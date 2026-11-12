import { gsap } from 'gsap';
import { METRO_GAME, METRO_ARRIVAL_MS, METRO_ARRIVED, METRO_CRASH, METRO_DWELL_MS,
  METRO_ENTRY_MS, METRO_FORK_MS, METRO_STATIONS, METRO_WRONG, SUSHI_GAME, SUSHI_ITEMS, SUSHI_SERVE_MS, SUSHI_OBSERVE_MS,
  createWorkshopRun, damOutline, metroStation } from '../shared/workshop-games.js';

const BUTTON_SHAPES = ['●', '▲', '◆'];
const BUTTON_COLORS = ['Red', 'Green', 'Blue'];
const STATION_NAMES = ['Star', 'Heart', 'Moon', 'Flower'];
const BOARD_RATIO = 1.08;
const ENTRY = [50, 9];
const SWITCHES = [[50, 31], [28, 57], [72, 57]];
const STATIONS = [[11, 85], [34, 85], [66, 85], [89, 85]];
const SUCCESS = '○';
const FAILURE = '×';
const orderIn = gsap.parseEase('back.out(1.6)');
const settle = gsap.parseEase('power2.out');

const unit = value => Math.max(0, Math.min(1, value));
const lerp = (from, to, fraction) => from + (to - from) * fraction;
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const position = (element, [x, y]) => {
  element.style.left = `${x}%`;
  element.style.top = `${y}%`;
};
const angle = (from, to) => Math.atan2(to[1] - from[1], (to[0] - from[0]) * BOARD_RATIO);

export class DamScene {
  constructor() {
    this.element = node('div', 'workshop-scene dam-scene');
    this.gap = node('div', 'dam-piece dam-gap');
    this.drop = node('div', 'dam-piece dam-drop');
    this.spray = node('div', 'dam-spray');
    this.spray.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 8; index++) this.spray.append(node('i', ''));
    this.target = node('div', 'dam-target');
    this.target.append(this.gap, this.drop, this.spray);
    const bank = node('div', 'dam-choices');
    this.choices = BUTTON_SHAPES.map((shape, color) => {
      const card = node('div', `dam-choice workshop-color-${color}`);
      const piece = node('span', 'dam-piece');
      card.append(piece, node('span', 'workshop-mark', shape));
      bank.append(card);
      return { card, piece };
    });
    this.status = node('strong', 'dam-status');
    this.element.append(this.target, bank, this.status);
  }

  render(puzzle, selected, result, age, motion) {
    if (puzzle !== this.puzzle) {
      this.puzzle = puzzle;
      this.gap.style.clipPath = damOutline(puzzle.profile);
      this.choices.forEach(({ piece }, index) => { piece.style.clipPath = damOutline(puzzle.choices[index]); });
    }
    const dropping = Boolean(result);
    const landed = dropping && (!motion || age >= 250);
    this.choices.forEach(({ card }, index) => {
      card.classList.toggle('is-selected', selected === index);
      card.classList.toggle('is-answer', landed && result.answer === index);
      card.classList.toggle('is-wrong', landed && selected === index && result.answer !== index);
    });
    this.gap.classList.toggle('is-flowing', motion && !landed);
    this.gap.hidden = landed;
    this.drop.hidden = !dropping;
    if (dropping) {
      this.drop.style.clipPath = damOutline(puzzle.choices[result.answer]);
      const fall = motion ? unit(age / 250) : 1;
      const recoil = motion ? Math.sin(Math.PI * unit((age - 250) / 150)) : 0;
      this.drop.style.transform = `translateY(${-145 * (1 - fall ** 2) - recoil * 7}%) scale(${1 + recoil * .065},${1 - recoil * .11})`;
    }
    const spray = unit((age - 250) / 330);
    this.spray.hidden = !motion || !landed || spray >= 1;
    if (!this.spray.hidden) [...this.spray.children].forEach((drop, index) => {
      const direction = index < 4 ? -1 : 1;
      drop.style.transform = `translate(${direction * (25 + index % 4 * 15) * settle(spray)}px,${-Math.sin(Math.PI * spray) * (15 + index % 4 * 5)}px) scale(${1 - spray * .5})`;
      drop.style.opacity = String(1 - spray);
    });
    const label = landed ? 'Leak sealed' : dropping ? 'Revealing' : selected === undefined ? '' : 'Locked in';
    if (this.status.textContent !== label) this.status.textContent = label;
    this.status.hidden = !label;
  }
}

