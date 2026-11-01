import test from 'node:test';
import assert from 'node:assert/strict';
import { KAYA_GAME, KAYA_GOAL, kayaStages, kayaDuration } from '../shared/kaya.js';
import { createRun, roundSettings, GAMES } from '../shared/games.js';
import { kayaPositions, KayaScene } from '../src/kaya-view.js';

test('Kaya has six seeded sets with more swaps and faster movement, and each final answer follows the actual swaps', () => {
  for (let difficulty = 1; difficulty <= 5; difficulty++) {
    const round = { id: 'kaya', game: KAYA_GAME, ...roundSettings(KAYA_GAME, 123, difficulty) };
    const stages = kayaStages(round);
    if (difficulty === 1) assert.deepEqual(stages.map(stage => stage.stepMs), [900, 720, 560, 420, 300, 220]);
    assert.equal(round.goal, KAYA_GOAL);
    assert.equal(GAMES[KAYA_GAME].sharedArena, true);
    assert.equal(stages.length, 6);
    assert.deepEqual(stages, kayaStages(round));
    assert.notDeepEqual(stages, kayaStages({ ...round, seed: 456 }));
    for (const stage of stages) {
      assert.equal(stage.puzzle.moves.length, stage.index + 2);
      assert.equal(stage.cues.length, stage.puzzle.moves.length);
      assert.equal(stage.answerEnd - stage.answerAt, 1500);
      if (stage.index) assert.ok(stage.stepMs < stages[stage.index - 1].stepMs);
      let order = [...stage.puzzle.initial];
      stage.puzzle.moves.forEach(({ left, right }, index) => {
        assert.notEqual(left, right);
        [order[left], order[right]] = [order[right], order[left]];
        assert.deepEqual(order, stage.puzzle.orders[index + 1]);
        assert.deepEqual([...order].sort(), [0, 1, 2]);
      });
      assert.equal(stage.puzzle.answer, order.indexOf(0));
    }
    assert.equal(stages.at(-1).endsAt, round.duration);
    assert.equal(round.duration, kayaDuration(difficulty));
  }
});

test('Kaya gates all input until the last shuffle finishes and preserves exact shuffle positions across frame skips', () => {
  const round = { id: 'kaya', game: KAYA_GAME, ...roundSettings(KAYA_GAME, 123) };
  const run = createRun(round, 1000);
  for (const stage of run.stages) {
    assert.equal(run.tap(stage.puzzle.answer, run.start + stage.answerAt - 1).type, 'ignored');
    stage.cues.forEach((at, turn) => {
      const beginning = run.phase(run.start + at);
      assert.equal(beginning.mode, 'turn');
      assert.equal(beginning.turn, turn);
      const poses = kayaPositions(beginning);
      assert.deepEqual(poses.map(pose => pose.slot), [0, 1, 2].map(id => stage.puzzle.orders[turn].indexOf(id)));
      const middle = run.phase(run.start + at + stage.stepMs / 2);
      assert.deepEqual(kayaPositions(middle).map(pose => pose.slot), kayaPositions(middle, true).map(pose => pose.slot));
      assert.ok(kayaPositions(middle, true).every(pose => pose.lift === 0));
    });
    const final = run.phase(run.start + stage.answerAt);
    assert.equal(final.mode, 'play');
    assert.deepEqual(kayaPositions(final).map(pose => pose.slot), [0, 1, 2].map(id => stage.puzzle.orders.at(-1).indexOf(id)));
    assert.equal(run.tap(stage.puzzle.answer, run.start + stage.answerAt).type, 'choice');
    assert.equal(run.tap(0, run.start + stage.answerAt + 1).type, 'ignored');
  }
});

class Element {
  constructor() { this.children = []; this.attributes = new Map(); this.style = { setProperty() {} }; this.classList = { toggle() {} }; }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key); }
}

test('the dog and identical kittens are fully hidden under identical blankets until the shared reveal', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  try {
    const run = createRun({ id: 'kaya', game: KAYA_GAME, ...roundSettings(KAYA_GAME, 123) }, 0);
    const scene = new KayaScene(), stage = run.stages[0];
    scene.render(run.phase(0), null);
    assert.ok(scene.subjects.every(subject => !subject.animal.hidden && subject.blanket.hidden));
    assert.equal(scene.subjects[1].animal.className, scene.subjects[2].animal.className);
    scene.render(run.phase(stage.turnsAt), null);
    assert.ok(scene.subjects.every(subject => subject.animal.hidden && !subject.blanket.hidden));
    assert.equal(new Set(scene.subjects.map(subject => subject.blanket.className)).size, 1);
    assert.doesNotMatch(scene.element.getAttribute('aria-label'), /Kaya is/);
    scene.render(run.phase(stage.answerAt), null);
    assert.ok(scene.subjects.every(subject => subject.animal.hidden));
    scene.render(run.phase(stage.answerEnd), { answer: stage.puzzle.answer });
    assert.ok(scene.subjects.every(subject => !subject.animal.hidden && subject.blanket.hidden));
    assert.match(scene.element.getAttribute('aria-label'), /Kaya is/);
  } finally { globalThis.document = previous; }
});
