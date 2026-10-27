import { FACE_NAMES, slotLayout, reelFace } from '../shared/slots.js';

export function facePortrait(face = 0) {
  const element = document.createElement('span');
  element.className = 'face-portrait';
  setFace(element, face);
  return element;
}

function setFace(element, face) {
  if (element.dataset.face === String(face)) return;
  element.dataset.face = String(face);
  element.style.backgroundPosition = `${face % 3 * 50}% ${Math.floor(face / 3) * 100}%`;
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', FACE_NAMES[face]);
}

export class SlotStage {
  constructor() {
    this.cabinet = document.createElement('div');
    this.cabinet.className = 'slot-cabinet';
    this.cabinet.hidden = true;
    this.reels = Array.from({ length: 3 }, (_, index) => {
      const window = document.createElement('div');
      window.className = `slot-window reel-${['red', 'green', 'blue'][index]}`;
      const badge = document.createElement('span');
      badge.className = 'reel-badge';
      const viewport = document.createElement('div');
      viewport.className = 'reel-viewport';
      const strip = document.createElement('div');
      strip.className = 'reel-strip';
      strip.setAttribute('aria-hidden', 'true');
      const faces = Array.from({ length: 5 }, () => facePortrait(index));
      strip.append(...faces);
      viewport.append(strip);
      window.append(viewport, badge);
      this.cabinet.append(window);
      return { window, strip, faces, badge, key: '' };
    });
  }

  render(round, mask, elapsed, run, active, present) {
    if (this.seed !== round.seed) { this.seed = round.seed; this.layout = slotLayout(round.seed); }
    this.reels.forEach((reel, index) => {
      const { window, strip, faces, badge } = reel;
      const locked = active && Boolean(mask & (1 << index));
      const current = active && present && !locked;
      const time = elapsed + (run?.start || 0);
      const miss = current && run && time < run.blockedReels[index];
      const localElapsed = run ? run.reelElapsed(index, time) : elapsed;
      const position = current && !miss ? Math.max(0, localElapsed) / round.stepMs : 0;
      const step = Math.floor(position);
      const portrait = locked ? this.layout.target : miss ? run.missedFaces[index] : current ? reelFace(this.layout, index, localElapsed, round.stepMs) : index;
      const cellKey = `${locked}/${Boolean(miss)}/${current}/${step}`;
      if (reel.key !== cellKey) {
        reel.key = cellKey;
        faces.forEach((face, offset) => setFace(face, current && !miss ? this.layout.reels[index][((step + offset - 2) % FACE_NAMES.length + FACE_NAMES.length) % FACE_NAMES.length] : portrait));
      }
      strip.style.setProperty('--reel-shift', String(current && !miss ? position - step : 0));
      const key = `${portrait}/${locked}/${current}/${Boolean(miss)}`;
      if (window.dataset.frame === key) return;
      window.dataset.frame = key;
      window.classList.toggle('locked', locked);
      window.classList.toggle('current', current);
      window.classList.toggle('miss', Boolean(miss));
      badge.textContent = locked ? '✓' : miss ? '×' : ['●', '▲', '◆'][index];
      window.dataset.face = portrait;
      window.setAttribute('aria-label', `${['Red', 'Green', 'Blue'][index]} reel: ${FACE_NAMES[portrait]}${locked ? ', matched' : miss ? ', retrying' : current ? ', spinning' : ''}`);
    });
  }
}

export function renderTarget(round) {
  const target = slotLayout(round.seed).target;
  const element = document.getElementById('slot-target-face');
  setFace(element, target);
  document.getElementById('slot-target-name').textContent = FACE_NAMES[target];
}
