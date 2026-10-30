import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../server/rooms.js';

function setup() {
  let now = 1_000_000;
  const messages = [];
  const service = new RoomService({ now: () => now, send: (client, message) => messages.push({ client, message: structuredClone(message) }) });
  const clients = [{}, {}];
  service.handle(clients[0], { type: 'create', name: 'Host', mode: 'game-select' });
  const room = service.rooms.get(clients[0].room);
  service.handle(clients[1], { type: 'join', code: room.code, name: 'Guest' });
  service.handle(clients[0], { type: 'start' });
  const ready = () => clients.filter(client => client.room).forEach(client => {
    service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 });
    service.handle(client, { type: 'ready', ready: true });
  });
  const finish = (client, elapsed = 2000) => service.handle(client, { type: 'result', roundId: room.round.id, status: 'finished', elapsed, cleared: room.round.goal, mistakes: 0 });
  return { service, clients, room, messages, ready, finish, time: value => { now = value; } };
}

test('only the host can go back, retaining room membership and clearing readiness and round state', () => {
  const { service, clients, room, ready } = setup();
  const setId = room.set.id;
  service.handle(clients[1], { type: 'back-to-modes', setId });
  assert.equal(room.set.id, setId);
  service.handle(clients[0], { type: 'back-to-modes', setId: 'stale' });
  assert.equal(room.set.id, setId);
  ready();
  assert.equal(room.round.phase, 'countdown');
  service.handle(clients[0], { type: 'back-to-modes', setId });
  assert.equal(room.set, null);
  assert.equal(room.round, null);
  assert.equal(room.players.length, 2);
  assert.ok(room.players.every(player => !player.ready && !player.result));
  service.handle(clients[0], { type: 'configure', mode: 'arcade', game: 'mimicking-monkeys' });
  assert.equal(room.mode, 'arcade');
  service.handle(clients[0], { type: 'start' });
  service.handle(clients[0], { type: 'back-to-modes', setId });
  assert.ok(room.set);
  assert.notEqual(room.set.id, setId);
});

test('leaving an unfinished active round forfeits just that player and allows remaining players to finish', () => {
  const { service, clients, room, ready, finish, time, messages } = setup();
  ready();
  const departing = room.players[0].id;
  time(room.round.startAt + 4000);
  service.handle(clients[0], { type: 'leave' });
  assert.equal(clients[0].room, null);
  assert.ok(messages.some(item => item.client === clients[0] && item.message.type === 'left'));
  assert.equal(room.players.length, 1);
  assert.equal(room.hostId, room.players[0].id);
  assert.notEqual(room.round.phase, 'results');
  finish(clients[1]);
  assert.equal(room.round.phase, 'results');
  const departed = room.set.history[0].rows.find(row => row.playerId === departing);
  assert.equal(departed.result.status, 'forfeit');
  assert.equal(departed.points, 0);
  assert.equal(room.set.players.find(player => player.id === room.hostId).points, 10);
  time(room.set.nextStartAt);
  ready(); service.tick();
  assert.deepEqual(room.round.playerIds, [room.hostId]);
  time(room.round.startAt + 4000); finish(clients[1]);
  assert.equal(room.set.history[1].rows.find(row => row.playerId === departing).result.status, 'missing');
});

test('a departing finisher keeps an accepted result and cannot block settlement or duplicate awards', () => {
  const { service, clients, room, ready, finish, time } = setup();
  ready(); time(room.round.startAt + 4000);
  const departing = room.players[0].id;
  finish(clients[0], 1000);
  service.handle(clients[0], { type: 'leave' });
  finish(clients[1], 2000);
  assert.equal(room.round.phase, 'results');
  assert.equal(room.set.players.find(player => player.id === departing).points, 10);
  assert.equal(room.set.history[0].rows.find(row => row.playerId === departing).result.elapsed, 1000);
  service.tick();
  assert.equal(room.set.history.length, 1);
});

test('everyone may leave during countdown and the empty room is removed', () => {
  const { service, clients, room, ready } = setup();
  ready();
  service.handle(clients[0], { type: 'leave' });
  service.handle(clients[1], { type: 'leave' });
  assert.equal(service.rooms.has(room.code), false);
});


test('Game Select picker is shared, host controlled, cancellable, and starts the confirmed game', () => {
  const service = new RoomService({ now: () => 1_000_000, send() {} });
  const host = {}, guest = {};
  service.handle(host, { type: 'create', name: 'Host', mode: 'game-select' });
  const room = service.rooms.get(host.room);
  service.handle(guest, { type: 'join', code: room.code, name: 'Guest' });
  service.handle(guest, { type: 'open-game-picker' });
  assert.equal(service.snapshot(room).gameChoosing, false);
  service.handle(host, { type: 'open-game-picker' });
  assert.equal(service.snapshot(room).gameChoosing, true);
  assert.equal(room.set, null);
  service.handle(guest, { type: 'back-to-modes' });
  assert.equal(room.gameChoosing, true);
  service.handle(host, { type: 'back-to-modes' });
  assert.equal(room.gameChoosing, false);
  service.handle(host, { type: 'open-game-picker' });
  service.handle(host, { type: 'configure', mode: 'game-select', game: 'perm-mania' });
  assert.equal(room.gameChoosing, true);
  service.handle(host, { type: 'start' });
  assert.equal(room.gameChoosing, false);
  assert.deepEqual(room.set.plan, ['perm-mania', 'perm-mania', 'perm-mania']);
  service.handle(host, { type: 'open-game-picker' });
  assert.equal(room.gameChoosing, false);
});
