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
    this.feedback = node('span', 'jump-feedback');
    this.sparks = node('div', 'jump-sparks');
    this.sparks.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 6; index++) {
      const spark = node('span', '', '✦');
      spark.style.setProperty('--spark-angle', `${index * 60}deg`);
      this.sparks.append(spark);
    }
    this.scene.append(this.feedback, this.sparks);
    this.phase = node('strong', 'jump-phase');
    this.timing = node('div', 'jump-timing');
    this.fill = node('span', 'jump-timing-fill');
    this.goldZone = node('span', 'jump-gold-zone');
    this.perfectZone = node('span', 'jump-perfect-zone');
    this.cursor = node('span', 'jump-timing-cursor');
    this.timing.append(this.fill, this.goldZone, this.perfectZone, this.cursor);
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
    const feedback = run?.feedback;
    const age = feedback ? time - feedback.at : Infinity;
    const showingFeedback = age >= 0 && age < 650;
    const boosted = showingFeedback && feedback.kind === 'boost';
    this.sparks.style.opacity = boosted ? String(Math.max(0, 1 - age / 500)) : '0';
    this.sparks.style.setProperty('--burst-age', String(Math.min(1, age / 500)));
    this.element.classList.toggle('jump-boosted', Boolean(boosted));
    this.element.classList.toggle('jump-perfect-boost', Boolean(boosted && feedback.perfect));
    this.feedback.hidden = !showingFeedback;
    this.feedback.style.setProperty('--feedback-rise', `${showingFeedback ? Math.min(1, age / 650) * 12 : 0}px`);
    this.feedback.textContent = !showingFeedback ? '' : feedback.kind === 'miss' ? feedback.label : feedback.perfect ? `Perfect! +${feedback.gain}` : `Nice! +${feedback.gain}`;
    const launchAge = run ? time - run.launchedAt : Infinity;
    const stretch = boosted && launchAge >= 0 && launchAge < 220 ? .15 * (1 - launchAge / 220) : 0;
    this.actor.style.setProperty('--dino-stretch', String(stretch));
    this.ring.style.setProperty('--landing-scale', String(run && (phase === 'air' || phase === 'land' || phase === 'perfect') ? Math.max(.6, Math.min(1.65, 1 + (run.landAt - time) / run.arcMs)) : 1));
    this.actor.hidden = !present;
    this.meat.hidden = !present || phase === 'finished';
    const text = !present ? '' : ({ perfect: 'Perfect!', land: 'Good!', air: '', stumble: 'Oops!', reaching: 'Chomp!', finished: 'Yum!', expired: 'Round over' }[phase] || '');
    if (this.phase.textContent !== text) this.phase.textContent = text;
    this.timing.hidden = !run || !active || terminal || phase === 'reaching';
    const position = run ? Math.max(0, Math.min(1, (time - run.launchedAt) / (run.arcMs + run.windowMs))) : 0;
    const center = run ? run.arcMs / (run.arcMs + run.windowMs) : .85;
    this.fill.style.width = `${position * 100}%`;
    this.cursor.style.left = `${position * 100}%`;
    this.timing.style.setProperty('--landing-center', `${center * 100}%`);
    this.timing.style.setProperty('--landing-width', `${run ? 2 * run.windowMs / (run.arcMs + run.windowMs) * 100 : 24}%`);
    this.timing.style.setProperty('--perfect-width', `${run ? 2 * run.perfectMs / (run.arcMs + run.windowMs) * 100 : 7}%`);
    const label = !present ? 'Open spot' : phase === 'perfect' ? 'Perfect landing, press any button for two boosts' : phase === 'land' ? 'Good landing, press any button for one boost' : phase === 'finished' ? 'Meat reached' : `${text || 'Dinosaur'}: ${cleared} boosts`;
    if (this.element.getAttribute('aria-label') !== label) this.element.setAttribute('aria-label', label);
  }
}
