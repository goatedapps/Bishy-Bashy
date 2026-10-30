import test from 'node:test';
import assert from 'node:assert/strict';
import { LettersStage } from '../src/letters-view.js';
import { LettersRun, LettersMatch, LETTERS_GAME } from '../shared/letters.js';
import { roundSettings } from '../shared/games.js';

class Element {
  constructor() {
    this.children = [];
    this.textContent = '';
    this.className = '';
    this.attributes = new Map();
    this.classList = { toggle: (name, enabled) => {
      const classes = new Set(this.className.split(' ').filter(Boolean));
      if (enabled) classes.add(name); else classes.delete(name);
      this.className = [...classes].join(' ');
    } };
  }
  append(...children) { children.forEach(child => { child.remove(); this.children.push(child); child.parentNode = this; }); }
  replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this.append(...children); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  setAttribute(name, value) { this.attributes.set(name, value); }
}

test('shared arena shows one target, all three pointers and scores, hides targets before GO, and never shows stale typed entries', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  try {
    const round = { id: 'letters', game: LETTERS_GAME, phase: 'running', playerIds: ['a', 'b', 'c'], ...roundSettings(LETTERS_GAME, 123) };
    const match = new LettersMatch(round);
    round.letters = match.state;
    const players = round.playerIds.map((id, i) => ({ id, name: `Player ${i}`, connected: true, progress: { letters: { index: 0, cursor: i, typed: 'AB' } } }));
    const room = { round, players, set: { players } };
    const run = new LettersRun(round, 1000), local = { run, start: 1000, end: 31000 };
    const stage = new LettersStage();
    stage.render(room, 'a', local, 999);
    assert.deepEqual(stage.targetLetters.map(letter => letter.textContent), ['?', '?', '?']);
    assert.ok(stage.rows.every(row => row.pointer.hidden));
    run.tap(2, 1100);
    stage.render(room, 'a', local, 1100);
    assert.equal(stage.targetLetters.map(letter => letter.textContent).join(''), match.state.target);
    assert.equal(stage.rows.length, 3);
    assert.equal(stage.rows[0].pointer.parentNode, stage.keys[14].markers);
    assert.equal(stage.rows[1].pointer.parentNode, stage.keys[1].markers);
    assert.deepEqual(stage.rows[1].slots.map(slot => slot.textContent), ['A', 'B', '·']);
    match.state.index = 1;
    match.state.target = 'XYZ';
    run.sync(match.state, 'a');
    stage.render(room, 'a', local, 1200);
    assert.ok(stage.rows.every(row => row.slots.every(slot => slot.textContent === '·')));
    assert.equal(stage.rows[1].pointer.parentNode, stage.keys[13].markers);
  } finally { globalThis.document = previous; }
});

test('shared set feedback marks only winners with circles, marks other players lost, and clears for the next target', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  try {
    const round = { id: 'letters', game: LETTERS_GAME, playerIds: ['a', 'b', 'c'], ...roundSettings(LETTERS_GAME, 123) };
    round.letters = new LettersMatch(round).state;
    const players = round.playerIds.map(id => ({ id, name: id, connected: true, progress: {} }));
    const room = { round, players }, local = { run: new LettersRun(round, 0), start: 0, end: 30000 };
    const stage = new LettersStage();
    round.letters.phase = 'feedback';
    round.letters.scores.b = 1;
    round.letters.feedback = { index: 0, winners: ['b'], at: 2000 };
    stage.render(room, 'a', local, 2000);
    assert.deepEqual(stage.rows.map(row => row.outcome.textContent), ['×', '○', '×']);
    assert.equal(stage.rows[1].score.textContent, '1');
    assert.ok(stage.rows.every(row => !row.outcome.hidden));
    round.letters.phase = 'play';
    round.letters.index = 1;
    stage.render(room, 'a', local, 2700);
    assert.ok(stage.rows.every(row => row.outcome.hidden));
    stage.render(room, 'a', local, 30000);
    assert.equal(stage.notice.textContent, 'Time’s up!');
  } finally { globalThis.document = previous; }
});
