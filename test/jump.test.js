import test from 'node:test';
import assert from 'node:assert/strict';
import { JUMP_GAME, JumpRun, JUMP_RECOVERY_MS } from '../shared/jump.js';
import { roundSettings, createRun } from '../shared/games.js';
import { RoomService } from '../server/rooms.js';

const settings = (level = 1, seed = 123) => ({ id: 'jump', game: JUMP_GAME, ...roundSettings(JUMP_GAME, seed, level) });

test('seeded bounce durations and trajectories agree across devices', () => {
  const first = new JumpRun(settings(), 1000);
  const second = new JumpRun(settings(), 9000);
  assert.deepEqual(first.delays, second.delays);
  assert.notDeepEqual(first.delays, new JumpRun(settings(1, 124), 1000).delays);
  for (let elapsed = 0; elapsed < 1200; elapsed += 20) assert.equal(first.heightAt(1000 + elapsed), second.heightAt(9000 + elapsed));
  assert.equal(first.heightAt(first.launchedAt), 0);
  assert.equal(first.heightAt(first.landAt), 0);
  assert.ok(first.heightAt(first.launchedAt + first.arcMs / 2) > 0);
});

test('all three buttons accept both inclusive landing boundaries and preserve height continuity', () => {
  for (const color of [0, 1, 2]) {
    for (const edge of [-1, 1]) {
      const run = new JumpRun(settings(), 1000);
      const time = run.landAt + edge * run.windowMs;
      const height = run.heightAt(time);
      assert.equal(run.tap(color, time).type, 'hit');
      assert.equal(run.cleared, 1);
      assert.equal(run.heightAt(time), height);
      assert.equal(run.tap((color + 1) % 3, time).type, 'ignored');
    }
  }
});

test('early taps stumble, missed windows recover once, and completed boosts remain credited', () => {
  const run = new JumpRun(settings(), 1000);
  run.tap(0, run.landAt - run.windowMs);
  assert.equal(run.tap(1, run.launchedAt + 200).type, 'mistake');
  assert.equal(run.cleared, 1);
  assert.equal(run.tap(2, run.blockedUntil - 1).type, 'ignored');
  assert.equal(run.phase(run.blockedUntil - 1), 'stumble');
  const expiry = run.landAt + run.windowMs;
  run.advance(expiry);
  assert.equal(run.mistakes, 1);
  run.advance(expiry + 1);
  assert.equal(run.mistakes, 2);
  assert.equal(run.launchedAt, expiry + JUMP_RECOVERY_MS);
  const frequent = new JumpRun(settings(), 0), delayed = new JumpRun(settings(), 0);
  for (let time = 0; time <= 10000; time += 10) frequent.advance(time);
  delayed.advance(10000);
  assert.equal(frequent.launchedAt, delayed.launchedAt);
  assert.equal(frequent.mistakes, delayed.mistakes);
});

test('five difficulties finish at the final apex, independent of frame delivery and network time', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(level => settings(level).goal), [6, 7, 8, 9, 10]);
  assert.deepEqual([1, 2, 3, 4, 5].map(level => settings(level).windowMs), [150, 135, 120, 105, 90]);
  for (let level = 1; level <= 5; level++) {
    const round = settings(level), run = createRun(round, 5000);
    assert.ok(run instanceof JumpRun);
    while (run.cleared < round.goal) assert.equal(run.tap(run.cleared % 3, run.landAt).type, 'jumpPerfect');
    assert.equal(run.cleared, round.goal);
    assert.equal(run.done, false);
    assert.equal(run.phase(run.finishAt - 1), 'reaching');
    assert.equal(run.tap(0, run.finishAt - 1).type, 'ignored');
    run.advance(run.finishAt - 1);
    assert.equal(run.done, false);
    const finishAt = run.finishAt;
    run.advance(run.end + 1000);
    assert.equal(run.done, true);
    assert.equal(run.elapsed, finishAt - run.start);
    assert.ok(run.elapsed < round.duration);
    assert.equal(run.tap(0, finishAt).type, 'ignored');
  }
});

test('perfect center timings earn two boosts, safe edges earn one, and perfects beat safe play', () => {
  for (let level = 1; level <= 5; level++) {
    const round = settings(level), safe = new JumpRun(round, 0), perfect = new JumpRun(round, 0);
    while (safe.cleared < safe.goal) {
      assert.equal(safe.tap(0, safe.landAt - safe.windowMs).type, 'hit');
      assert.equal(safe.feedback.gain, 1);
    }
    while (perfect.cleared < perfect.goal) {
      const before = perfect.cleared;
      assert.equal(perfect.phase(perfect.landAt), 'perfect');
      assert.equal(perfect.tap(2, perfect.landAt).type, 'jumpPerfect');
      assert.equal(perfect.cleared - before, Math.min(2, perfect.goal - before));
    }
    safe.advance(safe.finishAt); perfect.advance(perfect.finishAt);
    assert.ok(perfect.elapsed < safe.elapsed);
    assert.equal(perfect.cleared, round.goal);
    for (const edge of [-1, 1]) {
      const run = new JumpRun(round, 0);
      assert.equal(run.tap(1, run.landAt + edge * run.perfectMs).type, 'jumpPerfect');
      assert.equal(run.cleared, 2);
      const outside = new JumpRun(round, 0);
      assert.equal(outside.tap(1, outside.landAt + edge * (outside.perfectMs + 1)).type, 'hit');
      assert.equal(outside.cleared, 1);
    }
  }
});

test('invalid, pre-start, and deadline taps cannot progress; reaching meat after the deadline does not finish', () => {
  const run = new JumpRun(settings(), 1000);
  for (const color of [-1, 3, .5, NaN]) assert.equal(run.tap(color, run.landAt).type, 'ignored');
  for (const time of [999, run.end, run.end + 1, NaN, Infinity]) assert.equal(run.tap(0, time).type, 'ignored');
  const late = new JumpRun(settings(), 0);
  late.cleared = late.goal - 1;
  late.launchedAt = late.end - late.arcMs - 100;
  late.tap(0, late.landAt);
  assert.equal(late.cleared, late.goal);
  assert.ok(late.finishAt >= late.end);
  late.advance(late.end + 1000);
  assert.equal(late.done, false);
});

test('room rejects incomplete jumps and acknowledges a delayed completed race once', () => {
  let now = 1_000_000;
  const service = new RoomService({ now: () => now, send: () => {} });
  const host = {}, friend = {};
  service.handle(host, { type: 'create', name: 'Host', mode: 'game-select', game: JUMP_GAME });
  const room = service.rooms.get(host.room);
  service.handle(friend, { type: 'join', code: room.code, name: 'Friend' });
  service.handle(host, { type: 'start' });
  for (const client of [host, friend]) {
    service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 });
    service.handle(client, { type: 'ready', ready: true });
  }
  now = room.round.startAt + 20000;
  const result = { type: 'result', roundId: room.round.id, status: 'finished', elapsed: 10000, cleared: room.round.goal - 1, mistakes: 0 };
  service.handle(host, result);
  assert.equal(room.players[0].result, null);
  service.handle(friend, { ...result, cleared: room.round.goal, elapsed: 12000 });
  service.handle(host, { ...result, cleared: room.round.goal });
  service.handle(host, { ...result, cleared: room.round.goal, elapsed: 1 });
  assert.equal(room.players[0].result.elapsed, 10000);
  assert.deepEqual(room.set.players.map(player => player.points), [10, 7]);
  assert.equal(room.set.history.length, 1);
});
