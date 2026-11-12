import { ChoiceRun } from './choice-round.js';
import { seededIndex } from './seeded-index.js';
import { ReplayLaneRun, replayLane } from './replay-lane.js';

export const DAM_GAME = 'dam-good-fit';
export const SUSHI_GAME = 'sushi-switchboard';
export const METRO_GAME = 'mole-metro';
export const WORKSHOP_LANES = [SUSHI_GAME, METRO_GAME];
export const WORKSHOP_GAMES = [DAM_GAME, ...WORKSHOP_LANES];
export const WORKSHOP_FINISH_HOLD_MS = 550;
export const WORKSHOP_CONTROLS = {
  [DAM_GAME]: ['Left block', 'Middle block', 'Right block'],
  [SUSHI_GAME]: ['Red menu', 'Green menu', 'Blue menu'],
  [METRO_GAME]: ['Entry switch', 'Left switch', 'Right switch'],
};

export const DAM_SETS = 8;
export const DAM_REVEAL_MS = 900;
const damWindow = (index, difficulty) => 5200 - 470 * index - 150 * (difficulty - 1);
const damDuration = difficulty => Array.from({ length: DAM_SETS }, (_, index) => damWindow(index, difficulty) + DAM_REVEAL_MS).reduce((total, duration) => total + duration, 0);
export const SUSHI_SERVE_MS = 440;
export const SUSHI_RETRY_MS = 360;
export const SUSHI_ITEMS = ['Salmon', 'Tuna', 'Shrimp', 'Egg', 'Eel', 'Cucumber', 'Avocado', 'Roe', 'Inari'];

export const METRO_TRAINS = 12;
export const METRO_PASSENGERS = 3;
export const METRO_STATIONS = ['â˜…', 'â™¥', 'â˜¾', 'âœ¿'];
export const METRO_ENTRY_MS = 1_600;
export const METRO_FORK_MS = 3_000;
export const METRO_ARRIVAL_MS = 4_650;
export const METRO_FIRST_MS = 600;
export const METRO_DWELL_MS = 2_750;
export const METRO_ARRIVED = 6;
export const METRO_WRONG = 10;
export const METRO_CRASH = 14;

const metroHeadway = difficulty => 2_200 - 130 * (difficulty - 1);
const metroDuration = (count, headway) => METRO_FIRST_MS + (count - 1) * headway + METRO_ARRIVAL_MS + 700;

export const WORKSHOP_SETTINGS = {
  [DAM_GAME]: { goal: DAM_SETS, duration: damDuration(1) },
  [SUSHI_GAME]: { goal: 10, duration: 36_000 },
  [METRO_GAME]: { goal: METRO_TRAINS * METRO_PASSENGERS, duration: metroDuration(METRO_TRAINS, metroHeadway(1)) },
};

export function workshopSettings(game, seed, difficulty) {
  const settings = { seed, difficulty, ...WORKSHOP_SETTINGS[game] };
  if (game === DAM_GAME) settings.duration = damDuration(difficulty);
  if (game === METRO_GAME) {
    settings.trainCount = METRO_TRAINS;
    settings.headway = metroHeadway(difficulty);
    settings.duration = metroDuration(settings.trainCount, settings.headway);
  }
  return settings;
}

export function damPuzzles(round) {
  const pick = seededIndex(round.seed);
  return Array.from({ length: round.goal }, () => {
    const profile = Array.from({ length: 8 }, () => pick(3));
    const correct = pick(3);
    const first = pick(8);
    const second = (first + 1 + pick(7)) % 8;
    const choices = [0, 1, 2].map(color => {
      if (color === correct) return profile;
      const candidate = [...profile];
      const point = color === (correct + 1) % 3 ? first : second;
      const difference = round.difficulty < 3 ? 2 : 1;
      candidate[point] = (candidate[point] + difference) % 3;
      if (round.difficulty < 2) candidate[(point + 4) % 8] = (candidate[(point + 4) % 8] + 1) % 3;
      return candidate;
    });
    return { profile, choices, correct };
  });
}

export function damOutline(profile) {
  const top = profile.slice(0, 4).map((height, index) => `${index * 25 + 12.5}% ${8 + height * 12}%`);
  const bottom = profile.slice(4).map((height, index) => `${87.5 - index * 25}% ${92 - height * 12}%`);
  return `polygon(0 34%, ${top.join(', ')}, 100% 34%, 100% 66%, ${bottom.join(', ')}, 0 66%)`;
}

