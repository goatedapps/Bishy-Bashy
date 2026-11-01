import { seededIndex } from './seeded-index.js';

export const COIN_GAME = 'its-raining-coins';
export const COIN_GOAL = 36;
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
    Object.assign(this, { id: round.id, start: localStart, end: localStart + round.duration, goal: round.goal, baseFallMs: round.fallMs, baseSpawnMs: round.spawnMs || Math.round(round.fallMs * .55),
      index: 0, position: 1, blockedUntil: 0, cleared: 0, mistakes: 0, feedback: null, events: [], done: false, elapsed: null });
    this.sequence = coinSequence(round.seed);
    // Assign timings per pair so acceleration never changes an airborne trajectory.
    this.schedule = [];
    let launchedAt = this.start;
    while (launchedAt < this.end) {
      const index = this.schedule.length;
      const pace = 1 - .5 * Math.min(index / (COIN_GOAL - 1), 1);
      const fallMs = Math.round(this.baseFallMs * pace);
      const spawnMs = Math.round(this.baseSpawnMs * pace);
      this.schedule.push({ ...this.sequence[index % this.sequence.length], index, launchedAt, fallMs, spawnMs, landAt: launchedAt + fallMs });
      launchedAt += spawnMs;
    }
  }

  get wave() { return this.sequence[this.index % this.sequence.length]; }
  get launchedAt() { return this.schedule[this.index]?.launchedAt ?? this.end; }
  get fallMs() { return this.schedule[this.index]?.fallMs ?? Math.round(this.baseFallMs * .5); }
  get spawnMs() { return this.schedule[this.index]?.spawnMs ?? Math.round(this.baseSpawnMs * .5); }
  get landAt() { return this.schedule[this.index]?.landAt ?? this.end; }

  activeWaves(time) {
    if (this.done || !Number.isFinite(time) || time < this.start || time >= this.end) return [];
    return this.schedule.filter(wave => wave.index >= this.index && wave.launchedAt <= time && wave.landAt > time).slice(0, 3);
  }

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
      this.blockedUntil = 0;
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
