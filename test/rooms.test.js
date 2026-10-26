import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../server/rooms.js';

function setup(count = 2) {
  let time = 1_000_000;
  const sent = new Map();
  const service = new RoomService({ now: () => time, send: (client, message) => { if (!sent.has(client)) sent.set(client, []); sent.get(client).push(structuredClone(message)); } });
  const clients = Array.from({ length: count }, () => ({}));
  service.handle(clients[0], { type: 'create', name: 'First' });
  const code = clients[0].room;
  for (let i = 1; i < count; i++) service.handle(clients[i], { type: 'join', code, name: `Player ${i + 1}` });
  const room = service.rooms.get(code);
  const start = (mode = 'sync') => {
    clients.forEach(client => { service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 }); service.handle(client, { type: 'ready', ready: true }); });
    service.handle(clients[0], { type: 'start', mode });
  };
  return { service, clients, room, sent, start, setTime: value => { time = value; } };
}

test('four slots, private resume credentials, and host-only start', () => {
  const { service, clients, room, sent } = setup(4);
  const fifth = {};
  service.handle(fifth, { type: 'join', code: room.code, name: 'Fifth' });
  assert.match(sent.get(fifth).at(-1).message, /four players/);
  assert.equal(room.players.length, 4);
  assert.equal(JSON.stringify(service.snapshot(room)).includes(room.players[0].token), false);
  service.handle(clients[1], { type: 'start' });
  assert.match(sent.get(clients[1]).at(-1).message, /host/);
  assert.equal(room.round, null);
});

test('totem starts share a seed and throttle monotonic progress owned by the connection', () => {
  const { service, clients, room, start, setTime, sent } = setup(4);
  start('totem-shrinker');
  const round = room.round;
  assert.equal(round.duration, 45_000);
  assert.equal(round.blockCount, 30);
  assert.equal(round.freezeMs, 300);
  for (const client of clients) assert.equal(sent.get(client).at(-1).room.round.seed, round.seed);
  const progress = { type: 'progress', roundId: round.id, cleared: 3, mistakes: 1, playerId: room.players[1].id };
  service.handle(clients[0], progress);
  assert.equal(room.players[0].progress.cleared, 0);
  setTime(round.startAt + 1000);
  service.handle(clients[0], progress);
  assert.deepEqual(room.players[0].progress, { cleared: 3, mistakes: 1 });
  assert.equal(room.players[1].progress.cleared, 0);
  service.handle(clients[0], { ...progress, cleared: 4 });
  assert.equal(room.players[0].progress.cleared, 3);
  setTime(round.startAt + 1300);
  for (const cleared of [2, 31, 4.5]) service.handle(clients[0], { ...progress, cleared });
  assert.equal(room.players[0].progress.cleared, 3);
  service.handle(clients[0], { ...progress, cleared: 5 });
  assert.equal(room.players[0].progress.cleared, 5);
});

test('totem rejects incomplete finishes and preserves a faster result arriving after reconnect', () => {
  const { service, clients, room, start, setTime, sent } = setup();
  start('totem-shrinker');
  const round = room.round;
  const result = { type: 'result', roundId: round.id, status: 'finished', elapsed: 1800, cleared: 29, mistakes: 0 };
  setTime(round.startAt + 2000);
  service.handle(clients[0], result);
  assert.equal(room.players[0].result, null);
  service.handle(clients[1], { ...result, cleared: 30, elapsed: 1900 });
  const token = room.players[0].token;
  service.disconnect(clients[0]);
  setTime(round.endAt + 9000);
  const returning = {};
  service.handle(returning, { type: 'join', code: room.code, token, name: 'First' });
  service.handle(returning, { ...result, cleared: 30 });
  assert.equal(room.round.phase, 'results');
  assert.equal(room.players[0].result.elapsed, 1800);
  assert.equal(room.players[0].progress.cleared, 30);
  service.handle(returning, { ...result, cleared: 30, elapsed: 1 });
  assert.equal(room.players[0].result.elapsed, 1800);
  assert.equal(sent.get(returning).at(-1).type, 'result-ack');
});

