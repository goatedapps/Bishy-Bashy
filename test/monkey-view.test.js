import test from 'node:test';
import assert from 'node:assert/strict';
import { MonkeyStage } from '../src/monkey-view.js';
import { MonkeyRun, MONKEY_GAME } from '../shared/monkeys.js';
import { roundSettings } from '../shared/games.js';

class Element {
  constructor() {
    this.attributes = new Map();
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = { toggle() {} };
  }
  append() {}
  replaceChildren() {}
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
}

test('a completed response cannot flash a phantom first move during the next demonstration lead-in', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  try {
    const round = { id: 'memory', game: MONKEY_GAME, ...roundSettings(MONKEY_GAME, 123) };
    const run = new MonkeyRun(round, 0);
    const stage = new MonkeyStage();
    const playAt = run.playAt;
    run.tap(run.sequence[0], playAt);
    stage.render(round, run, playAt + 1, true, true, 0);
    assert.notEqual(stage.portrait.dataset.item, 'none');
    assert.match(stage.element.getAttribute('aria-label'), /Your turn/);
    run.tap(run.sequence[1], playAt + 160);
    stage.render(round, run, playAt + 161, true, true, 1);
    assert.equal(stage.heading.textContent, 'Watch');
    assert.equal(stage.portrait.dataset.item, 'none');
    assert.equal(stage.element.getAttribute('aria-label'), 'Watch');
    stage.render(round, run, run.demoAt, true, true, 1);
    assert.notEqual(stage.portrait.dataset.item, 'none');
    assert.match(stage.element.getAttribute('aria-label'), /^Watch, move 1 of 3:/);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test('each visible monkey item matches only the current cue and neutral gaps do not reveal the next item', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  try {
    for (let color = 0; color < 3; color++) {
      const round = { id: 'items', game: MONKEY_GAME, ...roundSettings(MONKEY_GAME, 123) };
      const run = new MonkeyRun(round, 0);
      run.sequence[0] = color;
      const view = new MonkeyStage();
      view.render(round, run, run.demoAt - 1, true, true, 0);
      assert.equal(view.portrait.dataset.item, 'none');
      view.render(round, run, run.demoAt, true, true, 0);
      assert.equal(view.portrait.dataset.item, String(color));
      assert.match(view.portrait.getAttribute('aria-label'), new RegExp(['red apple', 'green pear', 'blue ball'][color]));
      view.render(round, run, run.demoAt + run.stepMs * .8, true, true, 0);
      assert.equal(view.portrait.dataset.item, 'none');
    }
  } finally { globalThis.document = previous; }
});
