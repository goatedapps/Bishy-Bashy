import test from 'node:test';
import assert from 'node:assert/strict';
import { BURGER_GAME, BurgerRun, BURGER_RECOVERY_MS } from '../shared/burger.js';
import { MISTAKE_GAME, MistakeRun, mistakeSequence, MISTAKE_RETRY_MS } from '../shared/mistake.js';
import { createRun, roundSettings, comparePlayers } from '../shared/games.js';
import { RoomService } from '../server/rooms.js';

const settings = (game, level = 1) => ({ id: game, game, ...roundSettings(game, 123, level) });

function finishBurger(round, misses = 0) {
  const run = new BurgerRun(round, 0);
  for (let index = 0; index < misses; index++) {
    run.tap((run.column + 1) % 3, run.launchedAt + 1);
    run.advance(run.landAt);
  }
  while (!run.done && run.landAt < run.end) {
    run.tap(run.column, run.launchedAt + 1);
    run.advance(run.landAt);
  }
  return run;
}

test('Burger Girl catches seeded ingredients at the local landing time across all five speeds', () => {
  for (let level = 1; level <= 5; level++) {
    const round = settings(BURGER_GAME, level);
    const run = finishBurger(round);
    assert.ok(run instanceof BurgerRun);
    assert.equal(run.done, true);
    assert.equal(run.cleared, 12);
    assert.equal(run.mistakes, 0);
    assert.equal(run.elapsed, 12 * round.fallMs + 11 * 160);
    assert.ok(run.elapsed < round.duration);
    assert.deepEqual(run.sequence, new BurgerRun(round, 10000).sequence);
    assert.equal(new Set(run.sequence).size, 3);
  }
  assert.deepEqual([1, 2, 3, 4, 5].map(level => settings(BURGER_GAME, level).fallMs), [1100, 990, 880, 770, 660]);
});

test('Burger catches include a move exactly on landing, keep prior layers after a miss, and cannot be mashed early', () => {
  const run = createRun(settings(BURGER_GAME), 1000);
  for (const color of [-1, 3, NaN, .5]) assert.equal(run.tap(color, 1000).type, 'ignored');
  assert.equal(run.tap(0, NaN).type, 'ignored');
  assert.equal(run.tap(0, 999).type, 'ignored');
  for (let index = 0; index < 30; index++) run.tap(index % 3, 1001);
  assert.equal(run.cleared, 0);
  run.tap(run.column, run.landAt);
  assert.equal(run.cleared, 1);
  const missedAt = run.landAt;
  run.tap((run.column + 1) % 3, run.launchedAt);
  run.advance(missedAt);
  assert.equal(run.cleared, 1);
  assert.equal(run.mistakes, 1);
  assert.equal(run.blockedUntil, missedAt + BURGER_RECOVERY_MS);
  assert.equal(run.tap(run.column, run.blockedUntil - 1).type, 'ignored');
  run.tap(run.column, run.blockedUntil);
  run.advance(run.landAt);
  assert.equal(run.cleared, 2);
});

test('Burger delayed frames settle the same catches and misses and never finish beyond the deadline', () => {
  const frequent = new BurgerRun(settings(BURGER_GAME), 0);
  const delayed = new BurgerRun(settings(BURGER_GAME), 0);
  for (let time = 0; time <= 30000; time += 10) frequent.advance(time);
  delayed.advance(30000);
  assert.deepEqual([delayed.cleared, delayed.mistakes, delayed.index, delayed.launchedAt], [frequent.cleared, frequent.mistakes, frequent.index, frequent.launchedAt]);
  const short = { ...settings(BURGER_GAME), duration: 1100 };
  const run = new BurgerRun(short, 0);
  run.tap(run.column, 1);
  run.advance(100000);
  assert.equal(run.cleared, 0);
  assert.equal(run.done, false);
  assert.equal(run.tap(0, run.end).type, 'ignored');
});

test('Me Find Mistake generates two identical pictures and one variant, with seeded difficulty pools', () => {
  assert.deepEqual(mistakeSequence(123, 100, 5), mistakeSequence(123, 100, 5));
  assert.notDeepEqual(mistakeSequence(123, 100, 5), mistakeSequence(124, 100, 5));
  for (const puzzle of mistakeSequence(123, 100, 5)) {
    const common = puzzle.pictures[(puzzle.odd + 1) % 3];
    assert.equal(puzzle.pictures.filter(picture => picture === common).length, 2);
    assert.equal(puzzle.pictures[puzzle.odd], common ^ 1);
    assert.ok(puzzle.pictures.every(picture => picture >= 0 && picture < 16));
  }
  assert.ok(mistakeSequence(123, 100, 1).every(puzzle => puzzle.pictures.every(picture => picture < 8)));
  assert.ok(mistakeSequence(123, 100, 5).some(puzzle => puzzle.pictures.some(picture => picture >= 14)));
});

