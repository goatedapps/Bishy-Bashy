import test from 'node:test';
import assert from 'node:assert/strict';
import { HappyRun, happyChart, HAPPY_GAME, HAPPY_GOAL, HAPPY_GOOD_MS, HAPPY_PERFECT_MS, validHappyScore } from '../shared/happy.js';
import { roundSettings, createRun, comparePlayers } from '../shared/games.js';
import { HeldInputs } from '../src/held-input.js';
import { RoomService } from '../server/rooms.js';
import { captureVisual, sanitizeVisual, RemoteRuns } from '../shared/visual-state.js';
import { HappyStage } from '../src/happy-view.js';

const round = { id: 'happy', game: HAPPY_GAME, ...roundSettings(HAPPY_GAME, 123) };
const single = duration => new HappyRun({ ...round, goal: 1 }, 1000, 0, [{ index: 0, color: 0, at: 1000, duration, phrase: 0 }]);
function perform(run, shift = 0) {
  const inputs = run.notes.flatMap(note => [
    { at: run.start + note.at + run.offset + shift, color: note.color, down: true },
    { at: run.start + note.at + run.offset + shift + note.duration + (note.duration ? 0 : 20), color: note.color, down: false },
  ]).sort((a, b) => a.at - b.at);
  for (const input of inputs) input.down ? run.tap(input.color, input.at) : run.release(input.color, input.at);
  run.advance(run.end);
}

test('Happy Days uses seeded musical charts with three columns, taps and holds, and room for both timing windows', () => {
  const notes = happyChart(123);
  assert.deepEqual(notes, happyChart(123));
  assert.equal(notes.length, HAPPY_GOAL);
  assert.equal(round.duration, 30000);
  assert.equal(new Set(notes.map(note => note.color)).size, 3);
  assert.ok(notes.some(note => note.duration === 0));
  assert.equal(new Set(notes.filter(note => note.duration).map(note => note.duration)).size, 2);
  for (const note of notes) {
    assert.ok(note.at >= 1500);
    assert.ok(note.at + note.duration + HAPPY_GOOD_MS < 30000);
    const previous = notes.filter(other => other.index < note.index && other.color === note.color).at(-1);
    if (previous) assert.ok(note.at - previous.at - previous.duration > HAPPY_GOOD_MS * 2);
  }
  for (let level = 1; level <= 5; level++) assert.deepEqual(createRun({ ...round, ...roundSettings(HAPPY_GAME, 123, level) }, 0).notes, notes);
  assert.notDeepEqual(happyChart(123), happyChart(999));
  assert.notDeepEqual(happyChart(123).map(note => note.at), happyChart(999).map(note => note.at));
  for (let seed = 0; seed < 100; seed++) {
    const chart = happyChart(seed);
    assert.equal(chart.length, HAPPY_GOAL); assert.equal(chart.filter(note => note.duration).length, 17);
    for (const note of chart) {
      const previous = chart.filter(other => other.index < note.index && other.color === note.color).at(-1);
      if (previous) assert.ok(note.at - previous.at - previous.duration > HAPPY_GOOD_MS * 2);
      assert.ok(note.at + note.duration + HAPPY_GOOD_MS < 30000);
    }
    const run = createRun({ ...round, seed }, 0); perform(run);
    assert.equal(run.mistakes, 0); assert.equal(run.score, HAPPY_GOAL * 1000);
  }
});

test('tap timing has inclusive Perfect/Good edges and rejects too-early, too-late and held repeat inputs', () => {
  for (const [error, grade] of [[-141, 0], [-140, 3], [-55, 2], [0, 2], [55, 2], [140, 3], [141, 4]]) {
    const run = single(0);
    const action = run.tap(0, 2000 + error);
    assert.equal(run.judgments[0], grade);
    if (grade === 2 || grade === 3) {
      assert.equal(action.type, 'note');
      assert.equal(run.tap(0, 2001 + error).type, 'ignored');
      assert.equal(run.score, grade === 2 ? 1000 : 500);
    } else assert.equal(action.type, 'mistake');
  }
  const early = single(0);
  early.tap(0, 1800);
  assert.equal(early.tap(0, 2000).type, 'ignored');
  early.release(0, 2010); early.advance(2200);
  assert.equal(early.mistakes, 1);
});

