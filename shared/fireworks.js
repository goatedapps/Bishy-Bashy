import { createSequence } from './totem.js';

export const FIREWORK_GAME = 'fireworks-craze';
export const FIREWORK_GOAL = 5;
export const FIREWORK_DURATION_MS = 45_000;
export const FIREWORK_FREEZE_MS = 650;
export const FIREWORK_SETS = [
  { count: 1, airMs: 2600, gapMs: 420 },
  { count: 3, airMs: 2600, gapMs: 420 },
  { count: 3, airMs: 2200, gapMs: 340 },
  { count: 4, airMs: 2100, gapMs: 300 },
  { count: 5, airMs: 2000, gapMs: 260 },
];

export function fireworkSequence(seed) {
  return createSequence(seed, 1024).map(color => ({ color }));
}

export class FireworkRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.goal = FIREWORK_GOAL;
    this.speed = round.speed || 1;
    this.sequence = fireworkSequence(round.seed);
    this.index = 0;
    this.launchedAt = localStart;
    this.cleared = 0;
    this.burstMask = 0;
    this.burstTimes = Array(5).fill(-10000);
    this.mistakes = 0;
    this.blockedUntil = 0;
    this.feedback = null;
    this.stageFeedback = null;
    this.events = [];
    this.lastTap = -Infinity;
    this.done = false;
    this.elapsed = null;
  }

  get set() { return FIREWORK_SETS[Math.min(this.cleared, FIREWORK_GOAL - 1)]; }
  get rockets() {
    return Array.from({ length: this.set.count }, (_, slot) => ({
      slot, color: this.sequence[(this.index * 5 + slot) % this.sequence.length].color,
      launchAt: this.launchedAt + slot * this.set.gapMs * this.speed,
      airMs: this.set.airMs * this.speed,
      burstAt: this.burstTimes[slot],
      hit: Boolean(this.burstMask & (1 << slot)),
    }));
  }

  fail(at) {
    this.mistakes++;
    this.feedback = { kind: 'miss', at };
    this.stageFeedback = { correct: false, at };
    this.events.push({ type: 'stageWrong', at });
    this.next(at);
  }

  next(at) {
    this.index++;
    this.burstMask = 0;
    this.burstTimes.fill(-10000);
    this.launchedAt = this.blockedUntil = at + FIREWORK_FREEZE_MS;
  }

  advance(time) {
    if (this.done || !Number.isFinite(time) || time < this.start) return;
    // Resolve expirations at their scheduled landing, independent of frame frequency.
    while (true) {
      const pending = this.rockets.filter(rocket => !rocket.hit);
      const landsAt = Math.min(...pending.map(rocket => rocket.launchAt + rocket.airMs));
      if (landsAt > Math.min(time, this.end)) return;
      this.fail(landsAt);
    }
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end) return { type: 'ignored' };
    this.advance(time);
    if (time < this.blockedUntil || time - this.lastTap < 80) return { type: 'ignored' };
    this.lastTap = time;
    const rocket = this.rockets.find(rocket => !rocket.hit && rocket.color === color && time >= rocket.launchAt && time < rocket.launchAt + rocket.airMs);
    if (!rocket) { this.fail(time); return { type: 'mistake' }; }
    this.burstMask |= 1 << rocket.slot;
    this.burstTimes[rocket.slot] = time;
    this.feedback = { kind: 'burst', color, at: time };
    if (this.burstMask === (1 << this.set.count) - 1) {
      this.cleared++;
      this.stageFeedback = { correct: true, at: time };
      this.events.push({ type: 'stageComplete', at: time });
      if (this.cleared === this.goal) {
        this.done = true;
        this.elapsed = time - this.start;
        return { type: 'finished', elapsed: this.elapsed };
      }
      this.next(time);
    }
    return { type: 'hit' };
  }
}
