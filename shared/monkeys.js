import { createSequence } from './totem.js';

export const MONKEY_GAME = 'mimicking-monkeys';
export const MONKEY_DURATION_MS = 45_000;
export const MONKEY_STAGES = 5;
export const DEMO_LEAD_MS = 550;
export const DEMO_GAP_MS = 250;
export const MONKEY_RETRY_MS = 600;
export const MONKEY_INPUT_GUARD_MS = 100;

export class MonkeyRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.goal = round.goal;
    this.stepMs = round.stepMs;
    this.sequence = createSequence(round.seed, round.goal + 1);
    this.cleared = 0;
    this.mistakes = 0;
    this.entered = 0;
    this.lastTap = -Infinity;
    this.blockedUntil = 0;
    this.demoVersion = 0;
    this.feedback = null;
    this.elapsed = null;
    this.done = false;
    this.demonstrate(localStart + DEMO_LEAD_MS);
  }

  get length() { return Math.min(this.goal + 1, this.cleared + 2); }

  demonstrate(at) {
    this.demoAt = at;
    this.playAt = at + this.length * this.stepMs + DEMO_GAP_MS;
    this.entered = 0;
    this.demoVersion++;
    this.cues = this.sequence.slice(0, this.length).map((color, index) => ({ color, at: at + index * this.stepMs }));
  }

  phase(time) {
    if (this.done || time >= this.end) return { mode: 'done', color: null, position: -1 };
    if (time < this.start) return { mode: 'waiting', color: null, position: -1 };
    if (time < this.blockedUntil) return { mode: 'retry', color: null, position: -1 };
    if (time >= this.playAt) return { mode: 'play', color: null, position: this.entered };
    const offset = time - this.demoAt;
    const position = Math.floor(offset / this.stepMs);
    const visible = offset >= 0 && position < this.length && offset % this.stepMs < this.stepMs * .65;
    return { mode: 'watch', color: visible ? this.sequence[position] : null, position: visible ? position : -1 };
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end || this.phase(time).mode !== 'play' || time - this.lastTap < MONKEY_INPUT_GUARD_MS) return { type: 'ignored' };
    this.lastTap = time;
    if (color !== this.sequence[this.entered]) {
      this.mistakes++;
      this.feedback = { kind: 'miss', at: time };
      this.blockedUntil = time + MONKEY_RETRY_MS;
      this.demonstrate(this.blockedUntil + DEMO_LEAD_MS);
      return { type: 'mistake' };
    }
    this.entered++;
    this.feedback = { kind: 'hit', color, at: time };
    if (this.entered === this.length) {
      this.cleared++;
      if (this.cleared === this.goal) {
        this.done = true;
        this.elapsed = time - this.start;
        return { type: 'finished', elapsed: this.elapsed };
      }
      this.demonstrate(time + DEMO_LEAD_MS);
    }
    return { type: 'hit' };
  }
}
