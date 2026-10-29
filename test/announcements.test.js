import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../server/rooms.js';
import { GAME_ANNOUNCEMENT_MS } from '../shared/sets.js';

function setup(mode = 'game-select') {
  let time = 100000;
  const service = new RoomService({ now: () => time, send() {} }), host = {}, guest = {};
  service.handle(host, { type: 'create', name: 'Host', mode, announceGates: true, assetGates: true });
  const room = service.rooms.get(host.room);
  service.handle(guest, { type: 'join', name: 'Guest', code: room.code, announceGates: true, assetGates: true });
  service.handle(host, { type: 'start' });
  return { service, host, guest, room, advance(ms) { time += ms; service.tick(); } };
}

test('Game Select opens instructions after two seconds regardless of audio acknowledgements', () => {
  const { service, host, guest, room, advance } = setup();
  const id = room.round.id;
  assert.equal(room.set.phase, 'announcing');
  service.handle(host, { type: 'announcement-done', roundId: 'stale' });
  assert.equal(room.set.phase, 'announcing');
  service.handle(host, { type: 'announcement-done', roundId: id });
  service.handle(host, { type: 'announcement-done', roundId: id });
  service.handle(host, { type: 'ready', ready: true });
  service.handle(guest, { type: 'assets-ready', roundId: id, ready: true });
  assert.equal(room.set.phase, 'announcing');
  assert.ok(room.players.every(player => !player.ready && player.assetRound === null));
  service.handle(guest, { type: 'announcement-done', roundId: id });
  advance(GAME_ANNOUNCEMENT_MS - 1);
  assert.equal(room.set.phase, 'announcing');
  advance(1);
  assert.equal(room.set.phase, 'instructions');
  assert.equal(room.round.phase, 'instructions');
  service.handle(guest, { type: 'announcement-done', roundId: id });
  assert.equal(room.set.phase, 'instructions');
});

test('disconnected players do not lengthen the announcement and stale messages cannot reopen a cancelled set', () => {
  const { service, host, guest, room, advance } = setup();
  service.disconnect(guest);
  service.handle(host, { type: 'announcement-done', roundId: room.round.id });
  advance(GAME_ANNOUNCEMENT_MS - 1);
  assert.equal(room.set.phase, 'announcing');
  advance(1);
  assert.equal(room.set.phase, 'instructions');
  const id = room.round.id;
  service.handle(host, { type: 'back-to-modes', setId: room.set.id });
  service.handle(host, { type: 'announcement-done', roundId: id });
  assert.equal(room.set, null);
  assert.equal(room.round, null);
});

test('Arcade keeps its existing shared reel rather than using the Game Select announcement gate', () => {
  const { room } = setup('arcade');
  assert.equal(room.set.phase, 'selecting');
  assert.ok(room.set.selectionEndAt > room.set.spinStartAt);
});
