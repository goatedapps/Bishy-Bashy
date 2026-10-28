import { seededIndex } from './seeded-index.js';

export const DODGE_GAME = 'dodge-or-die';
export const DODGE_GOAL = 12;
export const DODGE_DURATION_MS = 40_000;
export const JUMP_MS = 640;
export const JUMP_CLEARANCE = .6;
export const MOVE_MS = 100;

export function dodgeSequence(seed, count = 128) {
  const choose = seededIndex(seed);
  return Array.from({ length: count }, (_, index) => ({ kind: index % 2 === 0 ? 'wall' : 'hurdle', safe: choose(3) }));
}

export class DodgeRun {
  constructor(round, localStart) {
    Object.assign(this, { id: round.id, start: localStart, end: localStart + round.duration, goal: round.goal, approachMs: round.approachMs,
      index: 0, position: 1, launchedAt: localStart, blockedUntil: 0, moveAt: localStart, jumpAt: -Infinity,
      cleared: 0, mistakes: 0, feedback: null, events: [], done: false, elapsed: null });
    this.sequence = dodgeSequence(round.seed);
  }

  get obstacle() { return this.sequence[this.index % this.sequence.length]; }
  get impactAt() { return this.launchedAt + this.approachMs; }
  jumpHeight(time) { return time >= this.jumpAt && time <= this.jumpAt + JUMP_MS ? Math.sin(Math.PI * (time - this.jumpAt) / JUMP_MS) : 0; }

  advance(time, inclusive = true) {
    if (this.done || !Number.isFinite(time) || time < this.start) return;
    while (this.impactAt < this.end && (this.impactAt < time || inclusive && this.impactAt === time)) {
      const at = this.impactAt;
      const safe = this.obstacle.kind === 'wall' ? this.position === this.obstacle.safe : this.jumpHeight(at) >= JUMP_CLEARANCE;
      this.feedback = { kind: safe ? 'clear' : 'crash', at, color: this.obstacle.kind === 'hurdle' ? 1 : this.position, obstacle: this.obstacle };
      this.events.push({ type: safe ? 'hit' : 'mistake', at, color: this.feedback.color });
      if (safe) this.cleared++;
      else this.mistakes++;
      this.index++;
      this.launchedAt = at + (safe ? 180 : 550);
      this.blockedUntil = safe ? 0 : this.launchedAt;
      if (!safe) this.jumpAt = -Infinity;
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
    let moved = false;
    if (color === 1) {
      if (time >= this.jumpAt + JUMP_MS) { this.jumpAt = time; moved = true; }
    } else if (time >= this.moveAt) {
      const position = Math.max(0, Math.min(2, this.position + (color === 0 ? -1 : 1)));
      moved = position !== this.position;
      if (moved) { this.position = position; this.moveAt = time + MOVE_MS; }
    }
    this.advance(time);
    return this.done ? { type: 'finished', elapsed: this.elapsed } : { type: moved ? 'move' : 'ignored' };
  }
}
