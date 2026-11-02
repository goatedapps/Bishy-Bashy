import test from 'node:test';
import assert from 'node:assert/strict';
import { STAR_GAME, STAR_STEP_MS, STAR_MAX_DEPTH, StarRun, starCourse, validStarResult } from '../shared/stars.js';
import { roundSettings, comparePlayers } from '../shared/games.js';
import { captureVisual, sanitizeVisual, RemoteRuns } from '../shared/visual-state.js';
import { RoomService } from '../server/rooms.js';
import { StarStage } from '../src/stars-view.js';

const settings = seed => ({ id: 'stars', game: STAR_GAME, ...roundSettings(STAR_GAME, seed) });

test('seeded mazes vary bar lengths, vertical gaps, and floating star positions without embedding or overlapping stars', () => {
  for (let seed = 0; seed < 100; seed++) {
    const course = starCourse(seed), { shelves, stars } = course;
    const gaps = shelves.slice(1).map((wall, i) => wall.y - shelves[i].y);
    assert.ok(shelves.every(wall => wall.width >= 94 && wall.width <= 226));
    assert.ok(gaps.every(gap => gap >= 80 && gap <= 165));
    assert.ok(new Set(shelves.slice(0, 10).map(wall => wall.width)).size >= 5);
    assert.ok(new Set(gaps.slice(0, 10)).size >= 5);
    assert.ok(new Set(stars.map(star => star.x)).size > 40);
    assert.ok(stars.filter(star => shelves.every(wall => Math.abs(star.y - (wall.y - 22)) > 1)).length > 64);
    assert.equal(stars.length, 128); assert.equal(new Set(stars.map(star => star.id)).size, 128);
    assert.ok(course.bottom < STAR_MAX_DEPTH);
    for (const star of stars) {
      assert.ok(star.x >= 32 && star.x <= 268);
      assert.ok(shelves.every(wall => star.x + 12 <= wall.x || star.x - 12 >= wall.x + wall.width || star.y + 12 <= wall.y || star.y - 12 >= wall.y + wall.height));
      assert.ok(stars.every(other => other.id === star.id || Math.hypot(star.x - other.x, star.y - other.y) >= 40));
    }
  }
});

function drive(round, start = 0, frameMs = 16) {
  const run = new StarRun(round, start);
  const edges = [[500, 2, true], [2200, 2, false], [2200, 0, true], [4500, 0, false], [4500, 2, true], [7000, 2, false]];
  let frame = 0;
  for (const [at, color, pressed] of edges) {
    while (frame < at) { run.advance(start + frame); frame += frameMs; }
    run[pressed ? 'tap' : 'release'](color, start + at);
  }
  while (frame < round.duration) { run.advance(start + frame); frame += frameMs; }
  run.advance(start + round.duration);
  return run;
}

test('Star Collector has a shared seeded course, reachable stars, no duplicates, and identical physics at different frame rates', () => {
  const round = settings(123);
  assert.deepEqual(starCourse(123), starCourse(123));
  assert.notDeepEqual(starCourse(123), starCourse(456));
  const fast = drive(round, 500000, 8), slow = drive(round, 500000, 151);
  assert.equal(fast.cleared, slow.cleared); assert.equal(fast.mistakes, slow.mistakes);
  for (const key of ['x', 'y', 'vx', 'vy', 'tilt', 'collected', 'proof']) assert.deepEqual(fast[key], slow[key]);
  assert.ok(fast.cleared > 0); assert.ok(fast.mistakes > 0);
  assert.equal(fast.cleared, fast.collected.reduce((a, b) => a + b));
  assert.equal(fast.events.filter(event => event.type === 'stageComplete').length, fast.cleared);
  assert.equal(fast.events.filter(event => event.type === 'carBump').length, fast.mistakes);
  assert.equal(validStarResult(round, { ...fast, elapsed: round.duration }), true);
});

test('holding controls tilt, release levels with momentum, simultaneous holds cancel, and deadline freezes play', () => {
  const round = settings(321), run = new StarRun(round, 1000);
  assert.equal(run.tap(0, 999).type, 'ignored');
  assert.equal(run.tap(1, 1000).type, 'ignored');
  run.tap(2, 1000); run.advance(1300);
  assert.ok(run.tilt > .4); assert.ok(run.vx > 0);
  run.release(2, 1300); run.advance(1600);
  assert.equal(run.tilt, 0); assert.ok(run.vx > 0);
  run.tap(0, 1600); run.tap(2, 1600); run.advance(1900); assert.equal(run.tilt, 0);
  run.advance(run.end - 1); assert.equal(run.done, false);
  run.advance(run.end + 5000); assert.equal(run.done, true); assert.equal(run.elapsed, round.duration);
  const frozen = [run.x, run.y, run.cleared, run.mistakes];
  assert.equal(run.tap(0, run.end).type, 'ignored'); run.advance(run.end + 10000);
  assert.deepEqual([run.x, run.y, run.cleared, run.mistakes], frozen);
});

