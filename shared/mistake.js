import { createSequence } from './totem.js';

export const MISTAKE_GAME = 'me-find-mistake';
export const MISTAKE_GOAL = 8;
export const MISTAKE_DURATION_MS = 35_000;
export const MISTAKE_RETRY_MS = 600;
export const MISTAKE_REVEAL_MS = 260;
export const MISTAKE_OBSERVE_MS = 250;
export const PICTURE_NAMES = [
  'Owl with a star badge', 'Owl with a heart badge', 'Duck facing left', 'Duck facing right',
  'Frog with a crown', 'Frog with a chef hat', 'Robot with square eyes', 'Robot with round eyes',
  'Cat with a bow tie', 'Cat with a necktie', 'Crab with left claw up', 'Crab with right claw up',
  'Cupcake with strawberry', 'Cupcake with cherry', 'Bunny with upright ears', 'Bunny with a folded ear',
];

export function mistakeSequence(seed, count, difficulty = 1) {
  const digits = createSequence(seed, count * 4);
  const pairs = Math.min(8, difficulty + 3);
  return Array.from({ length: count }, (_, index) => {
    const odd = digits[index * 4];
    const pair = (digits[index * 4 + 1] * 3 + digits[index * 4 + 2]) % pairs;
    const common = pair * 2 + digits[index * 4 + 3] % 2;
    return { odd, pictures: Array.from({ length: 3 }, (_, column) => column === odd ? common ^ 1 : common) };
  });
}

export class MistakeRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.goal = round.goal;
    this.sequence = mistakeSequence(round.seed, round.goal, round.difficulty);
    this.cleared = 0;
    this.mistakes = 0;
    this.shownAt = localStart;
    this.blockedUntil = 0;
    this.feedback = null;
    this.done = false;
    this.elapsed = null;
  }

  get puzzle() { return this.sequence[Math.min(this.cleared, this.goal - 1)]; }
  get readyAt() { return Math.max(this.blockedUntil, this.shownAt + (this.cleared === 0 ? MISTAKE_OBSERVE_MS : 0)); }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.readyAt || time >= this.end) return { type: 'ignored' };
    const puzzle = this.puzzle;
    if (color !== puzzle.odd) {
      this.mistakes++;
      this.blockedUntil = time + MISTAKE_RETRY_MS;
      this.feedback = { kind: 'miss', at: time, color, puzzle };
      return { type: 'mistake' };
    }
    this.feedback = { kind: 'hit', at: time, color, puzzle };
    this.cleared++;
    if (this.cleared === this.goal) {
      this.done = true;
      this.elapsed = time - this.start;
      return { type: 'finished', elapsed: this.elapsed };
    }
    this.shownAt = time + MISTAKE_REVEAL_MS;
    return { type: 'hit' };
  }
}
