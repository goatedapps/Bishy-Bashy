import { DAM_GAME, DAM_FALL_MS, DAM_SETTLE_MS, METRO_GAME, METRO_ARRIVAL_MS, METRO_ARRIVED, METRO_CRASH, METRO_DWELL_MS,
  METRO_ENTRY_MS, METRO_FORK_MS, METRO_STATIONS, METRO_WRONG, SUSHI_GAME, SUSHI_ITEMS, SUSHI_SERVE_MS,
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

class DamScene {
  constructor() {
    this.element = node('div', 'workshop-scene dam-scene');
    this.gap = node('div', 'dam-piece dam-gap');
    this.drop = node('div', 'dam-piece dam-drop');
    this.target = node('div', 'dam-target');
    this.target.append(this.gap, this.drop);
    const bank = node('div', 'dam-choices');
    this.choices = BUTTON_SHAPES.map((shape, color) => {
      const card = node('div', `dam-choice workshop-color-${color}`);
      const piece = node('span', 'dam-piece');
      card.append(piece, node('span', 'workshop-mark', shape));
      bank.append(card);
      return { card, piece };
    });
    this.element.append(this.target, bank);
  }

  render(run, age, motion) {
    const final = run.cleared === run.round.goal;
    const sealed = final || run.feedback?.kind === 'clear' && age < DAM_SETTLE_MS;
    const dropping = run.feedback?.kind === 'hit';
    const failed = run.feedback?.kind === 'miss' && age < 540;
    const index = sealed ? run.cleared - 1 : run.cleared;
    const puzzle = run.sequence[index];
    const color = final ? puzzle.correct : run.feedback?.color;
    if (puzzle !== this.puzzle) {
      this.puzzle = puzzle;
      this.gap.style.clipPath = damOutline(puzzle.profile);
      this.choices.forEach(({ piece }, index) => { piece.style.clipPath = damOutline(puzzle.choices[index]); });
    }
    this.choices.forEach(({ card }, index) => {
      card.classList.toggle('is-selected', index === color && (sealed || failed || dropping));
      card.classList.toggle('is-wrong', index === color && failed);
    });
    this.gap.classList.toggle('is-flowing', motion && !sealed);
    this.drop.hidden = !sealed && !failed && !dropping;
    if (!this.drop.hidden) {
      this.drop.style.clipPath = damOutline(puzzle.choices[color]);
      const fall = unit(age / DAM_FALL_MS);
      const bounce = failed ? Math.sin(Math.PI * unit((age - DAM_FALL_MS) / 360)) : 0;
      this.drop.style.transform = motion ? `translateY(${-160 * (1 - fall ** 2) - 76 * bounce}%) rotate(${failed ? 15 * bounce : 0}deg)` : '';
      this.drop.style.opacity = failed && motion ? String(1 - unit((age - 320) / 210)) : '1';
    }
    return sealed ? 'Leak sealed' : failed ? 'The block did not fit' : 'Choose the block that matches the leak';
  }
}

function sushiIcon(item) {
  const icon = node('span', 'sushi-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.style.backgroundPosition = `${item % 3 * 50}% ${Math.floor(item / 3) * 50}%`;
  return icon;
}

class SushiScene {
  constructor() {
    this.element = node('div', 'workshop-scene sushi-scene');
    this.ticket = node('div', 'sushi-ticket');
    this.menu = node('div', 'sushi-menu');
    this.element.append(this.ticket, this.menu);
  }

  render(run, age, motion) {
    if (run.menu !== this.menuSource) {
      this.menuSource = run.menu;
      this.menu.replaceChildren(...run.menu.map((items, color) => {
        const row = node('div', `sushi-bucket workshop-color-${color}`);
        row.setAttribute('aria-label', `${BUTTON_COLORS[color]} menu`);
        row.append(node('span', 'workshop-mark', BUTTON_SHAPES[color]),
          ...items.map(item => node('span', 'sushi-menu-item', SUSHI_ITEMS[item])));
        return row;
      }));
    }
    const complete = run.cleared === run.round.goal || run.feedback?.kind === 'clear' && age < SUSHI_SERVE_MS;
    const index = complete ? run.cleared - 1 : run.cleared;
    const order = run.sequence[index];
    const served = complete ? (1 << order.length) - 1 : run.servedMask;
    if (this.order !== order || this.served !== served) {
      this.order = order;
      this.served = served;
      this.ticket.replaceChildren(...order.map((item, index) => {
        const filled = Boolean(served & (1 << index));
        const slot = node('div', `sushi-slot${filled ? ' is-filled' : ''}`);
        slot.append(sushiIcon(item), node('span', '', SUSHI_ITEMS[item]), node('b', 'sushi-check', filled ? '✓' : ''));
        return slot;
      }));
    }
    this.ticket.classList.toggle('is-served', complete);
    this.ticket.style.translate = complete && motion ? `0 ${-6 * Math.sin(Math.PI * unit(age / SUSHI_SERVE_MS))}%` : '';
    return complete ? 'Order served' : `Order: ${order.map((item, slot) => SUSHI_ITEMS[item] + (served & (1 << slot) ? ' served' : '')).join(', ')}`;
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

const SCENES = { [DAM_GAME]: DamScene, [SUSHI_GAME]: SushiScene, [METRO_GAME]: MetroScene };

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
    const label = round.game === METRO_GAME ? this.scene.render(sample, run ? time : -1, motion, terminal) : this.scene.render(sample, age, motion);
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
