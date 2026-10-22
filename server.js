const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const players = {};

io.on('connection', (socket) => {
  console.log('Jogador conectado:', socket.id);

  // Quando o jogador entra, cria o boneco dele
  players[socket.id] = {
    x: Math.random() * 20 - 10,
    z: Math.random() * 20 - 10,
    yaw: 0,
    health: 100,
    kills: 0
  };

  // Manda a lista de jogadores para todo mundo
  io.emit('updatePlayers', players);

  // Recebe movimento e atira para os outros
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].z = data.z;
      players[socket.id].yaw = data.yaw;
      socket.broadcast.emit('playerMoved', { id: socket.id, data: players[socket.id] });
    }
  });

  socket.on('shoot', (data) => {
    socket.broadcast.emit('playerShot', { id: socket.id, target: data.target });
  });

  socket.on('disconnect', () => {
    console.log('Jogador saiu:', socket.id);
    delete players[socket.id];
    io.emit('updatePlayers', players);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
