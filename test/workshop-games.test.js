import { CHOICE_GRACE_MS, ChoiceMatch } from '../shared/choice-round.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, comparePlayers, createRun, roundSettings } from '../shared/games.js';
import { captureVisual, sanitizeVisual } from '../shared/visual-state.js';
import {
  DAM_GAME, METRO_GAME, METRO_ARRIVAL_MS, METRO_CRASH, METRO_ENTRY_MS,
  METRO_FORK_MS, METRO_PASSENGERS, SUSHI_GAME, SUSHI_ITEMS, WORKSHOP_LANES, damPuzzles, validWorkshopResult,
} from '../shared/workshop-games.js';
import { workshopDemoPlan } from '../src/workshop-demo.js';
import { driveWorkshop } from './helpers/workshop-games.js';

const settings = (game, seed = 123, level = 1) => ({ id: game, game, ...roundSettings(game, seed, level) });

test('every dam gap has exactly one fit and two distinct wrong blocks', () => {
  for (let seed = 0; seed < 80; seed++) for (let level = 1; level <= 5; level++) {
    for (const { choices, correct, profile } of damPuzzles(settings(DAM_GAME, seed, level))) {
      assert.deepEqual(choices[correct], profile);
      assert.equal(new Set(choices.map(choice => choice.join(','))).size, 3);
    }
  }
});

test('Dam Good Fit locks the first answer and reveals every seat together after the deadline', () => {
  for (let level = 1; level <= 5; level++) {
    const round = { ...settings(DAM_GAME, 123, level), playerIds: ['one', 'two', 'three'] };
    const run = createRun(round, 0);
    const match = new ChoiceMatch(round, run.stages);
    assert.equal(run.stages.length, 8);
    assert.equal(run.stages.at(-1).endsAt, round.duration);
    let prior = Infinity;
    for (const stage of run.stages) {
      const window = stage.answerEnd - stage.answerAt;
      assert.ok(window < prior);
      prior = window;
      const elapsed = stage.answerAt + 10;
      const color = stage.puzzle.answer;
      assert.equal(run.tap(color, elapsed).type, 'choice');
      assert.equal(run.tap((color + 1) % 3, elapsed + 2).type, 'ignored');
      const choice = run.selections.get(stage.index);
      assert.equal(match.choose('one', choice, elapsed), true);
      assert.equal(match.choose('one', { ...choice, color: (color + 1) % 3 }, elapsed), false);
      assert.equal(match.choose('two', { ...choice, color: (color + 1) % 3 }, elapsed), true);
      assert.equal(match.advance(stage.answerEnd - 1), false);
      assert.equal(match.state.results.length, stage.index);
      assert.equal(match.advance(stage.answerEnd + CHOICE_GRACE_MS), true);
      const result = match.state.results.at(-1);
      assert.deepEqual(result.choices, { one: color, two: (color + 1) % 3, three: null });
      assert.deepEqual(result.correctIds, ['one']);
    }
    assert.deepEqual(match.state.scores, { one: 8, two: 0, three: 0 });
  }
});

test('Sushi Switchboard supports both item orders and repeated colors, preserving a partial order after a miss', () => {
  const run = createRun(settings(SUSHI_GAME), 0);
  const colorOf = item => run.menu.findIndex(bucket => bucket.includes(item));
  assert.deepEqual([...run.menu.flat()].sort((a, b) => a - b), SUSHI_ITEMS.map((_, index) => index));
  run.tap(colorOf(run.sequence[0][0]), run.blockedUntil);
  const sharedColorOrder = run.sequence[1];
  const sharedColor = colorOf(sharedColorOrder[0]);
  assert.equal(colorOf(sharedColorOrder[1]), sharedColor);
  const at = run.blockedUntil;
  assert.equal(run.tap(sharedColor, at).type, 'move');
  assert.equal(run.servedMask, 1);
  assert.equal(run.tap(sharedColor, at + 40).type, 'ignored');
  assert.equal(run.tap((sharedColor + 1) % 3, at + 100).type, 'mistake');
  assert.equal(run.servedMask, 1);
  assert.equal(run.tap(sharedColor, run.blockedUntil).type, 'clear');
  const [first, second] = run.sequence[2].map(colorOf);
  assert.notEqual(first, second);
  assert.equal(run.tap(second, run.blockedUntil).type, 'move');
  assert.equal(run.servedMask, 2);
  assert.equal(run.tap(first, run.blockedUntil + 100).type, 'clear');
  assert.equal(run.cleared, 3);
});

test('Mole Metro latches a route at each switch and penalizes a collision without taking back delivered passengers', () => {
  const round = settings(METRO_GAME, 15);
  const run = createRun(round, 0);
  const first = run.trains[0];
  const branch = first.target >> 1;
  if ((run.switches & 1) !== branch) run.tap(0, first.at + METRO_ENTRY_MS - 100);
  const fork = 1 + branch;
  if ((run.switches >> fork & 1) !== (first.target & 1)) run.tap(fork, first.at + METRO_FORK_MS - 100);
  run.tap(0, first.at + METRO_ENTRY_MS);
  assert.equal(run.routes[0], branch);
  run.tap(0, first.at + METRO_ENTRY_MS + 100);
  const arrival = first.at + METRO_ARRIVAL_MS;
  run.advance(arrival);
  assert.equal(run.cleared, METRO_PASSENGERS);
  run.advance(arrival + round.headway);
  assert.equal(run.routes[1], METRO_CRASH + first.target);
  assert.equal(run.cleared, METRO_PASSENGERS);
  assert.equal(run.mistakes, 1);
  assert.equal(run.feedback.kind, 'crash');
  const visual = captureVisual(round.game, run, arrival + round.headway);
  assert.ok(sanitizeVisual(round, visual, visual.sample));
  visual.fields.routes[0] = 19;
  assert.equal(sanitizeVisual(round, visual, visual.sample), null);
});

test('Mole Metro has a collision-free solution at every difficulty and ranks passenger counts', () => {
  for (let level = 1; level <= 5; level++) for (let seed = 0; seed < 20; seed++) {
    const round = settings(METRO_GAME, seed, level);
    const perfect = driveWorkshop(round);
    const missed = driveWorkshop(round, { misses: 2 });
    assert.equal(perfect.cleared, round.goal, `level ${level}, seed ${seed}`);
    assert.equal(perfect.mistakes, 0);
    assert.equal(perfect.elapsed, round.duration);
    assert.ok(validWorkshopResult(round, perfect));
    assert.equal(validWorkshopResult(round, { ...missed, cleared: round.goal }), false);
    const result = run => ({ result: { status: 'finished', cleared: run.cleared, elapsed: run.elapsed } });
    assert.ok(comparePlayers(result(perfect), result(missed), METRO_GAME) < 0);
    assert.equal(GAMES[METRO_GAME].scoreNoun, 'passengers');
  }
});

test('Sushi and Metro tutorials use their gameplay models and cue one Ding per success', () => {
  for (const game of WORKSHOP_LANES) for (let level = 1; level <= 5; level++) {
    const plan = workshopDemoPlan(game, level);
    const run = createRun(plan.settings, plan.start);
    for (const { color, at } of plan.presses) assert.notEqual(run.tap(color, at).type, 'ignored', game);
    run.advance?.(plan.completeAt);
    assert.equal(run.cleared, game === METRO_GAME ? plan.settings.trainCount * METRO_PASSENGERS : plan.settings.goal, game);
    assert.equal(plan.cues.filter(cue => cue.type === 'complete').length, 3, game);
    assert.equal(run.mistakes, 0);
  }
});
