export const SESAME_GAME = 'open-sesame';
export const SESAME_GOAL = 8;
export const SESAME_DURATION_MS = 30_000;
export const SESAME_DIGITS = '1234567890';
const INPUT_MS = 40;
const FEEDBACK_MS = 280;

export function sesameTarget(seed) {
  let state = seed >>> 0;
  return Array.from({ length: SESAME_GOAL }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return SESAME_DIGITS[Math.floor(state / 0x100000000 * SESAME_DIGITS.length)];
  }).join('');
}

export class SesameRun {
  constructor(round, start) {
    this.target = sesameTarget(round.seed);
    this.start = start;
    this.end = start + SESAME_DURATION_MS;
    this.lastInputUs = -Infinity;
    this.cursor = 0;
    this.cleared = 0;
    this.mistakes = 0;
    this.done = false;
    this.elapsed = null;
    this.feedback = null;
    this.proof = [];
  }

  tap(color, time) {
    if (this.done || ![0, 1, 2].includes(color) || !Number.isFinite(time) || time < this.start) return { type: 'ignored' };
    const elapsedUs = Math.round((time - this.start) * 1000);
    if (elapsedUs >= SESAME_DURATION_MS * 1000 || elapsedUs - this.lastInputUs < INPUT_MS * 1000) return { type: 'ignored' };
    this.lastInputUs = elapsedUs;
    // Integer microseconds keep a full-speed input history inside the WebSocket limit.
    this.proof.push([color, elapsedUs]);
    if (color !== 1) {
      this.cursor = (this.cursor + (color === 0 ? -1 : 1) + SESAME_DIGITS.length) % SESAME_DIGITS.length;
      return { type: 'move' };
    }
    const correct = SESAME_DIGITS[this.cursor] === this.target[this.cleared];
    this.feedback = { correct, cursor: this.cursor, until: time + FEEDBACK_MS };
    if (!correct) {
      this.mistakes++;
      return { type: 'mistake' };
    }
    if (++this.cleared < SESAME_GOAL) return { type: 'digit' };
    this.done = true;
    this.elapsed = elapsedUs / 1000;
    return { type: 'finished', elapsed: this.elapsed };
  }
}

export function validSesameResult(round, { proof, elapsed, mistakes }) {
  if (!Array.isArray(proof) || proof.length > SESAME_DURATION_MS / INPUT_MS) return false;
  const replay = new SesameRun(round, 0);
  for (const entry of proof) {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[1]) ||
      replay.tap(entry[0], entry[1] / 1000).type === 'ignored') return false;
  }
  return replay.done && replay.elapsed === elapsed && replay.mistakes === mistakes;
}
