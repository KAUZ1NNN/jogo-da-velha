const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = [];
let usernames = {};
let gameStarted = false;

io.on('connection', (socket) => {

  socket.on('setUsername', (name) => {
    usernames[socket.id] = name;

    if (!players.includes(socket.id)) {
      players.push(socket.id);
    }

    if (players.length === 2 && !gameStarted) {
        gameStarted = true;
      
      const player1 = usernames[players[0]];
      const player2 = usernames[players[1]];

      io.to(players[0]).emit('playerNumber', 1);
      io.to(players[1]).emit('playerNumber', 2);

      io.to(players[0]).emit('playersReady', { you: player1, opponent: player2 });
      io.to(players[1]).emit('playersReady', { you: player2, opponent: player1 });

      io.emit('startGame');
    }
  });

  socket.on('playMove', (data) => {
    socket.broadcast.emit('opponentMove', data);
  });

  socket.on('gameOver', (result) => {
    socket.broadcast.emit('gameOver', result);
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
    usernames = {};
    gameStarted = false;
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p !== socket.id);
    delete usernames[socket.id];
  
    // Se menos de 2 jogadores, encerre o jogo e informe
    if (players.length < 2 && gameStarted) {
      gameStarted = false;
      io.emit('playerLeft');
    }
  });
  
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
