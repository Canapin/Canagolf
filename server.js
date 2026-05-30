"use strict";
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;
const basicAuth = require("express-basic-auth");

app.use(
  basicAuth({
    users: {
      user: "lescanards", // your password
    },
    challenge: true,
  }),
);

app.use(express.static(path.join(__dirname, "public")));
app.use("/maps", express.static(path.join(__dirname, "maps")));
app.use(express.json());

function localOnly(req, res, next) {
  const ip = req.ip;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1")
    return next();
  res.status(403).send("Forbidden");
}

app.get("/editor", (req, res) => {
  res.sendFile(path.join(__dirname, "editor", "editor.html"));
});

app.post("/editor/save", localOnly, (req, res) => {
  const { name, content, png } = req.body || {};
  if (!name || !content)
    return res.status(400).json({ error: "Missing name or content" });
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);
  if (!safe) return res.status(400).json({ error: "Invalid name" });
  const isJson = content.trim().startsWith("{");
  const ext = isJson ? ".json" : ".txt";
  fs.writeFileSync(path.join(__dirname, "maps", safe + ext), content, "utf8");
  if (png) {
    const buf = Buffer.from(png.replace(/^data:image\/png;base64,/, ""), "base64");
    fs.writeFileSync(path.join(__dirname, "maps", safe + ".png"), buf);
  }
  res.json({ ok: true, file: safe + ext });
});

app.get("/api/maps", (req, res) => {
  const seen = new Set();
  fs.readdirSync(path.join(__dirname, "maps"))
    .filter((f) => /^[a-zA-Z0-9_-]+\.(json|txt)$/.test(f))
    .forEach((f) => seen.add(f.replace(/\.(json|txt)$/, "")));
  res.json([...seen].sort());
});

app.get("/api/campaigns", (req, res) => {
  try {
    const dir = path.join(__dirname, "maps", "campaigns");
    const campaigns = fs.readdirSync(dir)
      .filter(f => f.endsWith(".json"))
      .sort()
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
    res.json(campaigns);
  } catch { res.json([]); }
});

// ── Room management ───────────────────────────────────────────────────────

const rooms = new Map(); // code → room

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from(
      { length: 4 },
      () => chars[(Math.random() * chars.length) | 0],
    ).join("");
  } while (rooms.has(code));
  return code;
}

function broadcastLobby(room) {
  io.to(room.code).emit("s:lobby", {
    players: room.players.map((p) => ({ id: p.id, name: p.name, isSpectator: !!p.isSpectator })),
    hostId: room.hostId,
  });
}

function loadMapText(mapName) {
  const safe = (mapName || "hole1").replace(/[^a-zA-Z0-9_-]/g, "") || "hole1";
  try {
    return fs.readFileSync(
      path.join(__dirname, "maps", safe + ".json"),
      "utf8",
    );
  } catch {}
  try {
    return fs.readFileSync(path.join(__dirname, "maps", safe + ".txt"), "utf8");
  } catch {}
  try {
    return fs.readFileSync(path.join(__dirname, "maps", "hole1.json"), "utf8");
  } catch {}
  return fs.readFileSync(path.join(__dirname, "maps", "hole1.txt"), "utf8");
}

function pickVariationMode() {
  const modes = ['none', 'h', 'v', 'b'];
  return modes[Math.floor(Math.random() * 4)];
}

function emitStartMap(room, roomCode) {
  const mapName = room.session.mapList[room.session.mapIndex];
  const mapText = loadMapText(mapName).replace(/^﻿/, '');
  const startIdx = (room.startingPlayerOffset + room.session.mapIndex) % room.players.length;
  room.currentPlayerIndex = startIdx;
  room.players.forEach((p) => {
    p.sunk = false;
    p.strokes = 0;
  });
  const variationMode = room.session.mapVariationModes?.[room.session.mapIndex];
  io.to(roomCode).emit("s:start", {
    mapText,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
    currentPlayerIndex: startIdx,
    variationMode,
  });
}

