import { HorseRun } from '../../shared/horse.js';

export function driveHorse(round, { start = 0, delay = 0 } = {}) {
  const run = new HorseRun(round, start);
  for (let elapsed = 0; elapsed < round.duration && !run.done; elapsed += 50) {
    const at = start + elapsed;
    run.advance(at);
    const wave = run.traffic[run.index];
    if (wave && run.position !== wave.safe) run.tap(run.position > wave.safe ? 0 : 2, at);
    if (elapsed >= delay && elapsed % 200 === 0) run.tap(1, at);
  }
  run.advance(run.end);
  return run;
}
