import test from 'node:test';
import assert from 'node:assert/strict';
import { LETTERS_GAME, LETTERS_DURATION_MS, LETTERS_INPUT_MS, LETTERS_SETTLE_MS, LETTERS_FEEDBACK_MS, LETTERS_MAX_ACTIONS, LettersRun, LettersMatch, letterTarget, validateLetterClaim } from '../shared/letters.js';
import { GAMES, createRun, roundSettings, comparePlayers } from '../shared/games.js';
import { awardRound, arcadeGameIds } from '../shared/sets.js';
import { RoomService } from '../server/rooms.js';

const round = () => ({ id: 'letters', game: LETTERS_GAME, playerIds: ['a', 'b', 'c'], ...roundSettings(LETTERS_GAME, 123) });

export function typeTarget(run, at = run.state.opensAt + 100) {
  const press = color => { run.tap(color, run.start + at); at += 50; };
  for (const letter of run.state.target) {
    const target = letter.charCodeAt(0) - 65;
    const right = (target - run.cursor + 27) % 27;
    const left = (run.cursor - target + 27) % 27;
    const count = Math.min(left, right);
    for (let index = 0; index < count; index++) press(left < right ? 0 : 2);
    press(1);
  }
  return run.claim;
}

test('letter targets are seeded three-letter sequences; Game Select includes the shared game before the next Arcade batch', () => {
  assert.equal(GAMES[LETTERS_GAME].sharedArena, true);
  assert.equal(round().duration, 30_000);
  assert.equal(arcadeGameIds().includes(LETTERS_GAME), false);
  assert.deepEqual(Array.from({ length: 100 }, (_, i) => letterTarget(123, i)), Array.from({ length: 100 }, (_, i) => letterTarget(123, i)));
  assert.notEqual(letterTarget(123, 0), letterTarget(124, 0));
  for (let i = 0; i < 100; i++) assert.match(letterTarget(123, i), /^[A-Z]{3}$/);
  assert.ok(createRun(round(), 1000) instanceof LettersRun);
});

test('left and right wrap across all 27 cells; enter types and backspace erases; wrong text cannot score', () => {
  const run = new LettersRun(round(), 1000);
  let at = 1100;
  const press = color => { const action = run.tap(color, at); at += 50; return action; };
  for (let i = 0; i < 14; i++) press(0);
  assert.equal(run.cursor, 26);
  press(2);
  assert.equal(run.cursor, 0);
  press(1);
  assert.equal(run.typed, 'A');
  press(0); press(1);
  assert.equal(run.typed, '');
  press(2); press(1); press(1); press(1);
  assert.equal(run.typed, 'AAA');
  assert.equal(run.claim, null);
  assert.equal(run.mistakes, 1);
  press(0); press(1);
  assert.equal(run.typed, 'AA');
});

test('inputs remain local and obey countdown, repeat limits, feedback gates, and the exact 30-second deadline', () => {
  const r = round(), run = new LettersRun(r, 5000);
  assert.equal(run.tap(0, 4999).type, 'ignored');
  assert.equal(run.tap(0, 5000).type, 'move');
  assert.equal(run.tap(0, 5000 + LETTERS_INPUT_MS - 1).type, 'ignored');
  assert.equal(run.tap(0, 5000 + LETTERS_INPUT_MS).type, 'move');
  for (const color of [-1, 3, .1, NaN]) assert.equal(run.tap(color, 6000).type, 'ignored');
  assert.equal(run.tap(0, NaN).type, 'ignored');
  assert.equal(run.tap(0, run.end).type, 'ignored');
  run.sync({ ...run.state, phase: 'feedback' }, 'a');
  assert.equal(run.tap(0, 7000).type, 'ignored');
  run.sync({ ...run.state, phase: 'play', index: 1, opensAt: 2500, target: 'ABC' }, 'a');
  assert.equal(run.cursor, 13);
  assert.equal(run.typed, '');
  assert.equal(run.tap(0, 7499).type, 'ignored');
  assert.equal(run.tap(0, 7500).type, 'move');
});

