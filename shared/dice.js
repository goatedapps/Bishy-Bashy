import { seededIndex } from './seeded-index.js';

export const DICE_GAME = 'dice-dice-more-dice';
export const DICE_GOAL = 12;
export const DICE_DURATION_MS = 35_000;
export const DICE_REVEAL_MS = 220;
export const DICE_OBSERVE_MS = 180;
export const DICE_RETRY_MS = 600;

export function diceSequence(seed, count, difficulty = 1) {
  const choose = seededIndex(seed);
  return Array.from({ length: count }, () => {
    const faces = [1, 2, 3, 4, 5, 6];
    for (let index = faces.length - 1; index > 0; index--) {
      const other = choose(index + 1);
      [faces[index], faces[other]] = [faces[other], faces[index]];
    }
    const values = faces.slice(0, 3);
    return { values, answer: values.indexOf(Math.max(...values)), angles: values.map(() => (choose(5) - 2) * (difficulty - 1) * 5) };
  });
}

export class DiceRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.goal = round.goal;
    this.rollMs = round.rollMs;
    this.sequence = diceSequence(round.seed, round.goal, round.difficulty);
    this.cleared = 0;
    this.mistakes = 0;
    this.shownAt = localStart + this.rollMs;
    this.blockedUntil = 0;
    this.feedback = null;
    this.done = false;
    this.elapsed = null;
  }

  get puzzle() { return this.sequence[Math.min(this.cleared, this.goal - 1)]; }
  get readyAt() { return Math.max(this.blockedUntil, this.shownAt + DICE_OBSERVE_MS); }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.readyAt || time >= this.end) return { type: 'ignored' };
    const puzzle = this.puzzle;
    const hit = color === puzzle.answer;
    this.feedback = { kind: hit ? 'hit' : 'miss', at: time, color, puzzle };
    if (!hit) {
      this.mistakes++;
      this.blockedUntil = time + DICE_RETRY_MS;
      return { type: 'mistake' };
    }
    if (++this.cleared === this.goal) {
      this.done = true;
      this.elapsed = time - this.start;
      return { type: 'finished', elapsed: this.elapsed };
    }
    this.shownAt = time + DICE_REVEAL_MS + this.rollMs;
    return { type: 'hit' };
  }
}