export function sushiMenu(round) {
  const pick = seededIndex(round.seed ^ 0xb935de27);
  const items = SUSHI_ITEMS.map((_, index) => index);
  for (let index = items.length - 1; index > 0; index--) {
    const other = pick(index + 1);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return [items.slice(0, 3), items.slice(3, 6), items.slice(6)];
}

export function sushiOrders(round, menu) {
  const pick = seededIndex(round.seed);
  let previous = -1;
  return Array.from({ length: round.goal }, (_, index) => {
    const first = (previous + 1 + pick(SUSHI_ITEMS.length - 1)) % SUSHI_ITEMS.length;
    previous = first;
    if (index === 0 || index % (4 + round.difficulty) === 0) return [first];
    const color = menu.findIndex(bucket => bucket.includes(first));
    const options = index % 3 === 1 ? menu[color].filter(item => item !== first) : menu.filter((_, i) => i !== color).flat();
    return [first, options[pick(options.length)]];
  });
}

export function damStages(round, window = index => damWindow(index, round.difficulty)) {
  let startsAt = 0;
  return damPuzzles(round).map(({ correct, ...puzzle }, index) => {
    const answerEnd = startsAt + window(index);
    const stage = { index, startsAt, answerAt: startsAt, answerEnd, endsAt: answerEnd + DAM_REVEAL_MS, puzzle: { ...puzzle, answer: correct } };
    startsAt = stage.endsAt;
    return stage;
  });
}

export class DamRun extends ChoiceRun {
  constructor(round, start) {
    super(round, start, damStages(round));
  }
}

export class SushiRun extends ReplayLaneRun {
  constructor(round, start) {
    super(round, start);
    this.menu = sushiMenu(round);
    this.sequence = sushiOrders(round, this.menu);
    this.servedMask = 0;
    this.blockedUntil = start + 250;
  }

  resolve(color, time) {
    const order = this.sequence[this.cleared];
    const completeMask = (1 << order.length) - 1;
    const slot = order.findIndex((item, index) => !(this.servedMask & (1 << index)) && this.menu[color].includes(item));
    if (slot === -1) {
      this.blockedUntil = time + SUSHI_RETRY_MS;
      return this.miss(time, color);
    }
    this.servedMask |= 1 << slot;
    const served = this.servedMask === completeMask;
    this.feedback = { kind: served ? 'clear' : 'hit', at: time, color };
    if (!served) return 'move';
    this.servedMask = 0;
    this.blockedUntil = time + SUSHI_SERVE_MS;
    return 'clear';
  }
}

export function metroSchedule(round) {
  const pick = seededIndex(round.seed);
  let previous = pick(4);
  return Array.from({ length: round.trainCount }, (_, index) => {
    previous = (previous + 1 + pick(3)) % 4;
    return { target: previous, at: METRO_FIRST_MS + index * round.headway };
  });
}

export function metroStation(route) {
  return (route - 2) % METRO_STATIONS.length;
}

export class MetroRun extends ReplayLaneRun {
  constructor(round, start) {
    super(round, start);
    this.trains = metroSchedule(round);
    this.routes = this.trains.map(() => -1);
    this.switches = round.seed & 7;
    this.occupiedUntil = METRO_STATIONS.map(() => 0);
    this.timeline = this.trains.flatMap(({ at }, train) =>
      [METRO_ENTRY_MS, METRO_FORK_MS, METRO_ARRIVAL_MS].map((offset, junction) => ({ at: at + offset, train, junction })))
      .sort((a, b) => a.at - b.at);
    this.next = 0;
  }

  advance(time) {
    if (this.done) return;
    const elapsed = this.offsetUs(Math.min(time, this.end)) / 1000;
    while (this.timeline[this.next]?.at <= elapsed) {
      const { at, train, junction } = this.timeline[this.next++];
      if (junction === 0) this.routes[train] = this.switches & 1;
      else if (junction === 1) {
        const branch = this.routes[train];
        this.routes[train] = 2 + 2 * branch + ((this.switches >> (1 + branch)) & 1);
      } else this.arrive(train, at);
    }
    if (elapsed >= this.round.duration) {
      this.done = true;
      this.elapsed = this.round.duration;
    }
  }

  arrive(train, elapsed) {
    const station = metroStation(this.routes[train]);
    const blocked = elapsed < this.occupiedUntil[station];
    const delivered = !blocked && station === this.trains[train].target;
    if (!blocked) this.occupiedUntil[station] = elapsed + METRO_DWELL_MS;
    this.routes[train] = station + (blocked ? METRO_CRASH : delivered ? METRO_ARRIVED : METRO_WRONG);
    const at = this.start + elapsed;
    if (delivered) {
      this.cleared += METRO_PASSENGERS;
      this.feedback = { kind: 'clear', at };
      this.events.push({ type: 'stageComplete', at });
    } else {
      this.mistakes++;
      this.feedback = { kind: blocked ? 'crash' : 'miss', at };
      this.events.push({ type: 'stageWrong', at });
    }
  }

  resolve(color) {
    this.switches ^= 1 << color;
    return 'move';
  }
}

const RUNS = { [SUSHI_GAME]: SushiRun, [METRO_GAME]: MetroRun };

export function createWorkshopRun(round, start) {
  return new RUNS[round.game](round, start);
}

export function validWorkshopResult(round, { proof, cleared, elapsed, mistakes }) {
  const replay = replayLane(round, proof, createWorkshopRun);
  if (!replay) return false;
  if (round.game === METRO_GAME) replay.advance(round.duration);
  return replay.done && replay.cleared === cleared && replay.elapsed === elapsed && replay.mistakes === mistakes;
}
