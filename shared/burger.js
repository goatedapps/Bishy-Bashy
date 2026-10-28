import { createSequence } from './totem.js';

export const BURGER_GAME = 'burger-girl';
export const BURGER_GOAL = 12;
export const BURGER_DURATION_MS = 35_000;
export const BURGER_RECOVERY_MS = 300;
export const INGREDIENT_NAMES = ['Lettuce', 'Patty', 'Tomato', 'Top bun'];

export class BurgerRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.goal = round.goal;
    this.fallMs = round.fallMs;
    this.sequence = createSequence(round.seed, 512);
    this.index = 0;
    this.position = 1;
    this.launchedAt = localStart;
    this.blockedUntil = 0;
    this.cleared = 0;
    this.mistakes = 0;
    this.feedback = null;
    this.events = [];
    this.done = false;
    this.elapsed = null;
  }

  get column() { return this.sequence[this.index % this.sequence.length]; }
  get ingredient() { return this.cleared % 4; }
  get landAt() { return this.launchedAt + this.fallMs; }

  advance(time, inclusive = true) {
    if (this.done || !Number.isFinite(time) || time < this.start) return;
    // Resolve landings at their scheduled time, even if a frame arrives late.
    while (this.landAt < this.end && (this.landAt < time || inclusive && this.landAt === time)) {
      const at = this.landAt;
      const caught = this.position === this.column;
      this.feedback = { kind: caught ? 'catch' : 'miss', at, color: this.column, ingredient: this.ingredient, served: caught && this.ingredient === 3 };
      this.events.push({ type: caught ? 'hit' : 'mistake', at, color: this.column });
      if (caught) this.cleared++;
      else this.mistakes++;
      this.index++;
      this.launchedAt = at + (caught ? 160 : BURGER_RECOVERY_MS);
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
