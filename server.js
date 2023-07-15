const express = require("express")
const app = express()
const cors = require("cors")
const http = require('http');
const PORT = 2003
const { Server } = require('socket.io');

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: `http://localhost:3000`,
        methods: ['GET', 'POST']
    }
});

const BOT = 'Bot';
const activeRooms = {};

io.on('connection', (socket) => {

    console.log(`${socket.id} just connected.`);

    socket.on('create-game', (data) => {
        const { userName, roomName } = data;

        if (activeRooms[roomName]) {
            socket.emit('room-already-exists');
            return;
        }

        else {

            const room = {
                roomName: roomName,
                users: [{ id: socket.id, userName: userName }]
            }
            activeRooms[roomName] = room;
    
            console.log(`${userName} has created room: ${roomName}`)
            
            socket.join(roomName);
            socket.emit('user-joined', data);

        }
    });

    socket.on('join-game', (data) => {

        const { userName, roomName } = data;
        const room = activeRooms[roomName];

        if (!room) {
            socket.emit('room-not-found');
            return
        }

        if (room.users.length >= 2) {
            socket.emit('room-full');
            return;
        }

        socket.join(roomName);
        room.users.push({ id: socket.id, userName });

        socket.emit('user-joined', data);
        io.in(roomName).emit('user-joined', data);

        socket.in(roomName).emit('get-chat', {
            message: `${userName} has joined the chat`,
            userName: BOT
        })

        console.log(`User ${userName} joined room ${roomName}`);

        if (room.users.length === 2) {
            socket.to(roomName).emit('both-connected', room.users);
        }

    });

    socket.on('request-username', (data) => {
        socket.in(data.roomName).emit('give-username', data.userName);
    });

    socket.on('send-chat', (data) => {
        io.in(data.roomName).emit('get-chat', data);
    });

    socket.on('leave-game', (data) => {

        const { roomName, userName } = data;
        const room = activeRooms[roomName];

        if (room) {
            room.users = room.users.filter((user) => user.id !== socket.id);
            socket.leave(room.roomName);
            console.log(`User ${userName} left room ${roomName}`);

            socket.in(roomName).emit('get-chat', {
                message: `${userName} has left the chat`,
                userName: BOT
            });

            // If the room is empty, remove it from the active rooms
            if (room.users.length === 0) {
                delete activeRooms[room.roomName];
                console.log(`Room ${room.roomName} is now empty and closed`);
            }
        }
    })
    
    socket.on('disconnect', () => {
        console.log(`${socket.id} has disconnected`);
        // Find the room containing the disconnected user
        const room = Object.values(activeRooms).find((r) =>
            r.users.some((user) => user.id === socket.id)
        );

        if (room) {
            
            let disconnectedUser;
            room.users.forEach(user => {
                if (user.id === socket.id) disconnectedUser = user;
            });

            // Remove the user from the room
            room.users = room.users.filter((user) => user.id !== socket.id);

            socket.in(room.roomName).emit('get-chat', {
                message: `${disconnectedUser.userName} has disconnected`,
                userName: BOT
            });

            // If the room is empty, remove it from the active rooms
            if (room.users.length === 0) {
                delete activeRooms[room.roomName];
                console.log(`Room ${room.roomName} is now empty and closed`);
            }
        }
    });

});

app.get('/', (req, res) => {
    res.json({msg: 'Hello World!'});
});

server.listen(PORT, () => {
    console.log(`\nserver listening on port: ${PORT}`);
})