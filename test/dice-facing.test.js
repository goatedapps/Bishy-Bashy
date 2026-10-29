import test from 'node:test';
import assert from 'node:assert/strict';
import { DiceRun, DICE_GAME, diceSequence, DICE_RETRY_MS, DICE_REVEAL_MS } from '../shared/dice.js';
import { FacingRun, FACING_GAME, facingSequence, applyTurn, DIRECTION_ANGLES, FACING_RETRY_MS } from '../shared/facing.js';
import { createRun, roundSettings, comparePlayers } from '../shared/games.js';
import { RoomService } from '../server/rooms.js';

const settings = (game, difficulty = 1) => ({ id: game, game, ...roundSettings(game, 123, difficulty) });

test('dice boards are seeded, use three distinct real die faces, and always have exactly one highest choice', () => {
  const boards = diceSequence(123, 1000, 5);
  assert.deepEqual(boards, diceSequence(123, 1000, 5));
  assert.notDeepEqual(boards, diceSequence(124, 1000, 5));
  assert.deepEqual(new Set(boards.map(board => board.answer)), new Set([0, 1, 2]));
  for (const board of boards) {
    assert.equal(new Set(board.values).size, 3);
    assert.ok(board.values.every(value => Number.isInteger(value) && value >= 1 && value <= 6));
    assert.equal(board.values[board.answer], Math.max(...board.values));
    assert.ok(board.angles.every(angle => Math.abs(angle) <= 40));
  }
});

test('dice reject roll/observation taps, keep the same board after misses, and cannot skip the solved-board feedback', () => {
  const run = new DiceRun(settings(DICE_GAME), 1000);
  const puzzle = run.puzzle;
  assert.equal(run.tap(puzzle.answer, run.start).type, 'ignored');
  assert.equal(run.tap(puzzle.answer, run.readyAt - 1).type, 'ignored');
  const at = run.readyAt;
  assert.equal(run.tap((puzzle.answer + 1) % 3, at).type, 'mistake');
  assert.equal(run.puzzle, puzzle);
  assert.equal(run.mistakes, 1);
  assert.equal(run.tap(puzzle.answer, at + DICE_RETRY_MS - 1).type, 'ignored');
  assert.equal(run.tap(puzzle.answer, at + DICE_RETRY_MS).type, 'hit');
  assert.equal(run.cleared, 1);
  assert.equal(run.feedback.puzzle, puzzle);
  assert.equal(run.shownAt, at + DICE_RETRY_MS + DICE_REVEAL_MS + run.rollMs);
  assert.equal(run.tap(run.puzzle.answer, run.readyAt - 1).type, 'ignored');
});

test('all five dice levels finish on local elapsed time with their own roll count and preserved mistake costs', () => {
  for (let level = 1; level <= 5; level++) {
    const round = settings(DICE_GAME, level);
    const run = createRun(round, 5000);
    assert.ok(run instanceof DiceRun);
    assert.equal(round.goal, 10 + level * 2);
    while (!run.done) run.tap(run.puzzle.answer, run.readyAt + 250);
    assert.equal(run.cleared, round.goal);
    assert.ok(run.elapsed < round.duration);
    assert.equal(run.elapsed, run.feedback.at - 5000);
  }
});

test('facing turns compose rotations and horizontal mirrors without creating an unanswerable down direction', () => {
  for (const angle of DIRECTION_ANGLES) for (const mirror of [-1, 1]) {
    const pose = { angle, mirror };
    const flip = { kind: 'mirror' };
    assert.deepEqual(applyTurn(applyTurn(pose, flip), flip), pose);
  }
  const boards = facingSequence(123, 500, 6);
  assert.deepEqual(boards, facingSequence(123, 500, 6));
  assert.notDeepEqual(boards, facingSequence(124, 500, 6));
  const moves = new Set();
  for (const board of boards) {
    let x = Math.round(Math.cos(board.initial.angle * Math.PI / 180));
    let y = Math.round(Math.sin(board.initial.angle * Math.PI / 180));
    board.moves.forEach((move, index) => {
      moves.add(move.kind === 'mirror' ? 'mirror' : move.degrees);
      if (move.kind === 'mirror') x = -x;
      else {
        const cosine = Math.round(Math.cos(move.degrees * Math.PI / 180));
        const sine = Math.round(Math.sin(move.degrees * Math.PI / 180));
        [x, y] = [x * cosine - y * sine, x * sine + y * cosine];
      }
      const pose = board.poses[index + 1];
      assert.ok(DIRECTION_ANGLES.includes(pose.angle));
      assert.equal(Math.round(Math.cos(pose.angle * Math.PI / 180)) || 0, x === 0 ? 0 : x);
      assert.equal(Math.round(Math.sin(pose.angle * Math.PI / 180)) || 0, y === 0 ? 0 : y);
    });
    assert.equal(board.answer, x < 0 ? 0 : y < 0 ? 1 : 2);
  }
  assert.deepEqual(moves, new Set(['mirror', 90, -90, 180]));
});

