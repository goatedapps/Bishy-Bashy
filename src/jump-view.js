const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function dinoPortrait() {
  const dino = node('span', 'jump-dino');
  dino.setAttribute('role', 'img');
  dino.setAttribute('aria-label', 'Hungry dinosaur');
  return dino;
}

export class JumpStage {
  constructor() {
    this.element = node('div', 'jump-stage');
    this.element.hidden = true;
    this.scene = node('div', 'jump-scene');
    this.meat = node('span', 'jump-meat');
    this.meat.setAttribute('aria-hidden', 'true');
    this.ring = node('span', 'jump-landing');
    this.actor = dinoPortrait();
    this.scene.append(this.meat, this.ring, this.actor);
    this.phase = node('strong', 'jump-phase');
    this.timing = node('div', 'jump-timing');
    this.fill = node('span', 'jump-timing-fill');
    this.timing.append(this.fill);
    this.timing.setAttribute('aria-hidden', 'true');
    this.element.append(this.scene, this.phase, this.timing);
    this.element.setAttribute('role', 'group');
  }

  render(round, run, time, elapsed, active, present, cleared, terminal = false) {
    const ownPhase = run?.phase(time);
    const phase = !active || !present ? 'waiting' : terminal ? cleared === round.goal ? 'finished' : 'expired' : ownPhase || 'remote';
    const motion = Math.max(0, elapsed) % (round.periodMs || 1200) / (round.periodMs || 1200);
    const height = run ? run.heightAt(time) : phase === 'remote' ? (.18 + cleared / round.goal * .58) * 4 * motion * (1 - motion) : phase === 'finished' ? .76 : 0;
    this.element.style.setProperty('--jump-height', String(height));
    this.element.dataset.phase = phase;
    this.actor.hidden = !present;
    this.meat.hidden = !present || phase === 'finished';
    const text = !present ? '' : ({ land: 'Land!', air: 'Bounce', stumble: 'Oops!', reaching: 'Reach!', finished: 'Got it!', expired: 'Round over' }[phase] || '');
    if (this.phase.textContent !== text) this.phase.textContent = text;
    this.timing.hidden = !run || !active || terminal || phase === 'reaching';
    this.fill.style.width = `${run ? Math.max(0, Math.min(1, (time - run.launchedAt) / run.arcMs)) * 100 : 0}%`;
    this.timing.style.setProperty('--landing-width', `${run ? run.windowMs / run.arcMs * 100 : 12}%`);
    const label = !present ? 'Open spot' : phase === 'land' ? 'Land now, press any button' : phase === 'finished' ? 'Meat reached' : `${text || 'Dinosaur'}: ${cleared} boosts`;
    if (this.element.getAttribute('aria-label') !== label) this.element.setAttribute('aria-label', label);
  }
}