test('claims replay bounded input proofs; fabricated strings, extra actions, impossible timing, and stale targets are rejected', () => {
  const r = round(), run = new LettersRun(r, 0), claim = typeTarget(run);
  const completedAt = claim.actions.at(-1)[1];
  assert.equal(validateLetterClaim(r, run.state, claim, completedAt + 200).elapsed, completedAt);
  assert.equal(run.tap(0, completedAt + 100).type, 'ignored');
  assert.equal(validateLetterClaim(r, run.state, { ...claim, index: 3 }, completedAt), null);
  assert.equal(validateLetterClaim(r, run.state, { ...claim, actions: [[1, 100]] }, completedAt), null);
  assert.equal(validateLetterClaim(r, run.state, { ...claim, actions: [...claim.actions, [0, completedAt + 100]] }, completedAt + 200), null);
  const bad = structuredClone(claim); bad.actions[1][1] = bad.actions[0][1];
  assert.equal(validateLetterClaim(r, run.state, bad, completedAt), null);
  assert.equal(validateLetterClaim(r, run.state, claim, completedAt + LETTERS_SETTLE_MS + 1), null);
  assert.equal(validateLetterClaim(r, run.state, claim, completedAt - 251), null);
  assert.equal(validateLetterClaim(r, run.state, { ...claim, actions: Array(LETTERS_MAX_ACTIONS + 1).fill([0, 0]) }, completedAt), null);
  const largest = { type: 'letters-claim', roundId: r.id, index: 0, actions: Array(LETTERS_MAX_ACTIONS).fill([2, 29999]) };
  assert.ok(Buffer.byteLength(JSON.stringify(largest)) < 8192);
});

test('earlier completion beats the first packet, claims are idempotent, equal timestamps share points, and targets wait for feedback', () => {
  const r = round(), match = new LettersMatch(r);
  const slow = typeTarget(new LettersRun({ ...r, letters: match.state }, 0), 200);
  const fast = typeTarget(new LettersRun({ ...r, letters: match.state }, 0), 100);
  const received = slow.actions.at(-1)[1] + 50;
  assert.ok(match.claim('a', slow, received));
  assert.ok(match.claim('b', fast, received + 200));
  assert.ok(match.claim('c', fast, received + 250));
  assert.ok(match.claim('b', fast, received + 300));
  const old = match.state.target;
  assert.equal(match.advance(received + LETTERS_SETTLE_MS - 1), false);
  assert.equal(match.advance(received + LETTERS_SETTLE_MS), true);
  assert.deepEqual(match.state.scores, { a: 0, b: 1, c: 1 });
  assert.equal(match.state.phase, 'feedback');
  assert.equal(match.state.index, 0);
  assert.equal(match.state.target, old);
  assert.equal(match.claim('a', slow, received + LETTERS_SETTLE_MS), false);
  match.advance(received + LETTERS_SETTLE_MS + LETTERS_FEEDBACK_MS);
  assert.equal(match.state.index, 1);
  assert.equal(match.state.phase, 'play');
  assert.equal(match.claim('a', slow, received + LETTERS_SETTLE_MS + LETTERS_FEEDBACK_MS + 10), false);
});

test('a pre-deadline finish arriving just after zero still scores; inputs at zero cannot score', () => {
  const r = round(), match = new LettersMatch(r);
  const probe = typeTarget(new LettersRun(r, 0), 100);
  const length = probe.actions.at(-1)[1] - 100;
  const claim = typeTarget(new LettersRun(r, 0), r.duration - length - 1);
  assert.equal(claim.actions.at(-1)[1], r.duration - 1);
  assert.ok(match.claim('a', claim, r.duration + 200));
  match.advance(r.duration + LETTERS_SETTLE_MS);
  assert.equal(match.state.scores.a, 1);
  assert.equal(match.state.index, 0);
  const late = structuredClone(claim); late.actions.at(-1)[1] = r.duration;
  assert.equal(validateLetterClaim(r, match.state, late, r.duration + 100), null);
});

function roomFixture() {
  let now = 1_000_000;
  const messages = [];
  const service = new RoomService({ now: () => now, send: (client, message) => messages.push({ client, message: structuredClone(message) }) });
  const clients = [{}, {}, {}];
  service.handle(clients[0], { type: 'create', name: 'Host', mode: 'game-select', game: LETTERS_GAME });
  const room = service.rooms.get(clients[0].room);
  clients.slice(1).forEach((client, i) => service.handle(client, { type: 'join', code: room.code, name: `Friend ${i + 1}` }));
  service.handle(clients[0], { type: 'start' });
  const ready = () => clients.forEach(client => {
    service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 });
    service.handle(client, { type: 'ready', ready: true });
  });
  ready();
  return { service, room, clients, messages, ready, time: value => { now = value; } };
}

