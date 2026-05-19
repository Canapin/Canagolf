'use strict';
const express        = require('express');
const { createServer } = require('http');
const { Server }     = require('socket.io');
const path           = require('path');
const fs             = require('fs');

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer);
const PORT       = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/maps', express.static(path.join(__dirname, 'maps')));
app.use(express.json());

function localOnly(req, res, next) {
  const ip = req.ip;
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  res.status(403).send('Forbidden');
}

app.get('/editor', localOnly, (req, res) => {
  res.sendFile(path.join(__dirname, 'editor', 'editor.html'));
});

app.post('/editor/save', localOnly, (req, res) => {
  const { name, content } = req.body || {};
  if (!name || !content) return res.status(400).json({ error: 'Missing name or content' });
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  if (!safe) return res.status(400).json({ error: 'Invalid name' });
  fs.writeFileSync(path.join(__dirname, 'maps', safe + '.txt'), content, 'utf8');
  res.json({ ok: true, file: safe + '.txt' });
});

// Future: POST /maps/:name → map editor save endpoint

// ── Room management ───────────────────────────────────────────────────────

const rooms = new Map(); // code → room

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.random() * chars.length | 0]).join('');
  } while (rooms.has(code));
  return code;
}

function broadcastLobby(room) {
  io.to(room.code).emit('s:lobby', {
    players: room.players.map(p => ({ id: p.id, name: p.name })),
    hostId: room.hostId,
  });
}

io.on('connection', socket => {
  let roomCode = null;

  socket.on('c:create', ({ name }) => {
    const code = makeCode();
    const room = {
      code,
      hostId: socket.id,
      players: [{ id: socket.id, name, strokes: 0, sunk: false }],
      started: false,
      currentPlayerIndex: 0,
    };
    rooms.set(code, room);
    roomCode = code;
    socket.join(code);
    socket.emit('s:created', { code, playerId: socket.id });
    broadcastLobby(room);
  });

  socket.on('c:join', ({ code, name }) => {
    const room = rooms.get(code.toUpperCase());
    if (!room)           { socket.emit('s:error', { msg: 'Room not found.' });      return; }
    if (room.started)    { socket.emit('s:error', { msg: 'Game already started.' }); return; }
    if (room.players.length >= 8) { socket.emit('s:error', { msg: 'Room is full.' }); return; }

    room.players.push({ id: socket.id, name, strokes: 0, sunk: false });
    roomCode = code.toUpperCase();
    socket.join(roomCode);
    socket.emit('s:joined', { code: roomCode, playerId: socket.id });
    broadcastLobby(room);
  });

  socket.on('c:start', () => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id || room.started) return;
    room.started = true;

    const mapText = fs.readFileSync(path.join(__dirname, 'maps', 'hole1.txt'), 'utf8');
    io.to(roomCode).emit('s:start', {
      mapText,
      players: room.players.map(p => ({ id: p.id, name: p.name })),
      currentPlayerIndex: 0,
    });
  });

  socket.on('c:shot', ({ vx, vy }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.started) return;
    const current = room.players[room.currentPlayerIndex];
    if (current.id !== socket.id) return;

    current.strokes++;
    io.to(roomCode).emit('s:shot', {
      playerIndex: room.currentPlayerIndex,
      vx,
      vy,
      strokes: current.strokes,
    });
  });

  socket.on('c:stopped', ({ x, y, sunk }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.started) return;
    const current = room.players[room.currentPlayerIndex];
    if (current.id !== socket.id) return;

    if (sunk) {
      current.sunk = true;
      io.to(roomCode).emit('s:sink', { playerIndex: room.currentPlayerIndex, x, y });
    } else {
      io.to(roomCode).emit('s:ballpos', { playerIndex: room.currentPlayerIndex, x, y });
    }

    if (room.players.every(p => p.sunk)) {
      io.to(roomCode).emit('s:gameover', {
        players: room.players.map(p => ({ name: p.name, strokes: p.strokes })),
      });
      rooms.delete(roomCode);
      return;
    }

    const n = room.players.length;
    let idx = (room.currentPlayerIndex + 1) % n;
    let tries = 0;
    while (room.players[idx].sunk && tries < n) { idx = (idx + 1) % n; tries++; }
    room.currentPlayerIndex = idx;

    io.to(roomCode).emit('s:turn', { currentPlayerIndex: room.currentPlayerIndex });
  });

  socket.on('c:close', () => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;
    io.to(roomCode).emit('s:close');
    rooms.delete(roomCode);
  });

  socket.on('disconnect', () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    if (room.players.length === 0) { rooms.delete(roomCode); return; }
    if (room.hostId === socket.id) room.hostId = room.players[0].id;
    if (!room.started) broadcastLobby(room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Canagolf running at http://localhost:${PORT}`);
});
