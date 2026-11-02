import { seededIndex } from './seeded-index.js';

export const STAR_GAME = 'star-collector';
export const STAR_DURATION_MS = 45000;
export const STAR_GOAL = 128;
export const STAR_STEP_MS = 1000 / 120;
export const STAR_RADIUS = 10;

export function starCourse(seed) {
  const choose = seededIndex(seed);
  const shelves = Array.from({ length: STAR_GOAL / 2 }, (_, i) => {
    const left = i % 2 === 0, width = 174 + choose(20);
    return { x: left ? 10 : 290 - width, y: 135 + i * 125, width, height: 9, left };
  });
  const stars = shelves.flatMap((wall, i) => [0, 1].map(n => ({
    x: wall.left ? 55 + n * 88 : 245 - n * 88, y: wall.y - 22, id: i * 2 + n,
  })));
  return { shelves, stars, bottom: shelves.at(-1).y + 150 };
}

export class StarRun {
  constructor(round, start) {
    this.id = round.id; this.start = start; this.end = start + round.duration;
    this.goal = STAR_GOAL; this.course = starCourse(round.seed);
    this.x = 70; this.y = 60; this.vx = 0; this.vy = 0; this.tilt = 0;
    this.pressedMask = 0; this.collected = Array(STAR_GOAL).fill(0);
    this.cleared = 0; this.mistakes = 0; this.step = 0; this.proof = [];
    this.done = false; this.elapsed = null; this.feedback = null; this.events = []; this.lastBump = -Infinity;
  }

  tap(color, time) { return this.input(color, time, true); }
  release(color, time) { return this.input(color, time, false); }

  input(color, time, pressed) {
    if (this.done || ![0, 2].includes(color) || !Number.isFinite(time) || time < this.start || time >= this.end) return { type: 'ignored' };
    this.advance(time);
    const mask = pressed ? this.pressedMask | (1 << color) : this.pressedMask & ~(1 << color);
    if (mask === this.pressedMask || this.proof.length >= 2048) return { type: 'ignored' };
    this.pressedMask = mask;
    const edge = [this.step, mask];
    if (this.proof.at(-1)?.[0] === this.step) this.proof[this.proof.length - 1] = edge;
    else this.proof.push(edge);
    return { type: 'move' };
  }

  advance(time) {
    if (this.done || !Number.isFinite(time) || time < this.start) return;
    const target = Math.floor((Math.min(time, this.end) - this.start) / STAR_STEP_MS + 1e-7);
    // Fixed steps preserve the same collision and pickup results across display refresh rates.
    while (this.step < target) this.integrate(++this.step);
    if (time >= this.end) { this.done = true; this.elapsed = this.end - this.start; this.pressedMask = 0; }
  }

  integrate(step) {
    const dt = STAR_STEP_MS / 1000, at = this.start + step * STAR_STEP_MS;
    const direction = Number(Boolean(this.pressedMask & 4)) - Number(Boolean(this.pressedMask & 1));
    this.tilt += Math.max(-1.6 * dt, Math.min(1.6 * dt, direction * .43 - this.tilt));
    this.vx = Math.max(-190, Math.min(190, (this.vx + Math.sin(this.tilt) * 650 * dt) * Math.exp(-.65 * dt)));
    this.vy = Math.min(190, this.vy + Math.cos(this.tilt) * 330 * dt);
    const walls = this.course.shelves.filter(wall => Math.abs(wall.y - this.y) < 35);
    let impact = 0;
    this.x += this.vx * dt;
    if (this.x < 20 || this.x > 280) { impact = Math.abs(this.vx); this.x = Math.max(20, Math.min(280, this.x)); this.vx *= -.25; }
    for (const wall of walls) if (this.y + STAR_RADIUS > wall.y && this.y - STAR_RADIUS < wall.y + wall.height && this.x + STAR_RADIUS > wall.x && this.x - STAR_RADIUS < wall.x + wall.width) {
      impact = Math.max(impact, Math.abs(this.vx)); this.x = this.vx > 0 ? wall.x - STAR_RADIUS : wall.x + wall.width + STAR_RADIUS; this.vx *= -.25;
    }
    const previousY = this.y;
    this.y += this.vy * dt;
    for (const wall of walls) if (this.x + STAR_RADIUS > wall.x && this.x - STAR_RADIUS < wall.x + wall.width && previousY + STAR_RADIUS <= wall.y + .01 && this.y + STAR_RADIUS >= wall.y) {
      impact = Math.max(impact, Math.abs(this.vy)); this.y = wall.y - STAR_RADIUS; this.vy = 0;
    }
    if (this.y > this.course.bottom) { impact = Math.max(impact, this.vy); this.y = this.course.bottom; this.vy = 0; }
    if (impact > 35 && at - this.lastBump >= 180) {
      this.lastBump = at; this.mistakes++; this.feedback = { kind: 'crash', at }; this.events.push({ type: 'carBump', at });
    }
    for (const star of this.course.stars) if (!this.collected[star.id] && Math.hypot(this.x - star.x, this.y - star.y) <= 24) {
      this.collected[star.id] = 1; this.cleared++; this.feedback = { kind: 'catch', at }; this.events.push({ type: 'stageComplete', at });
    }
  }
}

export function validStarResult(round, message) {
  if (!Array.isArray(message.proof) || message.proof.length > 2048) return false;
  const run = new StarRun(round, 0);
  let previous = -1;
  for (const edge of message.proof) {
    if (!Array.isArray(edge) || edge.length !== 2 || !Number.isInteger(edge[0]) || edge[0] <= previous || edge[0] < 0 || edge[0] >= Math.ceil(round.duration / STAR_STEP_MS) || ![0, 1, 4, 5].includes(edge[1])) return false;
    previous = edge[0]; run.advance(edge[0] * STAR_STEP_MS); run.pressedMask = edge[1]; run.events.length = 0;
  }
  run.advance(round.duration);
  return message.elapsed === round.duration && message.cleared === run.cleared && message.mistakes === run.mistakes;
}
