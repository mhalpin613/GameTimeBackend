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

// todo refresh, game(s)
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
            socket.emit('joined', data);

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

        socket.emit('joined', data);
        io.in(roomName).emit('joined', data);

        const opponent = room.users.find((user) => user.id !== socket.id);
        io.in(roomName).emit('user-joined', { userName });
        socket.emit('user-joined', { userName: opponent.userName });

        if (room.users.length === 2) {
            io.in(roomName).emit('both-connected', room.users);
        }

        socket.in(roomName).emit('get-chat', {
            message: `${userName} has joined the chat`,
            userName: BOT
        })

        console.log(`User ${userName} joined room ${roomName}`);

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

            socket.in(room.roomName).emit('remove-opp');

            // If the room is empty, remove it from the active rooms
            if (room.users.length === 0) {
                delete activeRooms[room.roomName];
                console.log(`Room ${room.roomName} is now empty and closed`);
            }
        }
    });
    
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

            socket.in(room.roomName).emit('end-call');

            // Remove the user from the room
            room.users = room.users.filter((user) => user.id !== socket.id);

            socket.in(room.roomName).emit('get-chat', {
                message: `${disconnectedUser.userName} has disconnected`,
                userName: BOT
            });

            socket.in(room.roomName).emit('remove-opp');

            // If the room is empty, remove it from the active rooms
            if (room.users.length === 0) {
                delete activeRooms[room.roomName];
                console.log(`Room ${room.roomName} is now empty and closed`);
            }
        }
    });

    socket.on('call-user', data => {
        console.log('calling user')
        // todo emitting to is not working
        io.to(data.userToCall).emit('ringing', {
            signal: data.signalData, 
            from: data.from,
        });
    });

    socket.on('accept-call', data => {
        console.log('accepted call')
        console.log('emmitting to ' + data.to)
        io.to(data.to).emit('call-accepted', data.signal);
    });

    socket.on('start-game', data => {
        socket.emit('started', data.goFirst);
        socket.to(data.oppId).emit('started', !data.goFirst);
    });

    socket.on('update', data => {
        const { board, oppId } = data;
        socket.to(oppId).emit('board-state', board);
    });

    socket.on('give-winner', data => {
        socket.to(data.oppId).emit('winner', data.winner);
    });

    socket.on('restart', opp => {
        socket.to(opp).emit('handle-restart');
    });

});

app.get('/', (req, res) => {
    res.json({msg: 'Hello World!'});
});

server.listen(PORT, () => {
    console.log(`\nserver listening on port: ${PORT}`);
})