export const WITCH_GAME = 'witch-delivery';
export const WITCH_DURATION_MS = 20000;
export const WITCH_GOAL = 240;
export const WITCH_GRAVITY = 400;
export const WITCH_THROW_SCALE = 5.5;
export const WITCH_ROAD = 234;
export const FROG_SPACING = 14;
export const WITCH_HOLD_MS = 2200;
const ANGLE_RATE = 55;
export const witchRunSpeed = presses => .2 * presses + .02 * presses * presses;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export class WitchRun {
  constructor(round = {}, start = 0) {
    this.start = start; this.end = start + WITCH_DURATION_MS;
    this.at = start; this.presses = 0; this.x = 0; this.speed = 0; this.power = 0; this.angle = 0;
    this.state = 'run'; this.lastColor = -1; this.lastTap = -Infinity;
    this.pressedMask = 0; this.actions = []; this.events = [];
    this.cleared = 0; this.mistakes = 0; this.done = false; this.elapsed = null;
    this.launchAt = null; this.landAt = null; this.stopX = 0; this.targetX = WITCH_ROAD + FROG_SPACING;
  }
  advance(time) {
    if (!Number.isFinite(time) || time < this.at || this.done) return;
    const until = Math.min(time, this.end);
    const seconds = Math.max(0, until - this.at) / 1000;
    if (this.state === 'run') {
      const distance = this.speed * seconds;
      if (this.x + distance >= WITCH_ROAD) {
        const crossing = (WITCH_ROAD - this.x) / this.speed;
        this.x = WITCH_ROAD; this.state = 'fall'; this.failure = 'overrun'; this.speed = 0;
        this.landAt = this.at + crossing * 1000 + 900;
      } else { this.x += distance; }
    } else if (this.state === 'aim') this.angle = Math.min(90, this.angle + seconds * ANGLE_RATE);
    this.at = until;
    if (['fly', 'fall'].includes(this.state) && until + 1e-6 >= this.landAt) {
      this.state = this.state === 'fly' ? 'land' : 'failed';
      this.done = true; this.elapsed = this.landAt - this.start;
      this.cleared = this.state === 'land' ? this.frogs : 0;
      this.mistakes = this.state === 'failed' ? 1 : 0;
      this.events.push({ type: this.state === 'land' ? 'stageComplete' : 'stageWrong', at: this.landAt, final: true });
    }
    if (!this.done && time >= this.end) {
      this.state = 'failed'; this.failure = 'timeout'; this.done = true; this.elapsed = WITCH_DURATION_MS; this.cleared = 0; this.mistakes = 1;
      this.events.push({ type: 'stageWrong', at: this.end, final: true });
    }
  }
  tap(color, time) {
    if (![0, 1, 2].includes(color) || !Number.isFinite(time) || time < this.start || time < this.at || time >= this.end || this.done || this.actions.length >= 499) return { type: 'ignored' };
    this.advance(time);
    if (this.done) return { type: 'ignored' };
    if (color === 1) {
      if (this.state !== 'run') return { type: 'ignored' };
      this.power = this.speed; this.angle = 0; this.pressedMask = 2; this.state = 'aim';
    } else {
      if (this.state !== 'run' || time - this.lastTap < 40 || color === this.lastColor) return { type: 'ignored' };
      this.lastColor = color; this.lastTap = time; this.speed = witchRunSpeed(++this.presses);
    }
    this.actions.push([time - this.start, color, 0]);
    return { type: 'move' };
  }
  release(color, time, cancel = false) {
    if (color !== 1 || !Number.isFinite(time) || time < this.at || this.done || !(this.pressedMask & 2)) return { type: 'ignored' };
    this.advance(time); this.pressedMask = 0;
    if (this.done) return { type: 'ignored' };
    this.actions.push([time - this.start, 1, cancel ? 2 : 1]);
    if (cancel) { this.state = 'run'; this.angle = 0; return { type: 'move' }; }
    if (this.state !== 'aim') return { type: 'ignored' };
    this.launchAt = time;
    const radians = this.angle * Math.PI / 180, velocity = this.power * WITCH_THROW_SCALE;
    this.stopX = this.x + 10 + 11 * Math.cos(radians);
    this.launchHeight = 34 + 11 * Math.sin(radians);
    const vertical = velocity * Math.sin(radians);
    this.flightSeconds = (vertical + Math.sqrt(vertical * vertical + 2 * WITCH_GRAVITY * this.launchHeight)) / WITCH_GRAVITY;
    const rawX = this.stopX + velocity * Math.cos(radians) * this.flightSeconds;
    this.frogs = clamp(Math.floor((rawX - WITCH_ROAD) / FROG_SPACING) - 1, 0, WITCH_GOAL);
    this.targetX = WITCH_ROAD + (this.frogs + 1) * FROG_SPACING;
    this.landAt = time + this.flightSeconds * 1000;
    this.state = 'fly'; this.events.push({ type: 'witchLaunch', at: time });
    return { type: 'move' };
  }
  get proof() { return this.actions.map(action => [...action]); }
}

export function replayWitch(actions, sample) {
  if (!Array.isArray(actions) || actions.length > 500 || !Number.isFinite(sample) || sample < 0 || sample > WITCH_DURATION_MS) return null;
  const run = new WitchRun({}, 0);
  let previous = -1;
  for (const action of actions) {
    if (!Array.isArray(action) || action.length !== 3) return null;
    const [at, color, release] = action;
    if (!Number.isFinite(at) || at < previous || at > sample || ![0, 1, 2].includes(color) || ![0, 1, 2].includes(release) || release && color !== 1) return null;
    const before = run.actions.length;
    if (release) run.release(color, at, release === 2); else run.tap(color, at);
    if (run.actions.length !== before + 1) return null;
    previous = at;
  }
  run.advance(sample);
  return run;
}

export function witchFlight(run, time) {
  if (run.launchAt === null) return null;
  const progress = clamp((time - run.launchAt) / (run.landAt - run.launchAt), 0, 1);
  const seconds = progress * run.flightSeconds;
  const x = run.stopX + (run.targetX - run.stopX) * progress;
  const y = Math.max(0, run.launchHeight + run.power * WITCH_THROW_SCALE * Math.sin(run.angle * Math.PI / 180) * seconds - WITCH_GRAVITY / 2 * seconds * seconds);
  const passed = Math.min(run.frogs, Math.max(0, Math.floor((x - WITCH_ROAD) / FROG_SPACING)));
  return { x, y, progress, passed };
}

export function witchPose(run, time) {
  // Advance an isolated cosmetic copy; spectators never mutate an authoritative run.
  const copy = Object.assign(Object.create(WitchRun.prototype), run, { actions: [], events: [] });
  copy.advance(time);
  return copy;
}
