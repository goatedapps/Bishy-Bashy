import { sharkCourse, SHARK_GOAL, SHARK_JUMP_MS, SHARK_FALL_MS, SHARK_RECOVERY_MS } from '../shared/shark.js';

const node = className => { const element = document.createElement('span'); element.className = className; return element; };
const COLORS = ['red', 'green', 'blue'];
export function sharkPortrait(kind = 'puppy') {
  const element = node(`shark-sprite shark-${kind}${['red', 'green', 'blue', 'stone'].includes(kind) ? ' shark-emerging' : ''}`);
  element.setAttribute('role', 'img'); element.setAttribute('aria-label', kind === 'puppy' || kind === 'climb' ? 'Cute puppy' : `${kind} shark`);
  return element;
}

export function sharkPlatform(kind = 'stone') {
  const element = node('shark-platform'), sprite = sharkPortrait(kind), wave = node('shark-wave'), mark = node('shark-mark');
  wave.setAttribute('aria-hidden', 'true');
  element.append(sprite, wave, mark);
  return { element, sprite, wave, mark };
}

export class SharkStage {
  constructor() {
    this.element = document.createElement('div'); this.element.className = 'shark-stage';
    this.sharks = Array.from({ length: 8 }, () => sharkPlatform());
    this.element.append(...this.sharks.map(shark => shark.element));
    this.puppy = sharkPortrait(); this.splash = node('shark-splash'); this.splash.hidden = true;
    this.element.append(this.splash, this.puppy);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  render(round, run, time, elapsed, active, occupied, cleared = 0, terminal = false) {
    const goal = round.goal ?? SHARK_GOAL;
    if (!this.course || this.roundId !== round.id || this.seed !== round.seed || this.goal !== goal) {
      this.roundId = round.id; this.seed = round.seed; this.goal = goal;
      this.course = sharkCourse(round.seed ?? 0, goal);
    }
    const now = run?.done && run.elapsed !== null ? run.start + run.elapsed : time;
    const landed = Math.max(0, Math.min(goal, active && occupied ? run?.cleared ?? cleared : 0));
    const pending = landed < goal && run?.landAt !== null && run?.landAt !== undefined;
    const fraction = pending && !this.motion?.matches ? Math.max(0, Math.min(1, (now - run.jumpAt) / SHARK_JUMP_MS)) : 0;
    const progress = landed + fraction, camera = Math.max(0, progress - 1);
    const y = step => 76 - (step - camera) * 14;
    const x = step => step === 0 ? 31 : 31 + this.course[step - 1].column * 19;
    const first = Math.max(0, landed - 2);
    this.sharks.forEach(({ element, sprite, mark }, offset) => {
      const step = first + offset;
      element.hidden = step > goal || y(step) < -18 || y(step) > 118;
      if (step > goal) return;
      const stone = step <= landed;
      const color = step ? this.course[step - 1].color : 0;
      const kind = stone ? 'stone' : COLORS[color];
      sprite.className = `shark-sprite shark-${kind} shark-emerging`;
      sprite.setAttribute('aria-label', stone ? 'Safe grey stone shark' : `${COLORS[color]} shark`);
      element.style.left = `${x(step)}%`; element.style.top = `${y(step)}%`;
      element.style.zIndex = `${goal - step + 1}`;
      element.style.transform = `translate(-50%,-50%) scaleX(${step % 2 ? -1 : 1})`;
      element.classList.toggle('shark-next', step === landed + 1);
      mark.hidden = stone; mark.textContent = ['●', '▲', '◆'][color];
    });
    const direction = landed % 2 === 0 ? 1 : -1;
    const age = now - (run?.fallAt ?? -Infinity), recovering = age >= 0 && age < SHARK_RECOVERY_MS;
    let fall = 0, drift = 0;
    if (recovering && !this.motion?.matches) {
      const amount = age < SHARK_FALL_MS ? (age / SHARK_FALL_MS) ** 2 : age < 400 ? 1 : (1 - (age - 400) / (SHARK_RECOVERY_MS - 400)) ** 2;
      fall = 20 * amount; drift = direction * 9 * amount;
    }
    const positionX = pending && !this.motion?.matches ? x(landed) + (x(landed + 1) - x(landed)) * fraction : x(landed);
    const arc = this.motion?.matches ? 0 : Math.sin(Math.PI * fraction) * 11;
    this.puppy.hidden = !occupied || Boolean(recovering && !this.motion?.matches && age >= SHARK_FALL_MS && age < 400);
    this.puppy.className = `shark-sprite shark-${recovering && age >= 400 ? 'climb' : 'puppy'}`;
    this.puppy.style.left = `${positionX + drift}%`;
    this.puppy.style.top = `calc(${y(progress) - arc + fall}% - 9cqw)`;
    this.puppy.style.transform = `translate(-50%,-100%) scaleX(${direction})`;
    const splashAge = age - SHARK_FALL_MS;
    this.splash.hidden = !occupied || splashAge < 0 || splashAge > 380;
    this.splash.style.left = `${x(landed) + direction * 9}%`; this.splash.style.top = `${y(landed) + 17}%`;
    this.splash.style.opacity = `${Math.max(0, 1 - splashAge / 380)}`;
    this.splash.style.transform = `translate(-50%,-50%) scale(${this.motion?.matches ? 1 : 1 + Math.max(0, splashAge) / 200})`;
    this.element.setAttribute('aria-label', recovering ? 'Puppy climbs back onto the last safe shark' : landed === goal ? 'All sharks crossed' : `Next shark: ${COLORS[this.course[landed].color]}`);
  }
}
