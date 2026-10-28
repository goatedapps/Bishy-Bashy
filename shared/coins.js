import { seededIndex } from './seeded-index.js';

export const COIN_GAME = 'its-raining-coins';
export const COIN_GOAL = 18;
export const COIN_DURATION_MS = 40_000;

export function coinSequence(seed, count = 128) {
  const choose = seededIndex(seed);
  let previous = 1;
  return Array.from({ length: count }, () => {
    const column = (previous + 1 + choose(2)) % 3;
    previous = column;
    return { column, decoy: (column + 1 + choose(2)) % 3 };
  });
}

export class CoinRun {
  constructor(round, localStart) {
    Object.assign(this, { id: round.id, start: localStart, end: localStart + round.duration, goal: round.goal, fallMs: round.fallMs,
      index: 0, position: 1, launchedAt: localStart, blockedUntil: 0, cleared: 0, mistakes: 0, feedback: null, events: [], done: false, elapsed: null });
    this.sequence = coinSequence(round.seed);
  }

  get wave() { return this.sequence[this.index % this.sequence.length]; }
  get landAt() { return this.launchedAt + this.fallMs; }

  advance(time, inclusive = true) {
    if (this.done || !Number.isFinite(time) || time < this.start) return;
    while (this.landAt < this.end && (this.landAt < time || inclusive && this.landAt === time)) {
      const at = this.landAt;
      const caught = this.position === this.wave.column;
      this.feedback = { kind: caught ? 'catch' : this.position === this.wave.decoy ? 'decoy' : 'miss', at, color: this.position };
      this.events.push({ type: caught ? 'hit' : 'mistake', at, color: this.position });
      if (caught) this.cleared++;
      else this.mistakes++;
      this.index++;
      this.launchedAt = at + (caught ? 100 : 400);
      this.blockedUntil = caught ? 0 : this.launchedAt;
      if (this.cleared === this.goal) {
        this.done = true;
        this.elapsed = at - this.start;
        return;
      }
    }
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end) return { type: 'ignored' };
    this.advance(time, false);
    if (this.done || time < this.blockedUntil) return { type: 'ignored' };
    const moved = this.position !== color;
    this.position = color;
    this.advance(time);
    return this.done ? { type: 'finished', elapsed: this.elapsed } : { type: moved ? 'move' : 'ignored' };
  }
}
