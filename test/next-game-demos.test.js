import test from 'node:test';
import assert from 'node:assert/strict';
import { SlotRun } from '../shared/slots.js';
import { MonkeyRun } from '../shared/monkeys.js';
import { roundSettings } from '../shared/games.js';
import { ScriptedDemo } from '../src/scripted-demo.js';
import { slotsDemoPlan } from '../src/slots-demo.js';
import { fireworksDemoPlan, createFireworksDemoRun } from '../src/fireworks-demo.js';
import { monkeysDemoPlan } from '../src/monkeys-demo.js';

const games = [
  ['facial-slot-machine', slotsDemoPlan, (round, start) => new SlotRun(round, start)],
  ['fireworks-craze', fireworksDemoPlan, createFireworksDemoRun],
  ['mimicking-monkeys', monkeysDemoPlan, (round, start) => new MonkeyRun(round, start)],
];

function setup(plan, createRun) {
  const demo = Object.create(ScriptedDemo.prototype);
  Object.assign(demo, { plan, createRun, elapsed: 0, previousTime: null, paint() {}, paintControls() {} });
  const heard = [];
  demo.callbacks = Object.fromEntries(['press', 'watch', 'complete', 'launch'].map(type => [type, color => heard.push({ type, color })]));
  demo.resetRun(0);
  demo.advance(0, true);
  return { demo, heard };
}

for (const [game, planFor, createRun] of games) {
  test(`${game}: the tutorial performs valid scheduled inputs, completes, and loops at every difficulty`, () => {
    for (let level = 1; level <= 5; level++) {
      const plan = planFor(roundSettings(game, 99, level));
      const { demo, heard } = setup(plan, createRun);
      for (let cycle = 0; cycle < 2; cycle++) {
        for (const cue of plan.cues) {
          const at = cycle * plan.duration + cue.at;
          demo.advance(at, true);
          demo.advance(at, true);
        }
        assert.equal(demo.run.done, true);
        assert.equal(demo.run.mistakes, 0);
        if (game === 'facial-slot-machine') assert.equal(demo.run.reelMask, 7);
        else assert.equal(demo.run.cleared, plan.settings.goal);
        demo.advance((cycle + 1) * plan.duration, true);
        assert.equal(demo.run.done, false);
      }
      assert.equal(heard.filter(cue => cue.type === 'press').length, plan.presses.length * 2);
      assert.equal(heard.filter(cue => cue.type === 'complete').length, 2);
    }
  });

  test(`${game}: hidden time and delayed frames never replay old sounds or corrupt the example`, () => {
    const plan = planFor();
    const { demo, heard } = setup(plan, createRun);
    demo.advance(100, true);
    demo.advance(200, false);
    demo.advance(30_000, true);
    assert.equal(demo.elapsed, 100);
    assert.deepEqual(heard, []);
    demo.advance(30_000 + 4 * plan.duration + plan.completeAt + 300, true);
    assert.deepEqual(heard, []);
    assert.equal(demo.run.done, true);
    assert.equal(demo.run.mistakes, 0);
  });
}

test('firework tutorial shows three distinct airborne colors, and monkey presses reproduce the watched order', () => {
  const fireworks = fireworksDemoPlan();
  const run = createFireworksDemoRun(fireworks.settings, fireworks.start);
  assert.equal(run.rockets.length, 3);
  assert.equal(new Set(run.rockets.map(rocket => rocket.color)).size, 3);
  fireworks.presses.forEach((press, index) => {
    assert.equal(press.color, run.rockets[index].color);
    assert.ok(press.at >= run.rockets[index].launchAt && press.at < run.rockets[index].launchAt + run.rockets[index].airMs);
  });
  const monkeys = monkeysDemoPlan();
  assert.deepEqual(monkeys.presses.map(cue => cue.color), monkeys.cues.filter(cue => cue.type === 'watch').map(cue => cue.color));
  assert.ok(monkeys.presses[0].at > monkeys.cues.filter(cue => cue.type === 'watch').at(-1).at);
});
