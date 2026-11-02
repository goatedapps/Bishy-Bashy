import test from 'node:test';
import assert from 'node:assert/strict';
import { HorseRun, HORSE_GAME, horseTraffic, horseLane, HORSE_MOVE_MS, HORSE_STEP_MS, HORSE_MAX_SPEED, HORSE_TRAFFIC_SPEED, validHorseResult } from '../shared/horse.js';
import { roundSettings, createRun } from '../shared/games.js';
import { captureVisual, sanitizeVisual, RemoteRuns } from '../shared/visual-state.js';
import { HorseStage } from '../src/horse-view.js';
import { RoomService } from '../server/rooms.js';
import { driveHorse } from './helpers/horse.js';

const settings = (seed = 123, level = 1) => ({ id: 'horse', game: HORSE_GAME, ...roundSettings(HORSE_GAME, seed, level) });

test('seeded horse traffic leaves a safe lane and enough time for two lane changes at maximum speed', () => {
  for (let level = 1; level <= 5; level++) {
    for (let seed = 0; seed < 25; seed++) {
      const round = settings(seed, level), run = driveHorse(round);
      assert.deepEqual(run.traffic, horseTraffic(seed, round.spacing));
      assert.ok(run.traffic.every(wave => [0, 1, 2].includes(wave.safe)));
      assert.ok(round.spacing / (HORSE_MAX_SPEED - HORSE_TRAFFIC_SPEED) * 1000 > 2 * HORSE_MOVE_MS + 600);
      assert.equal(run.done, true); assert.equal(run.mistakes, 0, `seed ${seed}, level ${level}`);
      assert.ok(run.elapsed > 30000 && run.elapsed < 40000);
      assert.equal(run.events.filter(event => event.type === 'stageComplete').length, run.index + 1);
      assert.equal(run.events.filter(event => event.final).length, 1);
    }
  }
});

test('green presses build capped speed, holding does not repeat, coasting slows down, and lanes move smoothly', () => {
  const round = settings(), run = createRun(round, 1000);
  assert.equal(run.tap(1, 999).type, 'ignored');
  assert.equal(run.tap(1, 1000).type, 'move');
  assert.equal(run.tap(1, 1050).type, 'ignored');
  for (let at = 1100; at <= 3000; at += 100) run.tap(1, at);
  assert.ok(run.speed <= HORSE_MAX_SPEED && run.speed > 100);
  const speed = run.speed; run.advance(3200); assert.ok(run.speed < speed);
  run.tap(0, 3200); assert.equal(run.position, 0);
  assert.equal(horseLane(run, 3200), 1); assert.equal(horseLane(run, 3290), .5); assert.equal(horseLane(run, 3380), 0);
  assert.equal(run.tap(2, 3290).type, 'ignored');
  run.advance(run.end); assert.equal(run.done, false);
});

test('bumps reduce speed once, keep distance, and allow steering throughout the stumble', () => {
  const round = settings(), run = new HorseRun(round, 0);
  run.position = run.moveFrom = (run.traffic[0].safe + 1) % 3;
  let at = 0;
  while (!run.mistakes && at < 10000) { at += 100; run.tap(1, at); }
  assert.equal(run.mistakes, 1); assert.ok(run.speed < 50);
  const distance = run.distance;
  assert.equal(run.tap(1, at + 10).type, 'ignored');
  const color = run.position === 0 ? 2 : 0;
  assert.equal(run.tap(color, at + 10).type, 'move');
  run.advance(at + 200); assert.ok(run.distance >= distance); assert.equal(run.mistakes, 1);
  assert.equal(run.events.filter(event => event.type === 'stageWrong').length, 1);
});

test('fixed-step replays preserve fractional finish time across delayed frames and device clock offsets', () => {
  const round = settings(), original = driveHorse(round, { start: 500000 });
  for (const interval of [8, 33, 310]) {
    const run = new HorseRun(round, 2000); let frame = 0;
    for (const [step, color] of original.proof) {
      const elapsed = step * HORSE_STEP_MS;
      while (frame < elapsed) { run.advance(run.start + frame); frame += interval; }
      assert.equal(run.tap(color, run.start + elapsed).type, 'move');
    }
    run.advance(run.end + 1000);
    assert.equal(run.done, true); assert.ok(Math.abs(run.elapsed - original.elapsed) < .001);
    assert.equal(run.mistakes, original.mistakes); assert.equal(run.cleared, round.goal);
    const events = run.events.length; run.advance(run.end + 5000); assert.equal(run.events.length, events);
  }
  assert.ok(validHorseResult(round, original));
  assert.equal(validHorseResult(round, { ...original, elapsed: original.elapsed - 10 }), false);
  for (const proof of [[[0, 3]], [[1, 1], [0, 0]], Array(1025).fill([0, 1]), [[0, 1], [0, 1]]]) assert.equal(validHorseResult(round, { ...original, proof }), false);
  assert.ok(Buffer.byteLength(JSON.stringify({ type: 'result', proof: Array.from({ length: 1024 }, (_, i) => [6000 + i, 1]) })) < 16384);
});

test('peers retain lane transitions, speed and collision timestamps without advancing remote simulation', () => {
  const round = settings(), run = new HorseRun(round, 500000); run.tap(0, 500100); run.tap(1, 500100); run.advance(500200);
  const visual = captureVisual(HORSE_GAME, run, 500200), safe = sanitizeVisual(round, visual, 200);
  assert.ok(safe);
  const peer = new RemoteRuns().get(round, { id: 'peer', progress: { cleared: run.cleared, mistakes: run.mistakes, visual: safe } }, 1000);
  assert.deepEqual(captureVisual(HORSE_GAME, peer, 1200), visual); assert.equal(peer.step, 0);
  assert.equal(horseLane(peer, 1200), horseLane(run, 500200));
  assert.equal(sanitizeVisual(round, { ...visual, fields: { ...visual.fields, speed: Infinity } }, 200), null);
});

