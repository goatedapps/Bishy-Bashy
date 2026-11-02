import { SharkRun, SHARK_JUMP_MS, SHARK_RECOVERY_MS } from '../../shared/shark.js';

export function driveSharks(round, { start = 0, delay = 0, misses = 0 } = {}) {
  const run = new SharkRun(round, start);
  let at = start + 100 + delay;
  for (let miss = 0; miss < misses; miss++) {
    run.tap((run.sequence[0] + 1) % 3, at); at += SHARK_RECOVERY_MS + 20; run.advance(at);
  }
  while (!run.done && at + SHARK_JUMP_MS <= run.end) {
    run.tap(run.sequence[run.cleared], at);
    run.advance(at + SHARK_JUMP_MS);
    at += SHARK_JUMP_MS + 30;
  }
  return run;
}
