const SHAPES = ['●', '▲', '◆'];
const NAMES = ['Red circle', 'Green triangle', 'Blue diamond'];
const COLORS = ['#ed526b', '#209668', '#398ce4'];
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function monkeyPortrait() {
  const image = node('span', 'monkey-portrait');
  image.setAttribute('role', 'img');
  image.setAttribute('aria-label', 'Mimicking monkey');
  return image;
}

export class MonkeyStage {
  constructor() {
    this.element = node('div', 'monkey-stage');
    this.element.hidden = true;
    this.heading = node('div', 'monkey-phase');
    this.scene = node('div', 'monkey-scene');
    this.portrait = monkeyPortrait();
    this.cue = node('span', 'monkey-cue');
    this.scene.append(this.portrait, this.cue);
    this.track = node('div', 'monkey-track');
    this.element.append(this.heading, this.scene, this.track);
    this.element.setAttribute('role', 'group');
    this.dots = [];
  }

  render(round, run, time, active, present, cleared, terminal = false) {
    const phase = active && run && !terminal ? run.phase(time) : { mode: terminal ? 'done' : 'waiting', color: null, position: -1 };
    const length = run?.length ?? Math.min((round.goal || 5) + 1, cleared + 2);
    const feedback = run?.feedback;
    const hit = feedback?.kind === 'hit' && time >= feedback.at && time - feedback.at < 180;
    const color = phase.color ?? (hit && phase.mode === 'play' ? feedback.color : null);
    const heading = !present ? '' : terminal ? cleared === round.goal ? 'Well done!' : 'Round over' : phase.mode === 'watch' ? 'Watch' : phase.mode === 'play' ? 'Your turn' : phase.mode === 'retry' ? 'Try again' : '';
    if (this.heading.textContent !== heading) this.heading.textContent = heading;
    this.element.dataset.mode = phase.mode;
    this.element.classList.toggle('showing-cue', color !== null);
    this.portrait.hidden = !present;
    this.cue.hidden = !present || color === null && phase.mode !== 'play' && phase.mode !== 'retry';
    this.cue.textContent = color !== null ? SHAPES[color] : phase.mode === 'retry' ? '×' : '?';
    this.element.style.setProperty('--monkey-cue-color', color === null ? '#7a5c35' : COLORS[color]);
    this.element.style.setProperty('--monkey-lean', color === 0 ? '-8deg' : color === 2 ? '8deg' : '0deg');
    if (length !== this.dots.length) {
      this.dots = Array.from({ length }, () => node('span', 'monkey-dot'));
      this.track.replaceChildren(...this.dots);
    }
    this.track.hidden = !present || !run || !active;
    this.dots.forEach((dot, index) => {
      dot.classList.toggle('current', phase.mode === 'watch' && phase.position === index);
      dot.classList.toggle('copied', phase.mode === 'play' && index < run.entered || terminal && cleared === round.goal);
    });
    const label = !present ? 'Open spot' : color !== null && phase.mode === 'watch' ? `Watch, move ${phase.position + 1} of ${length}: ${NAMES[color]}` : phase.mode === 'play' ? `Your turn, ${run.entered} of ${length} moves copied` : heading || `Monkey, ${cleared} stages completed`;
    if (this.element.getAttribute('aria-label') !== label) this.element.setAttribute('aria-label', label);
    this.track.setAttribute('aria-hidden', 'true');
  }
}
