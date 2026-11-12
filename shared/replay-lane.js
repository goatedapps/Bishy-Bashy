const INPUT_GAP_US = 75_000;
const COLORS = [0, 1, 2];

export class ReplayLaneRun {
  constructor(round, start) {
    this.round = round;
    this.start = start;
    this.end = start + round.duration;
    this.cleared = 0;
    this.mistakes = 0;
    this.done = false;
    this.elapsed = null;
    this.feedback = null;
    this.blockedUntil = start;
    this.events = [];
    this.proof = [];
  }

  offsetUs(time) { return Math.round((time - this.start) * 1000); }

  tap(color, time) {
    if (this.done || !COLORS.includes(color) || !Number.isFinite(time) || time < this.start) return { type: 'ignored' };
    const elapsedUs = this.offsetUs(time);
    time = this.start + elapsedUs / 1000;
    if (elapsedUs >= this.round.duration * 1000) return { type: 'ignored' };
    this.advance?.(time);
    const previous = this.proof.at(-1);
    if (this.done || elapsedUs < this.offsetUs(this.blockedUntil) || previous && elapsedUs - previous[1] < INPUT_GAP_US) return { type: 'ignored' };
    this.proof.push([color, elapsedUs]);
    const type = this.resolve(color, time);
    if (type !== 'clear') return { type };
    return this.clear(time);
  }

  clear(time) {
    if (++this.cleared < this.round.goal) {
      this.events.push({ type: 'stageComplete', at: time });
      return { type: 'clear' };
    }
    this.done = true;
    this.elapsed = this.offsetUs(time) / 1000;
    return { type: 'finished', elapsed: this.elapsed };
  }

  miss(time, color) {
    this.mistakes++;
    this.feedback = { kind: 'miss', at: time, ...(color === undefined ? {} : { color }) };
    this.events.push({ type: 'stageWrong', at: time });
    return 'mistake';
  }
}

export function replayLane(round, proof, createRun) {
  if (!Array.isArray(proof) || proof.length > Math.ceil(round.duration * 1000 / INPUT_GAP_US)) return null;
  const run = createRun(round, 0);
  for (const entry of proof) {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isSafeInteger(entry[1]) ||
        run.tap(entry[0], entry[1] / 1000).type === 'ignored') return null;
  }
  return run;
}
