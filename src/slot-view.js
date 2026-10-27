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
      window.className = 'slot-window';
      const badge = document.createElement('span');
      badge.className = 'reel-badge';
      const face = facePortrait(index);
      window.append(face, badge);
      this.cabinet.append(window);
      return { window, face, badge };
    });
  }

  render(round, cleared, elapsed, run, active, present) {
    if (this.seed !== round.seed) { this.seed = round.seed; this.layout = slotLayout(round.seed); }
    this.reels.forEach(({ window, face, badge }, index) => {
      const locked = active && index < cleared;
      const current = active && present && index === cleared;
      const miss = current && run && elapsed + run.start < run.blockedUntil;
      const portrait = locked ? this.layout.target : miss ? run.missedFace : active && present ? reelFace(this.layout, index, elapsed, round.stepMs) : index;
      const key = `${portrait}/${locked}/${current}/${Boolean(miss)}`;
      if (window.dataset.frame === key) return;
      window.dataset.frame = key;
      setFace(face, portrait);
      window.classList.toggle('locked', locked);
      window.classList.toggle('current', current);
      window.classList.toggle('miss', Boolean(miss));
      badge.textContent = locked ? '✓' : miss ? '×' : String(index + 1);
      window.setAttribute('aria-label', `Reel ${index + 1}: ${FACE_NAMES[portrait]}${locked ? ', matched' : current ? ', stop this reel' : ''}`);
    });
  }
}

export function renderTarget(round) {
  const target = slotLayout(round.seed).target;
  const element = document.getElementById('slot-target-face');
  setFace(element, target);
  document.getElementById('slot-target-name').textContent = FACE_NAMES[target];
}
