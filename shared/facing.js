import { seededIndex } from './seeded-index.js';

export const FACING_GAME = 'facing-which-way';
export const FACING_GOAL = 5;
export const FACING_DURATION_MS = 60_000;
export const FACING_LOOK_MS = 700;
export const FACING_COVER_MS = 400;
export const FACING_COVER_HOLD_MS = 350;
export const FACING_HANDOFF_MS = 200;
export const FACING_REVEAL_MS = 260;
export const FACING_RETRY_MS = 450;
export const DIRECTION_NAMES = ['Left', 'Up', 'Right'];
export const DIRECTION_ANGLES = [180, 270, 0];
const normalize = angle => (angle % 360 + 360) % 360;

export function applyTurn(pose, move) {
  return move.kind === 'mirror' ? { angle: normalize(180 - pose.angle), mirror: -pose.mirror } : { angle: normalize(pose.angle + move.degrees), mirror: pose.mirror };
}

export function facingSequence(seed, count, turnCount) {
  const choose = seededIndex(seed);
  return Array.from({ length: count }, () => {
    const initial = { angle: DIRECTION_ANGLES[choose(3)], mirror: 1 };
    const poses = [initial];
    const moves = Array.from({ length: turnCount }, () => {
      const pose = poses.at(-1);
      const choice = choose(3);
      const degrees = pose.angle === 270 ? choice === 0 ? -90 : 90 : choice === 0 ? 180 : pose.angle === 180 ? 90 : -90;
      const move = choice === 2 ? { kind: 'mirror' } : { kind: 'rotate', degrees };
      poses.push(applyTurn(pose, move));
      return move;
    });
    return { initial, moves, poses, answer: DIRECTION_ANGLES.indexOf(poses.at(-1).angle) };
  });
}

export class FacingRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.goal = round.goal;
    this.stepMs = round.stepMs;
    this.sequence = facingSequence(round.seed, round.goal, round.turnCount);
    this.cleared = 0;
    this.mistakes = 0;
    this.trialAt = localStart;
    this.blockedUntil = 0;
    this.feedback = null;
    this.stageFeedback = null;
    this.demoVersion = 0;
    this.done = false;
    this.elapsed = null;
  }

  get puzzle() { return this.sequence[Math.min(this.cleared, this.goal - 1)]; }
  get coveredAt() { return this.trialAt + FACING_LOOK_MS + FACING_COVER_MS; }
  get turnsAt() { return this.coveredAt + FACING_COVER_HOLD_MS; }
  get playAt() { return this.turnsAt + this.puzzle.moves.length * this.stepMs + FACING_HANDOFF_MS; }
  get cues() { return this.puzzle.moves.map((_, index) => ({ at: this.turnsAt + index * this.stepMs })); }

  phase(time) {
    if (!Number.isFinite(time) || time < this.start || time < this.trialAt) return { mode: 'wait' };
    if (time >= this.end || this.done) return { mode: 'done' };
    if (time < this.trialAt + FACING_LOOK_MS) return { mode: 'look' };
    if (time < this.coveredAt) return { mode: 'cover', progress: (time - this.trialAt - FACING_LOOK_MS) / FACING_COVER_MS };
    if (time < this.turnsAt) return { mode: 'covered' };
    const index = Math.floor((time - this.turnsAt) / this.stepMs);
    if (index < this.puzzle.moves.length) return { mode: 'turn', index, progress: (time - this.turnsAt - index * this.stepMs) / this.stepMs };
    return { mode: time < this.playAt ? 'handoff' : 'play' };
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end || this.phase(time).mode !== 'play') return { type: 'ignored' };
    const puzzle = this.puzzle;
    const hit = color === puzzle.answer;
    this.feedback = { kind: hit ? 'hit' : 'miss', at: time, color, puzzle };
    this.stageFeedback = { correct: hit, at: time };
    this.demoVersion++;
    if (!hit) {
      this.mistakes++;
      this.trialAt = this.blockedUntil = time + FACING_RETRY_MS;
      return { type: 'mistake' };
    }
    if (++this.cleared === this.goal) {
      this.done = true;
      this.elapsed = time - this.start;
      return { type: 'finished', elapsed: this.elapsed };
    }
    this.trialAt = time + FACING_REVEAL_MS;
    return { type: 'hit' };
  }
}