test('hold notes judge both edges, reject early release and overholding, and light only an accepted press', () => {
  for (const [head, tail, grade] of [[0, 0, 2], [55, -55, 2], [56, 0, 3], [0, -140, 3], [140, 140, 3], [0, -141, 4], [0, 141, 4]]) {
    const run = single(800);
    run.tap(0, 2000 + head);
    assert.equal(run.judgments[0], 1);
    assert.equal(run.cleared, 0);
    run.release(0, 2800 + tail);
    assert.equal(run.judgments[0], grade);
    assert.equal(run.pressedMask, 0);
  }
  const stuck = single(800);
  stuck.tap(0, 2000); stuck.advance(2941);
  assert.equal(stuck.judgments[0], 4);
  assert.equal(stuck.pressedMask, 1);
  stuck.release(0, 3000); assert.equal(stuck.pressedMask, 0);
});

test('a complete song finishes at 30 seconds with accuracy points, phrase Dings, and all missed notes settled on late frames', () => {
  for (const offset of [-150, 0, 150]) {
    const run = new HappyRun(round, 1000, offset);
    perform(run);
    assert.equal(run.score, HAPPY_GOAL * 1000);
    assert.equal(run.cleared, HAPPY_GOAL);
    assert.equal(run.mistakes, 0);
    assert.equal(run.perfects, HAPPY_GOAL);
    assert.equal(run.elapsed, 30000);
    assert.equal(run.events.filter(event => event.type === 'stageComplete').length, 9);
    assert.equal(run.events.at(-1).final, true);
    assert.ok(validHappyScore(round, run, true));
  }
  const good = new HappyRun(round, 0); perform(good, 80);
  assert.equal(good.score, HAPPY_GOAL * 500);
  assert.equal(good.goods, HAPPY_GOAL);
  const missed = new HappyRun(round, 0); missed.advance(40000);
  assert.equal(missed.mistakes, HAPPY_GOAL);
  assert.equal(missed.score, 0);
  assert.equal(missed.elapsed, 30000);
});

test('multiple pointers and keyboard sources share physical lanes and release independently without stuck holds', () => {
  const events = [], held = new HeldInputs(color => events.push(['down', color]), color => events.push(['up', color]));
  held.press('finger1', 0); held.press('finger2', 2); held.press('keyJ', 0); held.press('keyJ', 0);
  assert.deepEqual(events, [['down', 0], ['down', 2]]);
  held.release('finger1'); assert.equal(events.length, 2);
  held.release('keyJ'); assert.deepEqual(events.at(-1), ['up', 0]);
  held.clear(); held.clear();
  assert.deepEqual(events.at(-1), ['up', 2]);
  assert.deepEqual(held.counts, [0, 0, 0]);
});

test('remote note snapshots preserve held bars, fixed offsets and accuracy scores with bounded validation', () => {
  const run = new HappyRun(round, 1000, -80), note = run.notes[0];
  run.tap(note.color, run.start + note.at - 80);
  const at = run.start + note.at + 50;
  const visual = captureVisual(HAPPY_GAME, run, at);
  assert.ok(sanitizeVisual(round, visual, at - run.start));
  const remote = new RemoteRuns().get(round, { id: 'peer', progress: { cleared: 0, mistakes: 0, score: 500, visual } }, 8000);
  assert.deepEqual(remote.judgments, run.judgments);
  assert.equal(remote.offset, -80); assert.equal(remote.pressedMask, run.pressedMask); assert.equal(remote.score, 500);
  for (const mutate of [v => v.fields.judgments.push(0), v => v.fields.judgments[0] = 5, v => v.fields.offset = 151, v => v.fields.pressedMask = 8]) {
    const invalid = structuredClone(visual); mutate(invalid); assert.equal(sanitizeVisual(round, invalid, at - run.start), null);
  }
});