function sushiIcon(item) {
  const icon = node('span', 'sushi-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.style.backgroundPosition = `${item % 3 * 50}% ${Math.floor(item / 3) * 50}%`;
  return icon;
}

export class SushiMenu {
  constructor(element = node('div', 'sushi-menu')) {
    this.element = element;
  }

  render(menu) {
    if (menu === this.source) return;
    this.source = menu;
    this.element.replaceChildren(...menu.map((items, color) => {
      const row = node('div', `sushi-bucket workshop-color-${color}`);
      row.setAttribute('aria-label', `${BUTTON_COLORS[color]} menu`);
      row.append(node('span', 'workshop-mark', BUTTON_SHAPES[color]),
        ...items.map(item => node('span', 'sushi-menu-item', SUSHI_ITEMS[item])));
      return row;
    }));
  }
}

class SushiScene {
  constructor() {
    this.element = node('div', 'workshop-scene sushi-scene');
    this.ticket = node('div', 'sushi-ticket');
    this.outcome = node('strong', 'sushi-outcome');
    this.sparkles = node('div', 'sushi-sparkles');
    this.sparkles.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 5; index++) this.sparkles.append(node('i', '', '✦'));
    this.menu = new SushiMenu();
    this.customer = node('div', 'sushi-customer');
    this.customer.setAttribute('aria-hidden', 'true');
    const counter = node('div', 'sushi-counter');
    counter.append(this.ticket, this.customer, this.sparkles);
    this.element.append(this.menu.element, counter);
  }

  render(run, age, motion, time) {
    this.menu.render(run.menu);
    this.ticket.hidden = run.done && !run.feedback;
    const resolved = ['clear', 'miss'].includes(run.feedback?.kind);
    const holding = resolved && age < SUSHI_SERVE_MS || run.index === run.round.goal;
    const complete = holding && run.feedback?.kind === 'clear';
    const failed = holding && run.feedback?.kind === 'miss';
    const index = Math.min(run.round.goal - 1, Math.max(0, run.index - Number(holding)));
    const order = run.sequence[index];
    const served = holding ? run.lastMask : run.servedMask;
    if (this.order !== order || this.served !== served) {
      this.order = order;
      this.served = served;
      this.slots = order.map((item, index) => {
        const filled = Boolean(served & (1 << index));
        const slot = node('div', `sushi-slot${filled ? ' is-filled' : ''}`);
        slot.append(sushiIcon(item), node('span', '', SUSHI_ITEMS[item]), node('b', 'sushi-check', filled ? '✓' : ''));
        return slot;
      });
      this.ticket.replaceChildren(...this.slots, this.outcome);
    }
    this.ticket.classList.toggle('is-served', complete);
    this.ticket.classList.toggle('is-rejected', failed);
    this.outcome.hidden = !holding;
    this.outcome.textContent = failed ? 'Wrong order' : complete ? 'Served!' : '';
    const entrance = !run.feedback ? unit((time - run.start) / SUSHI_OBSERVE_MS) :
      !holding && resolved ? unit((age - SUSHI_SERVE_MS) / SUSHI_OBSERVE_MS) : 1;
    const cheers = complete && motion && age < 380 ? Math.sin(Math.PI * unit(age / 380)) : 0;
    const recoil = failed && motion ? Math.sin(unit(age / 320) * Math.PI * 5) * (1 - unit(age / 320)) : 0;
    const departure = holding && !run.done && motion ? settle(unit((age - 360) / (SUSHI_SERVE_MS - 360))) : 0;
    const reveal = motion ? orderIn(entrance) : 1;
    this.ticket.style.transform = `translate(${recoil * 5}%,${(1 - reveal) * 18 - cheers * 7 - departure * 12}%) scale(${.82 + reveal * .18 + cheers * .045})`;
    this.ticket.style.opacity = String(1 - departure);
    this.customer.style.transform = `translateY(${(1 - reveal) * 16 - cheers * 9 + departure * 12}%) rotate(${cheers * 5 - recoil * 5}deg) scale(${1 + cheers * .035},${1 - cheers * .04})`;
    this.customer.style.opacity = String(1 - departure);
    const pop = motion && ['hit', 'clear'].includes(run.feedback?.kind) && age < 280 ? Math.sin(Math.PI * unit(age / 280)) : 0;
    const newest = order.findLastIndex((item, slot) => (served & (1 << slot)) && run.menu[run.feedback?.color]?.includes(item));
    this.slots.forEach((slot, index) => {
      const bounce = index === newest ? pop : 0;
      slot.style.transform = `translateY(${-bounce * 8}%) scale(${1 + bounce * .12})`;
    });
    this.sparkles.hidden = !motion || !complete || age < 0 || age >= 380;
    if (!this.sparkles.hidden) [...this.sparkles.children].forEach((spark, index) => {
      const spread = settle(unit(age / 380));
      const angle = (index / 4 * .8 + .1) * Math.PI;
      spark.style.transform = `translate(${Math.cos(angle) * spread * 32}px,${-Math.sin(angle) * spread * 28}px) scale(${1 - spread * .6})`;
      spark.style.opacity = String(1 - unit((age - 160) / 220));
    });
    return this.ticket.hidden ? 'Orders finished' : failed ? 'Wrong order — no retry' : complete ? 'Order served' : `Order: ${order.map((item, slot) => SUSHI_ITEMS[item] + (served & (1 << slot) ? ' served' : '')).join(', ')}`;
  }
}

