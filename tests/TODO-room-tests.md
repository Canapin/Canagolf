# Room / ready system server-side tests ✅ DONE

Add to `tests/simulate.js` or new `tests/room.js`.

Tested in `tests/room.js` — 39 tests, all passing.

## Approach

- `require('net')` fake socket stub: `{ id, emit, join, on }`
- `require` server.js? No — extract room logic or mock socket.io.
  Better: write test that imports `server.js` after monkey-patching `io`.
  Or: write self-contained test that duplicates the `rooms` Map + handler logic.

Simpler: copy the `rooms` Map and `c:*` handler code into the test file
(they're pure functions of `(socket, io)`) and call them directly.

## Test scenarios

1. **Create + join**: host creates, player joins, spectator joins →
   assert room has 3 players, hostId set, `s:lobby` emitted.

2. **Start game**: host `c:start` → assert `room.started`, `s:start` emitted
   with player list (spectator filtered out).

3. **Holeover via all-sink**: both players sink → assert `s:holeover` emitted
   with `players[i].id`, `ready` reset to false.

4. **Holeover via give-up**: one gives up, other sinks → same assertion.

5. **Ready → auto-advance**: after `s:holeover`, both players `c:ready` →
   assert `s:start` emitted (mapIndex incremented).

6. **Host force-advance**: host `c:nexthole` → assert `s:start` emitted,
   `ready` reset.

7. **Non-host force rejected**: non-host `c:nexthole` → assert no `s:start`.

8. **Spectator ready ignored**: spectator `c:ready` → assert no `s:playerready`,
   room state unchanged.

9. **Room cleanup**: last player disconnects → assert room deleted.