test('the server rejects early and inconsistent scores and ranks accuracy points ahead of hit count', () => {
  let time = 1000000;
  const service = new RoomService({ now: () => time, send() {} }), clients = [{}, {}];
  service.handle(clients[0], { type: 'create', name: 'Host', mode: 'game-select', game: HAPPY_GAME });
  const room = service.rooms.get(clients[0].room);
  service.handle(clients[1], { type: 'join', name: 'Friend', code: room.code });
  service.handle(clients[0], { type: 'start' });
  clients.forEach(client => { service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 }); service.handle(client, { type: 'ready', ready: true }); });
  const r = room.round;
  const result = { type: 'result', roundId: r.id, status: 'finished', elapsed: 30000, cleared: 10, mistakes: r.goal - 10, score: 10000 };
  time = r.startAt + 1000; service.handle(clients[0], result); assert.equal(room.players[0].result, null);
  time = r.endAt + 100;
  for (const change of [{ score: 10001 }, { score: 10500 }, { mistakes: 0 }, { elapsed: 1000 }]) {
    service.handle(clients[0], { ...result, ...change }); assert.equal(room.players[0].result, null);
  }
  service.handle(clients[0], result);
  service.handle(clients[1], { ...result, cleared: 15, mistakes: r.goal - 15, score: 7500 });
  assert.deepEqual(room.set.players.map(player => player.points), [10, 7]);
  service.handle(clients[0], { ...result, score: 0 });
  assert.equal(room.players[0].result.score, 10000);
  assert.equal(comparePlayers({ result: { status: 'finished', cleared: 5, score: 5000 } }, { result: { status: 'finished', cleared: 10, score: 5000 } }, HAPPY_GAME), 0);
});

test('an accepted hold lights and shrinks toward the line, then leaves only its head flash on release', () => {
  class Element {
    constructor() {
      this.children = []; this.dataset = {}; this.values = {}; this.classes = new Set();
      this.style = { setProperty: (key, value) => { this.values[key] = value; } };
      this.classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
    }
    append(...children) { this.children.push(...children); }
    setAttribute() {}
    remove() {}
  }
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  try {
    const full = createRun(round, 1000), localView = new HappyStage(), remoteView = new HappyStage();
    for (const elapsed of [-1000, -200, 500]) {
      localView.render(round, full, full.start + elapsed, elapsed, true, true, 0);
      remoteView.render(round, null, full.start + elapsed, elapsed, true, true, 0);
      assert.deepEqual(remoteView.notes.map(bar => [bar.hidden, bar.values['--note-head']]), localView.notes.map(bar => [bar.hidden, bar.values['--note-head']]));
    }
    const run = single(800), view = new HappyStage();
    view.render(round, run, 1500, 0, true, true, 0);
    assert.equal(view.notes[0].classes.has('happy-note-lit'), false);
    run.tap(0, 2000);
    view.render(round, run, 2100, 0, true, true, 0);
    const initialLength = Number(view.notes[0].values['--note-length']);
    assert.ok(view.notes[0].classes.has('happy-note-lit'));
    assert.equal(Number(view.notes[0].values['--note-head']), 0);
    view.render(round, run, 2500, 0, true, true, 0);
    assert.ok(Number(view.notes[0].values['--note-length']) < initialLength);
    run.release(0, 2800);
    view.render(round, run, 2800, 0, true, true, 1);
    assert.equal(view.notes[0].values['--note-length'], '0');
    assert.equal(view.notes[0].hidden, false);
    view.render(round, run, 3001, 0, true, true, 1);
    assert.equal(view.notes[0].hidden, true);
  } finally { globalThis.document = previous; }
});
