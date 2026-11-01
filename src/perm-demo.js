import { PermRun, PERM_BPM, demoCues } from '../shared/perm.js';
import { createDemoLayout, demoNode as node } from './instruction-demo.js';

const INTRO_MS = 900;
const HOLD_MS = 1500;

export function permDemoPlan(round = {}) {
  const bpm = round.bpm || PERM_BPM;
  const settings = { id: 'perm-demo', seed: round.seed || 0, bpm, duration: 8 * 60_000 / bpm };
  const run = new PermRun(settings, INTRO_MS);
  const notes = run.notes.filter(note => note.phrase === 0);
  const cues = [
    ...demoCues(settings.seed, bpm).slice(0, notes.length).map(at => ({ type: 'watch', at: INTRO_MS + at })),
    ...notes.map(note => ({ type: 'press', at: INTRO_MS + note.at, color: 1 })),
    { type: 'complete', at: run.end },
  ];
  return { settings, cues, duration: run.end + HOLD_MS };
}

export class PermDemo {
  constructor({ round, onPress = () => {}, onWatch = () => {}, onComplete = () => {} } = {}) {
    Object.assign(this, createDemoLayout(
      'Perm Mania demonstration: watch one rhythm, then a finger copies every beat with the green button. Any button works. A correct set grows the dancer’s hair. The demonstration repeats.',
      ['Watch and listen to the rhythm.', 'Copy the rhythm with any button to grow your hair.'],
    ));
    this.element.classList.add('perm-demo');
    this.callbacks = { press: onPress, watch: onWatch, complete: onComplete };
    this.plan = permDemoPlan(round);
    this.heading = node('strong', 'perm-demo-heading', 'Watch');
    const track = node('div', 'rhythm-track');
    this.dots = Array.from({ length: 8 }, () => node('span', 'beat-dot'));
    track.append(...this.dots);
    this.guide = node('div', 'rhythm-guide');
    this.guide.append(this.heading, track);
    this.character = node('div', 'perm-character');
    this.character.append(node('div', 'perm-hair'), node('div', 'perm-dancer dancer-1'));
    this.feedback = node('strong', 'perm-demo-feedback');
    this.scene.append(this.guide, this.character, this.feedback);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.elapsed = 0;
    this.previousTime = null;
    this.cycle = -1;
    this.resetRun(0);
    this.paint(0);
  }

  resetRun(cycle) {
    this.cycle = cycle;
    this.run = new PermRun(this.plan.settings, INTRO_MS);
  }

  advance(time, visible) {
    if (!visible) { this.previousTime = null; return; }
    const previousElapsed = this.elapsed;
    if (this.previousTime !== null) this.elapsed += Math.max(0, time - this.previousTime);
    this.previousTime = time;
    const cycle = Math.floor(this.elapsed / this.plan.duration);
    if (cycle !== this.cycle) this.resetRun(cycle);
    const within = this.elapsed - cycle * this.plan.duration;
    for (const cue of this.plan.cues) {
      if (cue.type === 'press' && cue.at <= within) {
        const note = this.run.notes.find(note => note.phrase === 0 && INTRO_MS + note.at === cue.at);
        if (!note.hit) this.run.tap(cue.color, cue.at);
      }
    }
    this.run.advance(within);
    this.paint(within);
    for (const cue of this.plan.cues) {
      const at = cycle * this.plan.duration + cue.at;
      if (previousElapsed < at && at <= this.elapsed && this.elapsed - at < 100) this.callbacks[cue.type](cue.color);
    }
  }

  paint(time) {
    const phase = this.run.phase(time);
    const complete = this.run.done;
    const playing = phase.mode === 'play';
    this.heading.textContent = time < INTRO_MS ? 'Get ready' : complete ? 'Great rhythm!' : playing ? 'Your turn!' : 'Watch';
    this.guide.classList.toggle('your-turn', playing || complete);
    this.dots.forEach((dot, step) => {
      const note = this.run.notes.find(note => note.phrase === 0 && note.step === step);
      dot.className = `beat-dot${phase.steps.includes(step) ? ' is-note' : ''}${!complete && time >= INTRO_MS && phase.position === step ? ' is-current' : ''}${playing && note?.hit ? ' is-hit' : ''}`;
      dot.textContent = phase.steps.includes(step) ? '●' : '·';
    });
    this.character.style.setProperty('--hair-size', `${45 + this.run.cleared * 11}%`);
    const pulse = time >= INTRO_MS && !complete && !this.motion?.matches ? Math.max(0, 1 - ((time - INTRO_MS) % this.run.beatMs) / this.run.beatMs * 4) : 0;
    this.character.style.transform = `translateY(${-3 * pulse}px) rotate(${-2 * pulse}deg)`;
    const success = complete && time - this.run.end < 650;
    this.feedback.textContent = success ? '○' : !complete && this.run.feedback && time - this.run.feedback.at < 230 ? 'Perfect!' : '';
    this.feedback.classList.toggle('perm-demo-success', success);
    const presses = this.plan.cues.filter(cue => cue.type === 'press');
    const current = [...presses].reverse().find(cue => time >= cue.at - 200) || presses[0];
    const age = time - current.at;
    this.buttons.forEach((button, index) => button.classList.toggle('pressed', index === current.color && age >= 0 && age < 150));
    this.hand.style.left = `calc(${(current.color + .5) * 100 / 3}% - 36px)`;
    this.hand.style.opacity = !complete && time >= presses[0].at - 200 ? '1' : '0';
    const handY = age < 0 ? 14 * Math.min(1, -age / 200) ** 3 : age < 150 ? 4 : 14;
    this.hand.style.transform = `translateY(${this.motion?.matches ? 0 : handY}px)`;
    this.lines.forEach((line, index) => line.classList.toggle('demo-active', index === Number(playing || complete)));
  }
}
