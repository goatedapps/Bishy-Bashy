const COLORS = ['#ff637b', '#70ef9d', '#72bbff'];

export function fireworkBadge() {
  const badge = document.createElement('span');
  badge.className = 'firework-badge';
  badge.textContent = '✺';
  return badge;
}

export class FireworkStage {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'firework-stage';
    this.element.hidden = true;
    this.rockets = Array.from({ length: 5 }, () => {
      const rocket = document.createElement('span');
      rocket.className = 'firework-rocket';
      rocket.hidden = true;
      this.element.append(rocket);
      return rocket;
    });
    this.burst = document.createElement('div');
    this.burst.className = 'firework-burst';
    this.burst.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 12; index++) {
      const spark = document.createElement('i');
      spark.style.setProperty('--angle', `${index * 30}deg`);
      this.burst.append(spark);
    }
    this.count = document.createElement('strong');
    this.count.className = 'firework-set-count';
    this.element.append(this.burst, this.count);
  }

  render(round, run, time, active, present, cleared, terminal = false) {
    const playing = active && present && !terminal && !run?.done && time >= (run?.start ?? Infinity) && time < (run?.end ?? -Infinity);
    const feedback = run?.feedback;
    const age = feedback ? time - feedback.at : Infinity;
    const burst = feedback?.kind === 'burst' && age >= 0 && age < 450;
    const rockets = run?.rockets || [];
    this.rockets.forEach((element, index) => {
      const rocket = rockets[index];
      const progress = rocket ? (time - rocket.launchAt) / rocket.airMs : -1;
      element.hidden = !playing || !rocket || rocket.hit || progress < 0 || progress >= 1;
      if (element.hidden) return;
      element.style.setProperty('--firework-color', COLORS[rocket.color]);
      element.style.left = `${rockets.length === 1 ? 50 : 14 + index * 72 / (rockets.length - 1)}%`;
      element.style.bottom = `${8 + 72 * 4 * progress * (1 - progress)}%`;
      element.classList.toggle('falling', progress > .5);
    });
    this.element.style.setProperty('--firework-color', COLORS[feedback?.color || 0]);
    this.element.classList.toggle('bursting', burst);
    if (burst && this.lastBurst !== feedback.at) {
      this.lastBurst = feedback.at;
      this.burst.getAnimations?.().forEach(animation => animation.cancel());
      if (!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) this.burst.animate?.([
        { transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0 },
      ], { duration: 450, easing: 'ease-out' });
    }
    this.count.textContent = active && present ? `Set ${Math.min(cleared + 1, 5)} / 5` : '';
    const airborne = rockets.filter(rocket => !rocket.hit && time >= rocket.launchAt && time < rocket.launchAt + rocket.airMs);
    const label = !present ? 'Open spot' : terminal ? 'Round complete' : `Set ${Math.min(cleared + 1, 5)}: ${airborne.map(rocket => ['Red', 'Green', 'Blue'][rocket.color]).join(', ') || 'Get ready'}`;
    this.element.setAttribute('aria-label', label);
    this.element.setAttribute('role', 'img');
  }
}
