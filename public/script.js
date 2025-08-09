const socket = io();

// Game state
let gameState = {
  playerNumber: null,
  symbol: null,
  username: '',
  opponentName: '',
  roomCode: '',
  isMyTurn: false,
  gameStarted: false,
  gameOver: false,
  board: Array(9).fill(''),
  startTime: null,
  timerInterval: null
};

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
});

function initializeEventListeners() {
  // Enter key handlers
  document.getElementById('username').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createRoom();
  });

  document.getElementById('roomCode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
  });

  document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Room code input formatting
  document.getElementById('roomCode').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
  });

  // Board click events
  document.querySelectorAll('.cell').forEach(cell => {
    cell.addEventListener('click', () => makeMove(parseInt(cell.dataset.index)));
  });
}

// Room management
function createRoom() {
  const username = document.getElementById('username').value.trim();
  if (!username) {
    showToast('Por favor, digite seu nome!', 'error');
    return;
  }

  if (username.length > 20) {
    showToast('Nome muito longo! Use até 20 caracteres.', 'error');
    return;
  }

  gameState.username = username;
  socket.emit('createRoom', username);
  showScreen('waitingScreen');
  document.getElementById('waitingTitle').textContent = 'Criando sala...';
}

function joinRoom() {
  const username = document.getElementById('username').value.trim();
  const roomCode = document.getElementById('roomCode').value.trim();

  if (!username) {
    showToast('Por favor, digite seu nome!', 'error');
    return;
  }

  if (!roomCode || roomCode.length !== 5) {
    showToast('Por favor, digite um código válido de 5 letras!', 'error');
    return;
  }

  gameState.username = username;
  gameState.roomCode = roomCode;
  socket.emit('joinRoom', { roomCode, username });
  showScreen('waitingScreen');
  document.getElementById('waitingTitle').textContent = 'Entrando na sala...';
}

// Socket event handlers
socket.on('roomCreated', (data) => {
  gameState.playerNumber = data.playerNumber;
  gameState.symbol = data.symbol;
  gameState.roomCode = data.code;
  
  document.getElementById('displayRoomCode').textContent = data.code;
  document.getElementById('roomInfo').style.display = 'block';
  document.getElementById('waitingTitle').textContent = 'Aguardando jogador...';
  
  showToast('Sala criada com sucesso!', 'success');
});

socket.on('joinError', (message) => {
  showToast(message, 'error');
  showScreen('loginScreen');
});

socket.on('roomJoined', (data) => {
  gameState.playerNumber = data.playerNumber;
  gameState.symbol = data.symbol;
  gameState.opponentName = data.opponent;
  
  showToast('Sala encontrada!', 'success');
});

socket.on('playerJoined', (data) => {
  gameState.opponentName = data.opponent;
  showToast(`${data.opponent} entrou na sala!`, 'info');
});

socket.on('gameStart', (data) => {
  gameState.gameStarted = true;
  gameState.startTime = Date.now();
  gameState.isMyTurn = gameState.playerNumber === 1;
  
  setupGameScreen(data);
  showScreen('gameScreen');
  startTimer();
  
  showToast('Jogo iniciado!', 'success');
});

socket.on('moveMade', (data) => {
  const { index, symbol, nextPlayer } = data;
  
  gameState.board[index] = symbol;
  gameState.isMyTurn = nextPlayer === gameState.playerNumber;
  
  updateBoard(index, symbol);
  updateTurnIndicator();
});

socket.on('gameEnd', (data) => {
  gameState.gameOver = true;
  stopTimer();
  
  let resultType, resultTitle, resultMessage;
  
  if (data.type === 'win') {
    if (data.winner === gameState.symbol) {
      resultType = 'win';
      resultTitle = '🎉 Vitória!';
      resultMessage = 'Parabéns! Você venceu esta partida!';
    } else {
      resultType = 'lose';
      resultTitle = '😔 Derrota';
      resultMessage = `${data.winnerName} venceu esta partida.`;
    }
  } else {
    resultType = 'draw';
    resultTitle = '🤝 Empate!';
    resultMessage = 'Ninguém venceu desta vez!';
  }
  
  showResultModal(resultType, resultTitle, resultMessage);
  highlightWinningCells(data);
});

socket.on('messageReceived', (data) => {
  addMessage(data.message, 'opponent', data.sender);
});

socket.on('newGameRequested', () => {
  showNewGameModal();
});

socket.on('gameReset', () => {
  resetGame();
  closeAllModals();
  showToast('Nova partida iniciada!', 'success');
});

socket.on('playerDisconnected', () => {
  showToast('Seu oponente se desconectou', 'error');
  setTimeout(() => {
    showScreen('loginScreen');
    resetGameState();
  }, 3000);
});

// Game functions
function makeMove(index) {
  if (!gameState.isMyTurn || gameState.board[index] !== '' || gameState.gameOver) {
    return;
  }

  socket.emit('makeMove', { index });
}

function setupGameScreen(data) {
  document.getElementById('player1Name').textContent = data.host;
  document.getElementById('player2Name').textContent = data.guest;
  
  // Highlight current player
  updateTurnIndicator();
  
  addMessage('Jogo iniciado! Boa sorte! 🍀', 'system');
}