io.on("connection", (socket) => {
  let roomCode = null;

  socket.on("c:create", ({ name, isSpectator = false }) => {
    const code = makeCode();
    const room = {
      code,
      hostId: socket.id,
      players: [{ id: socket.id, name, strokes: 0, sunk: false, gaveUp: false, isSpectator }],
      started: false,
      over: false,
      currentPlayerIndex: 0,
      session: null,
    };
    rooms.set(code, room);
    roomCode = code;
    socket.join(code);
    socket.emit("s:created", { code, playerId: socket.id });
    broadcastLobby(room);
  });

  socket.on("c:join", ({ code, name, isSpectator = false }) => {
    const room = rooms.get(code.toUpperCase());
    if (!room) {
      socket.emit("s:error", { msg: "Room not found." });
      return;
    }
    if (room.started) {
      socket.emit("s:error", { msg: "Game already started." });
      return;
    }
    if (room.over) {
      socket.emit("s:error", { msg: "Game is over." });
      return;
    }
    if (room.players.length >= 8) {
      socket.emit("s:error", { msg: "Room is full." });
      return;
    }

    room.players.push({ id: socket.id, name, strokes: 0, sunk: false, gaveUp: false, isSpectator });
    roomCode = code.toUpperCase();
    socket.join(roomCode);
    socket.emit("s:joined", { code: roomCode, playerId: socket.id });
    broadcastLobby(room);
  });

  socket.on("c:start", ({ map, rounds = 1, mapVariation } = {}) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id || room.started) return;
    room.started = true;
    room.players = room.players.filter((p) => !p.isSpectator);

    // Build map list
    const allMaps = new Set();
    fs.readdirSync(path.join(__dirname, "maps"))
      .filter((f) => /^[a-zA-Z0-9_-]+\.(json|txt)$/.test(f))
      .forEach((f) => allMaps.add(f.replace(/\.(json|txt)$/, "")));
    const allMapArr = [...allMaps];

    let mapList;
    if (map.startsWith("__camp_")) {
      const campIdx = parseInt(map.slice(7));
      let campaigns = [];
      try {
        const dir = path.join(__dirname, "maps", "campaigns");
        campaigns = fs.readdirSync(dir)
          .filter(f => f.endsWith(".json"))
          .sort()
          .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
      } catch {}
      const camp = campaigns[campIdx];
      mapList = camp ? [...camp.maps] : [];
    } else if (map === "__random") {
      const pool = allMapArr.filter((m) => !m.startsWith("_"));
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      mapList = pool.slice(0, rounds);
    } else {
      const safe = (map || "hole1").replace(/[^a-zA-Z0-9_-]/g, "") || "hole1";
      mapList = [safe];
    }
    if (!mapList.length) mapList = ["hole1"];

    const mapVariationModes = mapVariation
      ? mapList.map(() => pickVariationMode()) : undefined;

    room.session = {
      mapList,
      mapIndex: 0,
      scores: Object.fromEntries(room.players.map((p) => [p.name, 0])),
      holeScores: [],
      mapVariationModes,
    };
    room.startingPlayerOffset = Math.floor(Math.random() * room.players.length);

    emitStartMap(room, roomCode);
  });

  socket.on("c:shot", ({ vx, vy }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.started) return;
    const current = room.players[room.currentPlayerIndex];
    if (current.id !== socket.id) return;

    current.strokes++;
    io.to(roomCode).emit("s:shot", {
      playerIndex: room.currentPlayerIndex,
      vx,
      vy,
      strokes: current.strokes,
    });
  });

  socket.on("c:stopped", ({ x, y, sunk, playerStates }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.started) return;
    const current = room.players[room.currentPlayerIndex];
    if (current.id !== socket.id) return;

    // Apply authoritative player states from the active client's simulation
    if (Array.isArray(playerStates)) {
      playerStates.forEach((s, i) => {
        if (room.players[i]) {
          room.players[i].sunk = room.players[i].sunk || s.sunk || s.eliminated;
        }
      });
    }

    if (sunk) {
      current.sunk = true;
      io.to(roomCode).emit("s:sink", {
        playerIndex: room.currentPlayerIndex,
        x,
        y,
      });
    } else {
      io.to(roomCode).emit("s:ballpos", {
        playerIndex: room.currentPlayerIndex,
        x,
        y,
      });
    }

    if (room.players.every((p) => p.sunk)) {
      const alive = room.players.filter(p => !p.gaveUp);
      const maxS = alive.length > 0 ? Math.max(...alive.map(p => p.strokes)) : 0;
      const session = room.session;
      session.holeScores.push(room.players.map((p) => ({
        name: p.name, strokes: p.gaveUp ? maxS + 5 : p.strokes,
      })));
      room.players.forEach((p) => {
        session.scores[p.name] = (session.scores[p.name] ?? 0) + (p.gaveUp ? maxS + 5 : p.strokes);
      });
      const cumPlayers = room.players.map((p) => ({
        name: p.name,
        strokes: session.scores[p.name],
      }));
      const isLast = session.mapIndex >= session.mapList.length - 1;
      if (isLast) {
        room.over = true;
        io.to(roomCode).emit("s:gameover", { players: cumPlayers, holeScores: session.holeScores });
      } else {
        io.to(roomCode).emit("s:holeover", {
          players: cumPlayers,
          holeIndex: session.mapIndex,
          totalHoles: session.mapList.length,
        });
      }
      return;
    }

    const n = room.players.length;
    let idx = (room.currentPlayerIndex + 1) % n;
    let tries = 0;
    while (room.players[idx].sunk && tries < n) {
      idx = (idx + 1) % n;
      tries++;
    }
    room.currentPlayerIndex = idx;

    io.to(roomCode).emit("s:turn", {
      currentPlayerIndex: room.currentPlayerIndex,
      playerStates: Array.isArray(playerStates) ? playerStates : undefined,
    });
  });

  socket.on("c:giveup", ({ playerIndex }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.started) return;
    const p = room.players[playerIndex];
    if (!p || p.id !== socket.id || p.sunk) return;
    p.gaveUp = true;
    p.sunk = true;
    io.to(roomCode).emit("s:playereliminated", { playerIndex, strokes: p.strokes });

    if (room.players.every(p2 => p2.sunk)) {
      const alive = room.players.filter(p2 => !p2.gaveUp);
      const maxS = alive.length > 0 ? Math.max(...alive.map(p2 => p2.strokes)) : 0;
      const session = room.session;
      session.holeScores.push(room.players.map(p2 => ({
        name: p2.name, strokes: p2.gaveUp ? maxS + 5 : p2.strokes,
      })));
      room.players.forEach(p2 => {
        session.scores[p2.name] = (session.scores[p2.name] ?? 0) + (p2.gaveUp ? maxS + 5 : p2.strokes);
      });
      const cumPlayers = room.players.map(p2 => ({
        name: p2.name, strokes: session.scores[p2.name],
      }));
      const isLast = session.mapIndex >= session.mapList.length - 1;
      if (isLast) {
        room.over = true;
        io.to(roomCode).emit("s:gameover", { players: cumPlayers, holeScores: session.holeScores });
      } else {
        io.to(roomCode).emit("s:holeover", {
          players: cumPlayers,
          holeIndex: session.mapIndex,
          totalHoles: session.mapList.length,
        });
      }
      return;
    }

    if (room.currentPlayerIndex === playerIndex) {
      const n = room.players.length;
      let idx = (room.currentPlayerIndex + 1) % n;
      let tries = 0;
      while (room.players[idx].sunk && tries < n) {
        idx = (idx + 1) % n;
        tries++;
      }
      room.currentPlayerIndex = idx;
      io.to(roomCode).emit("s:turn", { currentPlayerIndex: room.currentPlayerIndex });
    }
  });

  socket.on("c:nexthole", () => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;
    room.session.mapIndex++;
    emitStartMap(room, roomCode);
  });

  socket.on("c:close", () => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;
    if (!room.over) return;
    io.to(roomCode).emit("s:close");
    rooms.delete(roomCode);
  });

  socket.on("disconnect", () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const wasInPlayers = room.players.some((p) => p.id === socket.id);
    room.players = room.players.filter((p) => p.id !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(roomCode);
      return;
    }
    if (wasInPlayers && room.hostId === socket.id) room.hostId = room.players[0].id;
    if (!room.started) broadcastLobby(room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Canagolf running at http://localhost:${PORT}`);
});