test('host can start after the 15-second reconnect wait, and a returning spectator cannot submit', () => {
  const { service, clients, room, setTime, sent } = setup();
  const token = room.players[1].token;
  service.disconnect(clients[1]);
  service.handle(clients[0], { type: 'sync', rtt: 20, uncertainty: 10, count: 5 });
  service.handle(clients[0], { type: 'ready', ready: true });
  service.handle(clients[0], { type: 'start' });
  assert.equal(room.round, null);
  assert.match(sent.get(clients[0]).at(-1).message, /15 seconds/);
  setTime(1_015_000);
  service.handle(clients[0], { type: 'start' });
  assert.deepEqual(room.round.playerIds, [room.players[0].id]);
  const returning = {};
  service.handle(returning, { type: 'join', code: room.code, name: 'Second', token });
  setTime(room.round.startAt + 2000);
  service.handle(returning, { type: 'result', roundId: room.round.id, status: 'finished', elapsed: 1000, cleared: 30, mistakes: 0 });
  assert.equal(room.players[1].result.status, 'missing');
  assert.match(sent.get(returning).at(-1).message, /unknown/);
});

test('all devices receive the same scheduled start and need fresh samples', () => {
  const { service, clients, room, sent, start, setTime } = setup(4);
  service.handle(clients[0], { type: 'ready', ready: true });
  assert.equal(room.players[0].ready, false);
  start();
  assert.equal(room.round.startAt, 1_005_000);
  for (const client of clients) assert.equal(sent.get(client).at(-1).room.round.startAt, room.round.startAt);
  setTime(room.round.expiresAt); service.tick();
  room.players.forEach(player => { player.ready = true; });
  service.handle(clients[0], { type: 'start' });
  assert.equal(room.testNumber, 1);
});

test('late arrival keeps a faster local result and duplicates are acknowledged', () => {
  const { service, clients, room, start, setTime, sent } = setup();
  start();
  setTime(room.round.startAt + 2200);
  service.handle(clients[1], { type: 'result', roundId: room.round.id, status: 'finished', elapsed: 2100, playerId: room.players[0].id });
  assert.equal(room.players[0].result, null);
  setTime(room.round.startAt + 4500);
  const result = { type: 'result', roundId: room.round.id, status: 'finished', elapsed: 1000, goDelay: 8 };
  service.handle(clients[0], result);
  assert.equal(room.round.phase, 'results');
  assert.equal(room.players[0].result.elapsed, 1000);
  assert.equal(room.players[0].result.arrivalLag, 3500);
  const accepted = structuredClone(room.players[0].result);
  service.handle(clients[0], { ...result, elapsed: 1 });
  assert.deepEqual(room.players[0].result, accepted);
  assert.equal(sent.get(clients[0]).at(-1).type, 'result-ack');
});

test('disconnect preserves a slot, migrates hosting, and accepts a queued finish', () => {
  const { service, clients, room, start, setTime } = setup();
  start();
  const originalId = room.players[0].id;
  const token = room.players[0].token;
  service.disconnect(clients[0]);
  assert.equal(room.hostId, room.players[1].id);
  setTime(room.round.startAt + 6000);
  const reconnected = {};
  service.handle(reconnected, { type: 'join', code: room.code, name: 'First', token });
  assert.equal(room.players.length, 2);
  assert.equal(room.players[0].id, originalId);
  service.handle(reconnected, { type: 'result', roundId: room.round.id, status: 'finished', elapsed: 1200 });
  assert.equal(room.players[0].result.elapsed, 1200);
});

test('server enforces bounds, deadline, forfeit, and missing-player timeout', () => {
  const { service, clients, room, start, setTime } = setup(3);
  start();
  service.handle(clients[0], { type: 'result', roundId: room.round.id, status: 'finished', elapsed: 0 });
  assert.equal(room.players[0].result, null);
  setTime(room.round.startAt + 100);
  for (const elapsed of [-1, 11_000, 2000, NaN]) service.handle(clients[0], { type: 'result', roundId: room.round.id, status: 'finished', elapsed });
  assert.equal(room.players[0].result, null);
  service.handle(clients[0], { type: 'result', roundId: room.round.id, status: 'forfeit' });
  assert.equal(room.players[0].result.status, 'forfeit');
  setTime(room.round.endAt); service.tick();
  assert.equal(room.round.phase, 'collecting');
  service.handle(clients[1], { type: 'result', roundId: room.round.id, status: 'timeout' });
  setTime(room.round.expiresAt); service.tick();
  assert.equal(room.players[2].result.status, 'missing');
  assert.equal(room.round.phase, 'results');
});

test('new players cannot join an active test and connected tokens cannot be reused', () => {
  const { service, clients, room, sent, start } = setup();
  const other = {};
  service.handle(other, { type: 'join', code: room.code, name: 'Copy', token: room.players[0].token });
  assert.match(sent.get(other).at(-1).message, /already connected/);
  start();
  service.handle(other, { type: 'join', code: room.code, name: 'Late' });
  assert.match(sent.get(other).at(-1).message, /underway/);
  service.handle(clients[0], { type: 'leave' });
  assert.equal(room.players.length, 2);
});