test('four players submit replay-validated finishes, ignore packet arrival order, and acknowledge retries', () => {
  let time = 100000;
  const clients = [{}, {}, {}, {}], messages = [];
  const service = new RoomService({ now: () => time, send: (client, message) => messages.push(message) });
  service.handle(clients[0], { type: 'create', name: 'Host', mode: 'game-select', game: HORSE_GAME });
  const room = service.rooms.get(clients[0].room);
  clients.slice(1).forEach((client, i) => service.handle(client, { type: 'join', name: `Friend ${i}`, code: room.code }));
  service.handle(clients[0], { type: 'start' });
  clients.forEach(client => { service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 }); service.handle(client, { type: 'ready', ready: true }); });
  const round = room.round, runs = clients.map((_, i) => driveHorse(round, { delay: i * 1000 }));
  const result = run => ({ type: 'result', roundId: round.id, status: 'finished', cleared: run.cleared, mistakes: run.mistakes, elapsed: run.elapsed, proof: run.proof });
  time = round.startAt + 5000; service.handle(clients[0], result(runs[0])); assert.equal(room.players[0].result, null);
  time = round.startAt + Math.max(...runs.map(run => run.elapsed)) + 100;
  service.handle(clients[0], { ...result(runs[0]), proof: [] }); assert.equal(room.players[0].result, null);
  for (const index of [3, 2, 1, 0]) service.handle(clients[index], result(runs[index]));
  assert.deepEqual(room.set.players.map(player => player.points), [10, 7, 4, 1]);
  service.handle(clients[0], result(runs[0])); assert.equal(messages.at(-1).type, 'result-ack');
  assert.equal(room.set.players[0].points, 10);
});

test('horse scenes have bounded traffic, render before GO, preserve finished scenes and honor reduced motion', () => {
  const previous = globalThis.document;
  class Element {
    constructor() { this.children = []; this.style = {}; this.classes = new Set(); this.classList = { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) }; }
    append(...children) { this.children.push(...children); }
    setAttribute() {}
  }
  globalThis.document = { createElement: () => new Element() };
  try {
    const stage = new HorseStage(); stage.render({}, null, 0, 0, false, false); assert.equal(stage.rider.hidden, true);
    const round = settings(), run = driveHorse(round);
    stage.render(round, run, 50000, 50000, true, true, run.cleared, true);
    assert.equal(stage.opponents.length, 14); assert.equal(stage.banner.hidden, false); assert.equal(stage.rider.hidden, false);
    const positions = stage.opponents.map(element => element.style.top);
    stage.render(round, run, 55000, 55000, true, true, run.cleared, true); assert.deepEqual(stage.opponents.map(element => element.style.top), positions);
    stage.motion = { matches: true }; run.done = false;
    stage.render(round, run, 1000, 1000, true, true, 0, false); assert.equal(stage.rider.classes.has('horse-stride'), false);
  } finally { globalThis.document = previous; }
});

test('collision recoil moves the rider backward, keeps the struck horse ahead, and never changes gameplay state', () => {
  const previous = globalThis.document;
  class Element {
    constructor() { this.children = []; this.style = {}; this.classes = new Set(); this.classList = { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) }; }
    append(...children) { this.children.push(...children); }
    setAttribute() {}
  }
  globalThis.document = { createElement: () => new Element() };
  try {
    const round = settings(), run = new HorseRun(round, 500000);
    run.position = run.moveFrom = (run.traffic[0].safe + 1) % 3;
    for (let at = run.start; !run.mistakes && at < run.start + 10000; at += 100) run.tap(1, at);
    assert.equal(run.mistakes, 1); assert.equal(run.feedback.color, run.position);
    const impact = run.feedback.at, state = [run.distance, run.speed, run.cleared, run.position];
    const stage = new HorseStage();
    stage.render(round, run, impact, 0, true, true, run.cleared, false);
    assert.equal(stage.rider.style.top, '80%');
    stage.render(round, run, impact + 90, 0, true, true, run.cleared, false);
    assert.equal(stage.rider.style.top, '85%'); assert.ok(stage.rider.classes.has('horse-stumble'));
    const struck = [0, 1, 2].filter(column => column !== run.traffic[0].safe).indexOf(run.feedback.color);
    assert.ok(parseFloat(stage.opponents[struck].style.top) < parseFloat(stage.rider.style.top) - 8);
    const visual = sanitizeVisual(round, captureVisual(HORSE_GAME, run, impact + 90), impact + 90 - run.start);
    const peer = new RemoteRuns().get(round, { id: 'peer', progress: { cleared: run.cleared, mistakes: run.mistakes, visual } }, 2000);
    stage.render(round, peer, 2000 + impact + 90 - run.start, 0, true, true, peer.cleared, false);
    assert.equal(stage.rider.style.top, '85%');
    stage.render(round, run, impact + 700, 0, true, true, run.cleared, false);
    assert.equal(stage.rider.style.top, '80%'); assert.ok(!stage.rider.classes.has('horse-stumble'));
    stage.motion = { matches: true };
    stage.render(round, run, impact + 90, 0, true, true, run.cleared, false); assert.equal(stage.rider.style.top, '80%');
    const next = { ...round, id: 'next' };
    stage.render(next, new HorseRun(next, 0), 0, 0, true, true, 0, false); assert.equal(stage.rider.style.top, '80%');
    assert.deepEqual([run.distance, run.speed, run.cleared, run.position], state);
  } finally { globalThis.document = previous; }
});
