const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = [];
let gameStarted = false;

io.on('connection', (socket) => {
  if (players.length < 2) {
    players.push(socket.id);
    socket.emit('playerNumber', players.length);

    if (players.length === 2) {
      gameStarted = true;
      io.emit('startGame');
    }
  }

  socket.on('playMove', (data) => {
    socket.broadcast.emit('opponentMove', data);
  });

  socket.on('sendMessage', (msg) => {
    socket.broadcast.emit('receiveMessage', msg);
  });

  socket.on('requestEndGame', () => {
    socket.broadcast.emit('confirmEndGame');
  });

  socket.on('acceptEndGame', () => {
    io.emit('gameEnded');
    players = [];
    gameStarted = false;
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p !== socket.id);
    io.emit('playerLeft');
  });
});

http.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});
