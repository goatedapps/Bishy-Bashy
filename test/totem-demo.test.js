import test from 'node:test';
import assert from 'node:assert/strict';
import { TotemDemo, totemDemoFrame, TOTEM_DEMO_STEP_MS, TOTEM_DEMO_TAP_MS, TOTEM_DEMO_LOOP_MS } from '../src/totem-demo.js';

test('Totem demonstration synchronizes three matching presses and clears, then resets the loop', () => {
  for (let step = 0; step < 3; step++) {
    const at = step * TOTEM_DEMO_STEP_MS + TOTEM_DEMO_TAP_MS;
    const before = totemDemoFrame(at - 1), pressed = totemDemoFrame(at), after = totemDemoFrame(at + 280);
    assert.equal(before.base, step);
    assert.equal(before.pressed, false);
    assert.equal(pressed.color, [1, 2, 0][step]);
    assert.equal(pressed.pressed, true);
    assert.equal(pressed.hand, true);
    assert.equal(after.base, step + 1);
    assert.equal(after.offset, 0);
  }
  assert.equal(totemDemoFrame(TOTEM_DEMO_LOOP_MS - 1).base, 3);
  assert.deepEqual(totemDemoFrame(TOTEM_DEMO_LOOP_MS), totemDemoFrame(0));
});

test('Totem reduced motion keeps matching discrete presses and clears without tower interpolation', () => {
  const before = totemDemoFrame(TOTEM_DEMO_TAP_MS - 1, true);
  const after = totemDemoFrame(TOTEM_DEMO_TAP_MS, true);
  assert.equal(before.base, 0);
  assert.equal(after.base, 1);
  assert.equal(after.offset, 0);
  assert.equal(after.handY, 0);
});

test('hidden demonstrations freeze their clock and resume without catching up', () => {
  const demo = Object.create(TotemDemo.prototype);
  demo.elapsed = 0;
  demo.previousTime = null;
  demo.paint = frame => { demo.frame = frame; };
  demo.advance(100, true);
  demo.advance(1100, true);
  assert.equal(demo.elapsed, 1000);
  demo.advance(1200, false);
  demo.advance(30_000, true);
  assert.equal(demo.elapsed, 1000);
  demo.advance(30_100, true);
  assert.equal(demo.elapsed, 1100);
});
