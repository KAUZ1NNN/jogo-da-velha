const socket = io();
let playerNum;
let myTurn = false;
let timer = 0;
let interval = null;

socket.on('playerNumber', (num) => {
  playerNum = num;
  document.getElementById('player').innerText = `Você é o Jogador ${playerNum} (${playerNum === 1 ? 'X' : 'O'})`;
});

socket.on('startGame', () => {
  document.getElementById('player').innerText += " | Jogo iniciado!";
  myTurn = playerNum === 1;
  startTimer();
});

document.querySelectorAll('.cell').forEach(cell => {
  cell.addEventListener('click', () => {
    if (!myTurn || cell.innerText !== '') return;
    const symbol = playerNum === 1 ? 'X' : 'O';
    cell.innerText = symbol;
    socket.emit('playMove', { index: cell.dataset.index, symbol });
    myTurn = false;
  });
});

socket.on('opponentMove', ({ index, symbol }) => {
  document.querySelector(`.cell[data-index="${index}"]`).innerText = symbol;
  myTurn = true;
});

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
