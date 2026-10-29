import test from 'node:test';
import assert from 'node:assert/strict';
import { FIREWORK_GAME, FireworkRun, fireworkSequence, FIREWORK_FREEZE_MS, FIREWORK_SETS } from '../shared/fireworks.js';
import { roundSettings, createRun, comparePlayers } from '../shared/games.js';
import { RoomService } from '../server/rooms.js';
import { captureVisual, sanitizeVisual, RemoteRuns } from '../shared/visual-state.js';

const settings = (difficulty = 1) => ({ id: 'fireworks', game: FIREWORK_GAME, ...roundSettings(FIREWORK_GAME, 123, difficulty) });

function clearSet(run) {
  const rockets = run.rockets;
  let time = rockets.at(-1).launchAt + 100;
  // Reverse launch order proves that input order is independent of launch order.
  for (const rocket of rockets.toReversed()) {
    const action = run.tap(rocket.color, time);
    assert.ok(['hit', 'finished'].includes(action.type));
    time += 100;
  }
  return time - 100;
}

test('five seeded sets have counts 1, 3, 3, 4, 5 and the third set is faster', () => {
  assert.deepEqual(fireworkSequence(123), fireworkSequence(123));
  assert.notDeepEqual(fireworkSequence(123), fireworkSequence(124));
  assert.equal(new Set(fireworkSequence(123).map(rocket => rocket.color)).size, 3);
  assert.deepEqual(FIREWORK_SETS.map(set => set.count), [1, 3, 3, 4, 5]);
  assert.ok(FIREWORK_SETS[2].airMs < FIREWORK_SETS[1].airMs);
  assert.ok(FIREWORK_SETS[2].gapMs < FIREWORK_SETS[1].gapMs);
});

test('colors are answerable from launch; wrong colors retry only this set and ignore recovery taps', () => {
  const run = new FireworkRun(settings(), 1000);
  assert.equal(run.tap(0, 999).type, 'ignored');
  assert.equal(run.tap(run.rockets[0].color, 1000).type, 'hit');
  assert.equal(run.cleared, 1);
  assert.deepEqual(run.stageFeedback, { correct: true, at: 1000 });
  assert.equal(run.tap(0, run.blockedUntil - 1).type, 'ignored');
  const time = run.launchedAt;
  const wrong = (run.rockets[0].color + 1) % 3;
  assert.equal(run.tap(wrong, time).type, 'mistake');
  assert.equal(run.cleared, 1);
  assert.equal(run.burstMask, 0);
  assert.equal(run.mistakes, 1);
  assert.deepEqual(run.stageFeedback, { correct: false, at: time });
  assert.equal(run.events.filter(event => event.type === 'stageWrong').length, 1);
});

test('repeated colors consume the oldest airborne matching rocket, never a future launch', () => {
  const run = new FireworkRun(settings(), 1000);
  clearSet(run);
  run.sequence = [{ color: 1 }];
  const first = run.rockets[0];
  run.tap(1, first.launchAt);
  assert.equal(run.burstMask, 1);
  const future = run.rockets[1].launchAt;
  run.tap(1, future - 1);
  assert.equal(run.mistakes, 1);
  assert.equal(run.cleared, 1);
  const rockets = run.rockets;
  let time = rockets.at(-1).launchAt;
  for (const mask of [1, 3]) {
    run.tap(1, time);
    assert.equal(run.burstMask, mask);
    time += 100;
  }
  run.tap(1, time);
  assert.equal(run.cleared, 2);
});

test('landing is exclusive and delayed frames settle retries at the scheduled landing time', () => {
  const run = new FireworkRun(settings(), 1000);
  const rocket = run.rockets[0], landing = rocket.launchAt + rocket.airMs;
  assert.equal(run.tap(rocket.color, landing).type, 'ignored');
  assert.equal(run.mistakes, 1);
  assert.equal(run.launchedAt, landing + FIREWORK_FREEZE_MS);
  run.advance(landing);
  assert.equal(run.mistakes, 1);
  const frequent = new FireworkRun(settings(), 1000), delayed = new FireworkRun(settings(), 1000);
  for (let at = 1000; at <= 15000; at += 10) frequent.advance(at);
  delayed.advance(15000);
  assert.equal(delayed.index, frequent.index);
  assert.equal(delayed.launchedAt, frequent.launchedAt);
  assert.equal(delayed.mistakes, frequent.mistakes);
  delayed.advance(delayed.end + 1);
  const mistakes = delayed.mistakes;
  delayed.advance(delayed.end + 100000);
  assert.equal(delayed.mistakes, mistakes);
});

test('every difficulty finishes all sets in any color order, with exactly one success per set', () => {
  for (let difficulty = 1; difficulty <= 5; difficulty++) {
    const round = settings(difficulty), run = createRun(round, 5000);
    assert.ok(run instanceof FireworkRun);
    for (const color of [-1, 3, .5, NaN]) assert.equal(run.tap(color, 5000).type, 'ignored');
    assert.equal(run.tap(0, NaN).type, 'ignored');
    while (!run.done) clearSet(run);
    assert.equal(run.cleared, 5);
    assert.equal(run.mistakes, 0);
    assert.equal(run.events.filter(event => event.type === 'stageComplete').length, 5);
    assert.ok(run.elapsed < round.duration);
    assert.equal(run.tap(0, run.start + run.elapsed).type, 'ignored');
    assert.equal(new FireworkRun(round, 0).tap(0, round.duration).type, 'ignored');
  }
});

test('published multi-rocket state and stage results map clocks without advancing remote gameplay', () => {
  const round = settings(), run = new FireworkRun(round, 500000);
  clearSet(run);
  const time = run.rockets[0].launchAt + 100;
  run.tap(run.rockets[0].color, time);
  const state = captureVisual(round.game, run, time);
  const safe = sanitizeVisual(round, state, time - run.start);
  assert.ok(safe);
  const remote = new RemoteRuns().get(round, { id: 'peer', progress: { cleared: run.cleared, mistakes: 0, visual: safe } }, 2000);
  assert.equal(remote.burstMask, run.burstMask);
  assert.deepEqual(captureVisual(round.game, remote, 2000 + time - run.start), state);
  const invalid = structuredClone(state);
  invalid.fields.burstMask = 32;
  assert.equal(sanitizeVisual(round, invalid, time - run.start), null);
  invalid.fields.burstMask = 1;
  invalid.fields.burstTimes.push(0);
  assert.equal(sanitizeVisual(round, invalid, time - run.start), null);
});

test('room rejects incomplete sets, accepts a delayed finish once, and ranks local duration', () => {
  let time = 1_000_000;
  const service = new RoomService({ now: () => time, send: () => {} }), host = {}, friend = {};
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
  const result = { type: 'result', roundId: round.id, status: 'finished', elapsed: 15000, cleared: 4, mistakes: 0 };
  service.handle(host, result);
  assert.equal(room.players[0].result, null);
  service.handle(friend, { ...result, cleared: 5, elapsed: 16000 });
  service.handle(host, { ...result, cleared: 5 });
  service.handle(host, { ...result, cleared: 5, elapsed: 1 });
  assert.equal(room.players[0].result.elapsed, 15000);
  assert.ok(comparePlayers(room.players[0], room.players[1], FIREWORK_GAME) < 0);
  assert.deepEqual(room.set.players.map(player => player.points), [10, 7]);
  assert.equal(room.set.history.length, 1);
});