function updateBoard(index, symbol) {
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  cell.textContent = symbol;
  cell.classList.add(symbol.toLowerCase());
  
  // Add animation effect
  cell.style.animation = 'none';
  cell.offsetHeight; // Trigger reflow
  cell.style.animation = symbol === 'X' ? 'placeX 0.5s ease-out' : 'placeO 0.5s ease-out';
}

function updateTurnIndicator() {
  const player1Card = document.getElementById('player1Card');
  const player2Card = document.getElementById('player2Card');
  const turnText = document.getElementById('turnText');
  
  player1Card.classList.remove('active');
  player2Card.classList.remove('active');
  
  if (gameState.isMyTurn) {
    if (gameState.playerNumber === 1) {
      player1Card.classList.add('active');
    } else {
      player2Card.classList.add('active');
    }
    turnText.textContent = 'Sua vez!';
  } else {
    if (gameState.playerNumber === 1) {
      player2Card.classList.add('active');
    } else {
      player1Card.classList.add('active');
    }
    turnText.textContent = 'Aguarde...';
  }
}

function highlightWinningCells(gameEndData) {
  if (gameEndData.type !== 'win') return;
  
  // This would need the winning line data from server
  // For now, just highlight all cells with the winning symbol
  setTimeout(() => {
    document.querySelectorAll('.cell').forEach(cell => {
      if (cell.textContent === gameEndData.winner) {
        cell.classList.add('winning');
      }
    });
  }, 500);
}

// Chat functions
function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  if (message.length > 100) {
    showToast('Mensagem muito longa! Use até 100 caracteres.', 'error');
    return;
  }
  
  addMessage(message, 'own', 'Você');
  socket.emit('sendMessage', message);
  input.value = '';
}

function addMessage(text, type, sender = '') {
  const messagesContainer = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = `message ${type}`;
  
  if (type === 'system') {
    messageElement.textContent = text;
  } else {
    messageElement.textContent = text;
  }
  
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Auto-remove old messages to prevent memory issues
  const messages = messagesContainer.children;
  if (messages.length > 50) {
    messagesContainer.removeChild(messages[0]);
  }
}

