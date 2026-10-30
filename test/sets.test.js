import { LettersRun, LETTERS_SETTLE_MS, LETTERS_FEEDBACK_MS, LETTERS_PACKET_MS } from '../shared/letters.js';
import { letterClaim } from './helpers/letters.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomService, RECONNECT_WAIT_MS } from '../server/rooms.js';
import { GAMES, createRun, roundSettings } from '../shared/games.js';
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
  if (room.set.phase === 'selecting') { time = room.set.selectionEndAt; service.tick(); }
  ready();
  const finish = (order = clients.map((_, index) => index), winner = 0) => {
    const round = room.round;
    if (round.game === 'type-in-letters') {
      for (let set = 0; set < clients.length; set++) {
        const claim = letterClaim(new LettersRun(round, 0));
        time = round.startAt + claim.actions.at(-1)[1] + 20;
        for (const index of order) {
          const place = index === winner ? 0 : index === 0 ? 1 : index;
          if (place < clients.length - set) service.handle(clients[index], { type: 'letters-claim', roundId: round.id, ...claim });
        }
        time += LETTERS_SETTLE_MS; service.tick();
        time += LETTERS_FEEDBACK_MS; service.tick();
      }
      time = round.endAt + LETTERS_PACKET_MS; service.tick(); return;
    }
    if (round.game === 'dice-dice-more-dice' || round.game === 'facing-which-way') {
      const run = createRun(round, 0);
      for (const stage of run.stages) {
        time = round.startAt + stage.answerAt + 10;
        for (const index of order) {
          const place = index === winner ? 0 : index === 0 ? 1 : index;
          service.handle(clients[index], { type: 'shared-choice', roundId: round.id, index: stage.index, color: stage.index < place ? (stage.puzzle.answer + 1) % 3 : stage.puzzle.answer, elapsed: stage.answerAt + 10 });
        }
        time = round.startAt + stage.answerEnd + 80; service.tick();
      }
      time = round.endAt; service.tick(); return;
    }
    time = round.game === PERM_GAME ? round.endAt + 100 : round.startAt + 3500;
    for (const index of order) {
      const place = index === winner ? 0 : index === 0 ? 1 : index;
      service.handle(clients[index], { type: 'result', roundId: round.id, status: 'finished', elapsed: round.game === PERM_GAME ? round.duration : 1000 + place * 500, cleared: round.game === 'me-find-mistake' ? round.goal - place : round.goal, attempted: round.goal, mistakes: round.game === 'me-find-mistake' ? place : 0, ...(round.game === 'facial-slot-machine' ? { reelMask: 7 } : {}), ...(round.game === PERM_GAME ? { score: round.maxScore - place * 100 } : {}) });
    }
  };
  return { service, clients, room, messages, sync, ready, finish, setTime: value => { time = value; }, get now() { return time; } };
}

test('Arcade selects five distinct games from the expanding catalog; Game Select repeats three', () => {
  const ids = Object.keys(GAMES);
  const current = createSetPlan('arcade', ids[0], () => 0);
  assert.equal(current.length, 5);
  assert.equal(new Set(current).size, 5);
  assert.ok(current.every(id => ids.includes(id)));
  const future = Array.from({ length: 12 }, (_, index) => `game-${index}`);
  const plan = createSetPlan('arcade', null, max => max - 1, future);
  assert.equal(plan.length, 5);
  assert.equal(new Set(plan).size, 5);
  assert.deepEqual(createSetPlan('game-select', PERM_GAME), Array(3).fill(PERM_GAME));
});

test('set points share tied places, skip forfeits and empty rhythm results, and total ties remain ties', () => {
  const players = [1000, 1000, 2000, null].map((elapsed, index) => ({ id: index, name: String(index), result: elapsed === null ? { status: 'forfeit' } : { status: 'finished', elapsed } }));
  assert.deepEqual(awardRound(players, 'totem-shrinker').map(row => row.points), [10, 10, 4, 0]);
  assert.equal(awardRound([{ id: 1, name: 'Idle', result: { status: 'finished', cleared: 0, score: 0 } }], PERM_GAME)[0].points, 0);
  assert.deepEqual(setStandings([{ id: 1, points: 17 }, { id: 2, points: 20 }, { id: 3, points: 20 }]).map(player => [player.id, player.placement]), [[2, 1], [3, 1], [1, 3]]);
});

