import { createRun } from '../../shared/games.js';
import { ANT_GAME, SATAY_GAME, WEATHER_GAME } from '../../shared/market-games.js';

export function driveMarket(round, { start = 0, delay = 0 } = {}) {
  const run = createRun(round, start);
  let time = run.blockedUntil + .125 + delay;
  while (!run.done && time < run.end) {
    run.advance?.(time);
    if (round.game === SATAY_GAME) time = run.catchAt + delay;
    const color = round.game === WEATHER_GAME ? run.sequence[run.index].colors[run.bottleMask & 7 ? 0 : 1] : round.game === ANT_GAME ? run.sequence[run.cleared] : 0;
    run.tap(color, time);
    time = Math.max(time + 75, run.blockedUntil);
  }
  return run;
}
