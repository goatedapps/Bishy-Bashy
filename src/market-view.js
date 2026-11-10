import { ANT_GAME, ANT_LEG_MS, POTION_GAME, POTION_REFILL_MS, SATAY_GAME, satayDropMs } from '../shared/market-games.js';

const DIRECTIONS = ['left', 'down', 'right'];
const ANGLES = [-90, 180, 90];
const POTIONS = ['heart', 'herb', 'moon'];
const LAST_LOOK = 10;
const TRAVEL_MS = 310;
const unit = value => Math.min(1, Math.max(0, value));
const node = (tag, className) => Object.assign(document.createElement(tag), { className });
const sprite = kind => node('span', `market-sprite market-${kind}`);
const bit = (mask, slot) => Boolean(mask & (1 << slot));
const mix = (from, to, progress) => from + (to - from) * progress;

function glamourLook(element, stage) {
  element.style.backgroundPosition = `${(stage % 4) * 100 / 3}% ${Math.floor(stage / 4) * 50}%`;
}

export function antFlightPose(round, run, time, motion) {
  const cleared = run?.cleared ?? 0;
  const age = time - (run?.feedback?.at ?? -Infinity);
  const flying = cleared > 0 && run.feedback?.kind === 'clear' && age >= 0 && age < ANT_LEG_MS;
  const leg = cleared - Number(flying);
  const color = run?.sequence[leg] ?? run?.sequence.at(-1) ?? 2;
  const from = run?.waypoints[leg] ?? [0, 0];
  const to = run?.waypoints[leg + 1] ?? from;
  const phase = flying && motion ? unit(age / ANT_LEG_MS) : 0;
  const travel = (1 - Math.cos(Math.PI * phase)) / 2;
  const lead = Math.sin(Math.PI * travel);
  const heading = ANGLES[color];
  const nextHeading = ANGLES[run?.sequence[leg + 1]] ?? heading;
  const turn = ((nextHeading - heading + 540) % 360) - 180;
  const turnPhase = unit((phase - .62) / .38);
  const distance = unit((leg + travel) / Math.max(12, round.goal));
  return {
    flying, color, heading,
    rotation: heading + turn * turnPhase ** 2 * (3 - 2 * turnPhase),
    x: 50 + (to[0] - from[0]) * 20 * lead,
    y: 46 + (to[1] - from[1]) * 16 * lead,
    cameraX: -5 * mix(from[0], to[0], travel),
    cameraY: -1.3 * mix(from[1], to[1], travel),
    zoom: mix(1.35, 1, distance),
    size: mix(1 - .08 * ((round.difficulty ?? 1) - 1), .32, distance),
    trail: lead * .85,
  };
}