test('three automatic Totem rounds increase block counts and crown the total-points leader', () => {
  const state = setup();
  const { service, clients, room, finish, sync, setTime } = state;
  const setId = room.set.id;
  for (let index = 0; index < 3; index++) {
    assert.equal(room.round.blockCount, 30 + index * 10);
    assert.equal(room.round.setRound, index + 1);
    assert.equal(room.round.totalRounds, 3);
    assert.ok(room.players.every(player => !player.ready));
    finish([3, 2, 1, 0], index < 2 ? 0 : 1);
    const points = room.set.players[0].points;
    const historyLength = room.set.history.length;
    service.handle(clients[0], { type: 'result', roundId: room.round.id, status: 'finished', elapsed: 1, cleared: room.round.goal, mistakes: 0 });
    service.tick();
    assert.equal(room.set.players[0].points, points);
    assert.equal(room.set.history.length, historyLength);
    if (index < 2) {
      assert.equal(room.set.phase, 'intermission');
      service.handle(clients[0], { type: 'configure', mode: 'arcade', game: PERM_GAME });
      assert.equal(room.mode, 'game-select');
      const outsider = {};
      service.handle(outsider, { type: 'join', code: room.code, name: 'Late' });
      assert.match(state.messages.get(outsider).at(-1).message, /set is underway/);
      state.ready(); setTime(room.set.nextStartAt - 1); sync(); service.tick();
      assert.equal(room.set.phase, 'intermission');
      setTime(room.set.nextStartAt); service.tick();
      assert.equal(room.set.phase, 'playing');
    }
  }
  assert.equal(room.set.phase, 'complete');
  assert.deepEqual(room.set.players.map(player => player.points), [27, 24, 12, 3]);
  assert.equal(setStandings(room.set.players)[0].id, room.players[0].id);
  assert.equal(room.set.history.length, 3);
  service.tick(); assert.equal(room.set.history.length, 3);
  service.handle(clients[0], { type: 'start' });
  assert.equal(room.set.id, setId);
  service.handle(clients[0], { type: 'back-to-modes', setId });
  service.handle(clients[0], { type: 'start' }); state.ready();
  assert.notEqual(room.set.id, setId);
  assert.ok(room.set.players.every(player => player.points === 0));
  assert.equal(room.set.history.length, 0);
  assert.equal(room.round.blockCount, 30);
});

test('Arcade automatically plays five distinct base-difficulty games and keeps cumulative scores', () => {
  const { service, room, finish, sync, ready, setTime } = setup({ mode: 'arcade', count: 2 });
  assert.equal(room.set.plan.length, 5);
  assert.equal(new Set(room.set.plan).size, 5);
  assert.ok(room.set.plan.every(id => GAMES[id]));
  for (let index = 0; index < 5; index++) {
    assert.equal(room.round.difficulty, 1);
    finish();
    if (index < 4) {
      assert.equal(room.set.phase, 'intermission');
      setTime(room.set.nextStartAt); sync(); service.tick();
      assert.equal(room.set.phase, 'selecting');
      setTime(room.set.selectionEndAt); service.tick();
      assert.equal(room.set.phase, 'instructions'); ready();
    }
  }
  assert.equal(room.set.phase, 'complete');
  assert.deepEqual(room.set.players.map(player => player.points), [50, 35]);
});

test('ready gates retain a bounded disconnected-player wait and never skip a connected unready player', () => {
  const state = setup({ count: 2 });
  const { service, clients, room, finish, sync, setTime } = state;
  finish();
  service.disconnect(clients[1]);
  sync([0]); service.handle(clients[0], { type: 'ready', ready: true });
  setTime(room.set.nextStartAt); service.tick();
  assert.equal(room.set.phase, 'intermission');
  setTime(state.now + RECONNECT_WAIT_MS); sync([0]); service.tick();
  assert.deepEqual(room.round.playerIds, [room.players[0].id]);
  const stale = setup({ count: 2 }); stale.finish();
  stale.setTime(stale.room.set.nextStartAt + 30_000); stale.sync([0]); stale.service.tick();
  assert.equal(stale.room.set.phase, 'intermission');
  stale.ready(); assert.equal(stale.room.set.phase, 'playing');
});

test('host migration and leaving between rounds preserve earned points and the original roster', () => {
  const { service, clients, room, finish, setTime, sync } = setup({ count: 2 });
  finish();
  const originalHost = room.players[0].id;
  service.handle(clients[0], { type: 'leave' });
  assert.equal(room.hostId, room.players[0].id);
  assert.equal(room.set.players.find(player => player.id === originalHost).points, 10);
  setTime(room.set.nextStartAt); sync([1]); service.handle(clients[1], { type: 'ready', ready: true }); service.tick();
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
