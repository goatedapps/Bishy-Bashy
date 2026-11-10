import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../server/rooms.js';
import { createRun, roundSettings } from '../shared/games.js';
import { ANT_GAME, MARKET_FINISH_HOLD_MS, MARKET_GAMES, SATAY_GAME, WEATHER_GAME, validMarketResult } from '../shared/market-games.js';
import { resultMessage } from '../src/result-message.js';
import { driveMarket } from './helpers/market-games.js';

const settings = game => ({ id: game, game, ...roundSettings(game, 5) });
const localStart = 5799.1234;

test('Satay accepts both edges, limits players to one attempt per hot dog, and processes skipped drops deterministically', () => {
  const round = settings(SATAY_GAME);
  const run = createRun(round, localStart);
  assert.equal(run.tap(0, localStart).type, 'ignored');
  assert.equal(run.tap(2, run.catchAt - round.catchWindow - 1).type, 'mistake');
  assert.equal(run.tap(0, run.catchAt).type, 'ignored');
  run.advance(run.nextAt);
  assert.equal(run.tap(1, run.catchAt - round.catchWindow).type, 'clear');
  run.advance(run.nextAt);
  assert.equal(run.tap(0, run.catchAt + round.catchWindow).type, 'clear');
  run.advance(run.nextAt + 2800);
  assert.ok(run.index >= 4);
  assert.ok(run.mistakes >= 2);
  assert.equal(run.cleared, 2);
  for (let attempt = 0; attempt < round.goal && !run.done; attempt++) {
    run.advance(run.nextAt ?? run.launchedAt);
    run.tap(2, run.catchAt);
  }
  assert.ok(run.done);
  assert.ok(validMarketResult(round, run));
});

test('Weather shoots one bottle from the matching stack, preserves other bottles, and pauses before refill', () => {
  const run = createRun(settings(WEATHER_GAME), localStart);
  let time = run.blockedUntil;
  assert.equal(run.tap(1, time).type, 'mistake');
  assert.equal(run.bottleMask, 9);
  assert.equal(run.tap(0, time + 100).type, 'ignored');
  time = run.blockedUntil;
  assert.equal(run.tap(0, time).type, 'move');
  assert.equal(run.bottleMask, 8);
  assert.equal(run.tap(2, time + 75).type, 'clear');
  assert.equal(run.tap(0, time + 150).type, 'ignored');
  time = run.blockedUntil;
  assert.equal(run.tap(0, time).type, 'move');
  assert.equal(run.bottleMask, 25);
  assert.equal(run.tap(0, time + 75).type, 'move');
  assert.equal(run.bottleMask, 24);
  assert.equal(run.cleared, 1);
});

test('Ant mail keeps the same plane after a wrong turn and waits for a successful plane to depart', () => {
  const run = createRun(settings(ANT_GAME), localStart);
  const [first, second] = run.sequence;
  assert.equal(run.tap((first + 1) % 3, run.blockedUntil).type, 'mistake');
  assert.equal(run.cleared, 0);
  assert.equal(run.tap(first, run.blockedUntil - 1).type, 'ignored');
  assert.equal(run.tap(first, run.blockedUntil).type, 'clear');
  assert.equal(run.tap(second, run.blockedUntil - 1).type, 'ignored');
  assert.equal(run.tap(second, run.blockedUntil).type, 'clear');
  assert.equal(run.cleared, 2);
});

for (const game of MARKET_GAMES) test(`${game}: room rejects a forged finish, acknowledges a replayed finish once, and holds the last animation`, () => {
  let now = 100_000;
  const messages = [];
  const service = new RoomService({ now: () => now, send: (_client, message) => messages.push(message) });
  const host = {};
  service.handle(host, { type: 'create', name: 'Host', mode: 'game-select', game });
  const room = service.rooms.get(host.room);
  assert.ok(MARKET_GAMES.every(id => messages.find(message => message.type === 'joined').capabilities.includes(id)));
  service.handle(host, { type: 'start' });
  service.handle(host, { type: 'sync', rtt: 10, uncertainty: 5, count: 5 });
  service.handle(host, { type: 'ready', ready: true });
  const round = room.round;
  assert.equal(round.phase, 'countdown');
  const run = driveMarket(round, { start: localStart });
  assert.ok(run.done);
  const payload = resultMessage(round, { id: round.id, run, goDelay: 1 }, 'finished', run.elapsed, run.start + run.elapsed);
  now = round.startAt + run.elapsed + 100;
  service.handle(host, { ...payload, proof: payload.proof.slice(0, -1) });
  assert.equal(room.players[0].result, null);
  service.handle(host, payload);
  const accepted = room.players[0].result;
  assert.equal(accepted.status, 'finished');
  assert.equal(accepted.elapsed, run.elapsed);
  assert.equal(room.players[0].progress.visual.done, true);
  assert.notEqual(room.round.phase, 'results');
  service.handle(host, payload);
  assert.equal(room.players[0].result, accepted);
  assert.equal(messages.filter(message => message.type === 'result-ack').length, 2);
  now += MARKET_FINISH_HOLD_MS;
  service.tick();
  assert.equal(room.round.phase, 'results');
});
