import { HeldInputs } from '../src/held-input.js';
import { driveWitch as throwPotion } from './helpers/witch.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { WitchRun, WITCH_GAME, WITCH_HOLD_MS, replayWitch, witchPose, witchFlight } from '../shared/witch.js';
import { GAMES, roundSettings, comparePlayers } from '../shared/games.js';
import { RoomService } from '../server/rooms.js';
import { resultMessage } from '../src/result-message.js';
import { witchDemoPlan } from '../src/witch-demo.js';

test('alternation builds speed, stopping freezes speed, aiming holds at 90 and release lands on a frog', () => {
  const run = new WitchRun({}, 1000);
  assert.equal(run.tap(0, 999).type, 'ignored');
  run.tap(0, 1100); const speed = run.speed;
  assert.equal(run.tap(0, 1200).type, 'ignored'); assert.equal(run.speed, speed);
  run.tap(2, 1300); assert.ok(run.speed > speed);
  const cast = throwPotion();
  assert.equal(cast.state, 'land'); assert.equal(cast.speed, cast.power); assert.ok(cast.power > 30);
  assert.ok(Math.abs(cast.angle - 45) < .0001); assert.ok(cast.cleared > 10);
  assert.equal(cast.targetX, 180 + (cast.cleared + 1) * 14);
  const vertical = throwPotion(0, 100, 90);
  assert.ok(Math.abs(vertical.angle - 90) < .001); assert.ok(vertical.cleared < cast.cleared);
  assert.ok(throwPotion(0, 160).cleared < cast.cleared);
});

test('proofs replay independently of frame timing and reject reordered, future, rewritten, and oversized input', () => {
  const cast = throwPotion(500000.25), proof = cast.proof;
  const replay = replayWitch(proof, cast.elapsed);
  assert.ok(replay); assert.equal(replay.state, cast.state); assert.equal(replay.cleared, cast.cleared);
  assert.ok(Math.abs(replay.elapsed - cast.elapsed) < .001);
  for (const bad of [[...proof].reverse(), [[30000, 0, 0]], Array.from({ length: 501 }, () => [0, 0, 0]), [[1, 1, 1]], [[100, 0, 0], [120, 2, 0]]]) assert.equal(replayWitch(bad, 20000), null);
  const sample = replayWitch(proof.slice(0, 10), 1100);
  const before = JSON.stringify(sample);
  witchPose(sample, 1800); assert.equal(JSON.stringify(sample), before);
  assert.ok(Buffer.byteLength(JSON.stringify({ proof: Array.from({ length: 500 }, (_, i) => [i * 40, i % 2 * 2, 0]) })) < 16384);
});

test('green stops immediately anywhere before the edge, freezes speed, and begins aiming until release', () => {
  for (const duration of [500, 1500, 2500]) {
    const run = new WitchRun({}, 0);
    for (let at = 100, color = 0; at < duration; at += 100, color = 2 - color) run.tap(color, at);
    run.tap(1, duration);
    const position = run.x, speed = run.speed;
    assert.equal(run.state, 'aim'); assert.equal(run.angle, 0);
    run.advance(duration + 500);
    assert.equal(run.x, position); assert.equal(run.speed, speed); assert.equal(run.power, speed);
    assert.equal(run.angle, 27.5);
    assert.equal(run.tap(0, duration + 600).type, 'ignored');
    run.release(1, duration + 800); assert.equal(run.state, 'fly');
    assert.ok(replayWitch(run.proof, duration + 800));
  }
});

test('explicit release throws immediately; cancellation never throws; overruns and idle turns fail', () => {
  const run = new WitchRun({}, 0); run.tap(0, 100); run.tap(2, 200); run.tap(1, 300); run.release(1, 310);
  assert.equal(run.state, 'fly'); assert.equal(run.launchAt, 310);
  const cancelled = new WitchRun({}, 0); cancelled.tap(0, 100); cancelled.tap(1, 200);
  cancelled.release(1, 300, true); assert.equal(cancelled.launchAt, null); assert.equal(cancelled.state, 'run');
  assert.equal(cancelled.angle, 0);
  cancelled.tap(1, 300); assert.equal(cancelled.angle, 0);
  assert.ok(replayWitch(cancelled.proof, 300));
  const overrun = new WitchRun({}, 0);
  for (let at = 100, color = 0; at < 10000 && !overrun.done; at += 100, color = 2 - color) overrun.tap(color, at);
  overrun.advance(15000); assert.equal(overrun.state, 'failed'); assert.equal(overrun.cleared, 0);
  const idle = new WitchRun({}, 0); idle.advance(20000); assert.equal(idle.state, 'failed');
});

