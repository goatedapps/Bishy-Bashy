import test from 'node:test';
import assert from 'node:assert/strict';
import { FIREWORK_GAME, FireworkRun, fireworkSequence, FIREWORK_FREEZE_MS } from '../shared/fireworks.js';
import { roundSettings, createRun, comparePlayers } from '../shared/games.js';
import { RoomService } from '../server/rooms.js';

const settings = (difficulty = 1) => ({ id: 'fireworks', game: FIREWORK_GAME, ...roundSettings(FIREWORK_GAME, 123, difficulty) });

test('rockets share seeded colors and variable reveal delays', () => {
  assert.deepEqual(fireworkSequence(123), fireworkSequence(123));
  assert.notDeepEqual(fireworkSequence(123), fireworkSequence(124));
  assert.equal(new Set(fireworkSequence(123).map(rocket => rocket.color)).size, 3);
  assert.equal(new Set(fireworkSequence(123).map(rocket => rocket.delay)).size, 3);
});

test('early and wrong inputs discard a rocket and freeze mashing without adding bursts', () => {
  const run = new FireworkRun(settings(), 1000);
  assert.equal(run.tap(0, 999).type, 'ignored');
  assert.equal(run.tap(run.rocket.color, run.revealAt - 1).type, 'mistake');
  assert.equal(run.cleared, 0);
  assert.equal(run.mistakes, 1);
  assert.equal(run.tap(0, run.blockedUntil - 1).type, 'ignored');
  assert.equal(run.tap((run.rocket.color + 1) % 3, run.revealAt).type, 'mistake');
  assert.equal(run.mistakes, 2);
  assert.equal(run.tap(run.rocket.color, run.revealAt).type, 'hit');
  assert.equal(run.cleared, 1);
});

test('missed windows advance once, including exact boundaries and delayed frames', () => {
  const run = new FireworkRun(settings(), 1000);
  const expiry = run.expiresAt;
  assert.equal(run.tap(run.rocket.color, expiry).type, 'ignored');
  assert.equal(run.mistakes, 1);
  assert.equal(run.launchedAt, expiry + FIREWORK_FREEZE_MS);
  run.advance(expiry);
  assert.equal(run.mistakes, 1);
  const frequent = new FireworkRun(settings(), 1000);
  const delayed = new FireworkRun(settings(), 1000);
  for (let time = 1000; time <= 15000; time += 10) frequent.advance(time);
  delayed.advance(15000);
  assert.equal(frequent.index, delayed.index);
  assert.equal(frequent.launchedAt, delayed.launchedAt);
  delayed.advance(delayed.end + 100000);
  const mistakes = delayed.mistakes;
  delayed.advance(delayed.end + 200000);
  assert.equal(delayed.mistakes, mistakes);
});

test('all five speeds can finish, measure local elapsed time, and reject invalid and late taps', () => {
  for (let difficulty = 1; difficulty <= 5; difficulty++) {
    const round = settings(difficulty);
    const run = createRun(round, 5000);
    assert.ok(run instanceof FireworkRun);
    for (const color of [-1, 3, .5, NaN]) assert.equal(run.tap(color, 5000).type, 'ignored');
    assert.equal(run.tap(0, NaN).type, 'ignored');
    for (let index = 0; index < round.goal; index++) {
      const time = run.revealAt + 180;
      assert.equal(run.tap(run.rocket.color, time).type, index === round.goal - 1 ? 'finished' : 'hit');
      if (run.done) assert.equal(run.elapsed, time - 5000);
    }
    assert.ok(run.elapsed < round.duration);
    assert.equal(run.mistakes, 0);
    assert.equal(run.tap(0, run.start + run.elapsed).type, 'ignored');
    assert.equal(new FireworkRun(round, 0).tap(0, round.duration).type, 'ignored');
  }
  assert.deepEqual([1, 2, 3, 4, 5].map(level => settings(level).windowMs), [900, 800, 700, 600, 500]);
});

test('room rejects incomplete bursts, accepts a delayed finish once, and ranks local duration', () => {
  let time = 1_000_000;
  const service = new RoomService({ now: () => time, send: () => {} });
  const host = {}, friend = {};
  service.handle(host, { type: 'create', name: 'Host', mode: 'game-select', game: FIREWORK_GAME });
  const room = service.rooms.get(host.room);
  service.handle(friend, { type: 'join', code: room.code, name: 'Friend' });
  service.handle(host, { type: 'start' });
  for (const client of [host, friend]) {
    service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 });
    service.handle(client, { type: 'ready', ready: true });
  }
  const round = room.round;
  time = round.startAt + 20_000;
  const result = { type: 'result', roundId: round.id, status: 'finished', elapsed: 15000, cleared: 11, mistakes: 0 };
  service.handle(host, result);
  assert.equal(room.players[0].result, null);
  service.handle(friend, { ...result, cleared: 12, elapsed: 16000 });
  service.handle(host, { ...result, cleared: 12 });
  service.handle(host, { ...result, cleared: 12, elapsed: 1 });
  assert.equal(room.players[0].result.elapsed, 15000);
  assert.ok(comparePlayers(room.players[0], room.players[1], FIREWORK_GAME) < 0);
  assert.deepEqual(room.set.players.map(player => player.points), [10, 7]);
  assert.equal(room.set.history.length, 1);
});