export function marketPortrait(game) {
  const portrait = node('span', `market-portrait market-scene-${game}`);
  if (game === SATAY_GAME) portrait.append(sprite('skewer'), sprite('sausage'));
  if (game === POTION_GAME) {
    const witch = sprite('witch');
    glamourLook(witch, LAST_LOOK);
    portrait.append(witch, sprite('bottle-0'), sprite('bottle-2'));
  }
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
    this.potions = node('div', `market-scene market-scene-${POTION_GAME}`);
    this.trays = node('div', 'potion-trays');
    this.witch = sprite('witch');
    this.previousWitch = sprite('witch');
    this.magic = node('span', 'potion-magic');
    const trays = [sprite('tray'), sprite('tray')];
    this.bottles = Array.from({ length: 6 }, (_, slot) => {
      const bottle = sprite('bottle-0');
      bottle.style.setProperty('--slot', String(slot % 3));
      bottle.style.setProperty('--tray-x', slot < 3 ? '13%' : '87%');
      return bottle;
    });
    this.burst = node('span', 'potion-burst');
    for (let ray = 0; ray < 7; ray++) {
      const fragment = node('i', 'potion-fragment');
      fragment.style.setProperty('--angle', `${ray * 360 / 7}deg`);
      this.burst.append(fragment);
    }
    this.trays.append(this.magic, this.previousWitch, this.witch, ...trays, ...this.bottles, this.burst);
    this.potions.append(this.trays);
    this.ant = node('div', `market-scene market-scene-${ANT_GAME}`);
    this.ground = node('div', 'ant-ground');
    this.junction = node('div', 'ant-junction');
    for (const direction of DIRECTIONS) this.junction.append(node('i', `ant-lane ant-lane-${direction}`));
    this.trail = node('div', 'ant-trail');
    this.plane = sprite('plane');
    this.ant.append(this.ground, this.junction, this.trail, this.plane);
    this.response = node('strong', 'market-response');
    this.response.setAttribute('aria-hidden', 'true');
    this.element.append(this.satay, this.potions, this.ant, this.response);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  render(round, run, time, _elapsed, _active, occupied, _cleared, terminal) {
    this.satay.hidden = round.game !== SATAY_GAME;
    this.potions.hidden = round.game !== POTION_GAME;
    this.ant.hidden = round.game !== ANT_GAME;
    const motion = !this.motion?.matches && !document.hidden;
    const age = time - (run?.feedback?.at ?? -Infinity);
    const feedback = age >= 0 && age < TRAVEL_MS && !document.hidden ? run.feedback : null;
    let label;
    if (round.game === SATAY_GAME) label = this.renderSatay(round, run, time, feedback, motion, occupied, terminal);
    if (round.game === POTION_GAME) label = this.renderPotions(round, run, age, motion, occupied, terminal);
    if (round.game === ANT_GAME) label = this.renderAnt(round, run, time, motion, occupied, terminal);
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
    const drop = motion ? progress : Math.floor(progress * 20) / 20;
    const y = caught ? 64 : 8 + 56 * drop ** 1.45;
    const age = time - (feedback?.at ?? -Infinity);
    const jab = caught ? 1 : feedback?.kind === 'miss' && feedback.color !== undefined ? motion ? Math.max(0, 1 - age / 150) : 1 : 0;
    this.skewer.hidden = !occupied;
    this.sausage.hidden = !occupied || y > 113 || terminal && !caught;
    this.sausage.style.top = `${y}%`;
    this.skewer.style.translate = `${-jab * 60 - 50}% -50%`;
    return caught ? 'Hot dog skewered' : feedback?.kind === 'miss' ? 'Missed hot dog' : 'Hot dog falling toward the skewer';
  }

  renderPotions(round, run, age, motion, occupied, terminal) {
    this.trays.hidden = !occupied;
    if (!occupied) return 'Open spot';
    const looks = run?.cleared ?? 0;
    const colors = run?.sequence[run.index]?.colors ?? [0, 2];
    const mask = terminal && looks === round.goal ? 0 : run?.bottleMask ?? 0b001001;
    const feedback = age >= 0 && run?.feedback?.kind === 'burst' ? run.feedback : null;
    const changing = looks > 0 && mask === 0 && feedback && age < POTION_REFILL_MS;
    const reveal = changing && motion ? unit((age - 45) / 210) : 1;
    const look = Math.min(LAST_LOOK, looks);
    glamourLook(this.witch, look);
    this.witch.style.opacity = String(reveal);
    this.witch.style.scale = String(reveal < 1 ? 1 + .09 * Math.sin(Math.PI * reveal) : 1);
    this.previousWitch.hidden = reveal === 1;
    if (reveal < 1) {
      glamourLook(this.previousWitch, look - 1);
      this.previousWitch.style.opacity = String(1 - reveal);
    }
    this.magic.hidden = !changing || !motion;
    if (!this.magic.hidden) {
      const glow = unit(age / POTION_REFILL_MS);
      this.magic.style.opacity = String(Math.sin(Math.PI * glow) * .88);
      this.magic.style.scale = String(.85 + .65 * glow);
    }
    const burstSide = feedback && age < TRAVEL_MS ? colors.indexOf(feedback.color) : -1;
    for (const [slot, bottle] of this.bottles.entries()) {
      bottle.hidden = !bit(mask, slot);
      const name = `market-sprite market-bottle-${colors[Math.floor(slot / 3)]}`;
      if (bottle.className !== name) bottle.className = name;
    }
    this.burst.hidden = burstSide === -1 || !motion;
    if (!this.burst.hidden) {
      const count = [0, 1, 2].filter(slot => bit(mask, slot + burstSide * 3)).length;
      const progress = unit(age / TRAVEL_MS);
      this.burst.className = `potion-burst potion-release-${feedback.color}`;
      this.burst.style.left = burstSide === 0 ? '13%' : '87%';
      this.burst.style.setProperty('--slot', String(count));
      this.burst.style.setProperty('--burst-travel', `${8 + 28 * (1 - (1 - progress) ** 2)}cqw`);
      this.burst.style.opacity = String(1 - progress);
    }
    const labels = colors.flatMap((color, side) => {
      const count = [0, 1, 2].filter(slot => bit(mask, slot + side * 3)).length;
      return count ? [`${count} ${POTIONS[color]} ${count === 1 ? 'potion' : 'potions'}`] : [];
    });
    return labels.join(', ') || 'Both trays cleared. The witch’s look changes.';
  }

  renderAnt(round, run, time, motion, occupied, terminal) {
    const pose = antFlightPose(round, run, time, motion);
    this.ground.style.translate = `${pose.cameraX}% ${pose.cameraY}%`;
    this.ground.style.scale = String(pose.zoom);
    this.junction.hidden = !occupied || pose.flying || terminal;
    this.trail.hidden = !occupied || pose.trail === 0;
    if (!this.trail.hidden) {
      this.trail.style.left = `${pose.x}%`;
      this.trail.style.top = `${pose.y}%`;
      this.trail.style.rotate = `${pose.heading}deg`;
      this.trail.style.opacity = String(pose.trail);
    }
    this.plane.hidden = !occupied;
    this.plane.style.left = `${pose.x}%`;
    this.plane.style.top = `${pose.y}%`;
    this.plane.style.rotate = `${pose.rotation}deg`;
    this.plane.style.setProperty('--plane-size', String(pose.size));
    return pose.flying ? `Flying ${DIRECTIONS[pose.color]} to the next waypoint` : `At a waypoint, nose pointing ${DIRECTIONS[pose.color]}`;
  }
}
