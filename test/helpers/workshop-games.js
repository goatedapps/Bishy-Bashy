import { createRun } from '../../shared/games.js';
import { METRO_GAME, METRO_ENTRY_MS, METRO_FORK_MS } from '../../shared/workshop-games.js';

export function driveWorkshop(round, { start = 0, delay = 0, misses = 0 } = {}) {
  const run = createRun(round, start);
  if (round.game === METRO_GAME) {
    const decisions = run.trains.flatMap(({ at, target }, index) => {
      const route = index >= run.trains.length - misses ? (target + 1) % 4 : target;
      return [
        { at: start + at + METRO_ENTRY_MS - 480, color: 0, direction: route >> 1 },
        { at: start + at + METRO_FORK_MS - 410, color: 1 + (route >> 1), direction: route & 1 },
      ];
    }).sort((a, b) => a.at - b.at);
    for (const { at, color, direction } of decisions) {
      if ((run.switches >> color & 1) !== direction) run.tap(color, at);
    }
    run.advance(run.end);
  } else {
    for (const [index, order] of run.sequence.entries()) {
      let at = run.blockedUntil + delay;
      if (index >= run.sequence.length - misses) {
        run.tap(run.menu.findIndex(bucket => !order.some(item => bucket.includes(item))), at);
        continue;
      }
      for (const item of [...order].reverse()) {
        run.tap(run.menu.findIndex(bucket => bucket.includes(item)), at);
        at += 150 + delay;
      }
    }
  }
  return run;
}
