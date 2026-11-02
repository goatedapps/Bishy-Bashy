import test from 'node:test';
import assert from 'node:assert/strict';
import { SHARK_GAME, SharkRun, sharkCourse, SHARK_JUMP_MS, SHARK_FALL_MS, SHARK_RECOVERY_MS, validSharkResult } from '../shared/shark.js';
import { roundSettings, createRun } from '../shared/games.js';
import { captureVisual, sanitizeVisual, RemoteRuns } from '../shared/visual-state.js';
import { SharkStage } from '../src/shark-view.js';
import { RoomService } from '../server/rooms.js';
import { driveSharks } from './helpers/shark.js';

const settings = (seed = 123, level = 1) => ({ id: 'sharks', game: SHARK_GAME, ...roundSettings(SHARK_GAME, seed, level) });

test('all devices share seeded red/green/blue sharks on a zigzag path with increasing Game Select lengths', () => {
  for (let level = 1; level <= 5; level++) {
    for (let seed = 0; seed < 30; seed++) {
      const round = settings(seed, level), run = driveSharks(round);
      assert.equal(round.goal, 30 + (level - 1) * 10);
      assert.deepEqual(run.course, sharkCourse(seed, round.goal));
      assert.ok(run.course.every((shark, i) => [0, 1, 2].includes(shark.color) && shark.column === (i % 2 ? 0 : 2)));
      assert.equal(run.done, true); assert.equal(run.cleared, round.goal); assert.equal(run.mistakes, 0);
      assert.equal(run.events.filter(event => event.type === 'sharkJump').length, round.goal);
      assert.equal(run.events.filter(event => event.type === 'stageComplete').length, 1);
      assert.equal(run.events.filter(event => event.final).length, 1);
    }
  }
});

test('a shark stays colored until landing, repeated presses cannot skip sharks, and final time includes the last jump', () => {
  const round = settings(), run = createRun(round, 1000), color = run.sequence[0];
  assert.equal(run.tap(color, 999).type, 'ignored');
  assert.equal(run.tap(color, 1100).type, 'move'); assert.equal(run.cleared, 0);
  assert.equal(run.tap(color, 1101).type, 'ignored');
  run.advance(1100 + SHARK_JUMP_MS - 1); assert.equal(run.cleared, 0);
  run.advance(1100 + SHARK_JUMP_MS); assert.equal(run.cleared, 1); assert.equal(run.landAt, null);
  const complete = driveSharks(round, { start: 500000 });
  assert.equal(complete.elapsed, complete.proof.at(-1)[1] + SHARK_JUMP_MS);
  const events = complete.events.length; complete.advance(complete.end + 1000); assert.equal(complete.events.length, events);
  assert.equal(complete.tap(0, complete.end).type, 'ignored');
});

test('a wrong press splashes at water impact once, preserves landed sharks, and recovers before accepting the next jump', () => {
  const run = createRun(settings(), 1000);
  run.tap(run.sequence[0], 1100); run.advance(1340);
  run.tap((run.sequence[1] + 1) % 3, 1400);
  assert.equal(run.mistakes, 1); assert.equal(run.cleared, 1);
  assert.equal(run.events.filter(event => event.type === 'sharkSplash').length, 0);
  run.advance(1400 + SHARK_FALL_MS - 1); assert.equal(run.events.filter(event => event.type === 'sharkSplash').length, 0);
  run.advance(1400 + SHARK_FALL_MS); assert.equal(run.events.filter(event => event.type === 'sharkSplash').length, 1);
  assert.equal(run.tap(run.sequence[1], 1400 + SHARK_RECOVERY_MS - 1).type, 'ignored');
  assert.equal(run.tap(run.sequence[1], 1400 + SHARK_RECOVERY_MS).type, 'move');
  run.advance(1400 + SHARK_RECOVERY_MS + SHARK_JUMP_MS);
  assert.equal(run.cleared, 2); assert.equal(run.mistakes, 1);
  assert.equal(run.events.filter(event => event.type === 'sharkSplash').length, 1);
});

test('delayed frames settle valid final landings, reject arrivals beyond the deadline, and replay offset-device proofs', () => {
  const round = { ...settings(), goal: 1 };
  const run = createRun(round, 500000);
  run.tap(run.sequence[0], run.end - SHARK_JUMP_MS); run.advance(run.end + 1000);
  assert.equal(run.done, true); assert.equal(run.elapsed, round.duration);
  assert.ok(validSharkResult(round, run));
  const late = createRun(round, 0); late.tap(late.sequence[0], late.end - SHARK_JUMP_MS + 1); late.advance(late.end + 1000);
  assert.equal(late.done, false); assert.equal(late.cleared, 0);
  const original = driveSharks(settings(), { start: 500000.12345, misses: 2 });
  assert.ok(validSharkResult(settings(), original));
  for (const changed of [{ elapsed: original.elapsed - 10 }, { mistakes: 0 }, { proof: [[0, NaN]] }, { proof: [[3, 100]] }, { proof: Array(513).fill([0, 100]) }, { proof: [[0, 100], [0, 100]] }]) assert.equal(validSharkResult(settings(), { ...original, ...changed }), false);
});

