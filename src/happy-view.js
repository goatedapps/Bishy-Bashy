import { happyChart, HAPPY_TRAVEL_MS, HAPPY_TONES } from '../shared/happy.js';
const node = (tag, className, text) => {
  const element = document.createElement(tag); element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function happyPortrait() {
  const portrait = node('span', 'happy-bird');
  portrait.setAttribute('role', 'img');
  portrait.setAttribute('aria-label', 'Blue songbird wearing lavender headphones');
  return portrait;
}

export class HappyStage {
  constructor() {
    this.element = node('div', 'happy-stage');
    this.element.hidden = true;
    this.element.setAttribute('role', 'group');
    this.tracks = node('div', 'happy-tracks');
    this.columns = [0, 1, 2].map(color => {
      const column = node('span', `happy-column happy-color-${color}`);
      column.append(node('span', 'happy-receptor', ['●', '▲', '◆'][color]));
      this.tracks.append(column); return column;
    });
    this.line = node('span', 'happy-hit-line');
    this.score = node('strong', 'happy-score', '0');
    this.judgment = node('strong', 'happy-judgment');
    this.judgment.setAttribute('aria-live', 'off');
    this.element.append(this.tracks, this.line, this.score, this.judgment);
    this.notes = [];
  }

  render(round, run, time, elapsed, active, present, cleared, terminal = false) {
    const chart = run?.notes || happyChart(round.seed);
    const key = `${round.id}/${round.seed}/${chart.length}`;
    if (this.key !== key) {
      this.key = key;
      this.notes.forEach(note => note.remove());
      this.notes = chart.map(note => {
        const bar = node('span', `happy-note happy-color-${note.color}${note.duration ? ' happy-long-note' : ''}`);
        bar.style.setProperty('--note-column', String(note.color));
        bar.setAttribute('aria-hidden', 'true');
        this.element.append(bar); return bar;
      });
    }
    this.element.classList.toggle('unoccupied', !present);
    const localElapsed = run ? time - run.start : elapsed;
    // Linear travel follows the song clock even when a frame or peer snapshot arrives late.
    const position = localElapsed - (run?.offset || 0);
    this.notes.forEach((bar, index) => {
      const note = chart[index], state = run?.judgments[index] || 0;
      const remaining = note.at - position;
      const tailAge = position - note.at - note.duration;
      const glow = state === 1 || (state === 2 || state === 3) && tailAge >= -140 && tailAge < 200;
      const head = state === 1 || glow ? 0 : remaining / HAPPY_TRAVEL_MS;
      const length = state === 1 ? Math.max(0, note.at + note.duration - position) : state >= 2 ? 0 : note.duration;
      bar.hidden = !active || !present || terminal || head > 1.1 || head < -.25 || state >= 2 && !glow;
      if (bar.hidden) return;
      bar.style.setProperty('--note-head', String(head));
      bar.style.setProperty('--note-length', String(length / HAPPY_TRAVEL_MS));
      bar.classList.toggle('happy-note-lit', glow);
    });
    this.columns.forEach((column, color) => column.classList.toggle('happy-held', Boolean(run?.pressedMask & (1 << color))));
    const score = String(run?.score || 0);
    if (this.score.textContent !== score) this.score.textContent = score;
    const feedback = run?.feedback;
    const age = feedback ? time - feedback.at : Infinity;
    this.judgment.hidden = age < 0 || age >= 350 || !active;
    this.judgment.textContent = feedback?.kind === 'Miss' ? 'Missed' : feedback?.kind || '';
    this.judgment.className = `happy-judgment${feedback?.kind === 'Miss' ? ' happy-missed' : ''}`;
    this.element.setAttribute('aria-label', !present ? 'Open spot' : `Falling notes: red ${HAPPY_TONES[0]}, green ${HAPPY_TONES[1]}, blue ${HAPPY_TONES[2]}. Press at the line; hold long bars until their tails reach it. Score ${run?.score || 0}`);
  }
}
