const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// Estrutura para gerenciar salas
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function createRoom(hostSocketId, hostName) {
  let roomCode;
  do {
    roomCode = generateRoomCode();
  } while (rooms.has(roomCode));

  const room = {
    code: roomCode,
    host: { id: hostSocketId, name: hostName, symbol: 'X' },
    guest: null,
    gameStarted: false,
    board: Array(9).fill(''),
    currentPlayer: 1, // 1 = host (X), 2 = guest (O)
    gameOver: false,
    startTime: null
  };

  rooms.set(roomCode, room);
  return room;
}

function joinRoom(roomCode, guestSocketId, guestName) {
  const room = rooms.get(roomCode);
  if (!room || room.guest) return null;

  room.guest = { id: guestSocketId, name: guestName, symbol: 'O' };
  return room;
}

function getPlayerRoom(socketId) {
  for (const [code, room] of rooms) {
    if (room.host.id === socketId || (room.guest && room.guest.id === socketId)) {
      return { code, room };
    }
  }
  return null;
}

function isPlayerTurn(room, socketId) {
  if (room.currentPlayer === 1 && room.host.id === socketId) return true;
  if (room.currentPlayer === 2 && room.guest && room.guest.id === socketId) return true;
  return false;
}

function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // linhas
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // colunas
    [0, 4, 8], [2, 4, 6]             // diagonais
  ];

  for (let [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on('createRoom', (username) => {
    if (!username.trim()) return;

    const room = createRoom(socket.id, username);
    socket.join(room.code);
    
    socket.emit('roomCreated', {
      code: room.code,
      playerNumber: 1,
      symbol: 'X',
      username: username
    });

    console.log(`Sala ${room.code} criada por ${username}`);
  });

  socket.on('joinRoom', ({ roomCode, username }) => {
    if (!username.trim() || !roomCode.trim()) return;

    const room = joinRoom(roomCode.toUpperCase(), socket.id, username);
    if (!room) {
      socket.emit('joinError', 'Sala não encontrada ou já está cheia');
      return;
    }

    socket.join(roomCode);

    // Notificar ambos os jogadores
    socket.emit('roomJoined', {
      code: roomCode,
      playerNumber: 2,
      symbol: 'O',
      username: username,
      opponent: room.host.name
    });

    io.to(room.host.id).emit('playerJoined', {
      opponent: username
    });

    // Iniciar o jogo
    room.gameStarted = true;
    room.startTime = Date.now();
    
    io.to(roomCode).emit('gameStart', {
      host: room.host.name,
      guest: room.guest.name,
      currentPlayer: 1
    });

    console.log(`${username} entrou na sala ${roomCode}`);
  });

  socket.on('makeMove', ({ index }) => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { code, room } = playerRoom;

    if (!room.gameStarted || room.gameOver || room.board[index] !== '' || !isPlayerTurn(room, socket.id)) {
      return;
    }

    const symbol = socket.id === room.host.id ? 'X' : 'O';
    room.board[index] = symbol;
    room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;

    io.to(code).emit('moveMade', { index, symbol, nextPlayer: room.currentPlayer });

    // Verificar vitória
    const winner = checkWinner(room.board);
    if (winner) {
      room.gameOver = true;
      const winnerName = winner === 'X' ? room.host.name : room.guest.name;
      io.to(code).emit('gameEnd', { type: 'win', winner: winner, winnerName });
    } else if (!room.board.includes('')) {
      room.gameOver = true;
      io.to(code).emit('gameEnd', { type: 'draw' });
    }
  });

  socket.on('sendMessage', (message) => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { code, room } = playerRoom;
    const senderName = socket.id === room.host.id ? room.host.name : room.guest.name;
    
    socket.to(code).emit('messageReceived', { sender: senderName, message });
  });

  socket.on('requestNewGame', () => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { code } = playerRoom;
    socket.to(code).emit('newGameRequested');
  });

  socket.on('acceptNewGame', () => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { code, room } = playerRoom;
    
    // Reset da sala
    room.board = Array(9).fill('');
    room.currentPlayer = 1;
    room.gameOver = false;
    room.startTime = Date.now();

    io.to(code).emit('gameReset');
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);

    const playerRoom = getPlayerRoom(socket.id);
    if (playerRoom) {
      const { code, room } = playerRoom;
      
      // Notificar o outro jogador
      if (room.host.id === socket.id && room.guest) {
        io.to(room.guest.id).emit('playerDisconnected');
      } else if (room.guest && room.guest.id === socket.id) {
        io.to(room.host.id).emit('playerDisconnected');
      }

      // Remover a sala se não houver jogadores
      rooms.delete(code);
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`🎮 Servidor Jogo da Velha rodando na porta ${PORT}`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
});
