import test from 'node:test';
import assert from 'node:assert/strict';
import { BALLOON_GAME, BALLOON_GOAL, BALLOON_DURATION_MS, validBalloonResult } from '../shared/balloon.js';
import { createRun, roundSettings } from '../shared/games.js';
import { pumpBalloon } from './helpers/balloon.js';
import { resultMessage } from '../src/result-message.js';

const round = { id: 'balloon', game: BALLOON_GAME, ...roundSettings(BALLOON_GAME, 1) };

test('either color starts the pump and only alternating presses grow the balloon', () => {
  const start = 7000.12;
  const run = createRun(round, start);
  assert.equal(run.tap(2, start - 1).type, 'ignored');
  assert.equal(run.tap(2, start).type, 'move');
  assert.equal(run.tap(0, start + 39).type, 'ignored');
  assert.equal(run.tap(2, start + 80).type, 'ignored');
  assert.equal(run.tap(1, start + 100).type, 'ignored');
  assert.equal(run.cleared, 1);
  assert.equal(run.mistakes, 0);
  assert.equal(run.tap(0, start + 120).type, 'move');
  pumpBalloon(run, start + 200.25);
  assert.equal(run.cleared, BALLOON_GOAL);
  assert.equal(run.elapsed, 5900.25);
  assert.equal(run.feedback.kind, 'burst');
  assert.equal(run.tap(2, start + 7000).type, 'ignored');
});

test('server replay rejects incomplete, duplicate, too-fast, late and altered finishes', () => {
  const start = 7000.12;
  const run = pumpBalloon(createRun(round, start), start + 190.125, 45);
  const result = resultMessage(round, { id: round.id, run, goDelay: 0 }, 'finished', run.elapsed, start + run.elapsed);
  assert.ok(validBalloonResult(round, result));
  assert.equal(validBalloonResult(round, { ...result, elapsed: run.elapsed - 1 }), false);
  assert.equal(validBalloonResult(round, { ...result, proof: result.proof.slice(1) }), false);
  for (const [index, entry] of [[1, [0, 400_000]], [1, [2, result.proof[0][1] + 39_999]], [59, [2, BALLOON_DURATION_MS * 1000]]]) {
    const proof = structuredClone(result.proof);
    proof[index] = entry;
    assert.equal(validBalloonResult(round, { ...result, proof }), false);
  }
  assert.equal(createRun(round, 0).tap(0, BALLOON_DURATION_MS).type, 'ignored');
});
