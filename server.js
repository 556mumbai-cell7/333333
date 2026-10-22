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
      if (data.mode === 'bots') {
        for(let i=0; i<8; i++) {
          rooms[roomId].bots.push({
            id: 'bot_' + i, x: Math.random() * 40 - 20, z: Math.random() * 40 - 20, yaw: 0, health: 100, alive: true
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

    if (data.targetType === 'player' && room.players[data.targetId]) {
      room.players[data.targetId].health -= 25;
      
      if (room.players[data.targetId].health <= 0) {
        room.players[data.targetId].health = 100;
        room.players[data.targetId].x = Math.random() * 10 - 5;
        room.players[data.targetId].z = Math.random() * 10 - 5;
        if(room.players[socket.id]) room.players[socket.id].kills++;
        
        // Avisa o alvo que ele morreu (e que ganhou 100 diamantes no front-end)
        io.to(data.targetId).emit('died', { killer: room.players[socket.id].username });
        // Avisa o matador que ele matou
        io.to(socket.id).emit('killedSomeone', { victim: room.players[data.targetId].username });
      }

      io.to(socket.roomId).emit('playerHit', { id: data.targetId, health: room.players[data.targetId].health, killerId: socket.id });
      io.to(socket.roomId).emit('updateRoom', room);
    }
    
    if (data.targetType === 'bot') {
      const bot = room.bots.find(b => b.id === data.targetId);
      if (bot && bot.alive) {
        bot.health -= 35;
        if (bot.health <= 0) { 
          bot.alive = false; 
          if(room.players[socket.id]) room.players[socket.id].kills++; 
          io.to(socket.id).emit('killedSomeone', { victim: 'Bot' });
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