function rail(from, to) {
  const element = node('div', 'metro-rail');
  const dx = to[0] - from[0], dy = (to[1] - from[1]) / BOARD_RATIO;
  position(element, from);
  element.style.width = `${Math.hypot(dx, dy)}%`;
  element.style.rotate = `${angle(from, to)}rad`;
  return element;
}

export function metroPose(route, elapsed, motion = true) {
  const station = route >= 2 ? metroStation(route) : -1;
  const branch = station >= 0 ? station >> 1 : route;
  const [from, to, fraction] = route === -1 ? [ENTRY, SWITCHES[0], elapsed / METRO_ENTRY_MS] :
    route < 2 ? [SWITCHES[0], SWITCHES[branch + 1], (elapsed - METRO_ENTRY_MS) / (METRO_FORK_MS - METRO_ENTRY_MS)] :
      [SWITCHES[branch + 1], STATIONS[station], (elapsed - METRO_FORK_MS) / (METRO_ARRIVAL_MS - METRO_FORK_MS)];
  const progress = motion || route >= METRO_ARRIVED ? unit(fraction) : Math.floor(unit(fraction) * 5) / 5;
  return { point: from.map((value, index) => lerp(value, to[index], progress)), rotation: angle(from, to) + Math.PI / 2 };
}

class MetroScene {
  constructor() {
    this.element = node('div', 'workshop-scene metro-scene');
    this.board = node('div', 'metro-board');
    this.board.append(rail(ENTRY, SWITCHES[0]));
    this.branches = SWITCHES.map((point, color) => {
      const ends = color === 0 ? SWITCHES.slice(1) : STATIONS.slice(2 * (color - 1), 2 * color);
      const pair = ends.map(end => rail(point, end));
      this.board.append(...pair);
      return pair;
    });
    this.switches = SWITCHES.map((point, color) => {
      const marker = node('span', `metro-switch workshop-color-${color}`, BUTTON_SHAPES[color]);
      position(marker, point);
      this.board.append(marker);
      return marker;
    });
    this.stations = STATIONS.map((point, index) => {
      const station = node('span', 'metro-station', METRO_STATIONS[index]);
      position(station, [point[0], 96]);
      station.setAttribute('aria-label', `${STATION_NAMES[index]} station`);
      this.board.append(station);
      return station;
    });
    this.trainNodes = [];
    this.element.append(this.board);
  }

