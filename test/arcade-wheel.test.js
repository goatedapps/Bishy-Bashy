import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../server/rooms.js';
import { GAMES } from '../shared/games.js';
import { reelStrip, reelPosition } from '../src/arcade-reel.js';
import { arcadeGameIds, createSetPlan } from '../shared/sets.js';

test('the reel lands exactly on the shared winner and has bounded travel for growing catalogs', () => {
  for (const count of [8, 40, 400]) {
    const ids = Array.from({ length: count }, (_, i) => `game-${i}`);
    for (const winner of ids) {
      const result = reelStrip(123, winner, ids);
      assert.deepEqual(result, reelStrip(123, winner, ids));
      assert.equal(result.strip[result.distance], winner);
      assert.ok(result.distance >= 48 && result.distance <= 60);
      assert.ok(result.strip.length <= 65);
      assert.equal(reelPosition(0, result.distance), 0);
      assert.equal(reelPosition(1, result.distance), result.distance);
      assert.equal(reelPosition(2, result.distance), result.distance);
      assert.ok(reelPosition(.5, result.distance) < reelPosition(.8, result.distance));
    }
  }
});

test('Arcade and its wheel expand only on four-game milestones, with new games available in Game Select immediately', () => {
  for (let count = 8; count <= 19; count++) {
    const catalog = Array.from({ length: count }, (_, index) => `game-${index}`);
    const eligible = arcadeGameIds(catalog);
    assert.deepEqual(eligible, catalog.slice(0, Math.floor(count / 4) * 4));
    assert.ok(createSetPlan('arcade', null, () => 0, catalog).every(id => eligible.includes(id)));
    assert.deepEqual(createSetPlan('game-select', catalog.at(-1)), Array(5).fill(catalog.at(-1)));
  }
  assert.equal(Object.keys(GAMES).length, 12);
  assert.equal(arcadeGameIds().length, 12);
  assert.deepEqual(arcadeGameIds(), Object.keys(GAMES));
  assert.ok(arcadeGameIds().includes('its-raining-coins'));
  assert.ok(arcadeGameIds().includes('dodge-or-die'));
});

test('Arcade shares one selection, ignores repeated starts and premature readiness, and supports cancelling the wheel', () => {
  let now = 100000;
  const service = new RoomService({ now: () => now, send() {} });
  const host = {}, guest = {};
  service.handle(host, { type: 'create', name: 'Host', mode: 'arcade', assetGates: true });
  const room = service.rooms.get(host.room);
  service.handle(guest, { type: 'join', code: room.code, name: 'Friend', assetGates: true });
  service.handle(host, { type: 'configure', mode: 'arcade' });
  const id = room.round.id, game = room.round.game;
  assert.equal(room.set.phase, 'selecting');
  service.handle(host, { type: 'start' });
  assert.equal(room.round.id, id);
  for (const client of [host, guest]) {
    service.handle(client, { type: 'sync', rtt: 10, uncertainty: 5, count: 5 });
    service.handle(client, { type: 'ready', ready: true });
  }
  assert.ok(room.players.every(player => !player.ready));
  now = room.set.spinEndAt; service.tick();
  assert.equal(room.set.phase, 'selecting');
  assert.equal(room.set.selectionEndAt - room.set.spinEndAt, 2000);
  service.handle(host, { type: 'ready', ready: true });
  assert.equal(room.players[0].ready, false);
  now = room.set.selectionEndAt - 1; service.tick();
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
