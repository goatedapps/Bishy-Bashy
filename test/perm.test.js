import test from 'node:test';
import assert from 'node:assert/strict';
import { PERM_GAME, PermRun, createPhrases, demoCues, permNotes, PHRASE_MS, HIT_WINDOW_MS } from '../shared/perm.js';
import { GAMES, roundSettings, comparePlayers } from '../shared/games.js';

const round = { id: 'perm', game: PERM_GAME, ...roundSettings(PERM_GAME, 456) };

test('the seed determines shared demonstrations and responses exactly four beats apart', () => {
  assert.deepEqual(createPhrases(456), createPhrases(456));
  assert.notDeepEqual(createPhrases(456), createPhrases(789));
  assert.deepEqual(createPhrases(456)[0], [0, 2, 4, 6]);
  const cues = demoCues(456);
  const notes = permNotes(456);
  assert.equal(notes.length, round.totalNotes);
  notes.forEach((note, index) => assert.equal(note.at - cues[index], PHRASE_MS / 2));
  assert.equal(round.duration, 30_000);
  assert.equal(GAMES.__proto__, undefined);
});

test('perfect local rhythm grows all eight stages and completes only at the fixed deadline', () => {
  const run = new PermRun(round, 1000);
  run.notes.forEach((note, index) => assert.equal(run.tap(index % 3, run.start + note.at).type, 'hit'));
  assert.equal(run.done, false);
  run.advance(run.end);
  assert.equal(run.cleared, 8);
  assert.equal(run.hits, round.totalNotes);
  assert.equal(run.perfects, run.hits);
  assert.equal(run.score, round.maxScore);
  assert.equal(run.mistakes, 0);
  assert.equal(run.elapsed, round.duration);
  assert.equal(run.done, true);
  assert.equal(run.events.length, 8);
  assert.equal(run.tap(0, run.end).type, 'ignored');
});

test('each phrase tolerates one miss, two fail growth, and accuracy still affects rank', () => {
  const run = new PermRun(round, 0);
  for (const note of run.notes) if (note.step !== 0 && !(note.phrase === 0 && note.step === 2)) run.tap(2, note.at + 50);
  run.advance(run.end);
  assert.equal(run.cleared, 7);
  assert.equal(run.events.filter(event => event.type === 'stageWrong').length, 1);
  assert.equal(run.events.find(event => event.type === 'stageWrong').at, PHRASE_MS);
  assert.equal(run.mistakes, 9);
  assert.ok(run.score < round.maxScore);
  const a = { result: { status: 'finished', cleared: 7, score: 100 } };
  const b = { result: { status: 'finished', cleared: 6, score: 10_000 } };
  assert.ok(comparePlayers(a, b, PERM_GAME) < 0);
  assert.ok(comparePlayers(a, { result: { ...a.result, score: 101 } }, PERM_GAME) > 0);
  assert.ok(comparePlayers(a, { result: { status: 'forfeit', cleared: 8, score: 99_999 } }, PERM_GAME) < 0);
});

test('watch taps and simultaneous keys do not score; mashing cannot clear a phrase', () => {
  const run = new PermRun(round, 0);
  assert.equal(run.tap(0, 0).type, 'ignored');
  assert.equal(run.score, 0);
  const first = run.notes[0];
  assert.equal(run.tap(0, first.at).type, 'hit');
  assert.equal(run.tap(1, first.at).type, 'ignored');
  assert.equal(run.tap(1, first.at + 90).type, 'mistake');
  for (let at = first.at + 180; at < PHRASE_MS; at += 90) run.tap(0, at);
  run.advance(PHRASE_MS);
  assert.equal(run.cleared, 0);
  assert.ok(run.mistakes > 1);
  assert.ok(run.hits <= run.phrases[0].length);
});

test('hit boundaries and a frozen per-device timing adjustment are applied consistently', () => {
  const adjusted = new PermRun(round, 1000, 150);
  for (const note of adjusted.notes) adjusted.tap(0, adjusted.start + note.at + 150);
  adjusted.advance(adjusted.end);
  assert.equal(adjusted.score, round.maxScore);
  const edge = new PermRun(round, 0);
  assert.equal(edge.tap(0, edge.notes[0].at + HIT_WINDOW_MS).type, 'hit');
  assert.equal(edge.tap(0, edge.notes[1].at + HIT_WINDOW_MS + 1).type, 'mistake');
  const empty = new PermRun(round, 0);
  empty.advance(empty.end + 5000);
  assert.equal(empty.cleared, 0);
  assert.equal(empty.mistakes, round.totalNotes);
  assert.equal(empty.elapsed, 30_000);
});
