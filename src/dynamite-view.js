import { gsap } from 'gsap';
const ns = 'http://www.w3.org/2000/svg';
const svgNode = (tag, attributes = {}) => { const n = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attributes)) n.setAttribute(key, value); return n; };
export function dynamitePortrait() {
  const n = document.createElement('span'); n.className = 'dynamite-bundle'; n.setAttribute('role', 'img'); n.setAttribute('aria-label', 'Bundle of dynamite'); return n;
}
export class DynamiteStage {
  constructor() {
    this.element = document.createElement('div'); this.element.className = 'dynamite-stage';
    this.svg = svgNode('svg', { viewBox: '0 0 180 420', preserveAspectRatio: 'none', role: 'img' });
    this.parts = Array.from({length: 52}, () => { const n = svgNode('path', { fill: 'none', 'stroke-width': 13, 'stroke-linecap': 'butt' }); this.svg.append(n); return n; });
    this.spark = svgNode('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 38, stroke: '#fff2a7', 'stroke-width': 1 }); this.spark.textContent = '✷'; this.svg.append(this.spark);
    this.bundle = dynamitePortrait(); this.blast = document.createElement('span'); this.blast.className = 'dynamite-blast'; this.blast.textContent = '✹';
    this.element.append(this.svg, this.bundle, this.blast);
    this.position = { progress: 0 };
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }
  render(round, run, time, elapsed, active, occupied, cleared, terminal) {
    const started = active && run && time >= run.start;
    const count = run?.sequence?.length || 52;
    const progress = started ? cleared : 0;
    const finish = terminal && run?.done && cleared === count;
    this.element.classList.toggle('dynamite-cleared', Boolean(finish));
    this.element.classList.toggle('dynamite-idle', !started || terminal);
    if (this.roundId !== round.id || !started || terminal || document.hidden || this.motion?.matches) {
      this.tween?.kill(); this.tween = null; this.position.progress = progress;
      this.roundId = round.id; this.targetProgress = progress;
    } else if (this.targetProgress !== progress) {
      this.tween?.kill(); this.targetProgress = progress; this.motionAt = time;
      this.tween = gsap.to(this.position, { progress, duration: .18, ease: 'power2.out', paused: true });
    }
    this.tween?.progress(Math.min(1, Math.max(0, (time - this.motionAt) / 180)));
    const visual = this.position.progress;
    const camera = Math.min(Math.max(0, (visual - 8) * 13), 416);
    const point = i => [90 + Math.sin(i / 7 * Math.PI) * 48, 40 + i * 13 - camera];
    this.parts.forEach((part, i) => {
      const a = point(i), b = point(i + 1);
      part.style.opacity = i < progress ? '.12' : '1';
      part.setAttribute('d', `M ${a.map((v,k)=>v+(b[k]-v)*.04)} L ${b.map((v,k)=>v+(a[k]-v)*.04)}`);
      part.setAttribute('stroke', ['#fa5366','#5cdb8d','#51bff5'][run?.sequence[i] ?? i % 3]);
    });
    const color = run?.sequence[progress] ?? 0;
    const sparkPoint = point(visual);
    this.spark.setAttribute('x', sparkPoint[0]); this.spark.setAttribute('y', sparkPoint[1]); this.spark.setAttribute('fill', ['#ff5365','#62ef92','#65d8ff'][color]);
    this.spark.style.display = occupied && !terminal ? '' : 'none';
    this.bundle.hidden = !occupied || finish;
    this.bundle.style.top = `${point(count)[1] / 420 * 100}%`;
    this.blast.hidden = !finish;
    this.svg.setAttribute('aria-label', finish ? 'Dynamite exploded' : `Wire: ${progress} of 52 sections cleared. ${['Red circle','Green triangle','Blue diamond'][color]} next`);
  }
}
