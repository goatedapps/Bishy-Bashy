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
  return layout.reels[reel][Math.floor(Math.max(0, elapsed) / stepMs) % FACE_NAMES.length];
}

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
    this.lastTap = -Infinity;
    this.missedFace = null;
    this.done = false;
    this.elapsed = null;
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || time < this.start || time >= this.end || time < this.blockedUntil || time - this.lastTap < INPUT_GUARD_MS) return { type: 'ignored' };
    this.lastTap = time;
    const face = reelFace(this.layout, this.cleared, time - this.start, this.stepMs);
    if (face !== this.layout.target) {
      this.missedFace = face;
      this.mistakes++;
      this.blockedUntil = time + this.retryMs;
      return { type: 'slotMiss' };
    }
    this.cleared++;
    this.missedFace = null;
    if (this.cleared === REEL_COUNT) {
      this.done = true;
      this.elapsed = time - this.start;
      return { type: 'finished', elapsed: this.elapsed };
    }
    return { type: 'slotLock' };
  }
}