test('wall contacts cannot tunnel or spam bump audio; collectible stars stay collected', () => {
  const round = settings(10), run = new StarRun(round, 0);
  run.advance(1500);
  assert.equal(run.y, run.course.shelves[0].y - 10);
  assert.equal(run.mistakes, 1); assert.equal(run.cleared, 1);
  run.advance(5000); assert.equal(run.mistakes, 1); assert.equal(run.cleared, 1);
  run.tap(2, 5000); run.advance(10000);
  assert.ok(run.x >= 20 && run.x <= 280); assert.equal(run.collected[0], 1);
  const bumps = run.events.filter(event => event.type === 'carBump');
  assert.ok(bumps.every((event, i) => !i || event.at - bumps[i - 1].at >= 180));
});

test('score proofs reject fabricated totals, reordered inputs, oversized histories, and invalid masks', () => {
  const round = settings(17), run = drive(round);
  const message = { proof: run.proof, elapsed: run.elapsed, cleared: run.cleared, mistakes: run.mistakes };
  assert.ok(validStarResult(round, message));
  for (const edit of [{ cleared: run.cleared + 1 }, { mistakes: run.mistakes + 1 }, { elapsed: 1000 }, { proof: [[0, 7]] }, { proof: [[1, 1], [0, 0]] }, { proof: [[round.duration / STAR_STEP_MS, 0]] }, { proof: Array(2049).fill([0, 0]) }]) assert.equal(validStarResult(round, { ...message, ...edit }), false);
});

test('peer snapshots retain collected stars and tilt without running remote physics', () => {
  const round = settings(19), run = drive(round, 500000);
  const visual = captureVisual(STAR_GAME, run, run.end);
  const safe = sanitizeVisual(round, visual, round.duration); assert.ok(safe);
  const peer = new RemoteRuns().get(round, { id: 'peer', progress: { cleared: run.cleared, mistakes: run.mistakes, visual: safe } }, 1000);
  assert.deepEqual(captureVisual(STAR_GAME, peer, 1000 + round.duration), visual);
  assert.equal(peer.step, 0);
  assert.equal(sanitizeVisual(round, { ...visual, fields: { ...visual.fields, x: NaN } }, round.duration), null);
  assert.equal(sanitizeVisual(round, { ...visual, fields: { ...visual.fields, collected: [1] } }, round.duration), null);
});

test('four players submit replay-validated scores once; ties rank by stars and share set points', () => {
  let time = 100000;
  const clients = [{}, {}, {}, {}], messages = [];
  const service = new RoomService({ now: () => time, send: (client, message) => messages.push({ client, message }) });
  service.handle(clients[0], { type: 'create', name: 'Host', mode: 'game-select', game: STAR_GAME });
  const room = service.rooms.get(clients[0].room);
  clients.slice(1).forEach((client, i) => service.handle(client, { type: 'join', name: `Friend ${i}`, code: room.code }));
  service.handle(clients[0], { type: 'start' });
  clients.forEach(client => { service.handle(client, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 }); service.handle(client, { type: 'ready', ready: true }); });
  const round = room.round, run = drive(round);
  const message = { type: 'result', roundId: round.id, status: 'finished', proof: run.proof, cleared: run.cleared, mistakes: run.mistakes, elapsed: run.elapsed };
  time = round.startAt + 5000;
  service.handle(clients[0], message); assert.equal(room.players[0].result, null);
  time = round.endAt;
  service.handle(clients[0], { ...message, cleared: run.cleared + 1 }); assert.equal(room.players[0].result, null);
  [...clients].reverse().forEach(client => service.handle(client, message));
  assert.ok(room.players.every(player => player.result?.cleared === run.cleared));
  assert.ok(room.set.players.every(player => player.points === 10));
  service.handle(clients[0], message); assert.equal(room.set.players[0].points, 10);
  assert.equal(messages.at(-1).message.type, 'result-ack');
  const result = { status: 'finished', cleared: 5, elapsed: 45000 };
  assert.equal(comparePlayers({ result }, { result: { ...result, elapsed: 1000 } }, STAR_GAME), 0);
});

test('maze scenes render before a round exists, rotate with the run, hide collected stars, and reset on a new round', () => {
  const previous = globalThis.document;
  class Element {
    constructor() { this.children = []; this.style = {}; this.classList = { toggle() {} }; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute() {}
  }
  globalThis.document = { createElement: () => new Element() };
  try {
    const stage = new StarStage(); stage.render({}, null, 0, 0, false, false);
    assert.equal(stage.car.hidden, true); assert.equal(stage.world.children.length, 192);
    const round = settings(123), run = new StarRun(round, 0);
    run.advance(1500); run.tap(2, 1500); run.advance(1800);
    stage.render(round, run, 1800, 1800, true, true);
    assert.equal(stage.car.hidden, false); assert.equal(stage.stars[0].hidden, true);
    assert.match(stage.board.style.transform, /rotate\(24/);
    assert.deepEqual(stage.course, run.course);
    const count = stage.world.children.length;
    stage.render(round, run, 1900, 1900, true, true); assert.equal(stage.world.children.length, count);
    stage.render({ ...round, id: 'next' }, new StarRun(round, 0), 0, 0, true, true);
    assert.equal(stage.stars[0].hidden, false); assert.match(stage.board.style.transform, /rotate\(0deg\)/);
  } finally { globalThis.document = previous; }
});
