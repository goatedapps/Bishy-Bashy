import { TOTEM_GAME, TotemRun, BLOCK_COUNT, GAME_DURATION_MS, MISTAKE_FREEZE_MS } from './totem.js';
import { PERM_GAME, PermRun, PHRASE_COUNT, PERM_DURATION_MS, PERM_BPM, HIT_WINDOW_MS, permNotes } from './perm.js';

export const GAMES = Object.assign(Object.create(null), {
  [TOTEM_GAME]: { id: TOTEM_GAME, title: 'Totem Shrinker', duration: GAME_DURATION_MS, goal: BLOCK_COUNT },
  [PERM_GAME]: { id: PERM_GAME, title: 'Perm Mania', duration: PERM_DURATION_MS, goal: PHRASE_COUNT },
});

export function roundSettings(game, seed) {
  if (game === PERM_GAME) return { seed, goal: PHRASE_COUNT, duration: PERM_DURATION_MS, bpm: PERM_BPM, hitWindow: HIT_WINDOW_MS, totalNotes: permNotes(seed).length, maxScore: permNotes(seed).length * 1000 };
  return { seed, goal: BLOCK_COUNT, blockCount: BLOCK_COUNT, duration: GAME_DURATION_MS, freezeMs: MISTAKE_FREEZE_MS };
}

export function createRun(round, localStart, timingOffset = 0) {
  return round.game === PERM_GAME ? new PermRun(round, localStart, timingOffset) : new TotemRun(round, localStart);
}

export function comparePlayers(a, b, game) {
  const finishedA = a.result?.status === 'finished';
  const finishedB = b.result?.status === 'finished';
  if (finishedA !== finishedB) return finishedA ? -1 : 1;
  if (!finishedA) return 0;
  if (game === PERM_GAME) return b.result.cleared - a.result.cleared || b.result.score - a.result.score;
  return a.result.elapsed - b.result.elapsed;
}
