import { seededIndex } from './seeded-index.js';
export const LADDER_GAME = 'ladder-climber';
export const LADDER_SETS = 10;
export const LADDER_DURATION_MS = 45000;
export const LADDER_STEP_MS = 100;
export const LADDER_MOVE_MS = 180;
export function ladderCourse(seed, sets = LADDER_SETS) {
  const choose = seededIndex(seed); let start = 0, base = 0, previous = choose(3);
  return Array.from({ length: sets }, (_, index) => {
    const column = index ? (previous + 1 + choose(2)) % 3 : previous, steps = 3 + choose(4);
    const ladder = { column, steps, start, base }; start += steps; base += steps; previous = column; return ladder;
  });
}
export function ladderPoint(course, cleared) {
  const segment = course.find(item => cleared < item.start + item.steps) || course.at(-1);
  return { column: segment.column, height: segment.base + Math.min(segment.steps, Math.max(0, cleared - segment.start)) };
}
export class LadderRun {
  constructor(round, start) {
    this.id = round.id; this.start = start; this.end = start + round.duration;
    this.course = ladderCourse(round.seed, round.ladderSets || LADDER_SETS);
    this.sequence = this.course.flatMap(ladder => Array(ladder.steps).fill(ladder.column));
    this.goal = this.sequence.length; this.cleared = 0; this.mistakes = 0; this.blockedUntil = start;
    this.lastTap = -Infinity; this.done = false; this.elapsed = null; this.finishAt = null;
    this.feedback = null; this.stageFeedback = null; this.events = [];
  }
  tap(color, time) {
    if (this.done || this.finishAt !== null || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end || time < this.blockedUntil || time - this.lastTap < LADDER_STEP_MS) return { type: 'ignored' };
    this.lastTap = time;
    if (color !== this.sequence[this.cleared]) {
      this.mistakes++; this.blockedUntil = time + 250; this.feedback = { kind: 'miss', color, at: time };
      this.stageFeedback = { correct: false, at: time }; this.events.push({ type: 'stageWrong', at: time }); return { type: 'move' };
    }
    this.cleared++; this.feedback = { kind: 'hit', color, at: time }; this.events.push({ type: 'ladderStep', at: time });
    if (this.course.some(item => this.cleared === item.start + item.steps)) {
      if (this.cleared === this.goal) this.finishAt = time + LADDER_MOVE_MS;
      else { this.stageFeedback = { correct: true, at: time }; this.events.push({ type: 'stageComplete', at: time }); this.blockedUntil = time + LADDER_MOVE_MS; }
    }
    return { type: 'move' };
  }
  advance(time) {
    if (this.done || this.finishAt === null || time < this.finishAt || this.finishAt >= this.end) return;
    this.done = true; this.elapsed = this.finishAt - this.start;
    this.stageFeedback = { correct: true, at: this.finishAt };
    this.events.push({ type: 'stageComplete', at: this.finishAt, final: true });
  }
}
