export const TOTEM_GAME = 'totem-shrinker';
export const BLOCK_COUNT = 30;
export const GAME_DURATION_MS = 45_000;
export const MISTAKE_FREEZE_MS = 300;
export const COLORS = ['red', 'green', 'blue'];

export function createSequence(seed, count = BLOCK_COUNT) {
  let state = seed >>> 0;
  return Array.from({ length: count }, () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) % COLORS.length;
  });
}

export class TotemRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.freezeMs = round.freezeMs;
    this.sequence = createSequence(round.seed, round.blockCount);
    this.cleared = 0;
    this.mistakes = 0;
    this.blockedUntil = 0;
    this.done = false;
    this.elapsed = null;
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color >= COLORS.length || time < this.start || time >= this.end || time < this.blockedUntil) return { type: 'ignored' };
    if (color !== this.sequence[this.cleared]) {
      this.mistakes++;
      this.blockedUntil = time + this.freezeMs;
      return { type: 'mistake' };
    }
    this.cleared++;
    if (this.cleared === this.sequence.length) {
      this.done = true;
      this.elapsed = time - this.start;
      return { type: 'finished', elapsed: this.elapsed };
    }
    return { type: 'hit' };
  }

  visibleBlocks(cleared = this.cleared) {
    return this.sequence.slice(cleared, cleared + 5).reverse();
  }
}
