import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomService, RECONNECT_WAIT_MS } from '../server/rooms.js';
import { GAMES, roundSettings } from '../shared/games.js';
import { PERM_GAME, PermRun, demoCues } from '../shared/perm.js';
import { TotemRun } from '../shared/totem.js';
import { createSetPlan, awardRound, setStandings, INTERMISSION_MS } from '../shared/sets.js';

function setup({ mode = 'game-select', game = 'totem-shrinker', count = 4 } = {}) {
  let time = 1_000_000;
  const messages = new Map();
  const service = new RoomService({ now: () => time, send: (client, message) => {
    if (!messages.has(client)) messages.set(client, []);
    messages.get(client).push(structuredClone(message));
  } });
  const clients = Array.from({ length: count }, () => ({}));
  service.handle(clients[0], { type: 'create', name: 'First', mode, game });
  const room = service.rooms.get(clients[0].room);
  for (let index = 1; index < count; index++) service.handle(clients[index], { type: 'join', code: room.code, name: `Player ${index + 1}` });
  const sync = (indices = clients.map((_, index) => index)) => indices.forEach(index => service.handle(clients[index], { type: 'sync', rtt: 20, uncertainty: 10, count: 5 }));
  const ready = () => { sync(); clients.forEach(client => service.handle(client, { type: 'ready', ready: true })); };
  ready(); service.handle(clients[0], { type: 'start' });
  const finish = (order = clients.map((_, index) => index), winner = 0) => {
    const round = room.round;
    time = round.game === PERM_GAME ? round.endAt + 100 : round.startAt + 3500;
    for (const index of order) {
      const place = index === winner ? 0 : index === 0 ? 1 : index;
      service.handle(clients[index], { type: 'result', roundId: round.id, status: 'finished', elapsed: round.game === PERM_GAME ? round.duration : 1000 + place * 500, cleared: round.goal, mistakes: 0, ...(round.game === PERM_GAME ? { score: round.maxScore - place * 100 } : {}) });
    }
  };
  return { service, clients, room, messages, sync, ready, finish, setTime: value => { time = value; }, get now() { return time; } };
}

test('Arcade selects two distinct games from the expanding catalog; Game Select repeats five', () => {
  const ids = Object.keys(GAMES);
  const current = createSetPlan('arcade', ids[0], () => 0);
  assert.equal(current.length, 2);
  assert.equal(new Set(current).size, 2);
  assert.ok(current.every(id => ids.includes(id)));
  const future = Array.from({ length: 12 }, (_, index) => `game-${index}`);
  const plan = createSetPlan('arcade', null, max => max - 1, future);
  assert.equal(plan.length, 2);
  assert.equal(new Set(plan).size, 2);
  assert.deepEqual(createSetPlan('game-select', PERM_GAME), Array(5).fill(PERM_GAME));
});

test('set points share tied places, skip forfeits and empty rhythm results, and total ties remain ties', () => {
  const players = [1000, 1000, 2000, null].map((elapsed, index) => ({ id: index, name: String(index), result: elapsed === null ? { status: 'forfeit' } : { status: 'finished', elapsed } }));
  assert.deepEqual(awardRound(players, 'totem-shrinker').map(row => row.points), [10, 10, 4, 0]);
  assert.equal(awardRound([{ id: 1, name: 'Idle', result: { status: 'finished', cleared: 0, score: 0 } }], PERM_GAME)[0].points, 0);
  assert.deepEqual(setStandings([{ id: 1, points: 17 }, { id: 2, points: 20 }, { id: 3, points: 20 }]).map(player => [player.id, player.placement]), [[2, 1], [3, 1], [1, 3]]);
});

test('five automatic Totem rounds increase block counts and crown the total-points leader', () => {
  const state = setup();
  const { service, clients, room, finish, sync, setTime } = state;
  const setId = room.set.id;
  for (let index = 0; index < 5; index++) {
    assert.equal(room.round.blockCount, 30 + index * 10);
    assert.equal(room.round.setRound, index + 1);
    assert.equal(room.round.totalRounds, 5);
    assert.ok(room.players.every(player => !player.ready));
    finish([3, 2, 1, 0], index < 3 ? 0 : 1);
    const points = room.set.players[0].points;
    const historyLength = room.set.history.length;
    service.handle(clients[0], { type: 'result', roundId: room.round.id, status: 'finished', elapsed: 1, cleared: room.round.goal, mistakes: 0 });
    service.tick();
    assert.equal(room.set.players[0].points, points);
    assert.equal(room.set.history.length, historyLength);
    if (index < 4) {
      assert.equal(room.set.phase, 'intermission');
      service.handle(clients[0], { type: 'configure', mode: 'arcade', game: PERM_GAME });
      assert.equal(room.mode, 'game-select');
      const outsider = {};
      service.handle(outsider, { type: 'join', code: room.code, name: 'Late' });
      assert.match(state.messages.get(outsider).at(-1).message, /set is underway/);
      setTime(room.set.nextStartAt - 1); sync(); service.tick();
      assert.equal(room.set.phase, 'intermission');
      setTime(room.set.nextStartAt); service.tick();
      assert.equal(room.set.phase, 'playing');
    }
  }
  assert.equal(room.set.phase, 'complete');
  assert.deepEqual(room.set.players.map(player => player.points), [44, 41, 20, 5]);
  assert.equal(setStandings(room.set.players)[0].id, room.players[0].id);
  assert.equal(room.set.history.length, 5);
  service.tick(); assert.equal(room.set.history.length, 5);
  state.ready(); service.handle(clients[0], { type: 'start' });
  assert.notEqual(room.set.id, setId);
  assert.ok(room.set.players.every(player => player.points === 0));
  assert.equal(room.set.history.length, 0);
  assert.equal(room.round.blockCount, 30);
});

