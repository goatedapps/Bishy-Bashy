import test from 'node:test';
import assert from 'node:assert/strict';
import { SyncedClock } from '../src/clock.js';

test('four-timestamp estimate accounts for server processing time', () => {
  const clock = new SyncedClock();
  clock.add({ sent: 100, serverReceived: 1110, serverSent: 1114, received: 124 });
  const estimate = clock.estimate(125);
  assert.equal(estimate.offset, 1000);
  assert.equal(estimate.rtt, 20);
  assert.equal(estimate.uncertainty, 10);
});

test('low-latency samples resist a delayed asymmetric outlier', () => {
  const clock = new SyncedClock();
  for (let i = 0; i < 5; i++) clock.add({ sent: i * 100, received: i * 100 + 20, serverReceived: i * 100 + 1010, serverSent: i * 100 + 1010 });
  clock.add({ sent: 600, received: 1600, serverReceived: 2500, serverSent: 2500 });
  assert.equal(clock.estimate(1601).offset, 1000);
  assert.equal(clock.estimate(1601).count, 6);
  assert.equal(clock.estimate(30_000), null);
});

test('invalid samples are ignored and history remains bounded', () => {
  const clock = new SyncedClock();
  clock.add({ sent: 5, received: 2, serverReceived: 10, serverSent: 10 });
  clock.add({ sent: NaN, received: 2, serverReceived: 10, serverSent: 10 });
  assert.equal(clock.estimate(10), null);
  for (let i = 0; i < 50; i++) clock.add({ sent: i * 100, received: i * 100 + 20, serverReceived: i * 100 + 1010, serverSent: i * 100 + 1010 });
  assert.equal(clock.samples.length, 20);
});
