const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', (data) => {
    const roomId = data.roomId;
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { players: {}, bots: [], lastBotUpdate: Date.now() };
      if (data.mode === 'bots' || data.mode === 'br') {
        const numBots = data.mode === 'br' ? 10 : 5;
        for(let i=0; i<numBots; i++) {
          rooms[roomId].bots.push({
            id: 'bot_' + i, 
            x: Math.random() * 80 - 40, 
            z: Math.random() * 80 - 40, 
            yaw: 0, 
            health: 100, 
            alive: true,
            shootCooldown: 0
          });
        }
      }
    }

    rooms[roomId].players[socket.id] = {
      username: data.username, x: 0, z: 0, yaw: 0, health: 100, kills: 0, skin: data.skin || 'Default'
    };

    socket.roomId = roomId;
    io.to(roomId).emit('updateRoom', rooms[roomId]);
  });

  socket.on('move', (data) => {
    const room = rooms[socket.roomId];
    if (room && room.players[socket.id]) {
      room.players[socket.id].x = data.x;
      room.players[socket.id].z = data.z;
      room.players[socket.id].yaw = data.yaw;
      socket.to(socket.roomId).emit('playerMoved', { id: socket.id, data: room.players[socket.id] });
    }
  });

  socket.on('shoot', (data) => {
    const room = rooms[socket.roomId];
    if (!room) return;
    const shooter = room.players[socket.id];
    if (!shooter) return;

    // Tiro em jogador
    if (data.targetType === 'player' && room.players[data.targetId]) {
      const target = room.players[data.targetId];
      target.health -= 25;
      if (target.health <= 0) {
        target.health = 100; target.x = 0; target.z = 0;
        shooter.kills++;
        io.to(data.targetId).emit('died', { killer: shooter.username });
        checkWin(room, socket.id);
      }
      io.to(socket.roomId).emit('playerHit', { id: data.targetId, health: target.health, killerId: socket.id });
      io.to(socket.roomId).emit('updateRoom', room);
    }
    
    // Tiro em bot
    if (data.targetType === 'bot') {
      const bot = room.bots.find(b => b.id === data.targetId);
      if (bot && bot.alive) {
        bot.health -= 35;
        if (bot.health <= 0) { bot.alive = false; shooter.kills++; checkWin(room, socket.id); }
        io.to(socket.roomId).emit('updateRoom', room);
      }
    }
  });

  // Bots atacando jogadores
  socket.on('botAttack', (data) => {
    const room = rooms[socket.roomId];
    if (!room) return;
    const bot = room.bots.find(b => b.id === data.botId);
    const player = room.players[data.playerId];
    if (bot && bot.alive && player) {
      player.health -= 10; // Dano do bot
      io.to(socket.roomId).emit('playerHit', { id: data.playerId, health: player.health, killerId: bot.id });
      if (player.health <= 0) {
        player.health = 100; player.x = 0; player.z = 0;
        io.to(data.playerId).emit('died', { killer: 'Bot' });
      }
      io.to(socket.roomId).emit('updateRoom', room);
    }
  });

  function checkWin(room, socketId) {
    if (room.players[socketId] && room.players[socketId].kills >= 10) {
      io.to(socketId).emit('gameOver', { winner: room.players[socketId].username, id: socketId });
      delete rooms[socketId];
    }
  }

  socket.on('disconnect', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      delete rooms[socket.roomId].players[socket.id];
      io.to(socket.roomId).emit('updateRoom', rooms[socket.roomId]);
      if (Object.keys(rooms[socket.roomId].players).length === 0) delete rooms[socket.roomId];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