function roomFixture(count = 4) {
  let now = 1000000; const messages = [];
  const service = new RoomService({ now: () => now, send: (client, message) => messages.push({ client, message: structuredClone(message) }) });
  const clients = Array.from({ length: count }, () => ({}));
  service.handle(clients[0], { type: 'create', name: 'Witch 1', mode: 'game-select', game: WITCH_GAME });
  const room = service.rooms.get(clients[0].room);
  clients.slice(1).forEach((client, i) => service.handle(client, { type: 'join', code: room.code, name: `Witch ${i + 2}` }));
  service.handle(clients[0], { type: 'start' });
  clients.forEach(client => { service.handle(client, { type: 'sync', rtt: 10, uncertainty: 5, count: 5 }); service.handle(client, { type: 'ready', ready: true }); });
  return { service, room, clients, messages, setTime: value => { now = value; }, now: () => now };
}

test('four players take authoritative turns, cannot act for each other, and receive one score per turn', () => {
  const f = roomFixture(); const { service, room, clients } = f;
  assert.ok(GAMES[WITCH_GAME].turnBased); assert.equal(room.round.witch.playerId, room.players[0].id);
  for (let i = 0; i < 4; i++) {
    const turn = room.round.witch, run = throwPotion(turn.startAt, 100 + i * 12);
    const local = { id: room.round.id, turn: i, run, start: turn.startAt, goDelay: 0 };
    const result = resultMessage(room.round, local, 'finished', run.elapsed, turn.startAt + run.elapsed);
    f.setTime(turn.startAt + run.elapsed);
    if (i === 0) {
      service.handle(clients[1], result); assert.equal(room.players[1].result, null);
      service.handle(clients[0], { ...result, cleared: 40 }); assert.equal(room.players[0].result, null);
    }
    service.handle(clients[i], result); assert.ok(room.players[i].result, JSON.stringify({ i, result, errors: f.messages.filter(item => item.message.type === 'error') })); assert.equal(room.players[i].result.cleared, run.cleared);
    service.handle(clients[i], result); assert.equal(room.round.witch.index, i);
    f.setTime(f.now() + WITCH_HOLD_MS - 1); service.tick(); assert.equal(room.round.witch.index, i);
    f.setTime(f.now() + 1); service.tick();
  }
  assert.equal(room.round.phase, 'results'); assert.equal(room.set.history.length, 1);
  const ranked = [...room.players].sort((a, b) => comparePlayers(a, b, WITCH_GAME));
  assert.ok(ranked[0].result.cleared >= ranked[3].result.cleared);
  for (const player of room.players) {
    const better = room.players.filter(other => other.result.cleared > player.result.cleared).length;
    assert.equal(room.set.players.find(member => member.id === player.id).points, [10, 7, 4, 1][better]);
  }
});

test('progress is bounded and append-only; timeouts, departures, and stale turns cannot stall the sequence', () => {
  const f = roomFixture(3); const { room, service, clients } = f;
  const turn = room.round.witch;
  f.setTime(turn.startAt + 500);
  const progress = { type: 'witch-progress', roundId: room.round.id, turn: 0, proof: [[100, 0, 0]], sample: 400 };
  service.handle(clients[1], progress); assert.equal(turn.scene.sample, 0);
  service.handle(clients[0], progress); assert.equal(turn.scene.sample, 400);
  f.setTime(f.now() + 250);
  service.handle(clients[0], { ...progress, proof: [[100, 2, 0]], sample: 600 }); assert.equal(turn.scene.sample, 400);
  service.handle(clients[1], { type: 'leave' });
  f.setTime(turn.endAt + 1000); service.tick(); assert.equal(room.players[0].result.status, 'timeout');
  f.setTime(f.now() + WITCH_HOLD_MS); service.tick(); assert.equal(room.round.witch.index, 2);
  service.handle(clients[0], { ...progress, sample: 800 }); assert.equal(room.round.witch.scene.sample, 0);
});

