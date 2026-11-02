import test from 'node:test';
import assert from 'node:assert/strict';
import { StationeryRun, StationeryMatch, stationeryStages, STATIONERY_GAME, STATIONERY_WINDOWS_MS } from '../shared/stationery.js';
import { ClockRun, ClockMatch, clockStages, clockPeriod, CLOCK_GAME } from '../shared/clock.js';
import { createRun, roundSettings, GAMES } from '../shared/games.js';
import { RoomService } from '../server/rooms.js';
import { DeskClockStage } from '../src/desk-clock-view.js';

const settings = game => ({ id: game, game, playerIds: ['a', 'b', 'c', 'd'], ...roundSettings(game, 123) });
function counterActions(stage, counts = stage.puzzle.counts) {
  let at = stage.answerAt + 100;
  return counts.flatMap((count, color) => Array.from({ length: count }, () => { const action = [color, at]; at += 80; return action; }));
}

test('Stationery has six shrinking seeded desks, exact 1–6 object counts, and distinct bounded scatter positions', () => {
  const round = settings(STATIONERY_GAME), stages = stationeryStages(round);
  assert.equal(stages.length, 6);
  assert.deepEqual(STATIONERY_WINDOWS_MS, [8000, 7400, 6800, 6200, 5600, 5000]);
  assert.deepEqual(stages.map(stage => stage.answerEnd - stage.answerAt), STATIONERY_WINDOWS_MS);
  assert.equal(stages.at(-1).endsAt, round.duration);
  assert.deepEqual(stages, stationeryStages(round));
  assert.notDeepEqual(stages, stationeryStages({ ...round, seed: 456 }));
  for (const stage of stages) {
    assert.ok(stage.puzzle.counts.every(count => Number.isInteger(count) && count >= 1 && count <= 6));
    assert.deepEqual([0, 1, 2].map(color => stage.puzzle.items.filter(item => item.color === color).length), stage.puzzle.counts);
    assert.equal(new Set(stage.puzzle.items.map(item => `${item.x}/${item.y}`)).size, stage.puzzle.items.length);
    assert.ok(stage.puzzle.items.every(item => item.x >= 6 && item.x <= 94 && item.y >= 10 && item.y <= 90));
  }
});

test('Stationery counters open after the throw, wrap after six, reject bounce, and retain newer proofs after stale acknowledgements', () => {
  const run = new StationeryRun(settings(STATIONERY_GAME), 1000), stage = run.stages[0], play = run.start + stage.answerAt;
  assert.equal(run.tap(0, play - 1).type, 'ignored');
  assert.equal(run.tap(0, NaN).type, 'ignored');
  assert.equal(run.tap(3, play).type, 'ignored');
  assert.equal(run.tap(0, play).type, 'choice');
  assert.equal(run.tap(0, play + 39).type, 'ignored');
  assert.equal(run.tap(1, play).type, 'choice');
  assert.deepEqual(run.counts, [1, 1, 0]);
  assert.equal(run.acknowledge(0, 1), false);
  assert.equal(run.pending.get(0).actions.length, 2);
  assert.equal(run.acknowledge(0, 2), true);
  for (let count = 1; count < 6; count++) run.tap(0, play + count * 40);
  assert.equal(run.counts[0], 6);
  assert.equal(run.tap(0, play + 1000).type, 'choice');
  assert.equal(run.counts[0], 0);
  run.tap(0, play + 1040);
  assert.equal(run.counts[0], 1);
  assert.equal(run.tap(2, run.start + stage.answerEnd).type, 'ignored');
  run.advance(run.start + stage.endsAt);
  assert.deepEqual(run.counts, [0, 0, 0]);
});

