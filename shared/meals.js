import { createSequence } from './totem.js';

export const MEALS_GAME = 'get-those-burgers-out';
export const MEALS_GOAL = 6;
export const MEALS_DURATION_MS = 45_000;
export const MEALS_DROP_MS = 300;
export const MEALS_SERVE_MS = 300;
export const MEAL_NAMES = ['Fries', 'Burger', 'Drink'];

export function mealSequence(seed, count = MEALS_GOAL) {
  const sequence = createSequence(seed, count * 3);
  return Array.from({ length: count }, (_, index) => sequence.slice(index * 3, index * 3 + 3).map(value => value + 1));
}

export class MealsRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.goal = round.goal;
    this.sequence = mealSequence(round.seed, round.goal);
    this.cleared = 0;
    this.mistakes = 0;
    this.filledMask = 0;
    this.pendingAt = Array(9).fill(this.start - 10000);
    this.setAt = localStart;
    this.blockedUntil = localStart;
    this.feedback = null;
    this.stageFeedback = null;
    this.events = [];
    this.done = false;
    this.elapsed = null;
  }

  get index() { return this.cleared; }
  get requirements() { return this.sequence[Math.min(this.cleared, this.goal - 1)]; }
  get filled() { return [this.filledMask & 3, this.filledMask >> 2 & 3, this.filledMask >> 4 & 3]; }
  get inFeedback() { return this.stageFeedback && this.setAt === this.stageFeedback.at; }

  advance(time) {
    if (this.done || !Number.isFinite(time) || time < this.start) return;
    if (this.inFeedback) {
      if (time < this.blockedUntil) return;
      this.filledMask = 0;
      this.pendingAt = Array(9).fill(this.start - 10000);
      this.setAt = this.blockedUntil;
    }
    const landings = this.pendingAt.map((at, slot) => ({ at: at + MEALS_DROP_MS, slot, color: Math.floor(slot / 3) })).filter(drop => this.pendingAt[drop.slot] >= this.start && drop.at <= time && drop.at < this.end).sort((a, b) => a.at - b.at);
    for (const { at, color, slot } of landings) {
      this.pendingAt[slot] = this.start - 10000;
      this.filledMask += 1 << color * 2;
      this.feedback = { kind: 'catch', color, at };
      if (this.filled.every((count, column) => count === this.requirements[column])) {
        this.cleared++;
        this.stageFeedback = { correct: true, at };
        this.events.push({ type: 'stageComplete', at });
        this.setAt = at;
        this.blockedUntil = at + MEALS_SERVE_MS;
        if (this.cleared === this.goal) {
          this.done = true;
          this.elapsed = at - this.start;
        } else if (time >= this.blockedUntil) {
          this.filledMask = 0;
          this.pendingAt = Array(9).fill(this.start - 10000);
          this.setAt = this.blockedUntil;
        }
        return;
      }
    }
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end) return { type: 'ignored' };
    this.advance(time);
    if (this.done) return { type: 'finished', elapsed: this.elapsed };
    if (time < this.blockedUntil) return { type: 'ignored' };
    const reserved = this.filled[color] + this.pendingAt.slice(color * 3, color * 3 + 3).filter(at => at >= this.start).length;
    if (reserved >= this.requirements[color]) {
      this.mistakes++; this.feedback = { kind: 'miss', color, at: time };
      this.events.push({ type: 'stageWrong', at: time }); return { type: 'move' };
    }
    this.pendingAt[color * 3 + reserved] = time;
    return { type: 'drop' };
  }
}
