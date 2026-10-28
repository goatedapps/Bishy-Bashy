import test from 'node:test';
import assert from 'node:assert/strict';
import { DiceStage, FacingStage } from '../src/dice-facing-view.js';
import { createRun, roundSettings } from '../shared/games.js';
import { DICE_REVEAL_MS } from '../shared/dice.js';

class Element {
  constructor() {
    this.dataset = {};
    this.children = [];
    this.attributes = new Map();
    this.style = { setProperty() {} };
    this.classes = new Set();
    this.classList = { add: name => this.classes.add(name), toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) };
  }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
}

function withDocument(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  try { run(); } finally { globalThis.document = previous; }
}

test('dice hide rolling/future values, preserve the solved roll, and never expose remote choices', () => withDocument(() => {
  const round = { id: 'dice', game: 'dice-dice-more-dice', ...roundSettings('dice-dice-more-dice', 123) };
  const run = createRun(round, 1000), stage = new DiceStage();
  const values = () => stage.cards.map(card => Number(card.face.dataset.value));
  stage.render(round, run, 999, 0, true, true, 0);
  assert.deepEqual(values(), [0, 0, 0]);
  stage.render(round, run, run.shownAt, 0, true, true, 0);
  assert.deepEqual(values(), run.puzzle.values);
  const puzzle = run.puzzle;
  run.tap(puzzle.answer, run.readyAt);
  stage.render(round, run, run.feedback.at + 1, 0, true, true, 1);
  assert.deepEqual(values(), puzzle.values);
  assert.equal(stage.cards[puzzle.answer].stamp.hidden, false);
  stage.render(round, run, run.feedback.at + DICE_REVEAL_MS, 0, true, true, 1);
  assert.deepEqual(values(), [0, 0, 0]);
  assert.ok(stage.cards.every(card => card.stamp.hidden));
  stage.render(round, run, run.shownAt, 0, true, true, 1);
  assert.deepEqual(values(), run.puzzle.values);
  stage.render(round, undefined, run.shownAt, 0, true, true, 1);
  assert.deepEqual(values(), [0, 0, 0]);
  assert.match(stage.element.getAttribute('aria-label'), /Remote player/);
}));

test('facing hides its picture and answer during turns and play, while feedback shows only the solved trick', () => withDocument(() => {
  const round = { id: 'facing', game: 'facing-which-way', ...roundSettings('facing-which-way', 123) };
  const run = createRun(round, 1000), stage = new FacingStage();
  stage.render(round, run, 999, 0, true, true, 0);
  assert.equal(stage.duck.hidden, true);
  stage.render(round, run, run.start, 0, true, true, 0);
  assert.equal(stage.duck.hidden, false);
  assert.match(stage.duck.getAttribute('aria-label'), /Duck pointing/);
  stage.render(round, run, run.turnsAt, 0, true, true, 0);
  assert.equal(stage.duck.hidden, true);
  assert.match(stage.element.getAttribute('aria-label'), /move 1 of 2/);
  stage.render(round, run, run.playAt, 0, true, true, 0);
  assert.equal(stage.duck.hidden, true);
  assert.equal(stage.duck.getAttribute('aria-label'), 'Covered picture');
  const puzzle = run.puzzle;
  run.tap(puzzle.answer, run.playAt);
  stage.render(round, run, run.feedback.at + 1, 0, true, true, 1);
  assert.equal(stage.duck.hidden, false);
  assert.equal(stage.cue.textContent, '✓');
  assert.match(stage.card.style.transform, new RegExp(`rotate\\(${puzzle.poses.at(-1).angle}deg\\)`));
  stage.render(round, run, run.trialAt, 0, true, true, 1);
  assert.equal(stage.phase.textContent, 'Look!');
  stage.render(round, undefined, run.trialAt, 0, true, true, 1);
  assert.equal(stage.duck.hidden, true);
  assert.equal(stage.cue.textContent, '');
  assert.match(stage.element.getAttribute('aria-label'), /Remote player/);
}));

test('a wrong direction never reveals the answer and a replay returns to the original picture', () => withDocument(() => {
  const round = { id: 'facing', game: 'facing-which-way', ...roundSettings('facing-which-way', 123) };
  const run = createRun(round, 1000), stage = new FacingStage();
  run.tap((run.puzzle.answer + 1) % 3, run.playAt);
  stage.render(round, run, run.feedback.at + 1, 0, true, true, 0);
  assert.equal(stage.duck.hidden, true);
  assert.equal(stage.phase.textContent, 'Again!');
  assert.equal(stage.cue.textContent, '×');
  stage.render(round, run, run.trialAt, 0, true, true, 0);
  assert.equal(stage.duck.hidden, false);
  assert.equal(stage.phase.textContent, 'Look!');
}));

test('reduced motion removes the decorative cover flip and follows preference changes without changing cue timing', () => withDocument(() => {
  const previous = globalThis.matchMedia;
  const preference = { matches: true };
  globalThis.matchMedia = () => preference;
  try {
    const round = { id: 'facing', game: 'facing-which-way', ...roundSettings('facing-which-way', 123) };
    const run = createRun(round, 1000), stage = new FacingStage();
    const time = run.turnsAt - 90;
    assert.equal(run.phase(time).mode, 'cover');
    stage.render(round, run, time, 0, true, true, 0);
    assert.ok(!stage.card.style.transform.includes('scaleX'));
    assert.equal(stage.duck.hidden, true);
    preference.matches = false;
    stage.render(round, run, time, 0, true, true, 0);
    assert.ok(stage.card.style.transform.includes('scaleX'));
    assert.equal(run.phase(time).mode, 'cover');
  } finally { globalThis.matchMedia = previous; }
}));
