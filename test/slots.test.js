import test from 'node:test';
import assert from 'node:assert/strict';
import { SlotRun, SLOT_GAME, slotLayout, reelFace, FACE_NAMES, INPUT_GUARD_MS } from '../shared/slots.js';
import { createRun, roundSettings } from '../shared/games.js';
import { RoomService } from '../server/rooms.js';

const settings = (seed = 123, difficulty = 1) => ({ id: 'slots', game: SLOT_GAME, ...roundSettings(SLOT_GAME, seed, difficulty) });

function nextTarget(run, after) {
  let time = Math.max(after, run.blockedUntil, run.lastTap + INPUT_GUARD_MS);
  while (reelFace(run.layout, run.cleared, time - run.start, run.stepMs) !== run.layout.target) time = run.start + (Math.floor((time - run.start) / run.stepMs) + 1) * run.stepMs + 1;
  return time;
}

test('seeded reels show every distinct face, share the target, and never start on a free match', () => {
  for (let seed = 0; seed < 100; seed++) {
    const layout = slotLayout(seed);
    assert.deepEqual(slotLayout(seed), layout);
    assert.ok(layout.target >= 0 && layout.target < FACE_NAMES.length);
    for (const reel of layout.reels) {
      assert.equal(new Set(reel).size, FACE_NAMES.length);
      assert.notEqual(reel[0], layout.target);
    }
    assert.deepEqual(Array.from({ length: 6 }, (_, index) => reelFace(layout, 0, index * 320, 320)), layout.reels[0]);
    assert.equal(reelFace(layout, 0, 6 * 320, 320), layout.reels[0][0]);
  }
});

test('a miss freezes only the current reel, keeps prior matches, and ignores repeated input', () => {
  const run = new SlotRun(settings(), 10_000);
  assert.equal(run.tap(0, run.start - 1).type, 'ignored');
  assert.equal(run.tap(0, run.start).type, 'slotMiss');
  assert.equal(run.mistakes, 1);
  const retry = run.blockedUntil;
  assert.equal(run.tap(1, retry - 1).type, 'ignored');
  const first = nextTarget(run, retry);
  assert.equal(run.tap(2, first).type, 'slotLock');
  assert.equal(run.cleared, 1);
  assert.equal(run.tap(0, first).type, 'ignored');
  let wrong = first + INPUT_GUARD_MS;
  while (reelFace(run.layout, 1, wrong - run.start, run.stepMs) === run.layout.target) wrong += run.stepMs;
  assert.equal(run.tap(1, wrong).type, 'slotMiss');
  assert.equal(run.cleared, 1);
  assert.equal(run.mistakes, 2);
});

test('every difficulty can be completed locally with any key and preserves exact elapsed time', () => {
  assert.deepEqual(Array.from({ length: 5 }, (_, index) => settings(1, index + 1).stepMs), [320, 290, 260, 230, 200]);
  for (let difficulty = 1; difficulty <= 5; difficulty++) {
    const round = settings(521, difficulty);
    const run = createRun(round, 3456.789);
    let time = run.start;
    for (let reel = 0; reel < 3; reel++) {
      time = nextTarget(run, time + INPUT_GUARD_MS);
      const action = run.tap(reel, time);
      assert.equal(action.type, reel === 2 ? 'finished' : 'slotLock');
    }
    assert.equal(run.cleared, 3);
    assert.equal(run.mistakes, 0);
    assert.equal(run.elapsed, time - run.start);
    assert.ok(run.elapsed < round.duration);
    assert.equal(run.tap(0, time + 500).type, 'ignored');
    assert.equal(run.cleared, 3);
  }
});

test('reel boundaries and the round deadline use the input timestamp', () => {
  const round = settings();
  const run = new SlotRun(round, 1000);
  const targetStep = run.layout.reels[0].indexOf(run.layout.target);
  const targetAt = run.start + targetStep * run.stepMs;
  assert.equal(run.tap(0, targetAt).type, 'slotLock');
  assert.equal(reelFace(run.layout, 0, targetStep * run.stepMs - .001, run.stepMs), run.layout.reels[0][targetStep - 1]);
  assert.equal(new SlotRun(round, 1000).tap(0, 1000 + round.duration).type, 'ignored');
  assert.equal(new SlotRun(round, 1000).tap(3, targetAt).type, 'ignored');
});

test('server rejects incomplete face matches and awards a delayed reconnect result exactly once', () => {
  let now = 1_000_000;
  const sent = [];
  const service = new RoomService({ now: () => now, send: (client, message) => sent.push({ client, message: structuredClone(message) }) });
  const host = {}, friend = {};
  service.handle(host, { type: 'create', name: 'Host', mode: 'game-select', game: SLOT_GAME });
  const room = service.rooms.get(host.room);
  service.handle(friend, { type: 'join', name: 'Friend', code: room.code });
  for (const client of [host, friend]) {
    service.handle(client, { type: 'sync', count: 5, rtt: 20, uncertainty: 10 });
    service.handle(client, { type: 'ready', ready: true });
  }
  service.handle(host, { type: 'start' });
  const round = room.round;
  const run = new SlotRun(round, 0);
  let time = 0;
  for (let reel = 0; reel < 3; reel++) { time = nextTarget(run, time + 120); run.tap(0, time); }
  now = round.startAt + time + 1000;
  const result = { type: 'result', roundId: round.id, status: 'finished', elapsed: run.elapsed, cleared: 2, mistakes: 0 };
  service.handle(host, result);
  assert.equal(room.players[0].result, null);
  const token = room.players[0].token;
  service.disconnect(host);
  service.handle(friend, { type: 'result', roundId: round.id, status: 'finished', elapsed: run.elapsed + 100, cleared: 3, mistakes: 0 });
  const resumed = {};
  service.handle(resumed, { type: 'join', code: room.code, token, name: 'Host' });
  result.cleared = 3;
  service.handle(resumed, result);
  assert.equal(room.round.phase, 'results');
  assert.deepEqual(room.set.players.map(player => player.points), [10, 7]);
  assert.equal(room.players[0].result.elapsed, run.elapsed);
  service.handle(resumed, result);
  assert.equal(room.set.history.length, 1);
  assert.equal(room.set.players[0].points, 10);
  assert.ok(sent.some(item => item.client === resumed && item.message.type === 'result-ack'));
});
