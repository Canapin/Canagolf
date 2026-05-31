"use strict";
const { EventEmitter } = require("events");
const path = require("path");
const fs = require("fs");
const { setupSocketHandlers } = require("../server.js");

let passed = 0, failed = 0;

function assert(condition, msg) {
  if (condition) { console.log(`  PASS  ${msg}`); passed++; }
  else { console.error(`  FAIL  ${msg}`); failed++; }
}

// ── Mocks ────────────────────────────────────────────────────────────────

class MockSocket extends EventEmitter {
  constructor(id) {
    super();
    this.id = id;
    this.emits = [];
    this.joinedRooms = new Set();
  }
  emit(event, data) {
    this.emits.push({ event, data });
    return super.emit(event, data);
  }
  join(room) { this.joinedRooms.add(room); }
}

class MockIo extends EventEmitter {
  constructor() {
    super();
    this.emits = [];
  }
  to(room) {
    const io = this;
    return {
      emit(event, data) { io.emits.push({ room, event, data }); },
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function fresh() {
  const io = new MockIo();
  const rooms = new Map();
  setupSocketHandlers(io, rooms);
  return { io, rooms };
}

function connect(io) {
  const s = new MockSocket("sock-" + Math.random().toString(36).slice(2, 8));
  io.emit("connection", s);
  return s;
}

function createRoom(io) {
  const host = connect(io);
  host.emit("c:create", { name: "Alice" });
  const created = host.emits.find(e => e.event === "s:created");
  return { host, code: created.data.code };
}

function joinRoom(io, code, name, isSpectator) {
  const p = connect(io);
  p.emit("c:join", { code, name, isSpectator: !!isSpectator });
  return p;
}

function startGame(host, opts) {
  host.emit("c:start", Object.assign({ map: "hole1" }, opts));
}

function activeSocket(host, player, room) {
  const activeId = room.players[room.currentPlayerIndex].id;
  return host.id === activeId ? host : player;
}

function sinkPlayer(socket, room, playerStates) {
  socket.emit("c:stopped", {
    x: 0, y: 0, sunk: true, playerStates,
  });
}

// ──────────────────────────────────────────────────────────────────────────

console.log("════════════════════════════════════════");
console.log("  Room & Ready System Tests");
console.log("════════════════════════════════════════\n");

// ── Test 1: Create + join room ───────────────────────────────────────────
{
  const { io, rooms } = fresh();
  const host = connect(io);
  host.emit("c:create", { name: "Alice" });
  const created = host.emits.find(e => e.event === "s:created");
  assert(!!created, "c:create emits s:created to host");
  const code = created.data.code;
  assert(code && code.length === 4, "Room code is 4 characters");

  const player = connect(io);
  player.emit("c:join", { code, name: "Bob" });
  const joined = player.emits.find(e => e.event === "s:joined");
  assert(!!joined, "c:join emits s:joined to player");

  const spec = connect(io);
  spec.emit("c:join", { code, name: "Charlie", isSpectator: true });
  const specJoined = spec.emits.find(e => e.event === "s:joined");
  assert(!!specJoined, "Spectator receives s:joined");

  const room = rooms.get(code);
  assert(room.players.length === 3, "Room has 3 players");
  assert(room.hostId === host.id, "Host is recorded");
  assert(room.players[2].isSpectator, "Third player is spectator");

  const lobby = io.emits.filter(e => e.event === "s:lobby");
  assert(lobby.length === 3, "s:lobby emitted after each join");
}

// ── Test 2: Start game ───────────────────────────────────────────────────
{
  const { io, rooms } = fresh();
  const host = connect(io);
  host.emit("c:create", { name: "Alice" });
  const code = host.emits.find(e => e.event === "s:created").data.code;

  joinRoom(io, code, "Bob");
  joinRoom(io, code, "Charlie", true); // spectator

  startGame(host, { map: "__random", rounds: 2 });
  const room = rooms.get(code);

  assert(room.started, "Room marked as started");
  assert(room.players.length === 2, "Spectator filtered out");
  assert(!room.players.find(p => p.isSpectator), "No spectator in players");
  assert(room.session.mapList.length === 2, "2 maps for 2-round game");

  const startEvent = io.emits.find(e => e.event === "s:start");
  assert(!!startEvent, "s:start emitted to room");
  assert(startEvent.data.players.length === 2, "s:start has 2 players (no spectator)");
  assert(!!startEvent.data.mapText, "s:start has map text");
}

// ── Test 3: Holeover via all-sink ────────────────────────────────────────
{
  const { io, rooms } = fresh();
  const host = connect(io);
  host.emit("c:create", { name: "Alice" });
  const code = host.emits.find(e => e.event === "s:created").data.code;
  const player = joinRoom(io, code, "Bob");
  startGame(host, { map: "__random", rounds: 2 });
  const room = rooms.get(code);

  // Mark first player as ready so turn advances, then sink both
  const first = activeSocket(host, player, room);
  const second = first === host ? player : host;

  first.emit("c:shot", { vx: 1, vy: 0 });
  sinkPlayer(first, room, [
    { x: 0, y: 0, sunk: first.id === host.id, eliminated: false },
    { x: 1, y: 1, sunk: first.id !== host.id, eliminated: false },
  ]);

  second.emit("c:shot", { vx: 1, vy: 0 });
  sinkPlayer(second, room, [
    { x: 0, y: 0, sunk: true, eliminated: false },
    { x: 1, y: 1, sunk: true, eliminated: false },
  ]);

  const holeover = io.emits.find(e => e.event === "s:holeover");
  assert(!!holeover, "s:holeover emitted after both sink");
  assert(holeover.data.players.length === 2, "holeover has 2 players");
  assert(typeof holeover.data.players[0].id === "string", "holeover players have id");
  assert(typeof holeover.data.players[0].strokes === "number", "holeover players have per-hole strokes");
  assert(room.players.every(p => !p.ready), "ready reset to false after holeover");
}

// ── Test 4: Holeover via give-up + sink ──────────────────────────────────
{
  const { io, rooms } = fresh();
  const host = connect(io);
  host.emit("c:create", { name: "Alice" });
  const code = host.emits.find(e => e.event === "s:created").data.code;
  const player = joinRoom(io, code, "Bob");
  startGame(host, { map: "__random", rounds: 2 });
  const room = rooms.get(code);

  const first = activeSocket(host, player, room);
  const second = first === host ? player : host;

  first.emit("c:shot", { vx: 1, vy: 0 });
  sinkPlayer(first, room, [
    { x: 0, y: 0, sunk: first.id === host.id, eliminated: false },
    { x: 1, y: 1, sunk: first.id !== host.id, eliminated: false },
  ]);

  // Second player gives up
  const secondIdx = room.players.findIndex(p => p.id === second.id);
  second.emit("c:giveup", { playerIndex: secondIdx });
  const elim = io.emits.find(e => e.event === "s:playereliminated");
  assert(!!elim, "s:playereliminated emitted after give-up");

  const holeover = io.emits.find(e => e.event === "s:holeover");
  assert(!!holeover, "s:holeover emitted after give-up + sink");
  assert(holeover.data.players.length === 2, "holeover has 2 players");
  assert(typeof holeover.data.players[0].id === "string", "holeover players have id");
}

// ── Test 5: Ready → auto-advance ─────────────────────────────────────────
{
  const { io, rooms } = fresh();
  const host = connect(io);
  host.emit("c:create", { name: "Alice" });
  const code = host.emits.find(e => e.event === "s:created").data.code;
  const player = joinRoom(io, code, "Bob");
  startGame(host, { map: "__random", rounds: 2 });
  const room = rooms.get(code);

  const first = activeSocket(host, player, room);
  const second = first === host ? player : host;

  first.emit("c:shot", { vx: 1, vy: 0 });
  sinkPlayer(first, room, [
    { x: 0, y: 0, sunk: first.id === host.id, eliminated: false },
    { x: 1, y: 1, sunk: first.id !== host.id, eliminated: false },
  ]);

  second.emit("c:shot", { vx: 1, vy: 0 });
  sinkPlayer(second, room, [
    { x: 0, y: 0, sunk: true, eliminated: false },
    { x: 1, y: 1, sunk: true, eliminated: false },
  ]);

  const holeover = io.emits.find(e => e.event === "s:holeover");
  assert(!!holeover, "s:holeover emitted");

  // Both players ready up
  host.emit("c:ready");
  player.emit("c:ready");

  const playerready = io.emits.filter(e => e.event === "s:playerready");
  assert(playerready.length === 2, "s:playerready emitted for both players");

  const startEvents = io.emits.filter(e => e.event === "s:start");
  assert(startEvents.length === 2, "s:start emitted twice (initial + auto-advance)");
  assert(room.session.mapIndex === 1, "mapIndex advanced to 1");
}

// ── Test 6: Host force-advance ──────────────────────────────────────────
{
  const { io, rooms } = fresh();
  const host = connect(io);
  host.emit("c:create", { name: "Alice" });
  const code = host.emits.find(e => e.event === "s:created").data.code;
  const player = joinRoom(io, code, "Bob");
  startGame(host, { map: "__random", rounds: 2 });
  const room = rooms.get(code);

  const first = activeSocket(host, player, room);
  const second = first === host ? player : host;

  first.emit("c:shot", { vx: 1, vy: 0 });
  sinkPlayer(first, room, [
    { x: 0, y: 0, sunk: first.id === host.id, eliminated: false },
    { x: 1, y: 1, sunk: first.id !== host.id, eliminated: false },
  ]);

  second.emit("c:shot", { vx: 1, vy: 0 });
  sinkPlayer(second, room, [
    { x: 0, y: 0, sunk: true, eliminated: false },
    { x: 1, y: 1, sunk: true, eliminated: false },
  ]);

  // Host force-advances (no ready from player)
  host.emit("c:nexthole");
  assert(room.session.mapIndex === 1, "mapIndex advanced by force");
  assert(room.players.every(p => !p.ready), "ready reset after force-advance");

  const startEvents = io.emits.filter(e => e.event === "s:start");
  assert(startEvents.length === 2, "s:start emitted on force-advance");
}

// ── Test 7: Non-host force rejected ──────────────────────────────────────
{
  const { io, rooms } = fresh();
  const host = connect(io);
  host.emit("c:create", { name: "Alice" });
  const code = host.emits.find(e => e.event === "s:created").data.code;
  const player = joinRoom(io, code, "Bob");
  startGame(host, { map: "__random", rounds: 2 });
  const room = rooms.get(code);

  const first = activeSocket(host, player, room);
  const second = first === host ? player : host;

  first.emit("c:shot", { vx: 1, vy: 0 });
  sinkPlayer(first, room, [
    { x: 0, y: 0, sunk: first.id === host.id, eliminated: false },
    { x: 1, y: 1, sunk: first.id !== host.id, eliminated: false },
  ]);

  second.emit("c:shot", { vx: 1, vy: 0 });
  sinkPlayer(second, room, [
    { x: 0, y: 0, sunk: true, eliminated: false },
    { x: 1, y: 1, sunk: true, eliminated: false },
  ]);

  const startCountBefore = io.emits.filter(e => e.event === "s:start").length;

  // Non-host tries to force-advance
  player.emit("c:nexthole");
  assert(room.session.mapIndex === 0, "mapIndex unchanged after non-host force attempt");

  const startCountAfter = io.emits.filter(e => e.event === "s:start").length;
  assert(startCountAfter === startCountBefore, "No s:start emitted for non-host force");
}

// ── Test 8: Spectator ready ignored ──────────────────────────────────────
{
  const { io, rooms } = fresh();
  const host = connect(io);
  host.emit("c:create", { name: "Alice" });
  const code = host.emits.find(e => e.event === "s:created").data.code;
  joinRoom(io, code, "Bob");
  const spec = joinRoom(io, code, "Charlie", true);
  startGame(host, { map: "__random", rounds: 2 });

  // Spectator tries to ready
  spec.emit("c:ready");
  const specReady = io.emits.find(e => e.event === "s:playerready");
  assert(!specReady, "No s:playerready emitted for spectator");

  // Host can still ready normally
  host.emit("c:ready");
  const hostReady = io.emits.find(e => e.event === "s:playerready");
  assert(!!hostReady, "Host can ready after spectator ready attempt");
}

// ── Test 9: Room cleanup on disconnect ───────────────────────────────────
{
  const { io, rooms } = fresh();
  const host = connect(io);
  host.emit("c:create", { name: "Alice" });
  const code = host.emits.find(e => e.event === "s:created").data.code;

  assert(rooms.size === 1, "Room exists after create");

  // Host disconnects → room should be deleted (only player)
  host.emit("disconnect");
  assert(rooms.size === 0, "Room deleted when last player disconnects");
}

// ── Test 9b: Room persists when non-last player disconnects ──────────────
{
  const { io, rooms } = fresh();
  const host = connect(io);
  host.emit("c:create", { name: "Alice" });
  const code = host.emits.find(e => e.event === "s:created").data.code;
  const player = joinRoom(io, code, "Bob");

  // Player disconnects (not last)
  player.emit("disconnect");
  assert(rooms.size === 1, "Room persists when non-last player disconnects");
  assert(rooms.get(code).players.length === 1, "Room has 1 player remaining");
}

// ── Summary ──────────────────────────────────────────────────────────────
console.log("\n════════════════════════════════════════");
console.log(`  ${passed} passed  ${failed} failed`);
console.log("════════════════════════════════════════");
if (failed > 0) process.exit(1);
