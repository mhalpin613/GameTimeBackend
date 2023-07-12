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
let users = [];

io.on('connection', (socket) => {
    console.log(`${socket.id} just connected.`);

    socket.on('join-room', (data) => {

        const { userName, roomName } = data;

        if (users.filter(user => user.roomName === roomName).length >= 2) {
            socket.emit('room-full');
            return;
        }

        socket.join(roomName);

        users.push({userName, id: socket.id, roomName});
        console.log(users);
          
        socket.to(roomName).emit('receive-message', {
            message: `${userName} has joined the chat`,
            userName: BOT,
        });
        // Send welcome msg to user that just joined chat only
        socket.emit('receive-message', {
            message: `${userName} has joined the chat`,
            userName: BOT,
        });

        if (io.sockets.adapter.rooms.get(roomName).size === 2) {
            socket.emit('both-connected', users)
            socket.to(roomName).emit('both-connected', users)
        }

    });

    socket.on('send-message', (data) => {
        io.in(data.roomName).emit('receive-message', data);
    });

    // todo functionality for only allowing rooms of 2
    socket.on('leave-room', (data) => {
        const { userName, roomName } = data;
        socket.leave(roomName);
        users = users.filter((user) => user.id != socket.id);
        socket.to(roomName).emit('receive-message', {
            userName: BOT,
            message: `${userName} has left the chat`,
        });
        console.log(`${userName} has left the chat`);
    });
    
    socket.on('disconnect', () => {
        console.log(`${socket.id} has disconnected`);
        const user = users.find((user) => user.id == socket.id);
        if (user?.userName) {
            users = users.filter((user) => user.id != socket.id);
            socket.to(user.roomName).emit('receive-message', {
                userName: BOT,
                message: `${user.userName} has disconnected from the chat.`,
            });
        }
    });
});

app.get('/', (req, res) => {
    res.json({msg: 'Hello World!'});
});

server.listen(PORT, () => {
    console.log(`\nserver listening on port: ${PORT}`);
})