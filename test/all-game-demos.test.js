import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, roundSettings } from '../shared/games.js';
import { remainingDemoPlan, REMAINING_DEMO_GAMES } from '../src/remaining-demos.js';
import { ScriptedDemo } from '../src/scripted-demo.js';
import { createGameDemo } from '../src/game-demo.js';

test('Shark Jumper tutorial sounds come only from accepted jumps and water impacts', () => {
  const plan = remainingDemoPlan('shark-jumper');
  assert.equal(plan.cues.filter(cue => cue.sound === 'sharkJump').length, 5);
  assert.equal(plan.cues.filter(cue => cue.sound === 'sharkSplash').length, 1);
  assert.ok(plan.cues.every(cue => cue.type !== 'press' && cue.sound !== 'gameplayPress'));
});

for (const game of REMAINING_DEMO_GAMES) test(`${game}: demo inputs demonstrate the intended actions and reset cleanly`, () => {
  for (let level = 1; level <= 3; level++) {
    const plan = remainingDemoPlan(game, roundSettings(game, 123, level));
    const demo = Object.create(ScriptedDemo.prototype);
    Object.assign(demo, { plan, createRun: plan.createRun, elapsed: 0, previousTime: null, callbacks: {}, paint() {}, paintControls() {} });
    demo.resetRun(0);
    demo.advance(0, true);
    for (const cue of plan.cues) demo.advance(cue.at, true);
    demo.advance(plan.completeAt + 500, true);
    if (game === 'shark-jumper') assert.equal(demo.run.mistakes, 1);
    else if (game === 'star-collector') assert.ok(demo.run.events.some(event => event.type === 'carBump'));
    else assert.equal(demo.run.mistakes, 0, game);
    assert.ok(demo.run.cleared > 0, game);
    if (!plan.sampleComplete) assert.equal(demo.run.done, true, game);
    demo.advance(plan.duration, true);
    assert.equal(demo.run.cleared, 0);
  }
});

class Element {
  constructor() {
    this.children = []; this.dataset = {}; this.attributes = new Map(); this.style = { setProperty() {} }; this.className = '';
    this.classList = { add: (...names) => { names.forEach(name => assert.ok(!/\s/.test(name))); this.className += ' ' + names.join(' '); }, toggle: (name, enabled) => {
      const names = new Set(this.className.split(' ').filter(Boolean));
      if (enabled) names.add(name); else names.delete(name); this.className = [...names].join(' ');
    } };
  }
  append(...children) { for (const child of children) { child.remove?.(); child.parentNode = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key); }
  getAnimations() { return []; }
}

test('every registered game has an isolated animated tutorial that renders its watch, press, and result states', () => {
  const previous = globalThis.document;
  globalThis.document = { hidden: false, createElement: () => new Element(), createElementNS: () => new Element() };
  try {
    for (const game of Object.keys(GAMES)) {
      const demo = createGameDemo(game, { round: roundSettings(game, 123) });
      assert.ok(demo, game);
      assert.equal(demo.buttons.length, 3, game);
      if (['wheres-kaya', 'clock-stopper'].includes(game)) assert.equal(demo.stage.header.hidden, true, game);
      assert.ok(demo.lines.length >= 2, game);
      demo.advance(0, true);
      const cues = demo.plan?.cues || [];
      for (const cue of cues) {
        demo.advance(cue.at, true);
        demo.advance(cue.at + 16, true);
      }
      demo.advance(10000, false);
      demo.dispose?.();
    }
  } finally { globalThis.document = previous; }
});

test('the Happy Days tutorial keeps its cat paw down through a hold and releases on the tail', () => {
  const previous = globalThis.document;
  globalThis.document = { hidden: false, createElement: () => new Element(), createElementNS: () => new Element() };
  try {
    const demo = createGameDemo('happy-days', {});
    const hold = demo.plan.presses.find(cue => cue.holdUntil !== undefined);
    demo.advance(0, true);
    demo.advance((hold.at + hold.holdUntil) / 2, true);
    assert.equal(demo.run.judgments[0], 1);
    assert.match(demo.buttons[hold.color].className, /pressed/);
    assert.equal(demo.hand.style.opacity, '1');
    demo.advance(hold.holdUntil, true);
    assert.equal(demo.run.judgments[0], 2);
    assert.ok(demo.plan.presses.some(cue => cue.type === 'release' && cue.at === hold.holdUntil));
  } finally { globalThis.document = previous; }
});


test('Clock and Stationery tutorials use one success circle from their real scene renderer', () => {
  const previous = globalThis.document;
  globalThis.document = { hidden: false, createElement: () => new Element(), createElementNS: () => new Element() };
  try {
    for (const game of ['clock-stopper', 'stationery-master']) {
      const demo = createGameDemo(game, {});
      demo.advance(0, true); demo.advance(demo.plan.completeAt + 100, true);
      assert.equal(demo.completion.hidden, true);
      assert.equal(demo.stage.rows.filter(row => !row.result.hidden && row.result.textContent === '○').length, 1);
      demo.dispose();
    }
  } finally { globalThis.document = previous; }
});
