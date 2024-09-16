// public/client.js
const socket = io();

socket.on('connect', () => {
  console.log('Connected to server');
  const playerName = prompt('Enter your name:');
  socket.emit('joinGame', { name: playerName, gameId: 'game1' });
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
