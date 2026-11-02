import { seededIndex } from './seeded-index.js';

export const HORSE_GAME = 'horse-speeder';
export const HORSE_GOAL = 3200;
export const HORSE_DURATION_MS = 60000;
export const HORSE_STEP_MS = 1000 / 120;
export const HORSE_MOVE_MS = 180;
export const HORSE_MAX_SPEED = 104;
export const HORSE_TRAFFIC_SPEED = 18;

export function horseTraffic(seed, spacing = 140) {
  const choose = seededIndex(seed);
  return Array.from({ length: 40 }, (_, index) => ({
    distance: 230 + index * spacing, safe: choose(3),
  }));
}

export function horseLane(run, time) {
  const progress = Math.max(0, Math.min(1, (time - run.moveAt) / HORSE_MOVE_MS));
  return run.moveFrom + (run.position - run.moveFrom) * progress;
}

export class HorseRun {
  constructor(round, start) {
    this.id = round.id; this.start = start; this.end = start + round.duration; this.goal = round.goal ?? HORSE_GOAL;
    this.traffic = horseTraffic(round.seed, round.spacing ?? 140);
    this.distance = 0; this.speed = 36; this.position = 1; this.moveFrom = 1; this.moveAt = start - HORSE_MOVE_MS;
    this.index = 0; this.cleared = 0; this.mistakes = 0; this.step = 0; this.proof = [];
    this.lastThrust = start - 10000; this.stumbleUntil = start;
    this.done = false; this.elapsed = null; this.feedback = null; this.events = [];
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end || this.proof.length >= 1024) return { type: 'ignored' };
    this.advance(time);
    if (this.done) return { type: 'ignored' };
    const at = this.start + this.step * HORSE_STEP_MS;
    if (color === 1) {
      if (at - this.lastThrust < 100 - 1e-6 || at < this.stumbleUntil) return { type: 'ignored' };
      this.speed = Math.min(HORSE_MAX_SPEED, this.speed + 7); this.lastThrust = at;
    } else {
      const target = Math.max(0, Math.min(2, this.position + (color === 0 ? -1 : 1)));
      if (target === this.position || at - this.moveAt < HORSE_MOVE_MS - 1e-6) return { type: 'ignored' };
      this.moveFrom = horseLane(this, at); this.moveAt = at; this.position = target;
    }
    this.proof.push([this.step, color]);
    return { type: 'move' };
  }

  advance(time) {
    if (this.done || !Number.isFinite(time) || time < this.start) return;
    const target = Math.floor((Math.min(time, this.end) - this.start) / HORSE_STEP_MS + 1e-7);
    while (this.step < target && !this.done) this.integrate(++this.step);
  }

  integrate(step) {
    const dt = HORSE_STEP_MS / 1000, previous = this.distance, before = this.start + (step - 1) * HORSE_STEP_MS;
    this.speed = Math.max(34, this.speed - 9 * dt);
    this.distance = Math.min(this.goal, previous + this.speed * dt);
    const finish = this.distance >= this.goal;
    const stopAt = finish ? before + (this.goal - previous) / this.speed * 1000 : before + HORSE_STEP_MS;
    const wave = this.traffic[this.index];
    if (wave) {
      const oldGap = wave.distance + HORSE_TRAFFIC_SPEED * (before - this.start) / 1000 - previous;
      const newGap = wave.distance + HORSE_TRAFFIC_SPEED * (stopAt - this.start) / 1000 - this.distance;
      if (newGap <= 0) {
        const at = before + Math.max(0, Math.min(1, oldGap / (oldGap - newGap))) * (stopAt - before);
        const lane = horseLane(this, at);
        const hitColumn = [0, 1, 2].find(column => column !== wave.safe && Math.abs(column - lane) < .6);
        const hit = hitColumn !== undefined;
        this.index++;
        if (hit) {
          this.speed = Math.max(34, this.speed * .4); this.mistakes++; this.stumbleUntil = at + 450;
          this.feedback = { kind: 'crash', color: hitColumn, at }; this.events.push({ type: 'stageWrong', at });
        } else {
          this.feedback = { kind: 'clear', at }; this.events.push({ type: 'stageComplete', at });
        }
      }
    }
    this.cleared = Math.floor(this.distance);
    if (finish) {
      this.done = true; this.cleared = this.goal; this.elapsed = stopAt - this.start;
      this.feedback = { kind: 'clear', at: stopAt };
      this.events.push({ type: 'stageComplete', at: stopAt, final: true });
    }
  }
}

export function validHorseResult(round, message) {
  if (!Array.isArray(message.proof) || message.proof.length > 1024) return false;
  const run = new HorseRun(round, 0);
  let previous = -1;
  for (const edge of message.proof) {
    if (!Array.isArray(edge) || edge.length !== 2 || !Number.isInteger(edge[0]) || edge[0] < previous || edge[0] < 0 || edge[0] >= round.duration / HORSE_STEP_MS || run.tap(edge[1], edge[0] * HORSE_STEP_MS).type === 'ignored') return false;
    previous = edge[0];
  }
  run.advance(round.duration);
  return run.done && Math.abs(message.elapsed - run.elapsed) < .001 && message.cleared === run.goal && message.mistakes === run.mistakes;
}
