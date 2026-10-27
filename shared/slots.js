export const SLOT_GAME = 'facial-slot-machine';
export const SLOT_DURATION_MS = 30_000;
export const FACE_NAMES = ['Robot', 'Frog', 'Lion', 'Cat', 'Yeti', 'Octopus'];
export const REEL_COUNT = 3;
export const RETRY_MS = 450;
export const INPUT_GUARD_MS = 120;

function random(seed) {
  let state = seed >>> 0;
  return max => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) % max;
  };
}

export function slotLayout(seed) {
  const pick = random(seed);
  const target = pick(FACE_NAMES.length);
  const reels = Array.from({ length: REEL_COUNT }, () => {
    const faces = FACE_NAMES.map((_, index) => index);
    for (let index = faces.length - 1; index > 0; index--) {
      const other = pick(index + 1);
      [faces[index], faces[other]] = [faces[other], faces[index]];
    }
    if (faces[0] === target) [faces[0], faces[1]] = [faces[1], faces[0]];
    return faces;
  });
  return { target, reels };
}

export function reelFace(layout, reel, elapsed, stepMs) {
  return layout.reels[reel][Math.floor(Math.max(0, elapsed) / stepMs + .5) % FACE_NAMES.length];
}

export const maskCount = mask => (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
export const validReelMask = (mask, cleared) => Number.isInteger(mask) && mask >= 0 && mask <= 7 && maskCount(mask) === cleared;

export class SlotRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.layout = slotLayout(round.seed);
    this.stepMs = round.stepMs;
    this.retryMs = round.retryMs;
    this.cleared = 0;
    this.mistakes = 0;
    this.blockedUntil = 0;
    this.reelMask = 0;
    this.blockedReels = [0, 0, 0];
    this.lastTaps = [-Infinity, -Infinity, -Infinity];
    this.missedFaces = [null, null, null];
    this.pausedMs = [0, 0, 0];
    this.stoppedAt = [0, 0, 0];
    this.done = false;
    this.elapsed = null;
  }

  reelElapsed(color, time) {
    if ((this.reelMask & (1 << color)) || time < this.blockedReels[color]) return this.stoppedAt[color];
    return Math.max(0, time - this.start - this.pausedMs[color]);
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || time < this.start || time >= this.end || (this.reelMask & (1 << color)) || time < this.blockedReels[color] || time - this.lastTaps[color] < INPUT_GUARD_MS) return { type: 'ignored' };
    this.lastTaps[color] = time;
    const elapsed = this.reelElapsed(color, time);
    const face = reelFace(this.layout, color, elapsed, this.stepMs);
    this.stoppedAt[color] = elapsed;
    if (face !== this.layout.target) {
      this.missedFaces[color] = face;
      this.mistakes++;
      this.blockedReels[color] = time + this.retryMs;
      this.pausedMs[color] += this.retryMs;
      return { type: 'slotMiss' };
    }
    this.reelMask |= 1 << color;
    this.cleared = maskCount(this.reelMask);
    this.missedFaces[color] = null;
    if (this.cleared === REEL_COUNT) {
      this.done = true;
      this.elapsed = time - this.start;
      return { type: 'finished', elapsed: this.elapsed };
    }
    return { type: 'slotLock' };
  }
}
