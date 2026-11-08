import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, roundSettings } from '../shared/games.js';
import { SESAME_GAME, SESAME_DURATION_MS, sesameTarget, validSesameResult } from '../shared/sesame.js';
import { resultMessage } from '../src/result-message.js';
import { dialCode } from './helpers/sesame.js';

const round = { id: 'sesame', game: SESAME_GAME, ...roundSettings(SESAME_GAME, 1714) };

test('a shared eight-digit code preserves leading zeroes and repeated digits', () => {
  const target = sesameTarget(round.seed);
  assert.match(target, /^0[0-9]{7}$/);
  assert.match(target, /([0-9])\1/);
  assert.equal(createRun(round, 2_000).target, createRun(round, 5_000).target);
});

test('dial wraps in both directions and a wrong digit keeps the accepted prefix', () => {
  const start = 7000.12345;
  const run = createRun(round, start);
  assert.equal(run.tap(0, start - 1).type, 'ignored');
  assert.equal(run.tap(0, start).type, 'move');
  assert.equal(run.cursor, 9);
  assert.equal(run.tap(2, start + 20).type, 'ignored');
  assert.equal(run.tap(1, start + 60).type, 'digit');
  assert.equal(run.tap(2, start + 120).type, 'move');
  assert.equal(run.cursor, 0);
  assert.equal(run.tap(1, start + 180).type, 'mistake');
  assert.equal(run.cleared, 1);
  assert.equal(run.mistakes, 1);
  assert.equal(createRun(round, start).tap(0, start + SESAME_DURATION_MS).type, 'ignored');
  dialCode(run, start + 260.75);
  assert.equal(run.cleared, 8);
  assert.equal(run.tap(1, start + run.elapsed + 100).type, 'ignored');
  const result = resultMessage(round, { id: round.id, run, goDelay: 0 }, 'finished', run.elapsed, start + run.elapsed);
  assert.ok(validSesameResult(round, result));
  assert.equal(validSesameResult(round, { ...result, elapsed: run.elapsed - 1 }), false);
  assert.equal(validSesameResult(round, { ...result, proof: result.proof.slice(0, -1) }), false);
  assert.equal(validSesameResult(round, { ...result, proof: [...result.proof].reverse() }), false);
});

test('a high-frequency dial history remains replayable and fits the WebSocket limit', () => {
  const start = 8549.1779;
  const run = createRun(round, start);
  for (let step = 0; step < 690; step++) {
    assert.equal(run.tap(step % 2 === 0 ? 0 : 2, start + step * 40).type, 'move');
  }
  dialCode(run, start + 690 * 40, 40);
  const result = resultMessage(round, { id: round.id, run, goDelay: 0 }, 'finished', run.elapsed, start + run.elapsed);
  assert.ok(validSesameResult(round, result));
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 16 * 1024);
});