test('remote snapshots preserve the pending shark landing and fall/climb timestamps without granting progress', () => {
  const round = settings(), run = createRun(round, 500000);
  for (const wrong of [false, true]) {
    const time = wrong ? 500500 : 500100;
    run.tap((run.sequence[run.cleared] + Number(wrong)) % 3, time);
    const visual = captureVisual(SHARK_GAME, run, time + 10), safe = sanitizeVisual(round, visual, time + 10 - run.start);
    assert.ok(safe);
    const peer = new RemoteRuns().get(round, { id: 'peer', progress: { cleared: run.cleared, mistakes: run.mistakes, visual: safe } }, 1000);
    assert.deepEqual(captureVisual(SHARK_GAME, peer, 1000 + time + 10 - run.start), visual);
    assert.equal(peer.events.length, 0); assert.equal(peer.proof.length, 0);
    run.advance(500340);
  }
});

test('four players submit verified jump histories and retain finishes on duplicate or delayed result delivery', () => {
  let time = 100000;
  const clients = [{}, {}, {}, {}], messages = [];
  const service = new RoomService({ now: () => time, send: (client, message) => messages.push(message) });
  service.handle(clients[0], { type: 'create', name: 'Host', mode: 'game-select', game: SHARK_GAME });
  const room = service.rooms.get(clients[0].room);
  clients.slice(1).forEach((client, i) => service.handle(client, { type: 'join', name: `Friend ${i}`, code: room.code }));
  service.handle(clients[0], { type: 'start' });
  clients.forEach(client => { service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 }); service.handle(client, { type: 'ready', ready: true }); });
  const round = room.round, runs = clients.map((_, i) => driveSharks(round, { misses: i }));
  const result = run => ({ type: 'result', roundId: round.id, status: 'finished', cleared: run.cleared, mistakes: run.mistakes, elapsed: run.elapsed, proof: run.proof });
  time = round.startAt + Math.max(...runs.map(run => run.elapsed)) + 100;
  service.handle(clients[0], { ...result(runs[0]), proof: [] }); assert.equal(room.players[0].result, null);
  for (const index of [3, 2, 1, 0]) service.handle(clients[index], result(runs[index]));
  assert.deepEqual(room.set.players.map(player => player.points), [10, 7, 4, 1]);
  service.handle(clients[0], result(runs[0])); assert.equal(messages.at(-1).type, 'result-ack');
  assert.equal(room.set.players[0].points, 10);
});

test('bounded shark scenes turn landed targets grey, animate recovery, reset correctly, and support reduced motion', () => {
  const previous = globalThis.document;
  class Element {
    constructor() { this.children = []; this.style = {}; this.classList = { toggle() {} }; }
    append(...children) { this.children.push(...children); }
    setAttribute() {}
  }
  globalThis.document = { createElement: () => new Element() };
  try {
    const stage = new SharkStage(); stage.render({}, null, 0, 0, false, false); assert.equal(stage.puppy.hidden, true);
    const round = settings(), run = createRun(round, 0);
    run.tap(run.sequence[0], 100); stage.render(round, run, 200, 200, true, true);
    assert.equal(stage.sharks.length, 8); assert.ok(!stage.sharks[1].sprite.className.includes('stone'));
    run.advance(340); stage.render(round, run, 340, 340, true, true); assert.ok(stage.sharks[1].sprite.className.includes('stone'));
    run.tap((run.sequence[1] + 1) % 3, 400); stage.render(round, run, 650, 650, true, true);
    assert.equal(stage.puppy.hidden, true); assert.equal(stage.splash.hidden, false);
    stage.render(round, run, 1000, 1000, true, true); assert.equal(stage.puppy.hidden, false); assert.ok(stage.puppy.className.includes('climb'));
    stage.motion = { matches: true }; stage.render(round, run, 650, 650, true, true); assert.equal(stage.puppy.hidden, false);
    stage.render({ ...round, id: 'next' }, createRun(round, 0), 0, 0, true, true); assert.ok(!stage.sharks[1].sprite.className.includes('stone'));
  } finally { globalThis.document = previous; }
});
