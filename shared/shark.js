import { seededIndex } from './seeded-index.js';

export const SHARK_GAME = 'shark-jumper';
export const SHARK_GOAL = 30;
export const SHARK_DURATION_MS = 45000;
export const SHARK_JUMP_MS = 240;
export const SHARK_FALL_MS = 220;
export const SHARK_RECOVERY_MS = 1000;

export function sharkCourse(seed, count = SHARK_GOAL) {
  const choose = seededIndex(seed);
  return Array.from({ length: count }, (_, index) => ({ color: choose(3), column: index % 2 === 0 ? 2 : 0 }));
}

export class SharkRun {
  constructor(round, start) {
    this.id = round.id; this.start = start; this.end = start + round.duration;
    this.goal = round.goal ?? SHARK_GOAL; this.course = sharkCourse(round.seed, this.goal);
    this.sequence = this.course.map(shark => shark.color);
    this.cleared = 0; this.mistakes = 0; this.jumpAt = start; this.landAt = null;
    this.fallAt = start - 10000; this.blockedUntil = start; this.splashAt = null;
    this.feedback = null; this.events = []; this.proof = []; this.done = false; this.elapsed = null;
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end || this.proof.length >= 512) return { type: 'ignored' };
    this.advance(time);
    if (this.done || this.landAt !== null || time + .000001 < this.blockedUntil) return { type: 'ignored' };
    this.proof.push([color, time - this.start]);
    if (color !== this.sequence[this.cleared]) {
      this.mistakes++; this.fallAt = time; this.blockedUntil = time + SHARK_RECOVERY_MS;
      this.splashAt = time + SHARK_FALL_MS; this.feedback = { kind: 'miss', color, at: time };
    } else {
      this.jumpAt = time; this.landAt = time + SHARK_JUMP_MS;
      this.feedback = { kind: 'boost', color, at: time };
      this.events.push({ type: 'sharkJump', at: time, preserveTail: this.cleared === this.goal - 1 && this.landAt <= this.end });
    }
    return { type: 'move' };
  }

  advance(time) {
    if (this.done || !Number.isFinite(time) || time < this.start) return;
    const at = Math.min(time, this.end);
    if (this.splashAt !== null && at + .000001 >= this.splashAt) {
      this.events.push({ type: 'sharkSplash', at: this.splashAt }); this.splashAt = null;
    }
    if (this.landAt === null || at + .000001 < this.landAt || this.landAt > this.end) return;
    const landedAt = this.landAt;
    this.landAt = null; this.cleared++;
    this.feedback = { kind: 'hit', color: this.sequence[this.cleared - 1], at: landedAt };
    if (this.cleared === this.goal) {
      this.done = true; this.elapsed = landedAt - this.start;
      this.events.push({ type: 'stageComplete', at: landedAt, final: true });
    }
  }
}

export function validSharkResult(round, message) {
  if (!Array.isArray(message.proof) || message.proof.length > 512) return false;
  const run = new SharkRun(round, 0);
  let previous = -1;
  for (const edge of message.proof) {
    if (!Array.isArray(edge) || edge.length !== 2 || !Number.isFinite(edge[1]) || edge[1] < previous || run.tap(edge[0], edge[1]).type === 'ignored') return false;
    previous = edge[1];
  }
  run.advance(round.duration);
  return run.done && message.cleared === run.goal && message.mistakes === run.mistakes && Math.abs(message.elapsed - run.elapsed) < .001;
}
