import { LadderStage } from '../src/ladder-view.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladderCourse, LadderRun, LADDER_GAME, ladderPoint } from '../shared/ladder.js';
import { createRun, roundSettings } from '../shared/games.js';
import { captureVisual, sanitizeVisual, RemoteRuns } from '../shared/visual-state.js';
const round = seed => ({ id: 'ladder', game: LADDER_GAME, ...roundSettings(LADDER_GAME, seed) });
test('Ladder has ten deterministic 3–6 rung ladders with changing positions and matching round goals', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const course = ladderCourse(seed), run = createRun(round(seed), 0);
    assert.deepEqual(course, ladderCourse(seed)); assert.equal(course.length, 10);
    assert.ok(course.every((ladder, index) => ladder.steps >= 3 && ladder.steps <= 6 && (!index || ladder.column !== course[index - 1].column)));
    assert.equal(run.goal, round(seed).goal); assert.equal(run.goal, course.reduce((sum, ladder) => sum + ladder.steps, 0));
    assert.deepEqual(run.sequence, course.flatMap(ladder => Array(ladder.steps).fill(ladder.column)));
  }
});
test('Ladder judges positions, guards rapid inputs, preserves progress after mistakes, and settles the trophy at its scheduled arrival', () => {
  const run = new LadderRun(round(123), 1000);
  assert.equal(run.tap(run.sequence[0], 999).type, 'ignored');
  run.tap((run.sequence[0] + 1) % 3, 1000); assert.equal(run.mistakes, 1); assert.equal(run.cleared, 0);
  assert.equal(run.tap(run.sequence[0], 1249).type, 'ignored');
  run.tap(run.sequence[0], 1250); assert.equal(run.cleared, 1);
  assert.equal(run.tap(run.sequence[1], 1349).type, 'ignored');
  let at = 1500;
  while (run.cleared < run.goal) { run.tap(run.sequence[run.cleared], at); at += 250; }
  assert.equal(run.done, false); const finishAt = run.finishAt;
  assert.equal(run.tap(0, finishAt - 1).type, 'ignored');
  run.advance(finishAt - 1); assert.equal(run.done, false);
  run.advance(finishAt + 1000); assert.equal(run.done, true); assert.equal(run.elapsed, finishAt - run.start);
  assert.equal(run.events.filter(event => event.type === 'ladderStep').length, run.goal);
  assert.equal(run.events.filter(event => event.type === 'stageComplete').length, 10);
  assert.equal(run.events.filter(event => event.final).length, 1);
  run.advance(finishAt + 2000); assert.equal(run.events.filter(event => event.final).length, 1);
  assert.deepEqual(ladderPoint(run.course, run.goal), { column: run.course.at(-1).column, height: run.course.at(-1).base + run.course.at(-1).steps });
});
test('Ladder deadline rejects final arrivals beyond the limit, and peer snapshots retain the same course and climb state', () => {
  const settings = round(123), run = createRun(settings, 5000);
  run.tap(run.sequence[0], 5100);
  const state = sanitizeVisual(settings, captureVisual(LADDER_GAME, run, 5200), 250);
  assert.ok(state);
  const remote = new RemoteRuns().get(settings, { id: 'peer', progress: { cleared: run.cleared, mistakes: 0, visual: state } }, 1000);
  assert.deepEqual(remote.course, run.course); assert.equal(remote.cleared, run.cleared);
  assert.equal(remote.feedback.at, 1100);
  const late = createRun(settings, 0); late.cleared = late.goal - 1;
  late.tap(late.sequence[late.cleared], late.end - 1); late.advance(late.end + 1000);
  assert.equal(late.done, false); assert.equal(late.tap(0, late.end).type, 'ignored');
});


test('Ladder renders a seeded preview before any run exists and shows the trophy only near the summit', () => {
  const previous = globalThis.document;
  class Element {
    constructor() { this.children = []; this.style = {}; this.classes = new Set(); this.classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) }; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute() {}
  }
  globalThis.document = { createElement: () => new Element() };
  try {
    const stage = new LadderStage(); stage.render({}, null, 0, 0, false, false, 0, false);
    assert.equal(stage.course.length, 10); assert.equal(stage.worker.hidden, true);
    const settings = round(123), run = createRun(settings, 0);
    stage.render(settings, run, 0, 0, true, true, 0, false);
    assert.deepEqual(stage.course, run.course); assert.equal(stage.trophy.hidden, true);
    assert.equal(stage.worker.style.left, `${25 + run.course[0].column * 25}%`);
    assert.equal(stage.worker.classes.has('ladder-left-reach'), false);
    run.tap(run.sequence[0], 100); stage.render(settings, run, 300, 300, true, true, 1, false);
    assert.equal(stage.worker.classes.has('ladder-left-reach'), true);
    run.tap(run.sequence[1], 400); stage.render(settings, run, 600, 600, true, true, 2, false);
    assert.equal(stage.worker.classes.has('ladder-left-reach'), false);
    run.cleared = run.goal; run.done = true;
    stage.render(settings, run, 10000, 10000, true, true, run.goal, true);
    assert.equal(stage.trophy.hidden, false); assert.equal(stage.worker.hidden, false);
    assert.equal(stage.worker.classes.has('ladder-left-reach'), false);
  } finally { globalThis.document = previous; }
});
