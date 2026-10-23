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
      rooms[roomId] = { players: {}, bots: [] };
      if (data.mode === 'bots' || data.mode === 'br') {
        const numBots = data.mode === 'br' ? 15 : 5;
        for(let i=0; i<numBots; i++) {
          rooms[roomId].bots.push({
            id: 'bot_' + i, x: Math.random() * 80 - 40, z: Math.random() * 80 - 40, yaw: 0, health: 100, alive: true
          });
        }
      }
    }

    rooms[roomId].players[socket.id] = {
      username: data.username, x: Math.random() * 10 - 5, z: Math.random() * 10 - 5, yaw: 0, health: 100, kills: 0, skin: data.skin || 'Default'
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

    // Se acertou um jogador
    if (data.targetType === 'player' && room.players[data.targetId]) {
      room.players[data.targetId].health -= 25;
      
      if (room.players[data.targetId].health <= 0) {
        room.players[data.targetId].health = 100;
        room.players[data.targetId].x = Math.random() * 10 - 5;
        room.players[data.targetId].z = Math.random() * 10 - 5;
        
        if(room.players[socket.id]) {
          room.players[socket.id].kills++;
          
          // SE CHEGAR A 10 KILLS, É VITÓRIA!
          if (room.players[socket.id].kills >= 10) {
            io.to(socket.roomId).emit('gameOver', { winner: room.players[socket.id].username, id: socket.id });
            delete rooms[socket.roomId]; // Limpa a sala
            return;
          }
        }
        
        io.to(data.targetId).emit('died', { killer: room.players[socket.id].username });
      }

      io.to(socket.roomId).emit('playerHit', { id: data.targetId, health: room.players[data.targetId].health, killerId: socket.id });
      io.to(socket.roomId).emit('updateRoom', room);
    }
    
    // Se acertou um bot
    if (data.targetType === 'bot') {
      const bot = room.bots.find(b => b.id === data.targetId);
      if (bot && bot.alive) {
        bot.health -= 35;
        if (bot.health <= 0) { 
          bot.alive = false; 
          if(room.players[socket.id]) {
            room.players[socket.id].kills++; 
            // SE CHEGAR A 10 KILLS NO BOT, TAMBÉM É VITÓRIA
            if (room.players[socket.id].kills >= 10) {
              io.to(socket.roomId).emit('gameOver', { winner: room.players[socket.id].username, id: socket.id });
              delete rooms[socket.roomId];
              return;
            }
          }
        }
        io.to(socket.roomId).emit('updateRoom', room);
      }
    }
  });

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