// Timer functions
function startTimer() {
  let seconds = 0;
  gameState.timerInterval = setInterval(() => {
    seconds++;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById('timeText').textContent = 
      `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
}

function stopTimer() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
}

// Modal functions
function showResultModal(type, title, message) {
  const modal = document.getElementById('resultModal');
  const icon = document.getElementById('resultIcon');
  const titleEl = document.getElementById('resultTitle');
  const messageEl = document.getElementById('resultMessage');
  
  // Update icon based on result
  icon.className = `result-icon ${type}`;
  if (type === 'win') {
    icon.innerHTML = '<i class="fas fa-trophy"></i>';
  } else if (type === 'lose') {
    icon.innerHTML = '<i class="fas fa-times-circle"></i>';
  } else {
    icon.innerHTML = '<i class="fas fa-handshake"></i>';
  }
  
  titleEl.textContent = title;
  messageEl.textContent = message;
  
  modal.classList.add('show');
}

function showNewGameModal() {
  const modal = document.getElementById('newGameModal');
  modal.classList.add('show');
}

function closeResultModal() {
  document.getElementById('resultModal').classList.remove('show');
}

function closeNewGameModal() {
  document.getElementById('newGameModal').classList.remove('show');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('show');
  });
}

// Game actions
function requestNewGame() {
  closeAllModals();
  socket.emit('requestNewGame');
  showToast('Solicitação enviada...', 'info');
}

function acceptNewGame() {
  socket.emit('acceptNewGame');
  closeNewGameModal();
}

function declineNewGame() {
  closeNewGameModal();
  showToast('Nova partida recusada', 'info');
}

function leaveRoom() {
  if (confirm('Tem certeza que deseja sair da sala?')) {
    socket.disconnect();
    showScreen('loginScreen');
    resetGameState();
    showToast('Você saiu da sala', 'info');
  }
}

// Utility functions
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.className = `toast ${type} show`;
  toast.textContent = message;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function copyRoomCode() {
  const roomCode = document.getElementById('displayRoomCode').textContent;
  navigator.clipboard.writeText(roomCode).then(() => {
    showToast('Código copiado!', 'success');
  }).catch(() => {
    showToast('Erro ao copiar código', 'error');
  });
}

function resetGame() {
  gameState.board = Array(9).fill('');
  gameState.gameOver = false;
  gameState.isMyTurn = gameState.playerNumber === 1;
  gameState.startTime = Date.now();
  
  // Clear board
  document.querySelectorAll('.cell').forEach(cell => {
    cell.textContent = '';
    cell.className = 'cell';
  });
  
  // Reset timer
  stopTimer();
  startTimer();
  
  // Update turn indicator
  updateTurnIndicator();
}

function resetGameState() {
  stopTimer();
  
  gameState = {
    playerNumber: null,
    symbol: null,
    username: '',
    opponentName: '',
    roomCode: '',
    isMyTurn: false,
    gameStarted: false,
    gameOver: false,
    board: Array(9).fill(''),
    startTime: null,
    timerInterval: null
  };
  
  // Clear form inputs
  document.getElementById('username').value = '';
  document.getElementById('roomCode').value = '';
  document.getElementById('messageInput').value = '';
  
  // Clear chat messages
  document.getElementById('chatMessages').innerHTML = '';
  
  // Reset room info
  document.getElementById('roomInfo').style.display = 'none';
  document.getElementById('displayRoomCode').textContent = '-----';
  
  closeAllModals();
}

// Input validation
function validateUsername(username) {
  if (!username.trim()) {
    showToast('Por favor, digite seu nome!', 'error');
    return false;
  }
  
  if (username.length > 20) {
    showToast('Nome muito longo! Use até 20 caracteres.', 'error');
    return false;
  }
  
  // Check for inappropriate content (basic filter)
  const inappropriate = /(?:admin|moderator|bot|sistema)/i;
  if (inappropriate.test(username)) {
    showToast('Nome não permitido. Escolha outro nome.', 'error');
    return false;
  }
  
  return true;
}

function validateRoomCode(code) {
  if (!code.trim()) {
    showToast('Por favor, digite o código da sala!', 'error');
    return false;
  }
  
  if (code.length !== 5) {
    showToast('O código deve ter exatamente 5 letras!', 'error');
    return false;
  }
  
  if (!/^[A-Z]{5}$/.test(code)) {
    showToast('O código deve conter apenas letras!', 'error');
    return false;
  }
  
  return true;
}

// Enhanced error handling
socket.on('connect_error', (error) => {
  showToast('Erro de conexão. Tente novamente.', 'error');
  console.error('Connection error:', error);
});

socket.on('disconnect', (reason) => {
  showToast('Conexão perdida', 'error');
  
  if (reason === 'io client disconnect') {
    // User initiated disconnect
    return;
  }
  
  // Try to reconnect
  setTimeout(() => {
    if (socket.disconnected) {
      socket.connect();
    }
  }, 3000);
});

socket.on('reconnect', () => {
  showToast('Reconectado!', 'success');
});

// Accessibility improvements
document.addEventListener('keydown', (e) => {
  // ESC key to close modals
  if (e.key === 'Escape') {
    closeAllModals();
  }
  
  // Arrow keys for board navigation (accessibility)
  if (gameState.gameStarted && !gameState.gameOver) {
    const cells = document.querySelectorAll('.cell');
    const focusedCell = document.querySelector('.cell:focus');
    
    if (!focusedCell) return;
    
    const currentIndex = parseInt(focusedCell.dataset.index);
    let newIndex = currentIndex;
    
    switch (e.key) {
      case 'ArrowUp':
        if (currentIndex >= 3) newIndex = currentIndex - 3;
        break;
      case 'ArrowDown':
        if (currentIndex <= 5) newIndex = currentIndex + 3;
        break;
      case 'ArrowLeft':
        if (currentIndex % 3 > 0) newIndex = currentIndex - 1;
        break;
      case 'ArrowRight':
        if (currentIndex % 3 < 2) newIndex = currentIndex + 1;
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        makeMove(currentIndex);
        return;
    }
    
    if (newIndex !== currentIndex) {
      e.preventDefault();
      cells[newIndex].focus();
    }
  }
});

// Performance optimization - throttle rapid moves
let moveThrottle = false;
function makeMove(index) {
  if (moveThrottle) return;
  
  if (!gameState.isMyTurn || gameState.board[index] !== '' || gameState.gameOver) {
    if (!gameState.isMyTurn) {
      showToast('Aguarde sua vez!', 'error');
    }
    return;
  }

  moveThrottle = true;
  setTimeout(() => { moveThrottle = false; }, 100);

  socket.emit('makeMove', { index });
}

// Enhanced chat with emoji support
function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  if (message.length > 100) {
    showToast('Mensagem muito longa!', 'error');
    return;
  }
  
  addMessage(message, 'own');
  socket.emit('sendMessage', message);
  input.value = '';
}

// Add focus management for better UX
function makeCellsFocusable() {
  document.querySelectorAll('.cell').forEach((cell, index) => {
    cell.setAttribute('tabindex', gameState.board[index] === '' ? '0' : '-1');
  });
}

// Update cells focusability when board changes
function updateBoard(index, symbol) {
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  cell.textContent = symbol;
  cell.classList.add(symbol.toLowerCase());
  cell.setAttribute('tabindex', '-1');
  
  makeCellsFocusable();
}

// Page visibility API to handle tab switching
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden - could pause timer or show notification
    return;
  }
  
  // Page is visible again
  if (gameState.gameStarted && !gameState.isMyTurn) {
    showToast('É sua vez!', 'info');
  }
});

// Prevent accidental page reload during game
window.addEventListener('beforeunload', (e) => {
  if (gameState.gameStarted && !gameState.gameOver) {
    e.preventDefault();
    e.returnValue = 'Você tem uma partida em andamento. Tem certeza que deseja sair?';
  }
});

// Initialize on load
window.addEventListener('load', () => {
  showScreen('loginScreen');
  document.getElementById('username').focus();
});