test('facing watch/turn/handoff inputs are ignored and wrong answers replay only the current trick', () => {
  const run = new FacingRun(settings(FACING_GAME), 1000);
  const puzzle = run.puzzle;
  assert.equal(run.phase(999).mode, 'wait');
  assert.equal(run.phase(run.start).mode, 'look');
  assert.equal(run.phase(run.turnsAt).mode, 'turn');
  assert.equal(run.phase(run.playAt - 1).mode, 'handoff');
  for (const at of [run.start, run.turnsAt, run.playAt - 1]) assert.equal(run.tap(puzzle.answer, at).type, 'ignored');
  const playAt = run.playAt;
  const oldCues = run.cues;
  assert.equal(run.tap((puzzle.answer + 1) % 3, playAt).type, 'mistake');
  assert.equal(run.puzzle, puzzle);
  assert.equal(run.cleared, 0);
  assert.equal(run.demoVersion, 1);
  assert.equal(run.trialAt, playAt + FACING_RETRY_MS);
  assert.notDeepEqual(run.cues, oldCues);
  assert.equal(run.phase(playAt + 1).mode, 'wait');
  assert.equal(run.tap(puzzle.answer, run.playAt).type, 'hit');
  assert.equal(run.cleared, 1);
  const solved = run.cleared;
  run.tap((run.puzzle.answer + 1) % 3, run.playAt);
  assert.equal(run.cleared, solved);
});

test('all five facing levels finish with their seeded 2–6 turns and local finish timestamp', () => {
  for (let level = 1; level <= 5; level++) {
    const round = settings(FACING_GAME, level);
    const run = createRun(round, 5000);
    assert.ok(run instanceof FacingRun);
    assert.equal(round.turnCount, level + 1);
    while (!run.done) {
      assert.equal(run.puzzle.moves.length, level + 1);
      run.tap(run.puzzle.answer, run.playAt + 300);
    }
    assert.equal(run.cleared, round.goal);
    assert.ok(run.elapsed < round.duration);
    assert.equal(run.elapsed, run.feedback.at - run.start);
    assert.equal(run.phase(run.feedback.at).mode, 'done');
  }
});

for (const game of [DICE_GAME, FACING_GAME]) {
  test(`${game}: invalid, pre-start, simultaneous, terminal, and deadline inputs cannot advance progress`, () => {
    const round = settings(game), run = createRun(round, 1000);
    const at = game === DICE_GAME ? run.readyAt : run.playAt;
    for (const color of [-1, 3, NaN, .5, '1']) assert.equal(run.tap(color, at).type, 'ignored');
    for (const time of [999, NaN, Infinity, run.end, run.end + 1]) assert.equal(run.tap(0, time).type, 'ignored');
    run.tap(run.puzzle.answer, at);
    const cleared = run.cleared;
    run.tap(run.puzzle.answer, at);
    assert.equal(run.cleared, cleared);
    while (!run.done) run.tap(run.puzzle.answer, game === DICE_GAME ? run.readyAt : run.playAt);
    assert.equal(run.tap(0, run.feedback.at + 1).type, 'ignored');
  });

  test(`${game}: server requires full completion, ranks local duration, and awards points once`, () => {
    let time = 1000000;
    const service = new RoomService({ now: () => time, send() {} });
    const host = {}, friend = {};
    service.handle(host, { type: 'create', name: 'Host', game, mode: 'game-select' });
    const room = service.rooms.get(host.room);
    service.handle(friend, { type: 'join', name: 'Friend', code: room.code });
    service.handle(host, { type: 'start' });
    for (const client of [host, friend]) {
      service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 });
      service.handle(client, { type: 'ready', ready: true });
    }
    const round = room.round;
    time = round.startAt + 25000;
    const result = { type: 'result', roundId: round.id, status: 'finished', cleared: round.goal - 1, mistakes: 0, elapsed: 17000 };
    service.handle(host, result);
    assert.equal(room.players[0].result, null);
    service.handle(friend, { ...result, cleared: round.goal, elapsed: 18000 });
    service.handle(host, { ...result, cleared: round.goal });
    service.handle(host, { ...result, cleared: round.goal, elapsed: 1 });
    assert.equal(room.players[0].result.elapsed, 17000);
    assert.ok(comparePlayers(room.players[0], room.players[1], game) < 0);
    assert.deepEqual(room.set.players.map(player => player.points), [10, 7]);
    assert.equal(room.set.history.length, 1);
  });
}

test('the facing flip, covered hold, turns, and their cues use distinct shared-clock boundaries', () => {
  const run=new FacingRun(settings(FACING_GAME),1000);
  assert.equal(run.coveredAt,run.trialAt+700+400);
  assert.equal(run.turnsAt-run.coveredAt,350);
  assert.equal(run.phase(run.coveredAt-1).mode,'cover');
  assert.equal(run.phase(run.coveredAt).mode,'covered');
  assert.equal(run.phase(run.turnsAt-1).mode,'covered');
  assert.equal(run.phase(run.turnsAt).mode,'turn');
  assert.equal(run.phase(run.turnsAt).index,0);
  assert.equal(run.phase(run.turnsAt+run.stepMs).index,1);
  assert.equal(run.cues[0].at,run.turnsAt);
  assert.equal(run.cues[1].at,run.turnsAt+run.stepMs);
  assert.equal(run.tap(run.puzzle.answer,run.coveredAt).type,'ignored');
});
