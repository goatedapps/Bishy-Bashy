import { GAMES } from '../shared/games.js';
import { arcadeGameIds } from '../shared/sets.js';
import { seededIndex } from '../shared/seeded-index.js';
import { gameArt } from './game-art.js';

export function reelStrip(seed, winner, ids = arcadeGameIds()) {
  const choose = seededIndex(seed);
  const distance = 48 + choose(13);
  const strip = [];
  for (let index = 0; index < distance + 5; index++) {
    const pool = ids.filter(id => id !== strip[index - 1] && (index !== distance - 1 && index !== distance + 1 || id !== winner));
    strip.push(pool.length ? pool[choose(pool.length)] : winner);
  }
  strip[distance] = winner;
  return { strip, distance };
}

export function reelPosition(progress, distance) {
  const elapsed = Math.max(0, progress) * 4700;
  if (elapsed <= 0) return 0;
  if (elapsed >= 4700) return distance;
  if (elapsed < 180) return -.1 * Math.sin(Math.PI * elapsed / 180);
  if (elapsed >= 4280) {
    const t = (elapsed - 4280) / 420;
    return distance + .065 * Math.exp(-6 * t) * Math.cos(10 * t);
  }
  const t = (elapsed - 180) / 4100, a = .14, b = .44, area = a / 2 + b - a + (1 - b) / 3;
  const travel = t < a ? t * t / (2 * a * area) : t < b ? (a / 2 + t - a) / area : (a / 2 + b - a + (1 - b) * (1 - (1 - (t - b) / (1 - b)) ** 3) / 3) / area;
  return (distance + .065) * travel;
}

export class ArcadeReel {
  constructor() {
    this.ids = arcadeGameIds();
    this.machine = document.getElementById('arcade-wheel');
    this.track = document.getElementById('reel-track');
    this.cards = Array.from({ length: 7 }, () => {
      const row = document.createElement('div');
      row.className = 'reel-row';
      this.track.append(row);
      return row;
    });
  }

  render(room, serverNow) {
    const selecting = room.set?.phase === 'selecting';
    this.machine.hidden = !selecting;
    if (!selecting) return;
    if (this.key !== room.round.id) {
      this.key = room.round.id;
      Object.assign(this, reelStrip(room.round.seed, room.round.game, this.ids));
      document.getElementById('reel-announcement').textContent = 'Choosing a game';
    }
    const progress = (serverNow - room.set.spinStartAt) / (room.set.spinEndAt - room.set.spinStartAt);
    const landed = progress >= 1;
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const position = reduced ? landed ? this.distance : 0 : reelPosition(progress, this.distance);
    const base = Math.floor(position), fraction = position - base;
    const height = this.track.parentElement.clientHeight;
    const rowHeight = this.cards[0].offsetHeight;
    this.track.style.transform = `translateY(${height / 2 - rowHeight / 2 - 3 * rowHeight - fraction * rowHeight}px)`;
    this.cards.forEach((card, index) => {
      const offset = index - 3, distance = offset - fraction;
      const rowIndex = base + offset;
      const id = this.strip[rowIndex] || this.ids[((rowIndex % this.ids.length) + this.ids.length) % this.ids.length];
      if (card.dataset.game !== id) {
        card.dataset.game = id;
        const title = document.createElement('strong');
        title.textContent = GAMES[id].title;
        card.replaceChildren(gameArt(id), title);
      }
      card.style.transform = `scale(${Math.max(.78, 1 - Math.abs(distance) * .12)}) rotateX(${Math.max(-55, Math.min(55, distance * 18))}deg)`;
      card.style.opacity = Math.max(.2, 1 - Math.abs(distance) * .28);
    });
    this.machine.classList.toggle('reel-running', !landed);
    this.machine.classList.toggle('reel-won', landed);
    if (landed) document.getElementById('reel-announcement').textContent = `Selected: ${GAMES[room.round.game].title}`;
  }
}
