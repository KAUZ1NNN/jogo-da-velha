const socket = io();
let playerNum;
let myTurn = false;
let timer = 0;
let interval = null;
let board = Array(9).fill('');
let gameOver = false;

let victories = 0;
let defeats = 0;
let draws = 0;
let username = '';
let opponentName = '';


const cells = document.querySelectorAll('.cell');

function start() {
    username = document.getElementById('username').value.trim();
    if (!username) return alert('Digite seu nome!');
    document.getElementById('login').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    socket.emit('setUsername', username);
  }
  

  socket.on('playerNumber', (num) => {
    playerNum = num;
  });
  socket.on('playersReady', ({ you, opponent }) => {
    opponentName = opponent;
    document.getElementById('player').innerText =
      `Você: ${you} (${playerNum === 1 ? 'X' : 'O'}) vs ${opponent}`;
  });
    

socket.on('startGame', () => {
  document.getElementById('player').innerText += " | Jogo iniciado!";
  myTurn = playerNum === 1;
  startTimer();
});

cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const index = cell.dataset.index;
    if (!myTurn || board[index] !== '' || gameOver) return;

    const symbol = playerNum === 1 ? 'X' : 'O';
    board[index] = symbol;
    cell.innerText = symbol;
    socket.emit('playMove', { index, symbol });
    myTurn = false;

    checkGameStatus();
  });
});

socket.on('opponentMove', ({ index, symbol }) => {
  board[index] = symbol;
  document.querySelector(`.cell[data-index="${index}"]`).innerText = symbol;
  myTurn = true;

  checkGameStatus();
});

function checkGameStatus() {
  const winner = checkWinner();

  if (winner) {
    gameOver = true;
    clearInterval(interval);
    showResult(winner === getSymbol() ? "Você venceu!" : "Você perdeu!");
    socket.emit('gameOver', winner);
  } else if (!board.includes('')) {
    gameOver = true;
    clearInterval(interval);
    showResult("Empate!");
    socket.emit('gameOver', "draw");
  }
}

function checkWinner() {
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

socket.on('gameOver', (result) => {
  if (result === "draw") {
    showResult("Empate!");
  } else if (result === getSymbol()) {
    showResult("Você venceu!");
  } else {
    showResult("Você perdeu!");
  }
  gameOver = true;
  clearInterval(interval);
});

function getSymbol() {
  return playerNum === 1 ? 'X' : 'O';
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  const msg = input.value.trim();
  if (msg) {
    addMessage(`Você: ${msg}`);
    socket.emit('sendMessage', msg);
    input.value = '';
  }
}

socket.on('receiveMessage', (msg) => {
  addMessage(`Adversário: ${msg}`);
});

function addMessage(msg) {
  const messages = document.getElementById('messages');
  messages.innerHTML += `<p>${msg}</p>`;
  messages.scrollTop = messages.scrollHeight;
}

function startTimer() {
  interval = setInterval(() => {
    timer++;
    document.getElementById('timer').innerText = `Tempo: ${timer}s`;
  }, 1000);
}

function requestEndGame() {
  if (confirm('Você deseja solicitar o fim da partida?')) {
    socket.emit('requestEndGame');
  }
}

socket.on('confirmEndGame', () => {
  if (confirm('Seu oponente deseja encerrar a partida. Aceita?')) {
    socket.emit('acceptEndGame');
  }
});

socket.on('gameEnded', () => {
  alert('A partida foi encerrada!');
  location.reload();
});

socket.on('playerLeft', () => {
  alert('Seu oponente saiu da partida.');
  location.reload();
});

function showResult(message) {
    if (message === "Você venceu!") victories++;
    if (message === "Você perdeu!") defeats++;
    if (message === "Empate!") draws++;
  
    updateScore();
  
    const resultCard = document.createElement('div');
    resultCard.id = 'resultCard';
    resultCard.innerHTML = `
      <div class="card">
        <h2>${message}</h2>
        <button onclick="restartGame()">Jogar Novamente</button>
        <button onclick="exitGame()">Sair</button>
      </div>
    `;
    document.body.appendChild(resultCard);
  }
  
  function updateScore() {
    document.getElementById('score').innerText =
      `Vitórias: ${victories} | Derrotas: ${defeats} | Empates: ${draws}`;
  }
  

function restartGame() {
  location.reload();
}

function exitGame() {
  window.close(); // No navegador, isso só funciona se a aba foi aberta via JavaScript
  alert("Feche a aba manualmente. (Limitação do navegador)");
}
