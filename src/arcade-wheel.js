import { GAMES } from '../shared/games.js';
import { arcadeGameIds } from '../shared/sets.js';
import { gameArt } from './game-art.js';

const COLORS = ['#ff7895', '#ffe06d', '#80d8a1', '#85c9ff', '#c5a1f5', '#ffb377', '#80ded3', '#f5a6d8'];
export function wheelRotation(game, progress, ids = arcadeGameIds()) {
  const index = Math.max(0, ids.indexOf(game));
  return (360 * 6 - index * 360 / ids.length) * (1 - (1 - Math.max(0, Math.min(1, progress))) ** 4);
}

export class ArcadeWheel {
  constructor() {
    this.ids = arcadeGameIds();
    this.disc = document.getElementById('wheel-disc');
    const angle = 360 / this.ids.length;
    this.disc.style.background = `conic-gradient(from ${-angle / 2}deg, ${this.ids.map((id, i) => `${COLORS[i % COLORS.length]} ${i * angle}deg ${(i + 1) * angle}deg`).join(',')})`;
    this.ids.forEach((id, index) => {
      const label = document.createElement('span');
      label.className = 'wheel-label';
      label.style.setProperty('--angle', `${index * angle}deg`);
      label.append(gameArt(id));
      const name = document.createElement('small');
      name.textContent = GAMES[id].title;
      label.append(name);
      this.disc.append(label);
    });
  }

  render(room, serverNow) {
    const spinning = room.set?.phase === 'selecting';
    const preview = room.mode === 'arcade' && room.arcadePreview && !room.set;
    document.getElementById('arcade-wheel').hidden = !spinning && !preview;
    if (!spinning && !preview) return;
    const progress = spinning ? (serverNow - room.set.spinStartAt) / (room.set.spinEndAt - room.set.spinStartAt) : 0;
    const rotation = spinning ? wheelRotation(room.round.game, progress) : 0;
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.disc.style.transform = `rotate(${reduced && progress < .85 ? 0 : rotation}deg)`;
    const index = ((Math.round(-rotation / (360 / this.ids.length)) % this.ids.length) + this.ids.length) % this.ids.length;
    const shown = spinning ? this.ids[index] : null;
    const settled = progress >= .85;
    document.getElementById('wheel-heading').textContent = spinning ? settled ? 'Next up!' : 'What will we play?' : 'Let fate choose!';
    document.getElementById('wheel-result').textContent = shown ? GAMES[settled ? room.round.game : shown].title : `${this.ids.length} games. Five surprises.`;
    document.getElementById('wheel-result').setAttribute('aria-live', spinning && settled ? 'polite' : 'off');
    document.getElementById('arcade-wheel').classList.toggle('wheel-settled', Boolean(spinning && settled));
  }
}