  render(run, time, motion, terminal) {
    if (run.trains !== this.schedule) {
      this.schedule = run.trains;
      this.trainNodes.forEach(({ element }) => element.remove());
      this.trainNodes = run.trains.map(({ target }) => {
        const element = node('div', 'metro-train');
        const body = node('span', 'metro-engine');
        element.append(body, node('span', 'metro-destination', METRO_STATIONS[target]));
        element.setAttribute('aria-label', `Train for ${STATION_NAMES[target]} station`);
        this.board.append(element);
        return { element, body };
      });
    }
    if (this.switchState !== run.switches) {
      this.switchState = run.switches;
      this.branches.forEach((pair, color) => {
        const setting = (run.switches >> color) & 1;
        pair.forEach((segment, index) => segment.classList.toggle('is-open', index === setting));
        this.switches[color].setAttribute('aria-label', `${BUTTON_COLORS[color]} switch points ${setting ? 'right' : 'left'}`);
      });
    }
    const at = terminal && !run.done ? run.sampleAt ?? time : time;
    const occupied = [false, false, false, false];
    run.trains.forEach(({ at: spawn }, index) => {
      const elapsed = at - run.start - spawn;
      const route = run.routes[index];
      const { element, body } = this.trainNodes[index];
      const dwell = route >= METRO_CRASH ? 420 : METRO_DWELL_MS;
      const arrivalAge = elapsed - METRO_ARRIVAL_MS;
      element.hidden = elapsed < 0 || arrivalAge >= dwell || terminal && route === -1;
      if (element.hidden) return;
      if (route >= METRO_ARRIVED && route < METRO_CRASH) occupied[metroStation(route)] = true;
      const pose = metroPose(route, elapsed, motion);
      position(element, route >= METRO_CRASH ? [pose.point[0], pose.point[1] - 10] : pose.point);
      body.style.rotate = `${pose.rotation}rad`;
      element.classList.toggle('is-wrong', route >= METRO_WRONG && route < METRO_CRASH);
      element.classList.toggle('is-crash', route >= METRO_CRASH);
      element.classList.toggle('is-delivered', route >= METRO_ARRIVED && route < METRO_WRONG);
    });
    this.stations.forEach((station, index) => station.classList.toggle('is-occupied', occupied[index]));
    return run.feedback?.kind === 'crash' ? 'Train collision' : run.feedback?.kind === 'clear' ? 'Passengers delivered' : 'Route trains to matching stations';
  }
}

const SCENES = { [SUSHI_GAME]: SushiScene, [METRO_GAME]: MetroScene };

export class WorkshopStage {
  constructor() {
    this.element = node('div', 'workshop-stage');
    this.response = node('strong', 'workshop-feedback');
    this.response.hidden = true;
    this.element.append(this.response);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  render(round, run, time, elapsed, active, occupied, cleared, terminal) {
    this.element.hidden = !active;
    if (!active) return;
    if (!this.round || this.round.id !== round.id || this.round.game !== round.game) {
      const changedGame = this.round?.game !== round.game;
      this.round = round;
      if (changedGame) {
        this.scene?.element.remove();
        this.scene = new SCENES[round.game]();
        this.element.append(this.scene.element);
      }
      this.preview = createWorkshopRun(round, 0);
    }
    this.scene.element.hidden = !occupied;
    this.response.hidden = true;
    if (!occupied) return;
    const sample = run || this.preview;
    const age = time - (sample.feedback?.at ?? -Infinity);
    const motion = !this.motion?.matches;
    const label = round.game === METRO_GAME ? this.scene.render(sample, run ? time : -1, motion, terminal) : this.scene.render(sample, age, motion, time);
    if (label !== this.label) {
      this.label = label;
      this.element.setAttribute('aria-label', label);
    }
    const feedback = sample.feedback?.kind;
    const symbol = feedback === 'clear' ? SUCCESS : ['crash', 'miss'].includes(feedback) ? FAILURE : '';
    this.response.hidden = !symbol || age < 0 || age >= (round.game === METRO_GAME ? 520 : 420);
    if (!this.response.hidden) {
      this.response.textContent = symbol;
      this.response.classList.toggle('is-wrong', symbol === FAILURE);
      this.response.style.scale = motion ? String(1 + .17 * Math.sin(Math.PI * unit(age / 420))) : '';
    }
  }
}
