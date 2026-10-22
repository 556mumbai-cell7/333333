const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const players = {};

io.on('connection', (socket) => {
  // Cria o jogador na sala
  players[socket.id] = {
    x: Math.random() * 10 - 5,
    z: Math.random() * 10 - 5,
    yaw: 0,
    health: 100,
    kills: 0
  };

  io.emit('updatePlayers', players);

  // Movimento
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].z = data.z;
      players[socket.id].yaw = data.yaw;
      socket.broadcast.emit('playerMoved', { id: socket.id, data: players[socket.id] });
    }
  });

  // Tiro (Dano no outro jogador)
  socket.on('shoot', (data) => {
    const targetId = data.target;
    if (players[targetId]) {
      players[targetId].health -= 25; // Tira 25 de vida
      
      // Se morrer, reseta a vida e dá kill pro atirador
      if (players[targetId].health <= 0) {
        players[targetId].health = 100;
        players[targetId].x = Math.random() * 10 - 5;
        players[targetId].z = Math.random() * 10 - 5;
        if(players[socket.id]) players[socket.id].kills++;
      }

      // Avisa todo mundo sobre o dano
      io.emit('playerHit', { 
        id: targetId, 
        health: players[targetId].health,
        killer: socket.id,
        killerKills: players[socket.id] ? players[socket.id].kills : 0
      });
      
      io.emit('updatePlayers', players);
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('updatePlayers', players);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
