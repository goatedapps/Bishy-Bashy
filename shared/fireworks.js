import { createSequence } from './totem.js';

export const FIREWORK_GAME = 'fireworks-craze';
export const FIREWORK_GOAL = 12;
export const FIREWORK_DURATION_MS = 30_000;
export const FIREWORK_FREEZE_MS = 300;

export function fireworkSequence(seed) {
  const values = createSequence(seed, 512);
  return Array.from({ length: 256 }, (_, index) => ({ color: values[index * 2], delay: values[index * 2 + 1] * 90 }));
}

export class FireworkRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.goal = round.goal;
    this.flightMs = round.flightMs;
    this.windowMs = round.windowMs;
    this.sequence = fireworkSequence(round.seed);
    this.index = 0;
    this.launchedAt = localStart;
    this.cleared = 0;
    this.mistakes = 0;
    this.blockedUntil = 0;
    this.feedback = null;
    this.done = false;
    this.elapsed = null;
  }

  get rocket() { return this.sequence[this.index % this.sequence.length]; }
  get revealAt() { return this.launchedAt + this.flightMs + this.rocket.delay; }
  get expiresAt() { return this.revealAt + this.windowMs; }

  advance(time) {
    if (this.done || !Number.isFinite(time) || time < this.start) return;
    while (this.expiresAt <= Math.min(time, this.end)) {
      const at = this.expiresAt;
      this.mistakes++;
      this.feedback = { kind: 'miss', at };
      this.index++;
      this.launchedAt = at + FIREWORK_FREEZE_MS;
      this.blockedUntil = this.launchedAt;
    }
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end) return { type: 'ignored' };
    this.advance(time);
    if (time < this.blockedUntil) return { type: 'ignored' };
    if (time < this.revealAt || color !== this.rocket.color) {
      this.mistakes++;
      this.feedback = { kind: 'miss', at: time };
      this.index++;
      this.launchedAt = time + FIREWORK_FREEZE_MS;
      this.blockedUntil = this.launchedAt;
      return { type: 'mistake' };
    }
    this.cleared++;
    this.feedback = { kind: 'burst', color, at: time };
    this.index++;
    this.launchedAt = time;
    if (this.cleared === this.goal) {
      this.done = true;
      this.elapsed = time - this.start;
      return { type: 'finished', elapsed: this.elapsed };
    }
    return { type: 'hit' };
  }
}
