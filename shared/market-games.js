import { seededIndex } from './seeded-index.js';
import { ReplayLaneRun, replayLane } from './replay-lane.js';

export const SATAY_GAME = 'satay-snag';
export const POTION_GAME = 'glamour-brew';
export const ANT_GAME = 'ant-air-mail';
export const MARKET_GAMES = Object.freeze([SATAY_GAME, POTION_GAME, ANT_GAME]);
export const MARKET_FINISH_HOLD_MS = 550;
export const MARKET_SETTINGS = Object.freeze({
  [SATAY_GAME]: { goal: 10, duration: 30_000 },
  [POTION_GAME]: { goal: 10, duration: 30_000 },
  [ANT_GAME]: { goal: 12, duration: 25_000 },
});
export const MARKET_CONTROLS = Object.freeze({
  [SATAY_GAME]: ['Skewer', 'Skewer', 'Skewer'],
  [POTION_GAME]: ['Heart', 'Herb', 'Moon'],
  [ANT_GAME]: ['Left', 'Down', 'Right'],
});

const FIRST_DROP_MS = 350;
const NEXT_DROP_MS = 340;
export const POTION_REFILL_MS = 440;
export const ANT_LEG_MS = 480;
const MISTAKE_MS = 420;
const COLORS = [0, 1, 2];

export function marketSettings(game, seed, difficulty) {
  return { seed, difficulty, ...MARKET_SETTINGS[game],
    ...(game === SATAY_GAME ? { catchWindow: 50 - 7 * (difficulty - 1) } : {}) };
}

export function satayDropMs(round, index) {
  const pick = seededIndex((round.seed + Math.imul(index, 0x9e3779b9)) >>> 0);
  return 690 + pick(181) - (round.difficulty - 1) * 32;
}

export function potionWaves(round) {
  const pick = seededIndex(round.seed);
  return Array.from({ length: round.goal }, (_, index) => {
    const left = pick(3);
    const right = (left + 1 + pick(2)) % 3;
    const max = Math.min(3, 1 + Math.floor((index + round.difficulty) / 2));
    const leftMask = (1 << (1 + pick(max))) - 1;
    const rightMask = (1 << (1 + pick(max))) - 1;
    return { colors: [left, right], mask: leftMask | (rightMask << 3) };
  });
}

export const ANT_STEPS = [[-1, 0], [0, 1], [1, 0]];

export function antCourse(round) {
  const pick = seededIndex(round.seed);
  const directions = [];
  const waypoints = [[0, 0]];
  for (let index = 0; index < round.goal; index++) {
    const last = directions.at(-1);
    const [x, y] = waypoints.at(-1);
    const options = COLORS.filter(color => {
      if (index > 1 && color === last && color === directions.at(-2)) return false;
      if (last !== 1 && last !== undefined && color === 2 - last) return false;
      return Math.abs(x + ANT_STEPS[color][0]) <= 2;
    });
    const color = options[pick(options.length)];
    const [dx, dy] = ANT_STEPS[color];
    directions.push(color);
    waypoints.push([x + dx, y + dy]);
  }
  return { directions, waypoints };
}

export class SatayRun extends ReplayLaneRun {
  constructor(round, start) {
    super(round, start);
    this.index = 0;
    this.launchedAt = start + FIRST_DROP_MS;
    this.blockedUntil = this.launchedAt;
    this.nextAt = null;
  }

  get catchAt() { return this.launchedAt + satayDropMs(this.round, this.index); }

  advance(time) {
    const until = this.offsetUs(Math.min(time, this.end));
    while (!this.done) {
      if (this.nextAt !== null) {
        if (until < this.offsetUs(this.nextAt)) return;
        this.launchedAt = this.nextAt;
        this.index++;
        this.nextAt = null;
      }
      const closesAt = this.catchAt + this.round.catchWindow;
      if (until <= this.offsetUs(closesAt)) return;
      this.miss(closesAt);
      this.blockedUntil = this.nextAt = closesAt + NEXT_DROP_MS;
    }
  }

  resolve(color, time) {
    const caught = this.offsetUs(time) >= this.offsetUs(this.catchAt - this.round.catchWindow);
    this.blockedUntil = this.nextAt = (caught ? time : this.catchAt + this.round.catchWindow) + NEXT_DROP_MS;
    if (!caught) return this.miss(time, color);
    this.feedback = { kind: 'catch', at: time, color };
    return 'clear';
  }
}

export class PotionRun extends ReplayLaneRun {
  constructor(round, start) {
    super(round, start);
    this.sequence = potionWaves(round);
    this.index = 0;
    this.bottleMask = this.sequence[0].mask;
    this.blockedUntil = start + 450;
  }

  advance(time) {
    if (!this.done && this.bottleMask === 0 && this.offsetUs(time) >= this.offsetUs(this.blockedUntil)) {
      this.index++;
      this.bottleMask = this.sequence[this.index].mask;
    }
  }

  resolve(color, time) {
    const side = this.sequence[this.index].colors.indexOf(color);
    const stack = side < 0 ? 0 : this.bottleMask & (7 << (side * 3));
    if (stack === 0) {
      this.blockedUntil = time + MISTAKE_MS;
      return this.miss(time, color);
    }
    this.bottleMask ^= 1 << (31 - Math.clz32(stack));
    this.feedback = { kind: 'burst', at: time, color };
    this.events.push({ type: 'potionBurst', at: time, preserveTail: this.cleared + 1 === this.round.goal && this.bottleMask === 0 });
    if (this.bottleMask !== 0) return 'move';
    this.blockedUntil = time + POTION_REFILL_MS;
    return 'clear';
  }
}

export class AntRun extends ReplayLaneRun {
  constructor(round, start) {
    super(round, start);
    const { directions, waypoints } = antCourse(round);
    this.sequence = directions;
    this.waypoints = waypoints;
    this.blockedUntil = start + 450;
  }

  resolve(color, time) {
    const correct = color === this.sequence[this.cleared];
    this.blockedUntil = time + (correct ? ANT_LEG_MS : MISTAKE_MS);
    if (!correct) return this.miss(time, color);
    this.feedback = { kind: 'clear', at: time, color };
    return 'clear';
  }
}

const RUNS = { [SATAY_GAME]: SatayRun, [POTION_GAME]: PotionRun, [ANT_GAME]: AntRun };

export function createMarketRun(round, start) {
  return new RUNS[round.game](round, start);
}

export function validMarketResult(round, { proof, elapsed, mistakes }) {
  const replay = replayLane(round, proof, createMarketRun);
  return Boolean(replay?.done && replay.elapsed === elapsed && replay.mistakes === mistakes);
}
