import { ANT_GAME, ANT_ROUTE_MS, SATAY_GAME, WEATHER_GAME, satayDropMs } from '../shared/market-games.js';

const DIRECTIONS = ['left', 'down', 'right'];
const ANGLES = [-90, 180, 90];
const WEATHER = ['lightning', 'wind', 'rain'];
const TRAVEL_MS = 310;
const unit = value => Math.min(1, Math.max(0, value));
const node = (tag, className) => Object.assign(document.createElement(tag), { className });
const sprite = kind => node('span', `market-sprite market-${kind}`);
const bit = (mask, slot) => Boolean(mask & (1 << slot));

export function marketPortrait(game) {
  const portrait = node('span', `market-portrait market-scene-${game}`);
  if (game === SATAY_GAME) portrait.append(sprite('skewer'), sprite('sausage'));
  if (game === WEATHER_GAME) portrait.append(sprite('witch'), sprite('bottle-0'), sprite('bottle-2'));
  if (game === ANT_GAME) portrait.append(sprite('plane'));
  return portrait;
}

export class MarketStage {
  constructor() {
    this.element = node('div', 'market-stage');
    this.element.setAttribute('role', 'img');
    this.satay = node('div', `market-scene market-scene-${SATAY_GAME}`);
    this.sausage = sprite('sausage');
    this.skewer = sprite('skewer');
    this.satay.append(this.skewer, this.sausage);
    this.weather = node('div', `market-scene market-scene-${WEATHER_GAME}`);
    this.trays = node('div', 'weather-trays');
    this.bottles = Array.from({ length: 6 }, (_, slot) => {
      const bottle = sprite('bottle-0');
      bottle.style.setProperty('--slot', String(slot % 3));
      bottle.style.setProperty('--tray-x', slot < 3 ? '13%' : '87%');
      return bottle;
    });
    this.burst = node('span', 'weather-burst');
    for (let ray = 0; ray < 7; ray++) {
      const fragment = node('i', 'weather-fragment');
      fragment.style.setProperty('--angle', `${ray * 360 / 7}deg`);
      this.burst.append(fragment);
    }
    this.trays.append(sprite('witch'), ...this.bottles, this.burst);
    this.weather.append(this.trays);
    this.ant = node('div', `market-scene market-scene-${ANT_GAME}`);
    this.ground = node('div', 'ant-ground');
    this.plane = sprite('plane');
    this.ant.append(this.ground, this.plane);
    this.response = node('strong', 'market-response');
    this.response.setAttribute('aria-hidden', 'true');
    this.element.append(this.satay, this.weather, this.ant, this.response);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  render(round, run, time, _elapsed, _active, occupied, _cleared, terminal) {
    this.satay.hidden = round.game !== SATAY_GAME;
    this.weather.hidden = round.game !== WEATHER_GAME;
    this.ant.hidden = round.game !== ANT_GAME;
    const motion = !this.motion?.matches && !document.hidden;
    const age = time - (run?.feedback?.at ?? -Infinity);
    const feedback = age >= 0 && age < TRAVEL_MS && !document.hidden ? run.feedback : null;
    let label;
    if (round.game === SATAY_GAME) label = this.renderSatay(round, run, time, feedback, motion, occupied, terminal);
    if (round.game === WEATHER_GAME) label = this.renderWeather(run, feedback, age, motion, occupied, terminal && run?.cleared === round.goal);
    if (round.game === ANT_GAME) label = this.renderAnt(round, run, feedback, age, motion, occupied, terminal);
    const success = ['catch', 'clear'].includes(feedback?.kind) || feedback?.kind === 'burst' && !motion;
    const response = feedback?.kind === 'miss' ? '×' : success ? '○' : '';
    this.response.hidden = !occupied || !response;
    this.response.className = `market-response${feedback?.kind === 'miss' ? ' market-wrong' : ''}`;
    if (this.response.textContent !== response) this.response.textContent = response;
    label = !occupied ? 'Open spot' : terminal && run?.cleared === round.goal ? 'Cleared' : label;
    if (label && this.label !== label) {
      this.label = label;
      this.element.setAttribute('aria-label', label);
    }
  }

  renderSatay(round, run, time, feedback, motion, occupied, terminal) {
    const caught = run?.feedback?.kind === 'catch' && run.feedback.at >= run.launchedAt;
    const duration = run ? satayDropMs(round, run.index) : 1000;
    const progress = run ? Math.min(1.45, Math.max(0, (time - run.launchedAt) / duration)) : 0;
    const drop = motion ? progress : Math.floor(progress * 12) / 12;
    const y = caught ? 64 : 8 + 56 * drop ** 1.45;
    const age = time - (feedback?.at ?? -Infinity);
    const jab = caught ? 1 : feedback?.kind === 'miss' && feedback.color !== undefined ? motion ? Math.max(0, 1 - age / 150) : 1 : 0;
    this.skewer.hidden = !occupied;
    this.sausage.hidden = !occupied || y > 113 || terminal && !caught;
    this.sausage.style.top = `${y}%`;
    this.skewer.style.translate = `${-jab * 60 - 50}% -50%`;
    return caught ? 'Hot dog skewered' : feedback?.kind === 'miss' ? 'Missed hot dog' : 'Hot dog falling toward the skewer';
  }

  renderWeather(run, feedback, age, motion, occupied, cleared) {
    this.trays.hidden = !occupied;
    if (!occupied) return 'Open spot';
    const colors = run?.sequence[run.index]?.colors ?? [0, 2];
    const mask = cleared ? 0 : run?.bottleMask ?? 0b001001;
    const burstSide = feedback?.kind === 'burst' ? colors.indexOf(feedback.color) : -1;
    for (const [slot, bottle] of this.bottles.entries()) {
      bottle.hidden = !bit(mask, slot);
      const name = `market-sprite market-bottle-${colors[Math.floor(slot / 3)]}`;
      if (bottle.className !== name) bottle.className = name;
    }
    this.burst.hidden = burstSide === -1 || !motion;
    if (!this.burst.hidden) {
      const count = [0, 1, 2].filter(slot => bit(mask, slot + burstSide * 3)).length;
      const progress = unit(age / TRAVEL_MS);
      this.burst.className = `weather-burst weather-release-${feedback.color}`;
      this.burst.style.left = burstSide === 0 ? '13%' : '87%';
      this.burst.style.setProperty('--slot', String(count));
      this.burst.style.setProperty('--burst-travel', `${8 + 28 * (1 - (1 - progress) ** 2)}cqw`);
      this.burst.style.opacity = String(1 - progress);
    }
    const labels = colors.flatMap((color, side) => {
      const count = [0, 1, 2].filter(slot => bit(mask, slot + side * 3)).length;
      return count ? [`${count} ${WEATHER[color]} ${count === 1 ? 'bottle' : 'bottles'}`] : [];
    });
    return labels.join(', ') || 'Both trays cleared';
  }

  renderAnt(round, run, feedback, age, motion, occupied, terminal) {
    const flying = feedback?.kind === 'clear' && age < ANT_ROUTE_MS;
    const index = Math.max(0, (run?.cleared ?? 0) - Number(flying));
    const color = run?.sequence[index] ?? 2;
    const progress = flying && motion ? unit(age / ANT_ROUTE_MS) : 0;
    const firstSize = 1 - .08 * ((round.difficulty ?? 1) - 1);
    const distance = index / Math.max(11, round.goal - 1);
    const scale = firstSize - (firstSize - .3) * distance;
    const zoom = 1.26 - .26 * (index + progress) / Math.max(11, round.goal - 1);
    this.ground.style.scale = String(zoom);
    this.plane.hidden = !occupied || terminal && !flying;
    this.plane.style.left = `${50 + (color - 1) * 53 * progress}%`;
    this.plane.style.top = `${43 + (color === 1 ? 53 * progress : 0)}%`;
    this.plane.style.rotate = `${ANGLES[color]}deg`;
    this.plane.style.setProperty('--plane-size', String(scale));
    this.plane.style.scale = String(1 - .26 * progress);
    return flying ? `Plane routed ${DIRECTIONS[color]}` : `Plane pointing ${DIRECTIONS[color]}`;
  }
}
