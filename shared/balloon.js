export const BALLOON_GAME = 'burst-the-balloon';
export const BALLOON_GOAL = 60;
export const BALLOON_DURATION_MS = 25_000;
export const BALLOON_POP_MS = 550;
const PUMP_INTERVAL_US = 40_000;

export class BalloonRun {
  constructor(round, start) {
    this.start = start;
    this.end = start + BALLOON_DURATION_MS;
    this.cleared = 0;
    this.mistakes = 0;
    this.done = false;
    this.elapsed = null;
    this.feedback = null;
    this.proof = [];
  }

  tap(color, time) {
    if (this.done || ![0, 2].includes(color) || !Number.isFinite(time) || time < this.start) return { type: 'ignored' };
    const elapsedUs = Math.round((time - this.start) * 1000);
    const previous = this.proof.at(-1);
    if (elapsedUs >= BALLOON_DURATION_MS * 1000 ||
      previous && (color === previous[0] || elapsedUs - previous[1] < PUMP_INTERVAL_US)) return { type: 'ignored' };
    this.proof.push([color, elapsedUs]);
    this.done = ++this.cleared === BALLOON_GOAL;
    this.feedback = { kind: this.done ? 'burst' : 'hit', at: time, color };
    if (!this.done) return { type: 'move' };
    this.elapsed = elapsedUs / 1000;
    return { type: 'finished', elapsed: this.elapsed };
  }
}

export function validBalloonResult(round, { proof, elapsed }) {
  if (!Array.isArray(proof) || proof.length !== BALLOON_GOAL) return false;
  const replay = new BalloonRun(round, 0);
  for (const entry of proof) {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[1]) ||
      replay.tap(entry[0], entry[1] / 1000).type === 'ignored') return false;
  }
  return replay.done && replay.elapsed === elapsed;
}
