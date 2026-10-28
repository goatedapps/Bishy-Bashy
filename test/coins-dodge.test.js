import test from 'node:test';
import assert from 'node:assert/strict';
import { COIN_GAME, CoinRun, coinSequence } from '../shared/coins.js';
import { DODGE_GAME, DodgeRun, dodgeSequence, JUMP_MS, JUMP_CLEARANCE, MOVE_MS } from '../shared/dodge.js';
import { createRun, roundSettings, comparePlayers } from '../shared/games.js';
import { RoomService } from '../server/rooms.js';

const settings = (game, difficulty = 1) => ({ id: game, game, ...roundSettings(game, 123, difficulty) });
function dodge(run, fail = false) {
  const at = run.impactAt;
  if (run.obstacle.kind === 'hurdle') {
    if (!fail) run.tap(1, at - JUMP_MS / 2);
  } else {
    const target = fail ? (run.obstacle.safe + 1) % 3 : run.obstacle.safe;
    let time = run.launchedAt + 1;
    while (run.position !== target) {
      run.tap(run.position > target ? 0 : 2, time);
      time += MOVE_MS;
    }
  }
  run.advance(at);
}

test('coin rain is seeded, separates gold from fakes, and never repeats the gold chute consecutively', () => {
  const waves = coinSequence(123, 1000);
  assert.deepEqual(waves, coinSequence(123, 1000));
  assert.notDeepEqual(waves, coinSequence(456, 1000));
  assert.equal(new Set(waves.map(wave => wave.column)).size, 3);
  waves.forEach((wave, index) => {
    assert.notEqual(wave.column, wave.decoy);
    assert.ok([0, 1, 2].includes(wave.column) && [0, 1, 2].includes(wave.decoy));
    if (index) assert.notEqual(wave.column, waves[index - 1].column);
  });
});

test('coins accept an input exactly at landing, retain catches after a fake, and reject recovery taps', () => {
  const run = new CoinRun(settings(COIN_GAME), 1000);
  const at = run.landAt;
  run.tap(run.wave.column, at);
  assert.equal(run.cleared, 1);
  assert.equal(run.feedback.at, at);
  run.tap(run.wave.decoy, run.launchedAt + 10);
  run.advance(run.landAt);
  assert.equal(run.feedback.kind, 'decoy');
  assert.equal(run.cleared, 1);
  assert.equal(run.mistakes, 1);
  assert.equal(run.tap(run.wave.column, run.blockedUntil - 1).type, 'ignored');
  assert.equal(run.events.filter(event => event.type === 'hit').length, 1);
});

test('late coin frames preserve scheduled catch times and cannot retroactively catch an expired coin', () => {
  const round = settings(COIN_GAME), a = new CoinRun(round, 1000), b = new CoinRun(round, 1000);
  a.tap(a.wave.column, a.start); b.tap(b.wave.column, b.start);
  a.advance(a.landAt); b.advance(b.landAt + 50);
  assert.deepEqual(a.feedback, b.feedback);
  const c = new CoinRun(round, 1000);
  c.position = (c.wave.column + 1) % 3;
  c.tap(c.wave.column, c.landAt + 1);
  assert.equal(c.cleared, 0);
  assert.equal(c.mistakes, 1);
});

test('dodge patterns give the same alternating walls and hurdles with one open wall lane', () => {
  const obstacles = dodgeSequence(123, 1000);
  assert.deepEqual(obstacles, dodgeSequence(123, 1000));
  assert.notDeepEqual(obstacles, dodgeSequence(456, 1000));
  assert.equal(new Set(obstacles.map(obstacle => obstacle.safe)).size, 3);
  obstacles.forEach((obstacle, index) => assert.equal(obstacle.kind, index % 2 ? 'hurdle' : 'wall'));
});

test('dodge requires the open lane for tall walls even in the air; jumps cannot be retriggered or lane moves spammed', () => {
  const run = new DodgeRun(settings(DODGE_GAME), 1000);
  run.position = (run.obstacle.safe + 1) % 3;
  run.tap(1, run.impactAt - JUMP_MS / 2);
  const jumpAt = run.jumpAt;
  assert.equal(run.tap(1, jumpAt + 1).type, 'ignored');
  assert.equal(run.jumpAt, jumpAt);
  run.advance(run.impactAt);
  assert.equal(run.mistakes, 1);
  assert.equal(run.feedback.kind, 'crash');
  assert.equal(run.tap(2, run.blockedUntil - 1).type, 'ignored');
  run.position = 0;
  run.tap(2, run.launchedAt);
  run.tap(2, run.launchedAt + MOVE_MS - 1);
  assert.equal(run.position, 1);
  run.tap(2, run.launchedAt + MOVE_MS);
  assert.equal(run.position, 2);
});

