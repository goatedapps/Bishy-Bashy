import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../server/rooms.js';
import { GAMES } from '../shared/games.js';
import { wheelRotation } from '../src/arcade-wheel.js';

test('every wheel segment lands exactly at the pointer and easing slows toward its chosen game', () => {
  const ids = Object.keys(GAMES);
  for (const [index, id] of ids.entries()) {
    assert.equal(wheelRotation(id, -1), 0);
    assert.equal(wheelRotation(id, 1), 2160 - index * 360 / ids.length);
    assert.equal(wheelRotation(id, 2), wheelRotation(id, 1));
    assert.ok(wheelRotation(id, .1) > wheelRotation(id, 1) - wheelRotation(id, .9));
  }
});

test('Arcade shares one selection, ignores repeated starts and premature readiness, and supports cancelling the wheel', () => {
  let now = 100000;
  const service = new RoomService({ now: () => now, send() {} });
  const host = {}, guest = {};
  service.handle(host, { type: 'create', name: 'Host', mode: 'arcade', assetGates: true });
  const room = service.rooms.get(host.room);
  service.handle(guest, { type: 'join', code: room.code, name: 'Friend', assetGates: true });
  service.handle(host, { type: 'configure', mode: 'arcade' });
  assert.equal(room.arcadePreview, true);
  service.handle(guest, { type: 'back-to-modes' });
  assert.equal(room.arcadePreview, true);
  service.handle(host, { type: 'back-to-modes' });
  assert.equal(room.arcadePreview, false);
  service.handle(host, { type: 'start' });
  const id = room.round.id, game = room.round.game;
  assert.equal(room.set.phase, 'selecting');
  service.handle(host, { type: 'start' });
  assert.equal(room.round.id, id);
  for (const client of [host, guest]) {
    service.handle(client, { type: 'sync', rtt: 10, uncertainty: 5, count: 5 });
    service.handle(client, { type: 'ready', ready: true });
  }
  assert.ok(room.players.every(player => !player.ready));
  now = room.set.spinEndAt - 1; service.tick();
  assert.equal(room.set.phase, 'selecting');
  now++; service.tick();
  assert.equal(room.set.phase, 'instructions');
  assert.equal(room.round.game, game);
  service.handle(host, { type: 'ready', ready: true });
  assert.equal(room.players[0].ready, false);
  service.handle(host, { type: 'assets-ready', roundId: 'stale', ready: true });
  assert.equal(room.players[0].assetRound, null);
  for (const client of [host, guest]) {
    service.handle(client, { type: 'assets-ready', roundId: id, ready: true });
    service.handle(client, { type: 'ready', ready: true });
  }
  assert.equal(room.set.phase, 'playing');
  service.handle(host, { type: 'back-to-modes', setId: room.set.id });
  assert.equal(room.set, null);
});
