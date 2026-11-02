import { starCourse } from '../shared/stars.js';

const node = className => { const element = document.createElement('span'); element.className = className; return element; };
export function starPortrait(kind = 'car') {
  const element = node(`star-sprite star-${kind}`);
  element.setAttribute('role', 'img'); element.setAttribute('aria-label', kind === 'star' ? 'Golden star' : 'Red rally car');
  return element;
}

export class StarStage {
  constructor() {
    this.element = document.createElement('div'); this.element.className = 'stars-stage';
    this.board = node('stars-board'); this.world = node('stars-world'); this.car = starPortrait();
    this.glow = starPortrait('sparkle'); this.glow.hidden = true;
    this.board.append(this.world, this.car, this.glow); this.element.append(this.board);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  render(round, run, time, elapsed, active, occupied) {
    if (!this.course || this.roundId !== round.id || this.seed !== round.seed) {
      this.roundId = round.id; this.seed = round.seed; this.position = null; this.course = starCourse(round.seed ?? 0);
      this.walls = this.course.shelves.map(wall => {
        const element = node('stars-wall'); element.style.left = `${wall.x / 3}%`; element.style.width = `${wall.width / 3}%`;
        this.world.append(element); return element;
      });
      this.stars = this.course.stars.map(star => {
        const element = starPortrait('star'); element.style.left = `${star.x / 3}%`; this.world.append(element); return element;
      });
      this.world.replaceChildren(...this.walls, ...this.stars);
    }
    const target = { x: run?.x ?? 70, y: run?.y ?? 60, tilt: run?.tilt ?? 0 };
    const blend = run?.remote && !this.motion?.matches ? 1 - Math.exp(-Math.max(0, time - (this.paintedAt ?? time)) / 65) : 1;
    if (!this.position || Math.abs(target.y - this.position.y) > 300) this.position = { ...target };
    for (const key of ['x', 'y', 'tilt']) this.position[key] += (target[key] - this.position[key]) * blend;
    this.paintedAt = time;
    const { x, y, tilt } = this.position, camera = Math.max(0, y - 150);
    this.board.style.transform = `translate(-50%,-50%) rotate(${tilt * 180 / Math.PI}deg)`;
    this.walls.forEach((element, i) => {
      const top = this.course.shelves[i].y - camera;
      element.hidden = top < -20 || top > 540; element.style.top = `${top / 5.2}%`;
    });
    this.stars.forEach((element, i) => {
      const top = this.course.stars[i].y - camera;
      element.hidden = Boolean(run?.collected[i]) || top < -25 || top > 545;
      element.style.top = `${top / 5.2}%`;
    });
    this.car.hidden = !occupied;
    this.car.style.left = `${x / 3}%`; this.car.style.top = `${(y - camera) / 5.2}%`;
    this.car.style.transform = `translate(-50%,-50%) scaleX(${(run?.vx ?? 0) < -2 ? -1 : 1})`;
    const age = time - (run?.feedback?.at ?? -Infinity);
    const pickup = run?.feedback?.kind === 'catch' && age >= 0 && age < 280;
    const bump = run?.feedback?.kind === 'crash' && age >= 0 && age < 180;
    this.car.classList.toggle('stars-bump', Boolean(bump));
    this.glow.hidden = !pickup || this.motion?.matches;
    this.glow.style.left = `${x / 3}%`; this.glow.style.top = `${(y - camera) / 5.2}%`;
    this.glow.style.opacity = `${Math.max(0, 1 - age / 280)}`;
    this.glow.style.scale = `${1 + Math.max(0, age) / 160}`;
    this.element.setAttribute('aria-label', pickup ? 'Star collected' : bump ? 'Car bumped a wall' : 'Tilt the maze to roll the car into stars');
  }
}
