import test from 'node:test';
import assert from 'node:assert/strict';
import { MONKEY_GAME, MonkeyRun, DEMO_LEAD_MS, MONKEY_RETRY_MS, MONKEY_INPUT_GUARD_MS } from '../shared/monkeys.js';
import { createRun, roundSettings, gameRules, comparePlayers } from '../shared/games.js';
import { RoomService } from '../server/rooms.js';

const settings = (level = 1, seed = 123) => ({ id: 'monkeys', game: MONKEY_GAME, ...roundSettings(MONKEY_GAME, seed, level) });
function copyStage(run, spacing = 160) {
  const playAt = run.playAt;
  const colors = run.sequence.slice(0, run.length);
  return colors.map((color, index) => run.tap(color, playAt + index * spacing)).at(-1);
}

test('all players share a seeded expanding prefix and demonstrations hide answers between flashes', () => {
  const run = new MonkeyRun(settings(), 1000);
  assert.deepEqual(run.sequence, new MonkeyRun(settings(), 1000).sequence);
  assert.notDeepEqual(run.sequence, new MonkeyRun(settings(1, 124), 1000).sequence);
  assert.equal(run.length, 2);
  assert.equal(run.phase(999).mode, 'waiting');
  assert.equal(run.phase(run.demoAt - 1).color, null);
  for (let index = 0; index < run.length; index++) {
    assert.equal(run.phase(run.demoAt + index * run.stepMs).color, run.sequence[index]);
    assert.equal(run.phase(run.demoAt + (index + .8) * run.stepMs).color, null);
  }
  const prefix = [...run.sequence];
  copyStage(run);
  assert.equal(run.cleared, 1);
  assert.equal(run.length, 3);
  assert.deepEqual(run.sequence, prefix);
  assert.deepEqual(run.cues.map(cue => cue.color), prefix.slice(0, 3));
});

test('watching inputs are ignored and arbitrary response timing is allowed after the exact handoff', () => {
  const run = new MonkeyRun(settings(), 1000);
  assert.equal(run.tap(run.sequence[0], run.playAt - 1).type, 'ignored');
  assert.equal(run.tap(run.sequence[0], run.playAt).type, 'hit');
  assert.equal(run.entered, 1);
  assert.equal(run.stageFeedback, null);
  assert.equal(run.tap(run.sequence[1], run.lastTap + MONKEY_INPUT_GUARD_MS - 1).type, 'ignored');
  assert.equal(run.tap(run.sequence[1], run.playAt + 1234).type, 'hit');
  assert.equal(run.cleared, 1);
  assert.equal(run.entered, 0);
  assert.equal(run.mistakes, 0);
  assert.equal(run.stageFeedback.correct, true);
});

test('a wrong response replays only the current prefix and keeps completed stages', () => {
  const run = new MonkeyRun(settings(), 0);
  copyStage(run);
  const at = run.playAt;
  run.tap(run.sequence[0], at);
  const prefix = run.cues.map(cue => cue.color);
  const version = run.demoVersion;
  assert.equal(run.tap((run.sequence[1] + 1) % 3, at + 200).type, 'mistake');
  assert.deepEqual(run.stageFeedback, { correct: false, at: at + 200 });
  assert.equal(run.cleared, 1);
  assert.equal(run.entered, 0);
  assert.equal(run.mistakes, 1);
  assert.equal(run.demoVersion, version + 1);
  assert.equal(run.demoAt, at + 200 + MONKEY_RETRY_MS + DEMO_LEAD_MS);
  assert.deepEqual(run.cues.map(cue => cue.color), prefix);
  assert.equal(run.phase(at + 300).mode, 'retry');
  assert.equal(run.tap(run.sequence[0], run.demoAt).type, 'ignored');
  copyStage(run);
  assert.equal(run.cleared, 2);
});

test('every difficulty finishes locally within the deadline and completion cannot be repeated', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(level => settings(level).goal), [5, 6, 7, 8, 9]);
  assert.deepEqual([1, 2, 3, 4, 5].map(level => settings(level).stepMs), [650, 610, 570, 530, 490]);
  for (let level = 1; level <= 5; level++) {
    const round = settings(level);
    const run = createRun(round, 5000);
    assert.ok(run instanceof MonkeyRun);
    for (let stage = 0; stage < round.goal; stage++) {
      const action = copyStage(run);
      assert.equal(action.type, stage === round.goal - 1 ? 'finished' : 'hit');
    }
    assert.equal(run.cleared, round.goal);
    assert.equal(run.done, true);
    assert.ok(run.elapsed > 0 && run.elapsed < round.duration);
    assert.equal(run.tap(0, run.start + run.elapsed).type, 'ignored');
    assert.equal(run.phase(run.start + run.elapsed).mode, 'done');
    assert.ok(gameRules(MONKEY_GAME, round).every(line => line.trim().length > 0));
  }
});

test('invalid, simultaneous, and deadline inputs cannot advance or mutate a result', () => {
  const run = new MonkeyRun(settings(), 0);
  for (const color of [-1, 3, .5, NaN]) assert.equal(run.tap(color, run.playAt).type, 'ignored');
  assert.equal(run.tap(0, NaN).type, 'ignored');
  assert.equal(run.tap(0, Infinity).type, 'ignored');
  const time = run.playAt;
  run.tap(run.sequence[0], time);
  assert.equal(run.tap(run.sequence[1], time).type, 'ignored');
  assert.equal(run.tap(run.sequence[1], run.end).type, 'ignored');
  assert.equal(run.tap(run.sequence[1], run.end + 1).type, 'ignored');
  assert.equal(run.cleared, 0);
  assert.equal(run.mistakes, 0);
});

test('completed memory stages are required for results and delayed results award points once', () => {
  let time = 1_000_000;
  const service = new RoomService({ now: () => time, send: () => {} });
  const host = {}, guest = {};
  service.handle(host, { type: 'create', name: 'Host', game: MONKEY_GAME, mode: 'game-select' });
  const room = service.rooms.get(host.room);
  service.handle(guest, { type: 'join', code: room.code, name: 'Guest' });
  service.handle(host, { type: 'start' });
  for (const client of [host, guest]) {
    service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 });
    service.handle(client, { type: 'ready', ready: true });
  }
  const round = room.round;
  time = round.startAt + 22000;
  service.handle(host, { type: 'progress', roundId: round.id, cleared: 2, mistakes: 1 });
  assert.equal(room.players[0].progress.cleared, 2);
  const result = { type: 'result', roundId: round.id, status: 'finished', elapsed: 18000, cleared: round.goal - 1, mistakes: 1 };
  service.handle(host, result);
  assert.equal(room.players[0].result, null);
  service.handle(guest, { ...result, cleared: round.goal, elapsed: 20000 });
  service.handle(host, { ...result, cleared: round.goal });
  service.handle(host, { ...result, cleared: round.goal, elapsed: 1 });
  assert.equal(room.players[0].result.elapsed, 18000);
  assert.equal(room.players[0].progress.cleared, round.goal);
  assert.ok(comparePlayers(room.players[0], room.players[1], MONKEY_GAME) < 0);
  assert.deepEqual(room.set.players.map(player => player.points), [10, 7]);
  assert.equal(room.set.history.length, 1);
});
