const ns = 'http://www.w3.org/2000/svg';
const svgNode = (tag, attributes = {}) => { const n = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attributes)) n.setAttribute(key, value); return n; };
export function dynamitePortrait() {
  const n = document.createElement('span'); n.className = 'dynamite-bundle'; n.setAttribute('aria-label', 'Bundle of dynamite');
  for (let i = 0; i < 3; i++) { const stick = document.createElement('i'); n.append(stick); }
  return n;
}
export class DynamiteStage {
  constructor() {
    this.element = document.createElement('div'); this.element.className = 'dynamite-stage';
    this.svg = svgNode('svg', { viewBox: '0 0 180 420', preserveAspectRatio: 'none', role: 'img' });
    this.parts = Array.from({length: 24}, () => { const n = svgNode('path', { fill: 'none', 'stroke-width': 13, 'stroke-linecap': 'butt' }); this.svg.append(n); return n; });
    this.spark = svgNode('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 38, stroke: '#fff2a7', 'stroke-width': 1 }); this.spark.textContent = '✷'; this.svg.append(this.spark);
    this.bundle = dynamitePortrait(); this.blast = document.createElement('span'); this.blast.className = 'dynamite-blast'; this.blast.textContent = '✹';
    this.element.append(this.svg, this.bundle, this.blast);
  }
  render(round, run, time, elapsed, active, occupied, cleared, terminal) {
    const started = active && run && time >= run.start;
    const count = run?.sequence?.length || 52;
    const progress = started ? cleared : 0;
    const finish = terminal && run?.done && cleared === count;
    this.element.classList.toggle('dynamite-cleared', Boolean(finish));
    this.element.classList.toggle('dynamite-idle', !started || terminal);
    const remaining = count - progress;
    const offset = Math.floor(Math.min(progress, 51) / 16) * 16;
    const visible = Math.min(24, count - offset);
    const final = count - offset <= 24;
    const point = i => [90 + Math.sin(i / 7 * Math.PI) * 48, 40 + i * 13];
    this.parts.forEach((part, i) => {
      part.style.display = i < visible ? '' : 'none';
      if (i >= visible) return;
      const a = point(i), b = point(i + 1);
      part.style.opacity = i < progress - offset ? '.15' : '1';
      part.setAttribute('d', `M ${a.map((v,k)=>v+(b[k]-v)*.04)} L ${b.map((v,k)=>v+(a[k]-v)*.04)}`);
      part.setAttribute('stroke', ['#fa5366','#5cdb8d','#51bff5'][run?.sequence[offset + i] ?? i % 3]);
    });
    const color = run?.sequence[progress] ?? 0;
    const sparkPoint = point(Math.min(progress - offset, visible));
    this.spark.setAttribute('x', sparkPoint[0]); this.spark.setAttribute('y', sparkPoint[1]); this.spark.setAttribute('fill', ['#ff5365','#62ef92','#65d8ff'][color]);
    this.spark.style.display = occupied && !terminal ? '' : 'none';
    this.bundle.hidden = !occupied || !final && started || finish;
    this.bundle.style.top = `${(40 + visible * 13) / 420 * 100}%`;
    this.blast.hidden = !finish;
    this.svg.setAttribute('aria-label', finish ? 'Dynamite exploded' : `Wire: ${progress} of 52 sections cleared. ${['Red circle','Green triangle','Blue diamond'][color]} next`);
  }
}
