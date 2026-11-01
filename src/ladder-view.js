import { gsap } from 'gsap';
import { ladderCourse, ladderPoint, LADDER_MOVE_MS } from '../shared/ladder.js';
const node = className => { const element = document.createElement('span'); element.className = className; return element; };
export function ladderPortrait(kind = 'worker') { const element = node(`ladder-sprite ladder-${kind === 'rung' ? 'part-rung' : kind}`); if (kind === 'rung') element.setAttribute('aria-hidden', 'true'); else { element.setAttribute('role', 'img'); element.setAttribute('aria-label', kind === 'trophy' ? 'Golden trophy' : 'Construction worker'); } return element; }
export class LadderStage {
  constructor() {
    this.element = document.createElement('div'); this.element.className = 'ladder-stage';
    this.world = node('ladder-world'); this.worker = ladderPortrait(); this.trophy = ladderPortrait('trophy');
    this.element.append(this.world, this.trophy, this.worker);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }
  render(round, run, time, elapsed, active, occupied, cleared, terminal) {
    if (!this.course || this.roundId !== round.id || this.seed !== round.seed) {
      this.tween?.kill(); this.tween = null; this.roundId = round.id; this.seed = round.seed;
      this.course = ladderCourse(round.seed ?? 0, round.ladderSets);
      this.rungs = this.course.flatMap((ladder, index) => Array.from({ length: ladder.steps }, (_, step) => {
        const rung = node('ladder-rung'); rung.append(ladderPortrait('rung')); this.world.append(rung);
        return { rung, column: ladder.column, height: ladder.base + step + 1, index };
      }));
      this.platforms = this.course.slice(1).map(ladder => { const element = node('ladder-platform'); return { element, height: ladder.base }; });
      this.world.replaceChildren(...this.rungs.map(item => item.rung), ...this.platforms.map(item => item.element));
      const point = ladderPoint(this.course, 0); this.position = { column: point.column, height: point.height }; this.target = -1;
    }
    const progress = active && occupied ? run?.cleared ?? cleared : 0;
    const point = ladderPoint(this.course, progress);
    if (this.target !== progress) {
      this.tween?.kill(); this.target = progress;
      if (!active || !occupied || this.motion?.matches || !run?.feedback || time - run.feedback.at > 500) Object.assign(this.position, point);
      else { this.moveAt = run.feedback.at; this.tween = gsap.to(this.position, { ...point, duration: LADDER_MOVE_MS / 1000, ease: 'power2.out', paused: true }); }
    }
    this.tween?.progress(Math.max(0, Math.min(1, (time - this.moveAt) / LADDER_MOVE_MS)));
    const camera = Math.max(0, this.position.height - 2), y = height => 78 - (height - camera) * 8;
    const current = this.course.findIndex(item => progress < item.start + item.steps);
    this.rungs.forEach(({ rung, column, height, index }) => {
      rung.hidden = y(height) < -12 || y(height) > 112;
      rung.style.left = `${25 + column * 25}%`; rung.style.top = `${y(height)}%`;
      rung.classList.toggle('ladder-active', index === current); rung.classList.toggle('ladder-past', index < current);
    });
    this.platforms.forEach(({ element, height }) => { element.style.top = `${y(height)}%`; });
    this.worker.hidden = !occupied;
    this.worker.style.left = `${25 + this.position.column * 25}%`; this.worker.style.top = `${y(this.position.height)}%`;
    const collected = Boolean(terminal && run?.done && progress === run.goal);
    this.worker.classList.toggle('ladder-cheer', collected);
    this.worker.classList.toggle('ladder-left-reach', !collected && progress % 2 === 1);
    this.worker.style.scale = !this.motion?.matches && run?.feedback?.kind === 'hit' && time - run.feedback.at < 150 ? '1.04 1.08' : '1';
    const last = this.course.at(-1), finish = terminal && run?.done && progress === run.goal;
    this.trophy.hidden = y(last.base + last.steps + (finish ? 1.8 : 1)) < -25;
    this.trophy.style.left = `${25 + last.column * 25}%`; this.trophy.style.top = `${y(last.base + last.steps + (finish ? 1.8 : 1))}%`;
    this.trophy.classList.toggle('ladder-collected', Boolean(finish));
    this.element.setAttribute('aria-label', finish ? 'Trophy reached!' : `Climb the ${['left', 'middle', 'right'][point.column]} ladder, one press per rung`);
  }
}
