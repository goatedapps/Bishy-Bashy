const COLORS = ['#ff637b', '#70ef9d', '#72bbff'];
const SHAPES = ['●', '▲', '◆'];

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
    this.rocket = document.createElement('span');
    this.rocket.className = 'firework-rocket';
    this.burst = document.createElement('div');
    this.burst.className = 'firework-burst';
    this.burst.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 12; index++) {
      const spark = document.createElement('i');
      spark.style.setProperty('--angle', `${index * 30}deg`);
      this.burst.append(spark);
    }
    this.fuse = document.createElement('div');
    this.fuse.className = 'firework-fuse';
    this.element.append(this.rocket, this.burst, this.fuse);
  }

  render(round, run, time, active, present, cleared, terminal = false) {
    const playing = active && present && !terminal && !run?.done && time >= (run?.start ?? Infinity) && time < (run?.end ?? -Infinity);
    const ready = playing && time >= run.revealAt && time < run.expiresAt;
    const feedback = run?.feedback;
    const age = feedback ? time - feedback.at : Infinity;
    const burst = feedback?.kind === 'burst' && age >= 0 && age < 450;
    const miss = feedback?.kind === 'miss' && age >= 0 && age < 300;
    // Remote bursts follow reported progress; reaction targets belong only to the local clock.
    if (!run && this.cleared !== cleared) this.remoteBurstAt = time;
    this.cleared = cleared;
    const remoteBurst = !run && cleared > 0 && time - (this.remoteBurstAt ?? -Infinity) < 450;
    const color = ready ? run.rocket.color : burst ? feedback.color : cleared % 3;
    this.element.style.setProperty('--firework-color', COLORS[color]);
    this.element.classList.toggle('revealed', ready);
    this.element.classList.toggle('bursting', burst || remoteBurst || terminal && cleared === round.goal);
    this.element.classList.toggle('misfired', miss);
    this.rocket.textContent = ready ? SHAPES[color] : miss ? '×' : '✦';
    this.rocket.hidden = burst || terminal || !present;
    const flight = playing ? Math.max(0, Math.min(1, (time - run.launchedAt) / (run.revealAt - run.launchedAt))) : .35;
    this.rocket.style.bottom = `${12 + flight * 50}%`;
    this.fuse.style.transform = `scaleX(${ready ? Math.max(0, (run.expiresAt - time) / run.windowMs) : 0})`;
    const label = !present ? 'Open spot' : ready ? `${['Red circle', 'Green triangle', 'Blue diamond'][color]}, press now` : miss ? 'Missed rocket' : burst || remoteBurst ? 'Firework burst' : terminal ? 'Round complete' : 'Rocket rising, wait for its color';
    if (this.element.getAttribute('aria-label') !== label) this.element.setAttribute('aria-label', label);
    this.element.setAttribute('role', 'img');
  }
}