test('Arcade automatically plays two distinct base-difficulty games and keeps cumulative scores', () => {
  const { service, room, finish, sync, setTime } = setup({ mode: 'arcade', count: 2 });
  assert.equal(room.set.plan.length, 2);
  assert.equal(new Set(room.set.plan).size, 2);
  assert.ok(room.set.plan.every(id => GAMES[id]));
  const first = room.round.game;
  assert.equal(room.round.difficulty, 1);
  finish();
  assert.equal(room.set.phase, 'intermission');
  setTime(room.set.nextStartAt); sync(); service.tick();
  assert.notEqual(room.round.game, first);
  assert.equal(room.round.difficulty, 1);
  finish();
  assert.equal(room.set.phase, 'complete');
  assert.deepEqual(room.set.players.map(player => player.points), [20, 14]);
});

test('disconnected and unsynchronized players get a bounded wait, then miss only that round', () => {
  const { service, clients, room, finish, sync, setTime } = setup({ count: 2 });
  finish();
  const endedAt = room.set.resumeAt - INTERMISSION_MS;
  service.disconnect(clients[1]);
  setTime(endedAt + INTERMISSION_MS); sync([0]); service.tick();
  assert.equal(room.set.phase, 'intermission');
  assert.equal(room.set.nextStartAt, endedAt + RECONNECT_WAIT_MS);
  setTime(room.set.nextStartAt); service.tick();
  assert.deepEqual(room.round.playerIds, [room.players[0].id]);
  assert.equal(room.players[1].result.status, 'missing');
  const returning = {};
  service.handle(returning, { type: 'join', code: room.code, token: room.players[1].token, name: 'Returned' });
  assert.equal(room.players.length, 2);
  setTime(room.round.startAt + 1500);
  service.handle(returning, { type: 'result', roundId: room.round.id, status: 'finished', elapsed: 1000, cleared: room.round.goal, mistakes: 0 });
  assert.equal(room.players[1].result.status, 'missing');
  assert.equal(room.set.players[1].points, 7);
  const stale = setup({ count: 2 });
  stale.finish(); stale.room.players[1].sync = null;
  stale.setTime(stale.room.set.nextStartAt); stale.sync([0]); stale.service.tick();
  assert.equal(stale.room.set.waitReason, 'sync');
  stale.setTime(stale.room.set.nextStartAt); stale.service.tick();
  assert.deepEqual(stale.room.round.playerIds, [stale.room.players[0].id]);
});

test('host migration and leaving between rounds preserve earned points and the original roster', () => {
  const { service, clients, room, finish, setTime, sync } = setup({ count: 2 });
  finish();
  const originalHost = room.players[0].id;
  service.handle(clients[0], { type: 'leave' });
  assert.equal(room.hostId, room.players[0].id);
  assert.equal(room.set.players.find(player => player.id === originalHost).points, 10);
  setTime(room.set.nextStartAt); sync([1]); service.tick();
  assert.equal(room.round.playerIds.length, 1);
  assert.equal(room.set.players.length, 2);
  assert.equal(JSON.stringify(service.snapshot(room)).includes(room.players[0].token), false);
});

test('all five Perm difficulties judge a perfect round on their own tempo and exact duration', () => {
  assert.deepEqual(Array.from({ length: 5 }, (_, index) => roundSettings(PERM_GAME, 123, index + 1).bpm), [128, 136, 144, 152, 160]);
  for (let difficulty = 1; difficulty <= 5; difficulty++) {
    const round = { id: String(difficulty), game: PERM_GAME, ...roundSettings(PERM_GAME, 123, difficulty) };
    const run = new PermRun(round, 12345.678);
    run.notes.forEach(note => assert.equal(run.tap(0, run.start + note.at).type, 'hit'));
    run.advance(run.end);
    assert.equal(run.cleared, 8);
    assert.equal(run.score, round.maxScore);
    assert.equal(run.elapsed, round.duration);
    assert.ok(Math.abs(demoCues(round.seed, round.bpm)[0]) < .001);
    if (difficulty > 1) assert.ok(round.duration < 30_000);
    const tower = new TotemRun(roundSettings('totem-shrinker', 1, difficulty), 0);
    assert.equal(tower.sequence.length, 30 + (difficulty - 1) * 10);
  }
});
