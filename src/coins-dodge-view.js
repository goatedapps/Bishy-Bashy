const SHAPES = ['●', '▲', '◆'];
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function raccoonPortrait() { return node('span', 'coin-raccoon'); }
export function runnerPortrait() { return node('span', 'dodge-fox'); }
export function coinPortrait(decoy = false) { return node('span', `rain-coin${decoy ? ' fake-coin' : ''}`, decoy ? '×' : '★'); }

class LaneStage {
  constructor(kind, portrait) {
    this.element = node('div', `lane-stage ${kind}-stage`);
    this.element.hidden = true;
    this.element.setAttribute('role', 'group');
    const tracks = node('div', 'lane-tracks');
    tracks.append(...SHAPES.map((shape, index) => node('span', `track-mark track-${index}`, shape)));
    this.line = node('span', 'lane-impact-line');
    this.shadow = node('span', 'lane-shadow');
    this.player = node('div', 'lane-runner');
    this.sprite = portrait();
    this.player.append(this.sprite);
    this.toast = node('strong', 'lane-toast');
    this.element.append(tracks, this.line, this.shadow, this.player, this.toast);
  }

  renderPlayer(run, time, present, terminal, cleared) {
    this.element.classList.toggle('unoccupied', !present);
    const age = run?.feedback ? time - run.feedback.at : Infinity;
    const showing = age >= 0 && age < 400;
    this.element.classList.toggle('lane-success', Boolean(showing && ['catch', 'clear'].includes(run.feedback.kind)));
    this.element.classList.toggle('lane-crash', Boolean(showing && ['crash', 'decoy', 'miss'].includes(run.feedback.kind)));
    this.element.style.setProperty('--runner-column', String(run?.position ?? cleared % 3));
    this.toast.hidden = !showing;
    this.toast.textContent = !showing ? '' : ({ catch: '+1', clear: 'Clear!', crash: 'Bump!', decoy: 'Fake!', miss: 'Miss!' }[run.feedback.kind] || '');
    return Boolean(run && !terminal && time >= run.start && time < run.end);
  }
}

export class CoinStage extends LaneStage {
  constructor() {
    super('coin', raccoonPortrait);
    this.drops = Array.from({ length: 3 }, () => {
      const pair = [false, true].map(fake => {
        const element = node('div', 'coin-drop'); element.append(coinPortrait(fake)); this.element.append(element); return element;
      });
      return pair;
    });
    [this.coin, this.decoy] = this.drops[0];
  }

  render(round, run, time, elapsed, active, present, cleared, terminal = false) {
    const playing = this.renderPlayer(run, time, present, terminal, cleared);
    const waves = playing ? run.activeWaves(time) : [];
    this.drops.forEach((pair, index) => {
      const wave = waves[index];
      pair.forEach((drop, fake) => {
        drop.hidden = !present || active && (!playing || !wave);
        drop.style.setProperty('--drop-column', String(wave ? fake ? wave.decoy : wave.column : fake ? 2 : 0));
        drop.style.setProperty('--fall-progress', String(wave ? Math.max(0, Math.min(1, (time - wave.launchedAt) / run.fallMs)) : 0));
      });
    });
    this.element.setAttribute('aria-label', !present ? 'Open spot' : playing ? `Gold coin ${['left', 'middle', 'right'][run.wave.column]}, fake ${['left', 'middle', 'right'][run.wave.decoy]}; raccoon ${['left', 'middle', 'right'][run.position]}` : `${cleared} coins caught`);
  }
}

export class DodgeStage extends LaneStage {
  constructor() {
    super('dodge', runnerPortrait);
    this.obstacles = Array.from({ length: 3 }, (_, column) => {
      const obstacle = node('div', 'road-obstacle');
      obstacle.style.setProperty('--drop-column', String(column));
      obstacle.append(node('span', 'obstacle-face'));
      this.element.append(obstacle);
      return obstacle;
    });
    this.warning = node('strong', 'road-warning');
    this.element.append(this.warning);
  }

  render(round, run, time, elapsed, active, present, cleared, terminal = false) {
    const playing = this.renderPlayer(run, time, present, terminal, cleared);
    const obstacle = run?.obstacle || { kind: 'wall', safe: 1 };
    const progress = run ? (time - run.launchedAt) / run.approachMs : .3;
    const height = playing ? run.jumpHeight(time) : 0;
    this.player.style.setProperty('--jump-height', String(height));
    this.shadow.style.opacity = 1 - height * .65;
    this.obstacles.forEach((element, column) => {
      element.hidden = active && (!playing || progress < 0 || progress > 1) || obstacle.kind === 'wall' && column === obstacle.safe;
      element.classList.toggle('low-hurdle', obstacle.kind === 'hurdle');
      element.style.setProperty('--fall-progress', String(Math.max(0, Math.min(1, progress))));
    });
    this.warning.hidden = active && (!playing || progress < 0);
    this.warning.textContent = obstacle.kind === 'hurdle' ? '↑ Jump!' : '↔ Dodge!';
    this.element.classList.toggle('hurdle-coming', obstacle.kind === 'hurdle');
    this.element.setAttribute('aria-label', !present ? 'Open spot' : playing ? obstacle.kind === 'hurdle' ? 'Low hurdle approaching: press green to jump at the landing line' : `Tall walls approaching; open lane ${['left', 'middle', 'right'][obstacle.safe]}` : `${cleared} obstacles cleared`);
  }
}