test('Stationery verifies growing input proofs, rejects rewrites and late presses, and awards only exact complete counts once', () => {
  const round = settings(STATIONERY_GAME), stages = stationeryStages(round), match = new StationeryMatch(round, stages);
  const stage = stages[0], actions = counterActions(stage), received = stage.answerAt + 3000;
  assert.equal(match.choose('a', { index: 0, actions: actions.slice(0, 1) }, received), true);
  assert.equal(match.choose('a', { index: 0, actions }, received), true);
  assert.deepEqual(match.state.counters.a.counts, stage.puzzle.counts);
  const rewrite = actions.map(action => [...action]); rewrite[0][1]++;
  assert.equal(match.choose('a', { index: 0, actions: rewrite }, received), false);
  for (const malformed of [[], Array(28).fill([0, 100]), [[3, 100]], [[0, NaN]], [[0, -1]], [[0, stage.answerEnd]], [[0, 100], [0, 101]]]) {
    assert.equal(match.choose('b', { index: 0, actions: malformed }, received), false);
  }
  assert.equal(match.choose('b', { index: 0, actions }, stage.revealAt), false);
  assert.equal(match.advance(stage.revealAt - 1), false);
  assert.equal(match.advance(stage.revealAt), true);
  assert.deepEqual(match.state.results[0].correctIds, ['a']);
  assert.deepEqual(match.state.scores, { a: 1, b: 0, c: 0, d: 0 });
  assert.equal(match.advance(stage.revealAt + 1), false);
  assert.equal(match.choose('a', { index: 0, actions }, stage.endsAt + 100), true);
  assert.equal(match.state.scores.a, 1);
});

test('a maximum-size Stationery answer is received after its last press, preserving future-input checks', () => {
  const round = { ...settings(STATIONERY_GAME), seed: 90 }, stages = stationeryStages(round);
  const stage = stages[0], actions = counterActions(stage), match = new StationeryMatch(round, stages);
  assert.deepEqual(stage.puzzle.counts, [6, 6, 6]);
  assert.ok(actions.at(-1)[1] > 3000 + 250);
  assert.equal(match.choose('a', { index: 0, actions }, 3000), false);
  assert.equal(match.choose('a', { index: 0, actions }, actions.at(-1)[1] + 20), true);
  match.advance(stage.revealAt);
  assert.equal(match.state.scores.a, 1);
});

test('Clock periods accelerate from 1.2 to 0.5 seconds and target hours advance from one through ten', () => {
  const round = settings(CLOCK_GAME), stages = clockStages(round);
  assert.equal(stages.length, 10);
  assert.deepEqual(stages.map(stage => stage.puzzle.hour), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(clockPeriod(0), 1200); assert.equal(clockPeriod(9), 500);
  assert.ok(stages.every((stage, index) => !index || stage.puzzle.period < stages[index - 1].puzzle.period));
  assert.ok(stages.every(stage => stage.targetAt - stage.spinAt === stage.puzzle.period));
  assert.equal(stages.at(-1).endsAt, round.duration);
  assert.equal(GAMES[CLOCK_GAME].scoreNoun, 'pts');
});

test('Clock prevents instant twelve wins, accepts any button, and locks the first local stop', () => {
  for (const color of [0, 1, 2]) {
    const run = new ClockRun(settings(CLOCK_GAME), 1000), stage = run.stages[0];
    assert.equal(run.tap(color, run.start + stage.spinAt).type, 'ignored');
    assert.equal(run.tap(color, run.start + stage.answerAt - .01).type, 'ignored');
    assert.equal(run.tap(color, run.start + stage.targetAt).type, 'choice');
    assert.equal(run.tap((color + 1) % 3, run.start + stage.targetAt + 1).type, 'ignored');
    assert.equal(run.selections.get(0).elapsed, stage.targetAt);
    run.advance(run.start + stage.endsAt);
    assert.equal(run.index, 1);
    assert.equal(run.selections.has(1), false);
  }
});

test('Clock ranks stop-time error rather than packet order, shares tied places, and never awards duplicate sets', () => {
  const round = settings(CLOCK_GAME), stages = clockStages(round), match = new ClockMatch(round, stages), stage = stages[0];
  const stop = (id, error, latency) => match.choose(id, { index: 0, color: 1, elapsed: stage.targetAt + error }, stage.targetAt + error + latency);
  assert.equal(stop('b', 10, 0), true);
  assert.equal(stop('a', -10, 100), true);
  assert.equal(stop('c', 25, 30), true);
  assert.equal(stop('a', 0, 0), false);
  assert.equal(match.advance(stage.answerEnd + 79), false);
  assert.equal(match.advance(stage.answerEnd + 80), true);
  assert.deepEqual(match.state.scores, { a: 10, b: 10, c: 4, d: 0 });
  assert.deepEqual(match.state.results[0].errors, { a: -10, b: 10, c: 25, d: null });
  assert.equal(match.advance(stage.endsAt), false);
  assert.equal(stop('a', -10, 100), true);
});

for (const game of [STATIONERY_GAME, CLOCK_GAME]) test(`${game}: server owns scores, acknowledges valid inputs, and rejects forged finish reports`, () => {
  let time = 100000;
  const messages = [], clients = [{}, {}];
  const service = new RoomService({ now: () => time, send: (client, message) => messages.push({ client, message }) });
  service.handle(clients[0], { type: 'create', name: 'Host', mode: 'game-select', game });
  const room = service.rooms.get(clients[0].room);
  service.handle(clients[1], { type: 'join', name: 'Friend', code: room.code });
  service.handle(clients[0], { type: 'start' });
  clients.forEach(client => { service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 }); service.handle(client, { type: 'ready', ready: true }); });
  const round = room.round, run = createRun(round, 0), stage = run.stages[0];
  time = round.startAt + 3000;
  service.handle(clients[0], { type: 'result', roundId: round.id, status: 'finished', cleared: 999, elapsed: 100, mistakes: 0 });
  assert.equal(room.players[0].result, null);
  const input = game === CLOCK_GAME ? { index: 0, color: 2, elapsed: stage.targetAt } : { index: 0, actions: counterActions(stage) };
  time = round.startAt + (game === CLOCK_GAME ? stage.targetAt : input.actions.at(-1)[1]) + 20;
  service.handle(clients[0], { type: 'shared-choice', roundId: round.id, ...input });
  const ack = messages.find(entry => entry.message.type === 'shared-choice-ack').message;
  assert.equal(ack.index, 0);
  if (game === STATIONERY_GAME) assert.equal(ack.revision, input.actions.length);
  time = round.startAt + (stage.revealAt ?? stage.answerEnd + 80); service.tick();
  assert.equal(round.choice.scores[room.players[0].id], game === CLOCK_GAME ? 10 : 1);
  time = round.endAt; service.tick();
  assert.equal(room.players[0].result.cleared, game === CLOCK_GAME ? 10 : 1);
  assert.equal(room.set.players[0].points, 10);
});

