import test from 'node:test';
import assert from 'node:assert/strict';
import { GameFeedback } from '../src/feedback.js';

function fixture() {
  const animated = () => ({
    calls: [],
    animate(frames, options) {
      const animation = { frames, options, cancel() { this.cancelled = true; this.oncancel?.(); } };
      this.calls.push(animation);
      return animation;
    },
  });
  const lane = {
    remaining: animated(), status: animated(), ring: animated(),
    particles: Array.from({ length: 12 }, animated),
    effects: { style: { setProperty() {} }, dataset: {} },
  };
  const round = { id: 'test', phase: 'running', game: 'totem-shrinker' };
  const run = { cleared: 0, mistakes: 0, sequence: [0, 0, 0] };
  const local = { id: round.id, run, done: false };
  const feedback = new GameFeedback();
  const update = time => feedback.update(round, local, lane, time);
  return { lane, round, run, local, feedback, update };
}

test('rapid same-color successes restart bounded effects without replaying snapshots', () => {
  const previous = globalThis.document;
  globalThis.document = { hidden: false };
  try {
    const { lane, run, feedback, update } = fixture();
    update(0);
    run.cleared++;
    update(10);
    const first = lane.ring.calls[0];
    update(11);
    assert.equal(lane.ring.calls.length, 1);
    run.cleared++;
    update(12);
    assert.equal(first.cancelled, true);
    assert.equal(lane.ring.calls.length, 2);
    assert.equal(feedback.animations.size, 6);
    for (const animation of [...feedback.animations.values()]) animation.onfinish();
    assert.equal(feedback.animations.size, 0);
  } finally { globalThis.document = previous; }
});

test('finish fires once, and hiding or changing rounds cancels outstanding effects', () => {
  const previous = globalThis.document;
  globalThis.document = { hidden: false };
  try {
    const { lane, local, feedback, round, update } = fixture();
    update(0);
    local.done = true;
    local.status = 'finished';
    update(10);
    update(11);
    assert.equal(lane.ring.calls.length, 1);
    assert.equal(feedback.animations.size, 14);
    document.hidden = true;
    update(12);
    assert.equal(feedback.animations.size, 0);
    assert.ok(lane.ring.calls[0].cancelled);
    document.hidden = false;
    update(13);
    assert.equal(lane.ring.calls.length, 1);
    round.id = 'next';
    update(14);
    assert.equal(feedback.run, null);
  } finally { globalThis.document = previous; }
});

test('reduced motion suppresses effects, including a preference change during a burst', () => {
  const previous = globalThis.document;
  const previousMedia = globalThis.matchMedia;
  let changed;
  const preference = { matches: true, addEventListener(name, listener) { assert.equal(name, 'change'); changed = listener; } };
  globalThis.matchMedia = () => preference;
  globalThis.document = { hidden: false };
  try {
    const { lane, run, feedback, update } = fixture();
    update(0);
    run.cleared++;
    update(10);
    assert.equal(lane.ring.calls.length, 0);
    preference.matches = false;
    run.cleared++;
    update(20);
    assert.ok(feedback.animations.size > 0);
    preference.matches = true;
    changed();
    assert.equal(feedback.animations.size, 0);
    assert.equal(lane.ring.calls[0].cancelled, true);
  } finally {
    globalThis.document = previous;
    globalThis.matchMedia = previousMedia;
  }
});

test('game-specific feedback leaves jump/firework impacts alone and pops only newly matched slot badges', () => {
  const previous = globalThis.document;
  globalThis.document = { hidden: false };
  try {
    for (const game of ['jump-for-the-meat', 'fireworks-craze']) {
      const { lane, round, run, update } = fixture();
      round.game = game;
      update(0);
      run.cleared++;
      run.feedback = { kind: game === 'fireworks-craze' ? 'burst' : 'boost', at: 10 };
      update(10);
      assert.equal(lane.ring.calls.length, 0);
      assert.equal(lane.remaining.calls.length, 1);
    }
    const { lane, round, run, update } = fixture();
    round.game = 'facial-slot-machine';
    lane.slots = { reels: Array.from({ length: 3 }, () => ({ badge: fixture().lane.remaining })) };
    update(0);
    run.reelMask = 4;
    run.cleared = 1;
    update(10);
    assert.deepEqual(lane.slots.reels.map(reel => reel.badge.calls.length), [0, 0, 1]);
    run.reelMask = 5;
    run.cleared = 2;
    update(20);
    assert.deepEqual(lane.slots.reels.map(reel => reel.badge.calls.length), [1, 0, 1]);
  } finally { globalThis.document = previous; }
});

test('Perm hits pop the dancer, while Monkey response dots never animate a new watch cue', () => {
  const previous = globalThis.document;
  globalThis.document = { hidden: false };
  try {
    const { lane, round, run, update } = fixture();
    const dancer = fixture().lane.remaining;
    lane.avatar = { querySelector: () => dancer };
    round.game = 'perm-mania';
    update(0);
    run.feedback = { kind: 'Perfect!', at: 10 };
    update(10);
    assert.equal(dancer.calls.length, 1);
    const monkey = fixture();
    monkey.round.game = 'mimicking-monkeys';
    monkey.lane.monkeys = { dots: [fixture().lane.remaining] };
    monkey.run.entered = 1;
    monkey.run.phase = () => ({ mode: 'play' });
    monkey.update(0);
    monkey.run.feedback = { kind: 'hit', at: 10 };
    monkey.update(10);
    assert.equal(monkey.lane.monkeys.dots[0].calls.length, 1);
    monkey.run.phase = () => ({ mode: 'watch' });
    monkey.run.feedback = { kind: 'hit', at: 20 };
    monkey.run.cleared++;
    monkey.update(20);
    assert.equal(monkey.lane.monkeys.dots[0].calls.length, 1);
    assert.equal(monkey.lane.ring.calls.length, 1);
  } finally { globalThis.document = previous; }
});