test('the tutorial performs a complete throw and transformation using the actual gameplay model', () => {
  const plan = witchDemoPlan(), run = new WitchRun({}, plan.start);
  for (const cue of plan.presses) cue.type === 'release' ? run.release(cue.color, cue.at) : run.tap(cue.color, cue.at);
  run.advance(plan.completeAt); assert.equal(run.state, 'land'); assert.ok(run.cleared > 0);
  assert.equal(plan.cues.filter(cue => cue.type === 'complete').length, 1);
  assert.ok(plan.presses.find(cue => cue.holdUntil));
  assert.equal(roundSettings(WITCH_GAME, 1).duration, 20000);
});


test('merged input cancellation clears the green hold without launching a potion', () => {
  const run = new WitchRun({}, 0);
  let time = 100;
  const held = new HeldInputs(color => run.tap(color, time), (color, cancelled) => run.release(color, time, cancelled));
  run.tap(0, 0); run.tap(2, 80);
  held.press('pointer:1', 1); held.press('key:k', 1);
  time = 1500; run.advance(time); assert.equal(run.state, 'aim');
  held.release('pointer:1'); assert.equal(run.pressedMask, 2);
  held.clear(); assert.equal(run.pressedMask, 0); assert.equal(run.launchAt, null);
  assert.ok(replayWitch(run.proof, time));
});


test('live frame updates and frozen nonzero device clocks preserve the submitted throw proof', () => {
  for (const start of [1234.5678, 527500.12345, 5000000.7]) {
    const run = new WitchRun({}, start); let color = 0;
    for (let at = start + 100; at < start + 4400; at += 100) {
      if (run.x >= 167) break;
      for (let frame = run.at + 16; frame < at; frame += 16) run.advance(frame);
      run.tap(color, at); color = 2 - color;
    }
    const brakeAt = run.at; run.tap(1, brakeAt);
    const releaseAt = brakeAt + 40 / 55 * 1000;
    for (let at = run.at + 16; at < releaseAt; at += 16) run.advance(at);
    run.release(1, releaseAt);
    for (let at = releaseAt + 16; at < run.landAt; at += 16) run.advance(at);
    run.advance(run.landAt + 16);
    const replay = replayWitch(run.proof, run.at - start);
    assert.ok(replay?.done); assert.equal(replay.cleared, run.cleared);
    assert.ok(Math.abs(replay.elapsed - run.elapsed) < .001);
  }
});


test('speed adds every accepted alternating press without decay or the former 42-speed ceiling', () => {
  for (const interval of [60, 120]) {
    const run = new WitchRun({}, 0);
    for (let i = 0; i < 20; i++) run.tap(i % 2 ? 2 : 0, 100 + i * interval);
    assert.equal(run.speed, 80);
    run.advance(run.at + 100); assert.equal(run.speed, 80);
    run.tap(1, run.at); assert.equal(run.power, 80);
  }
  const faster = throwPotion(0, 80), typical = throwPotion(0, 100), relaxed = throwPotion(0, 120);
  assert.ok(faster.power > typical.power && typical.power > relaxed.power);
  assert.ok(faster.cleared > typical.cleared && typical.cleared > relaxed.cleared);
  assert.ok(typical.cleared >= 35 && typical.cleared <= 45);
  assert.ok(faster.cleared > 40);
  assert.ok(typical.flightSeconds < 2);
});

test('the flight counter increases through crossed frogs and excludes the transformed landing frog', () => {
  const run = throwPotion();
  let previous = 0;
  for (let i = 0; i <= 100; i++) {
    const path = witchFlight(run, run.launchAt + (run.landAt - run.launchAt) * i / 100);
    assert.ok(path.passed >= previous); assert.ok(path.passed <= run.cleared);
    assert.ok(Number.isInteger(path.passed)); previous = path.passed;
  }
  assert.equal(previous, run.cleared);
  assert.equal(witchFlight(run, run.landAt + 1000).passed, run.cleared);
  assert.equal(witchFlight(new WitchRun(), 0), null);
});