test('hurdles judge jump height at impact and reject jumps that are too early or too late', () => {
  for (const offset of [0, JUMP_MS / 2, JUMP_MS + 1]) {
    const run = new DodgeRun(settings(DODGE_GAME), 1000);
    dodge(run);
    const at = run.impactAt;
    run.tap(1, at - offset);
    run.advance(at);
    assert.equal(run.feedback.kind, offset === JUMP_MS / 2 ? 'clear' : 'crash');
  }
  for (const side of [-1, 1]) {
    const run = new DodgeRun(settings(DODGE_GAME), 0);
    dodge(run);
    const boundary = Math.asin(JUMP_CLEARANCE) / Math.PI * JUMP_MS;
    run.tap(1, run.impactAt - boundary - side * .01);
    run.advance(run.impactAt);
    assert.equal(run.feedback.kind, side === 1 ? 'clear' : 'crash');
  }
});

for (const game of [COIN_GAME, DODGE_GAME]) {
  test(`${game}: all five levels finish locally, preserve progress after a miss, and use scheduled elapsed time`, () => {
    for (let level = 1; level <= 5; level++) {
      const round = settings(game, level), run = createRun(round, 1000);
      if (game === COIN_GAME) { run.tap(run.wave.decoy, run.start); run.advance(run.landAt); }
      else dodge(run, true);
      assert.equal(run.mistakes, 1);
      while (!run.done && (game === COIN_GAME ? run.landAt : run.impactAt) < run.end) {
        if (game === COIN_GAME) { run.tap(run.wave.column, run.launchedAt + 1); run.advance(run.landAt); }
        else dodge(run);
      }
      assert.equal(run.cleared, round.goal);
      assert.equal(run.done, true);
      assert.equal(run.mistakes, 1);
      assert.equal(run.elapsed, run.feedback.at - run.start);
      assert.ok(run.elapsed < round.duration);
      assert.equal(run.tap(0, run.feedback.at + 1).type, 'ignored');
    }
  });

  test(`${game}: invalid inputs, pre-start input, delayed frames, and exact deadlines cannot create extra progress`, () => {
    const round = settings(game), run = createRun(round, 1000);
    for (const color of [-1, 3, NaN, .5, '1']) assert.equal(run.tap(color, 1000).type, 'ignored');
    for (const time of [999, NaN, Infinity, run.end]) assert.equal(run.tap(0, time).type, 'ignored');
    const exact = createRun({ ...round, duration: game === COIN_GAME ? round.fallMs : round.approachMs }, 1000);
    if (game === COIN_GAME) exact.position = exact.wave.column;
    else exact.position = exact.obstacle.safe;
    exact.advance(exact.end + 1000);
    assert.equal(exact.cleared, 0);
    const timely = createRun(round, 1000), late = createRun(round, 1000);
    if (game === COIN_GAME) timely.position = late.position = timely.wave.column;
    else timely.position = late.position = timely.obstacle.safe;
    const at = game === COIN_GAME ? timely.landAt : timely.impactAt;
    timely.advance(at); late.advance(at + 100);
    assert.equal(timely.cleared, late.cleared);
    assert.deepEqual(timely.feedback, late.feedback);
  });

  test(`${game}: full server results are required and delayed faster results win once`, () => {
    let time = 100000;
    const service = new RoomService({ now: () => time, send() {} }), host = {}, guest = {};
    service.handle(host, { type: 'create', name: 'Host', game, mode: 'game-select' });
    const room = service.rooms.get(host.room);
    service.handle(guest, { type: 'join', name: 'Friend', code: room.code });
    service.handle(host, { type: 'start' });
    for (const client of [host, guest]) {
      service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 });
      service.handle(client, { type: 'ready', ready: true });
    }
    const round = room.round;
    time = round.startAt + 30000;
    const result = { type: 'result', roundId: round.id, status: 'finished', elapsed: 24000, cleared: round.goal - 1, mistakes: 0 };
    service.handle(host, result);
    assert.equal(room.players[0].result, null);
    service.handle(guest, { ...result, cleared: round.goal, elapsed: 25000 });
    service.handle(host, { ...result, cleared: round.goal });
    service.handle(host, { ...result, cleared: round.goal, elapsed: 1 });
    assert.equal(room.players[0].result.elapsed, 24000);
    assert.ok(comparePlayers(room.players[0], room.players[1], game) < 0);
    assert.deepEqual(room.set.players.map(player => player.points), [10, 7]);
    assert.equal(room.set.history.length, 1);
  });
}

test('both automatic games retain the scheduled final finish when rendering resumes after the landing', () => {
  for (const game of [COIN_GAME, DODGE_GAME]) {
    const run = createRun({ ...settings(game), goal: 2 }, 1000);
    if (game === COIN_GAME) {
      run.tap(run.wave.column, run.start);
      run.advance(run.landAt);
      run.tap(run.wave.column, run.launchedAt + 1);
      const at = run.landAt;
      run.advance(at + 500);
      assert.equal(run.elapsed, at - run.start);
    } else {
      dodge(run);
      const at = run.impactAt;
      run.tap(1, at - JUMP_MS / 2);
      run.advance(at + 500);
      assert.equal(run.elapsed, at - run.start);
    }
    assert.equal(run.done, true);
    assert.equal(run.events.filter(event => event.type === 'hit').length, 2);
  }
});