class Element {
  constructor() { this.children = []; this.dataset = {}; this.attributes = new Map(); this.style = {}; this.classes = new Set(); this.classList = { add: name => this.classes.add(name), toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key); }
}
test('the shared desk hides countdown items and future answers, while clocks freeze at published stop timestamps', () => {
  const previous = globalThis.document; globalThis.document = { createElement: () => new Element() };
  try {
    const players = [{ id: 'a', name: 'You' }, { id: 'b', name: 'Friend' }];
    const round = settings(STATIONERY_GAME), run = new StationeryRun(round, 1000), view = new DeskClockStage(), match = new StationeryMatch(round, run.stages);
    round.choice = match.state;
    const room = { round, players };
    view.render(room, 'a', { run }, 999);
    assert.ok(view.items.every(item => item.hidden));
    run.tap(0, 1000 + run.stages[0].answerAt); view.render(room, 'a', { run }, 1000 + run.stages[0].answerAt);
    assert.ok(view.items.every(item => !item.hidden));
    assert.equal(view.rows[0].counts[0].value.textContent, '1');
    assert.ok(view.rows[0].counts.every(counter => counter.target.hidden));
    const clockRound = settings(CLOCK_GAME), clockRun = new ClockRun(clockRound, 1000), stage = clockRun.stages[0], clockMatch = new ClockMatch(clockRound, clockRun.stages);
    clockRound.choice = clockMatch.state;
    clockRun.tap(1, clockRun.start + stage.targetAt);
    clockMatch.choose('b', { index: 0, color: 0, elapsed: stage.targetAt + 10 }, stage.targetAt + 20);
    const clockView = new DeskClockStage(), clockRoom = { round: clockRound, players };
    clockView.render(clockRoom, 'a', { run: clockRun }, clockRun.start + stage.targetAt + 30);
    const ownAngle = clockView.rows[0].clock.minute.style.transform, peerAngle = clockView.rows[1].clock.minute.style.transform;
    clockView.render(clockRoom, 'a', { run: clockRun }, clockRun.start + stage.targetAt + 100);
    assert.equal(clockView.rows[0].clock.minute.style.transform, ownAngle);
    assert.equal(clockView.rows[1].clock.minute.style.transform, peerAngle);
  } finally { globalThis.document = previous; }
});


