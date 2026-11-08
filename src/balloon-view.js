import { BALLOON_GOAL, BALLOON_POP_MS } from '../shared/balloon.js';

function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

export function balloonPortrait() {
  return node('span', 'balloon-sprite balloon-body');
}

export class BalloonStage {
  constructor() {
    this.element = node('div', 'balloon-stage');
    this.element.setAttribute('role', 'img');
    this.balloon = balloonPortrait();
    this.pump = node('span', 'balloon-sprite balloon-pump');
    this.pop = node('strong', 'balloon-pop', 'POP!');
    this.rays = node('div', 'balloon-rays');
    for (let index = 0; index < 8; index++) {
      const ray = node('i', 'balloon-ray');
      ray.style.setProperty('--angle', `${index * 45}deg`);
      this.rays.append(ray);
    }
    this.element.append(this.pump, this.balloon, this.rays, this.pop);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  render(round, run, time, elapsed, active, occupied, cleared, terminal) {
    this.balloon.hidden = this.pump.hidden = !occupied;
    const progress = occupied && active ? Math.min(1, cleared / (round.goal || BALLOON_GOAL)) : 0;
    const popped = Boolean(terminal && progress === 1);
    this.balloon.hidden ||= popped;
    this.pop.hidden = !popped;
    const age = Math.max(0, time - (run?.feedback?.at ?? -Infinity));
    const motion = !this.motion?.matches && !document.hidden;
    const stroke = active && !terminal && motion ? Math.max(0, 1 - age / 150) : 0;
    const size = .23 + .77 * progress ** .8;
    const pulse = .09 * stroke;
    const tautness = Math.max(0, (progress - .72) / .28);
    this.balloon.style.scale = `${size * (1 + pulse)} ${size * (1 - pulse / 2)}`;
    this.balloon.style.rotate = `${stroke ? Math.sin(age / 25) * 4 * stroke * tautness : 0}deg`;
    this.pump.style.scale = `1 ${1 - .18 * stroke}`;
    const bursting = popped && motion && age < BALLOON_POP_MS;
    this.rays.hidden = !bursting;
    if (bursting) {
      const t = age / BALLOON_POP_MS;
      this.rays.style.setProperty('--burst-travel', `${4 + 40 * (1 - (1 - t) ** 3)}cqw`);
      this.rays.style.opacity = String(1 - t);
    }
    const label = !occupied ? 'Open spot' : popped ? 'Balloon popped' : progress >= .72 ? 'Balloon nearly full' : cleared > 0 ? 'Balloon inflating' : 'Deflated balloon';
    if (label !== this.label) { this.label = label; this.element.setAttribute('aria-label', label); }
  }
}
