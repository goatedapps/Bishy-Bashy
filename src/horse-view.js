import { horseTraffic, horseLane, HORSE_TRAFFIC_SPEED } from '../shared/horse.js';

const node = className => { const element = document.createElement('span'); element.className = className; return element; };
export function horsePortrait(kind = 'rider') {
  const element = node(`horse-sprite horse-${kind}`);
  element.setAttribute('role', 'img'); element.setAttribute('aria-label', kind === 'traffic' ? 'Slower horse' : 'Racehorse and jockey');
  return element;
}

export class HorseStage {
  constructor() {
    this.element = document.createElement('div'); this.element.className = 'horse-stage';
    this.road = node('horse-road');
    this.field = node('horse-field');
    this.opponents = Array.from({ length: 14 }, () => horsePortrait('traffic'));
    this.rider = horsePortrait(); this.banner = node('horse-banner'); this.banner.textContent = 'FINISH';
    this.field.append(...this.opponents, this.banner, this.rider); this.element.append(this.road, this.field);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  render(round, run, time, elapsed, active, occupied, cleared, terminal) {
    if (!this.traffic || this.roundId !== round.id || this.seed !== round.seed || this.spacing !== round.spacing) {
      this.roundId = round.id; this.seed = round.seed; this.spacing = round.spacing;
      this.traffic = horseTraffic(round.seed ?? 0, round.spacing ?? 140);
    }
    const shownTime = run?.done && run.elapsed !== null ? run.start + run.elapsed : time;
    const seconds = run ? Math.max(0, shownTime - run.start) / 1000 : 0;
    const projection = run?.remote && !terminal ? Math.max(0, Math.min(.25, (time - run.sampleAt) / 1000)) : 0;
    const distance = Math.min(round.goal ?? 3200, (run?.distance ?? 0) + (run?.speed ?? 0) * (Number.isFinite(projection) ? projection : 0));
    const speed = run?.speed ?? 36;
    const bumpAge = run?.feedback?.kind === 'crash' ? shownTime - run.feedback.at : Infinity;
    const bump = !terminal && bumpAge >= 0 && bumpAge < 650;
    const recoil = bump && !this.motion?.matches ? bumpAge < 90 ? 1 - (1 - bumpAge / 90) ** 3 : (1 - (bumpAge - 90) / 560) ** 2 : 0;
    const sceneDistance = distance - recoil * 18;
    this.road.style.backgroundPosition = `0 ${sceneDistance * 2}px`;
    const visible = this.traffic.flatMap((wave, index) => {
      const gap = wave.distance + HORSE_TRAFFIC_SPEED * seconds - sceneDistance;
      return gap < -40 || gap > 235 ? [] : [0, 1, 2].filter(column => column !== wave.safe).map(column => {
        const collided = run?.feedback?.kind === 'crash' && index === run.index - 1 && column === (run.feedback.color ?? run.position);
        return { gap: collided && bump && !this.motion?.matches ? Math.max(gap, 28 * (1 - Math.exp(-bumpAge / 60))) : gap, column, collided };
      }).filter(horse => !horse.collided || bumpAge < (this.motion?.matches ? 120 : 650));
    }).slice(0, this.opponents.length);
    this.opponents.forEach((element, i) => {
      const horse = visible[i]; element.hidden = !horse || !occupied;
      if (!horse) return;
      const depth = Math.max(0, Math.min(1.2, 1 - horse.gap / 235));
      element.style.left = `${50 + (horse.column - 1) * (10 + depth * 22)}%`;
      element.style.top = `${12 + depth * 68}%`;
      element.style.width = `${15 + depth * 25}%`;
      element.style.zIndex = `${Math.round(depth * 50)}`;
      element.style.opacity = `${(.55 + Math.min(1, depth) * .45) * (horse.collided ? Math.max(0, Math.min(1, (650 - bumpAge) / 300)) : 1)}`;
      element.style.transform = `translate(-50%,-85%) rotate(${this.motion?.matches ? 0 : Math.sin(shownTime / 135 + i) * 2}deg)`;
    });
    const column = run ? horseLane(run, shownTime) : 1;
    this.rider.hidden = !occupied;
    this.rider.style.top = `${80 + recoil * 5}%`;
    this.rider.style.left = `${50 + (column - 1) * 32}%`;
    const bob = this.motion?.matches || terminal ? 0 : Math.sin(seconds * (8 + speed / 10)) * (1 + speed / 40);
    this.rider.style.transform = `translate(-50%,calc(-85% + ${bob}px))`;
    this.rider.classList.toggle('horse-stride', !this.motion?.matches && !terminal && Math.floor(seconds * (4 + speed / 22)) % 2 === 1);
    const pass = run?.feedback?.kind === 'clear' && shownTime - run.feedback.at < 200;
    this.rider.classList.toggle('horse-stumble', Boolean(bump));
    this.rider.classList.toggle('horse-overtake', Boolean(pass));
    const remaining = (round.goal ?? 3200) - distance;
    this.banner.hidden = !occupied || remaining > 235;
    this.banner.style.top = `${12 + (1 - Math.max(0, remaining) / 235) * 68}%`;
    this.element.setAttribute('aria-label', bump ? 'Horse stumbled; speed reduced' : 'Tap green to accelerate and steer through gaps in the horses');
  }
}
