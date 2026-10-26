import test from 'node:test';
import assert from 'node:assert/strict';
import { TotemRun, createSequence, BLOCK_COUNT, GAME_DURATION_MS, MISTAKE_FREEZE_MS } from '../shared/totem.js';

const round = { id: 'round', seed: 12345, blockCount: BLOCK_COUNT, duration: GAME_DURATION_MS, freezeMs: MISTAKE_FREEZE_MS };

test('all devices derive the same complete tower from the shared seed', () => {
  const sequence = createSequence(round.seed);
  assert.deepEqual(sequence, createSequence(round.seed));
  assert.notDeepEqual(sequence, createSequence(round.seed + 1));
  assert.equal(sequence.length, 30);
  assert.deepEqual([...new Set(sequence)].sort(), [0, 1, 2]);
  const run = new TotemRun(round, 1000);
  assert.equal(run.visibleBlocks().at(-1), sequence[0]);
});

test('a wrong tap freezes inputs without advancing or extending the deadline', () => {
  const run = new TotemRun(round, 1000);
  const correct = run.sequence[0];
  assert.equal(run.tap(correct, 999).type, 'ignored');
  assert.equal(run.tap((correct + 1) % 3, 1100).type, 'mistake');
  assert.equal(run.mistakes, 1);
  assert.equal(run.cleared, 0);
  assert.equal(run.tap(correct, 1399).type, 'ignored');
  assert.equal(run.tap(correct, 1400).type, 'hit');
  assert.equal(run.cleared, 1);
  assert.equal(run.end, 46_000);
  for (const invalid of [-1, 3, NaN, 1.2, '0']) assert.equal(run.tap(invalid, 1500).type, 'ignored');
});

test('only the final correct block finishes; elapsed includes mistakes and ignores packet delay', () => {
  const run = new TotemRun(round, 1000);
  run.tap((run.sequence[0] + 1) % 3, 1000);
  for (let index = 0; index < 30; index++) {
    const action = run.tap(run.sequence[index], 1400 + index * 100);
    assert.equal(action.type, index === 29 ? 'finished' : 'hit');
  }
  assert.equal(run.elapsed, 3300);
  assert.equal(run.mistakes, 1);
  assert.equal(run.cleared, 30);
  assert.equal(run.visibleBlocks().length, 0);
  assert.equal(run.tap(0, 5000).type, 'ignored');
  assert.equal(run.elapsed, 3300);
});

test('deadline excludes taps at or after the end, even when only one block remains', () => {
  const run = new TotemRun(round, 1000);
  run.cleared = 29;
  assert.equal(run.tap(run.sequence[29], run.end).type, 'ignored');
  assert.equal(run.done, false);
  assert.equal(run.tap(run.sequence[29], run.end - 1).type, 'finished');
  assert.equal(run.elapsed, GAME_DURATION_MS - 1);
});