test('server owns typing points and final results, keeps private proofs out of broadcasts, and ranks points rather than elapsed time', () => {
  const { service, room, clients, time, messages } = roomFixture();
  const r = room.round, winner = room.players[1];
  const claim = typeTarget(new LettersRun(r, 0));
  const finished = claim.actions.at(-1)[1];
  time(r.startAt + finished + 100);
  const message = { type: 'letters-claim', roundId: r.id, ...claim };
  service.handle(clients[1], message);
  service.handle(clients[1], message);
  assert.equal(messages.filter(item => item.message.type === 'letters-claim-ack').length, 2);
  service.handle(clients[0], { type: 'result', roundId: r.id, status: 'finished', cleared: 999, elapsed: 1, mistakes: 0 });
  assert.equal(room.players[0].result, null);
  time(r.startAt + finished + 100 + LETTERS_SETTLE_MS); service.tick();
  assert.equal(r.letters.scores[winner.id], 1);
  assert.equal(JSON.stringify(service.snapshot(room)).includes('actions'), false);
  assert.equal(JSON.stringify(service.snapshot(room)).includes(winner.token), false);
  time(r.endAt); service.tick();
  assert.equal(r.phase, 'collecting');
  time(r.endAt + LETTERS_SETTLE_MS); service.tick();
  assert.equal(r.phase, 'results');
  assert.equal(room.set.history.length, 1);
  assert.ok(room.players.every(player => player.result.status === 'finished' && player.result.elapsed === LETTERS_DURATION_MS));
  assert.equal(winner.result.cleared, 1);
  assert.ok(comparePlayers(winner, room.players[0], LETTERS_GAME) < 0);
  assert.deepEqual(awardRound(room.players, LETTERS_GAME).map(row => row.points), [0, 10, 0]);
  service.tick();
  assert.equal(room.set.history.length, 1);
});

test('cosmetic alphabet snapshots are bounded to 4 Hz and cannot award points; disconnects preserve scores and stale rounds are ignored', () => {
  const { service, room, clients, time } = roomFixture();
  const r = room.round;
  time(r.startAt + 500);
  const progress = { type: 'letters-progress', roundId: r.id, index: 0, cursor: 25, typed: 'ABC', sample: 400 };
  service.handle(clients[0], progress);
  assert.equal(room.players[0].progress.letters.cursor, 25);
  service.handle(clients[0], { ...progress, cursor: 26 });
  assert.equal(room.players[0].progress.letters.cursor, 25);
  time(r.startAt + 800);
  for (const patch of [{ cursor: 27 }, { typed: '<b>' }, { typed: 'ABCD' }, { sample: 99999 }, { index: 1 }, { roundId: 'old' }]) service.handle(clients[0], { ...progress, ...patch });
  assert.equal(room.players[0].progress.letters.cursor, 25);
  service.handle(clients[0], { type: 'progress', roundId: r.id, cleared: 1000, mistakes: 0 });
  assert.equal(room.players[0].progress.cleared, 0);
  service.disconnect(clients[0]);
  assert.equal(room.players[0].result, null);
  time(r.endAt + LETTERS_SETTLE_MS); service.tick();
  assert.equal(room.players[0].result.status, 'finished');
});

test('three Game Select rounds keep 30-second races and readiness gates, reset typing scores, and exit normally', () => {
  const { service, room, clients, time, ready } = roomFixture();
  for (let index = 0; index < 3; index++) {
    assert.equal(room.round.duration, 30_000);
    assert.ok(Object.values(room.round.letters.scores).every(score => score === 0));
    time(room.round.endAt + LETTERS_SETTLE_MS); service.tick();
    if (index < 2) {
      assert.equal(room.set.phase, 'intermission');
      time(room.set.nextStartAt); service.tick();
      assert.equal(room.set.phase, 'intermission');
      ready();
    }
  }
  assert.equal(room.set.phase, 'complete');
  service.handle(clients[1], { type: 'exit-set', setId: room.set.id });
  assert.equal(room.set, null);
  assert.equal(room.round, null);
});

test('forfeiting or leaving does not stop the shared race, and forfeited players cannot claim more points', () => {
  const { service, room, clients, time } = roomFixture();
  const r = room.round;
  time(r.startAt + 100);
  service.handle(clients[0], { type: 'result', roundId: r.id, status: 'forfeit', cleared: 999, mistakes: 0 });
  assert.equal(room.players[0].result.status, 'forfeit');
  assert.equal(room.players[0].result.cleared, 0);
  service.handle(clients[2], { type: 'leave' });
  assert.equal(room.players.length, 2);
  assert.notEqual(r.phase, 'results');
  const claim = typeTarget(new LettersRun(r, 0));
  const at = claim.actions.at(-1)[1] + 100;
  time(r.startAt + at);
  service.handle(clients[0], { type: 'letters-claim', roundId: r.id, ...claim });
  service.handle(clients[1], { type: 'letters-claim', roundId: r.id, ...claim });
  time(r.startAt + at + LETTERS_SETTLE_MS); service.tick();
  assert.equal(r.letters.scores[room.players[0].id], 0);
  assert.equal(r.letters.scores[room.players[1].id], 1);
  time(r.endAt + LETTERS_SETTLE_MS); service.tick();
  assert.equal(r.phase, 'results');
  assert.equal(room.set.history.length, 1);
  assert.deepEqual(room.set.history[0].rows.map(row => row.points), [0, 10, 0]);
});
