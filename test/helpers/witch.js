import { WitchRun, WITCH_ROAD, WITCH_RUN_SCALE } from '../../shared/witch.js';
export function driveWitch(start = 0, interval = 100, angle = 45) {
  const run = new WitchRun({}, start);
  let at = start + 100, color = 0;
  while (run.x < WITCH_ROAD - 14 * WITCH_RUN_SCALE && at < start + 15000) {
    run.tap(color, at); color = 2 - color; at += interval; run.advance(at);
  }
  run.tap(1, at); run.release(1, at + angle / 55 * 1000);
  run.advance(run.landAt);
  return run;
}
