import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomService, RECONNECT_WAIT_MS } from '../server/rooms.js';
import { GAMES } from '../shared/games.js';
import { createSetPlan, arcadeLength, PARTY_PICK_MS } from '../shared/sets.js';

function setup(mode = 'party', count = 3) {
  let time = 100_000;
  const sent = [];
  const service = new RoomService({ now: () => time, send: (client, message) => sent.push({ client, message: structuredClone(message) }) });
  const clients = Array.from({ length: count }, () => ({}));
  service.handle(clients[0], { type: 'create', name: 'Host', mode });
  const room = service.roomFor(clients[0]);
  clients.slice(1).forEach((client, index) => service.handle(client, { type: 'join', code: room.code, name: `Guest ${index + 1}` }));
  return { service, room, clients, sent, at: value => { time = value; }, now: () => time };
}

test('Arcade length defaults to five, covers every allowed count without repeats and only the idle host can change it', () => {
  const { service, room, clients } = setup('arcade');
  assert.equal(room.arcadeLength, 5);
  for (let count = 3; count <= Object.keys(GAMES).length; count++) {
    const plan = createSetPlan('arcade', null, () => 0, undefined, count);
    assert.equal(plan.length, count); assert.equal(new Set(plan).size, count);
  }
  assert.equal(arcadeLength(NaN), 5);
  service.handle(clients[1], { type: 'arcade-length', value: 10 });
  assert.equal(room.arcadeLength, 5);
  for (const value of [2, 100, 4.5, '7']) service.handle(clients[0], { type: 'arcade-length', value });
  assert.equal(room.arcadeLength, 5);
  service.handle(clients[0], { type: 'arcade-length', value: Object.keys(GAMES).length });
  assert.equal(service.snapshot(room).arcadeLength, Object.keys(GAMES).length);
  service.handle(clients[0], { type: 'start' });
  assert.equal(room.set.plan.length, Object.keys(GAMES).length);
  service.handle(clients[0], { type: 'arcade-length', value: 3 });
  assert.equal(room.set.plan.length, Object.keys(GAMES).length);
});

test('Party locks are immutable, ordered by player, and unselected players receive a game exactly at the 30-second deadline', () => {
  const { service, room, clients, at, now } = setup();
  service.handle(clients[0], { type: 'start' });
  const set = room.set;
  assert.deepEqual(createSetPlan('party'), []);
  assert.equal(set.phase, 'party-picking'); assert.equal(set.pickEndAt, now() + PARTY_PICK_MS);
  const lock = (client, game, cycle = set.cycle) => service.handle(client, { type: 'party-lock', setId: set.id, cycle, game });
  lock(clients[1], 'jump-for-the-meat');
  lock(clients[1], 'totem-shrinker');
  lock(clients[0], 'unknown'); lock(clients[0], 'totem-shrinker', 0);
  assert.deepEqual(Object.values(set.choices), ['jump-for-the-meat']);
  at(set.pickEndAt - 1); service.tick(); assert.equal(set.phase, 'party-picking');
  at(set.pickEndAt); lock(clients[0], 'totem-shrinker');
  assert.equal(set.choices[room.players[0].id], undefined);
  service.tick();
  assert.equal(set.plan.length, 3); assert.equal(set.plan[1], 'jump-for-the-meat');
  assert.ok(set.plan.every(game => GAMES[game])); assert.equal(set.phase, 'instructions');
  const plan = [...set.plan]; service.tick(); lock(clients[1], 'totem-shrinker');
  assert.deepEqual(set.plan, plan);
});

test('Party plays every player pick, keeps points and wins across a unanimous continuation, and ignores stale cycle commands', () => {
  const state = setup('party', 2);
  const { service, room, clients, at } = state;
  service.handle(clients[0], { type: 'start' });
  const set = room.set;
  const pick = () => clients.forEach(client => service.handle(client, { type: 'party-lock', setId: set.id, cycle: set.cycle, game: 'jump-for-the-meat' }));
  pick();
  assert.deepEqual(set.plan, ['jump-for-the-meat', 'jump-for-the-meat']);
  assert.equal(set.phase, 'instructions');
  for (let index = 0; index < 2; index++) {
    clients.forEach(client => {
      service.handle(client, { type: 'sync', count: 5, rtt: 10, uncertainty: 1 });
      service.handle(client, { type: 'ready', ready: true });
    });
    assert.equal(set.phase, 'playing'); assert.equal(room.round.setRound, index + 1);
    clients.forEach((client, playerIndex) => {
      at(room.round.startAt + 2000 + playerIndex * 100);
      service.handle(client, { type: 'result', roundId: room.round.id, status: 'finished', elapsed: 2000 + playerIndex * 100, cleared: room.round.goal, mistakes: 0 });
    });
    if (index === 0) {
      assert.equal(set.phase, 'intermission'); at(set.resumeAt - 1); service.tick(); assert.equal(set.roundIndex, 0);
      at(set.resumeAt); service.tick(); assert.equal(set.phase, 'instructions');
    }
  }
  assert.equal(set.phase, 'complete'); assert.equal(set.history.length, 2);
  assert.equal(set.players[0].points, 20); assert.equal(set.players[0].wins, 2);
  const continueMessage = { type: 'party-continue', setId: set.id, cycle: set.cycle };
  service.handle(clients[0], continueMessage); assert.equal(set.phase, 'complete');
  service.disconnect(clients[1]);
  at(state.now() + RECONNECT_WAIT_MS - 1); service.tick(); assert.equal(set.phase, 'complete');
  at(state.now() + 1); service.tick(); assert.equal(set.phase, 'party-picking');
  assert.equal(set.cycle, 2); assert.equal(set.pickerIds.length, 1);
  assert.equal(set.players[0].points, 20); assert.equal(set.players[0].wins, 2);
  service.handle(clients[0], continueMessage); assert.equal(set.phase, 'party-picking');
  service.handle(clients[0], { type: 'party-lock', setId: set.id, cycle: 1, game: 'totem-shrinker' });
  assert.equal(Object.keys(set.choices).length, 0);
  service.handle(clients[0], { type: 'party-lock', setId: set.id, cycle: 2, game: 'totem-shrinker' });
  assert.equal(set.plan.length, 3); assert.equal(set.history.length, 2); assert.equal(set.roundIndex, 2);
  assert.equal(set.plan[2], 'totem-shrinker');
});

test('Party Continue needs every connected player, while Exit returns the whole room to modes', () => {
  const { service, room, clients } = setup('party', 2);
  service.handle(clients[0], { type: 'start' });
  room.set.phase = 'complete';
  const message = { type: 'party-continue', setId: room.set.id, cycle: room.set.cycle };
  clients.forEach(client => service.handle(client, { type: 'ready', ready: true }));
  assert.ok(room.players.every(player => !player.ready));
  service.handle(clients[0], message); assert.equal(room.set.phase, 'complete');
  service.handle(clients[1], message); assert.equal(room.set.phase, 'party-picking');
  room.set.phase = 'complete';
  service.handle(clients[1], { type: 'exit-set', setId: room.set.id });
  assert.equal(room.set, null); assert.equal(room.round, null); assert.ok(room.players.every(player => !player.ready));
});
