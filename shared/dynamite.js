import { createSequence } from './totem.js';
export const DYNAMITE_GAME = 'dynamite-spark';
export const DYNAMITE_GOAL = 52;
export const DYNAMITE_DURATION_MS = 45000;
export class DynamiteRun {
  constructor(round, start) {
    this.id = round.id; this.start = start; this.end = start + round.duration;
    const groups = createSequence(round.seed, 13);
    for (let i = 1; i < groups.length; i++) if (groups[i] === groups[i - 1]) groups[i] = (groups[i] + 1) % 3;
    this.sequence = groups.flatMap(color => Array(4).fill(color));
    this.goal = 52; this.cleared = 0; this.mistakes = 0; this.blockedUntil = start;
    this.done = false; this.elapsed = null; this.feedback = null; this.lastTap = -Infinity;
  }
  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end || time < this.blockedUntil || time - this.lastTap < 40) return { type: 'ignored' };
    this.lastTap = time;
    if (color !== this.sequence[this.cleared]) {
      this.mistakes++; this.blockedUntil = time + 250;
      this.feedback = { kind: 'miss', color, at: time }; return { type: 'mistake' };
    }
    this.cleared++; this.feedback = { kind: 'hit', color, at: time };
    if (this.cleared === this.goal) { this.done = true; this.elapsed = time - this.start; return { type: 'finished', elapsed: this.elapsed }; }
    return { type: this.cleared % 4 === 0 ? 'stageComplete' : 'move' };
  }
}
