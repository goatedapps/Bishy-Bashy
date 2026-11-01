import test from 'node:test';
import assert from 'node:assert/strict';
import { PermDemo, permDemoPlan } from '../src/perm-demo.js';
import { AUDIO_FILES, audioAssetIds } from '../scripts/audio/score.js';

test('Perm audio preloads the three supplied colored hit cues for the tutorial', () => {
  for (const color of ['red', 'green', 'blue']) {
    assert.ok(audioAssetIds('perm-mania').includes(color));
    assert.equal(AUDIO_FILES[color], `hit-${color}.wav`);
  }
});

function setup(bpm = 128) {
  const demo = Object.create(PermDemo.prototype);
  demo.plan = permDemoPlan({ seed: 123, bpm });
  demo.elapsed = 0;
  demo.previousTime = null;
  demo.paint = () => {};
  const sounds = [];
  demo.callbacks = Object.fromEntries(['watch', 'press', 'complete'].map(type => [type, color => sounds.push({ type, color })]));
  demo.resetRun(0);
  demo.advance(0, true);
  return { demo, sounds };
}

test('Perm tutorial plays one real watch-and-response phrase, grows hair, and resets on each loop at every game tempo', () => {
  for (const bpm of [128, 136, 144]) {
    const { demo, sounds } = setup(bpm);
    const watches = demo.plan.cues.filter(cue => cue.type === 'watch');
    const presses = demo.plan.cues.filter(cue => cue.type === 'press');
    presses.forEach((cue, index) => assert.ok(Math.abs(cue.at - watches[index].at - 4 * 60_000 / bpm) < .001));
    for (let loop = 0; loop < 2; loop++) {
      for (const cue of demo.plan.cues) {
        const at = loop * demo.plan.duration + cue.at;
        demo.advance(at, true);
        demo.advance(at, true);
      }
      assert.equal(demo.run.done, true);
      assert.equal(demo.run.cleared, 1);
      assert.equal(demo.run.mistakes, 0);
      assert.equal(demo.run.hits, 4);
      demo.advance((loop + 1) * demo.plan.duration, true);
      assert.equal(demo.run.cleared, 0);
      assert.equal(demo.run.done, false);
    }
    assert.deepEqual(sounds.filter(cue => cue.type === 'press').map(cue => cue.color), Array(8).fill(1));
    assert.equal(sounds.filter(cue => cue.type === 'watch').length, 8);
    assert.equal(sounds.filter(cue => cue.type === 'complete').length, 2);
  }
});

test('Perm tutorial skips stale audio and pauses hidden time without affecting its successful demonstration', () => {
  const { demo, sounds } = setup();
  const first = demo.plan.cues[0].at;
  demo.advance(first + 200, true);
  assert.deepEqual(sounds, []);
  demo.advance(first + 210, false);
  demo.advance(30_000, true);
  assert.equal(demo.elapsed, first + 200);
  assert.deepEqual(sounds, []);
  demo.advance(30_000 + demo.plan.duration, true);
  assert.deepEqual(sounds, []);
});