test('Stationery accepts corrections beyond 27 taps, wraps counters on the server, and keeps all four seats visible', () => {
  const round = settings(STATIONERY_GAME), stages = stationeryStages(round), match = new StationeryMatch(round, stages), stage = stages[0];
  const counts = [...stage.puzzle.counts]; counts[0] += 28;
  const actions = counterActions(stage, counts);
  assert.ok(actions.length > 27);
  assert.equal(match.choose('a', { index: 0, actions: actions.slice(0, 7) }, 4000), true);
  assert.equal(match.state.counters.a.counts[0], 0);
  assert.equal(match.choose('a', { index: 0, actions }, 7000), true);
  assert.deepEqual(match.state.counters.a.counts, stage.puzzle.counts);
  match.advance(stage.revealAt);
  assert.equal(match.state.scores.a, 1);
  const previous = globalThis.document; globalThis.document = { createElement: () => new Element() };
  try {
    for (const game of [STATIONERY_GAME, CLOCK_GAME]) {
      const scheduled = { ...settings(game), playerIds: ['a', 'b'] }, run = createRun(scheduled, 0);
      scheduled.choice = { scores: { a: 0, b: 0 }, results: [], counters: { b: { index: 0, counts: [3, 2, 1] } }, stops: {} };
      const room = { round: scheduled, players: [{ id: 'a', name: 'Host' }, { id: 'b', name: 'Friend' }] };
      const view = new DeskClockStage(); view.render(room, 'a', { run }, 1000);
      assert.equal(view.rows.length, 4);
      assert.equal(view.rows[2].card.children[0].children[0].textContent, 'Open spot');
      assert.equal(view.rows[3].timing.textContent, 'Waiting to join');
      assert.equal(view.rows[2].clockSpace.hidden, true);
      if (game === STATIONERY_GAME) assert.equal(view.rows[1].counts[0].value.textContent, '3');
      const preview = new DeskClockStage({ preview: true }); preview.render(room, 'a', { run }, 1000);
      assert.equal(preview.rows.length, 2);
    }
  } finally { globalThis.document = previous; }
});


test('Stationery throws seek on the shared clock, finish before counting, and player footers retain identities', () => {
  const previous = globalThis.document; globalThis.document = { createElement: () => new Element() };
  try {
    const round = settings(STATIONERY_GAME), run = new StationeryRun(round, 1000);
    round.choice = { scores: { a: 0, b: 0 }, results: [], counters: {} };
    const room = { round, players: [{ id: 'a', name: 'Host', characterId: 4 }, { id: 'b', name: 'Friend', characterId: 7 }] };
    const view = new DeskClockStage();
    view.render(room, 'a', { run }, 999);
    assert.ok(view.items.every(item => item.hidden));
    view.render(room, 'a', { run }, 1100);
    assert.ok(view.items.some(item => item.hidden));
    assert.ok(view.poses.some(pose => pose.y !== 0));
    assert.equal(run.phase(1100).mode, 'throw');
    const targetTime = run.start + run.stages[0].answerAt;
    view.render(room, 'a', { run }, targetTime);
    assert.ok(view.items.every(item => !item.hidden));
    assert.ok(view.poses.every(pose => pose.y === 0 && pose.x === 0 && pose.scale === 1));
    assert.equal(run.phase(targetTime).mode, 'play');
    const footer = view.rows[1].card.children.at(-1);
    assert.equal(footer.children[0].dataset.character, '7');
    assert.equal(footer.children[1].textContent, 'Friend');
    view.render(room, 'a', { run }, 1100);
    const rewind = view.poses.map(pose => [pose.x, pose.y]);
    const other = new DeskClockStage(); other.render(room, 'b', { run }, 1100);
    other.poses.forEach((pose, index) => { assert.ok(Math.abs(pose.x - rewind[index][0]) < 0.0001); assert.ok(Math.abs(pose.y - rewind[index][1]) < 0.0001); });
    const reduced = new DeskClockStage(); reduced.motion = { matches: true };
    reduced.render(room, 'a', { run }, 1100);
    assert.ok(reduced.items.every(item => item.hidden));
    reduced.render(room, 'a', { run }, targetTime);
    assert.ok(reduced.items.every(item => !item.hidden));
    assert.ok(reduced.poses.every(pose => pose.y === 0 && pose.x === 0));
    view.dispose(); other.dispose(); reduced.dispose();
    assert.equal(view.tween, null);
  } finally { globalThis.document = previous; }
});
