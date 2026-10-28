import test from 'node:test';
import assert from 'node:assert/strict';
import { BurgerStage, MistakeStage } from '../src/catch-spot-view.js';
import { createRun, roundSettings } from '../shared/games.js';

class Element {
  constructor() {
    this.dataset = {};
    this.children = [];
    this.attributes = new Map();
    this.properties = new Map();
    this.style = { setProperty: (name, value) => this.properties.set(name, value) };
    this.classes = new Set();
    this.classList = { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
}

function withDocument(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  try { run(); }
  finally { globalThis.document = previous; }
}

test('picture feedback retains the solved board until the next reveal and never exposes remote puzzles', () => withDocument(() => {
  const round = { id: 'pictures', game: 'me-find-mistake', ...roundSettings('me-find-mistake', 123) };
  const run = createRun(round, 1000);
  const stage = new MistakeStage();
  stage.render(round, run, run.start, 0, true, true, 0);
  const puzzle = run.puzzle;
  run.tap(puzzle.odd, run.readyAt);
  stage.render(round, run, run.feedback.at + 1, 0, true, true, 1);
  assert.deepEqual(stage.cards.map(card => Number(card.picture.dataset.picture)), puzzle.pictures);
  assert.equal(stage.cards[puzzle.odd].stamp.textContent, '✓');
  stage.render(round, run, run.shownAt, 0, true, true, 1);
  assert.deepEqual(stage.cards.map(card => Number(card.picture.dataset.picture)), run.puzzle.pictures);
  assert.ok(stage.cards.every(card => card.stamp.hidden));
  stage.render(round, undefined, run.shownAt, 0, true, true, 1);
  assert.ok(stage.cards.every(card => card.picture.hidden));
  assert.match(stage.element.getAttribute('aria-label'), /Remote player/);
}));

test('Burger hides future food before launch and shows only completed layers, with a served burger flourish', () => withDocument(() => {
  const round = { id: 'burger', game: 'burger-girl', ...roundSettings('burger-girl', 123) };
  const run = createRun(round, 1000);
  const stage = new BurgerStage();
  stage.render(round, run, 999, 0, true, true, 0);
  assert.equal(stage.falling.hidden, true);
  assert.ok(stage.layers.every(layer => layer.hidden));
  stage.render(round, run, 1001, 0, true, true, 0);
  assert.equal(stage.falling.hidden, false);
  assert.match(stage.element.getAttribute('aria-label'), /falling in/);
  for (let index = 0; index < 4; index++) {
    run.tap(run.column, run.launchedAt + 1);
    run.advance(run.landAt);
  }
  stage.render(round, run, run.feedback.at + 1, 0, true, true, 4);
  assert.equal(stage.toast.textContent, 'Served!');
  assert.equal(stage.layers.filter(layer => !layer.hidden).length, 4);
  stage.render(round, run, run.feedback.at + 600, 0, true, true, 4);
  assert.ok(stage.layers.every(layer => layer.hidden));
}));