test('wrong picture choices advance once and preserve the correct-answer count', () => {
  const run = new MistakeRun(settings(MISTAKE_GAME), 1000);
  const puzzle = run.puzzle;
  assert.equal(run.tap(puzzle.odd, 1249).type, 'ignored');
  const wrong = (puzzle.odd + 1) % 3;
  assert.equal(run.tap(wrong, run.readyAt).type, 'mistake');
  const retryAt = 1250 + MISTAKE_RETRY_MS;
  assert.notEqual(run.puzzle, puzzle);
  assert.equal(run.index, 1);
  assert.equal(run.tap(puzzle.odd, retryAt - 1).type, 'ignored');
  assert.equal(run.tap(run.puzzle.odd, retryAt).type, 'hit');
  assert.equal(run.cleared, 1);
  assert.equal(run.tap(run.puzzle.odd, run.readyAt - 1).type, 'ignored');
  run.tap((run.puzzle.odd + 1) % 3, run.readyAt);
  assert.equal(run.cleared, 1);
});

test('all five picture difficulties finish on local elapsed time and reject invalid or terminal inputs', () => {
  for (let level = 1; level <= 5; level++) {
    const round = settings(MISTAKE_GAME, level);
    const run = createRun(round, 5000);
    for (const color of [-1, 3, .1, NaN]) assert.equal(run.tap(color, run.readyAt).type, 'ignored');
    assert.equal(run.tap(0, NaN).type, 'ignored');
    for (let index = 0; index < round.goal; index++) {
      const at = run.readyAt + 100;
      assert.equal(run.tap(run.puzzle.odd, at).type, index === round.goal - 1 ? 'finished' : 'hit');
      if (run.done) assert.equal(run.elapsed, at - 5000);
    }
    assert.ok(run.elapsed < round.duration);
    assert.equal(run.tap(0, run.start + run.elapsed + 1).type, 'ignored');
    assert.equal(new MistakeRun(round, 0).tap(0, round.duration).type, 'ignored');
  }
});

for (const game of [BURGER_GAME, MISTAKE_GAME]) test(`${game}: server rejects incomplete results and preserves a late faster finish once`, () => {
  let time = 1000000;
  const service = new RoomService({ now: () => time, send() {} });
  const host = {}, friend = {};
  service.handle(host, { type: 'create', name: 'Host', game, mode: 'game-select' });
  const room = service.rooms.get(host.room);
  service.handle(friend, { type: 'join', name: 'Friend', code: room.code });
  service.handle(host, { type: 'start' });
  for (const client of [host, friend]) {
    service.handle(client, { type: 'sync', count: 5, rtt: 20, uncertainty: 10 });
    service.handle(client, { type: 'ready', ready: true });
  }
  const round = room.round;
  time = round.startAt + 25000;
  const result = { type: 'result', roundId: round.id, status: 'finished', cleared: round.goal - 1, attempted: round.goal - 1, mistakes: 0, elapsed: 17000 };
  service.handle(host, result);
  assert.equal(room.players[0].result, null);
  service.handle(friend, { ...result, cleared: round.goal, attempted: round.goal, elapsed: 18000 });
  service.handle(host, { ...result, cleared: round.goal, attempted: round.goal });
  service.handle(host, { ...result, cleared: round.goal, attempted: round.goal, elapsed: 1 });
  assert.equal(room.players[0].result.elapsed, 17000);
  assert.equal(Math.sign(comparePlayers(room.players[0], room.players[1], game)), game === MISTAKE_GAME ? 0 : -1);
  assert.deepEqual(room.set.players.map(player => player.points), game === MISTAKE_GAME ? [10, 10] : [10, 7]);
  assert.equal(room.set.history.length, 1);
});


test('Me Find Mistake accepts visible boards immediately in all Game Select rounds', () => {
  for (let level = 1; level <= 3; level++) {
    const run = new MistakeRun(settings(MISTAKE_GAME, level), 1000);
    while (!run.done) {
      const at = run.cleared === 0 ? run.readyAt : run.shownAt;
      assert.equal(run.tap(run.puzzle.odd, at).type, run.done ? 'finished' : 'hit');
      if (!run.done) assert.equal(run.tap(run.puzzle.odd, run.shownAt - 1).type, 'ignored');
    }
  }
});

test('Me Find Mistake finishes after mixed answers and ranks correct counts ahead of faster completion', () => {
  const round = settings(MISTAKE_GAME), run = new MistakeRun(round, 1000);
  while (!run.done) {
    const correct = run.index % 3 !== 0;
    run.tap((run.puzzle.odd + (correct ? 0 : 1)) % 3, run.readyAt + 10);
  }
  assert.equal(run.index, round.goal);
  assert.equal(run.cleared + run.mistakes, round.goal);
  assert.equal(run.cleared, 5);
  assert.equal(run.mistakes, 3);
  assert.equal(comparePlayers({result:{status:'finished',cleared:5,elapsed:20000}}, {result:{status:'finished',cleared:4,elapsed:3000}}, MISTAKE_GAME), -1);
});
