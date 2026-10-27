import { TOTEM_GAME, TotemRun, BLOCK_COUNT, GAME_DURATION_MS, MISTAKE_FREEZE_MS } from './totem.js';
import { PERM_GAME, PermRun, PHRASE_COUNT, PERM_DURATION_MS, PERM_BPM, HIT_WINDOW_MS, permNotes } from './perm.js';
import { SLOT_GAME, SlotRun, SLOT_DURATION_MS, REEL_COUNT, RETRY_MS } from './slots.js';

export const GAMES = Object.assign(Object.create(null), {
  [TOTEM_GAME]: { id: TOTEM_GAME, title: 'Totem Shrinker', subtitle: 'A taller tower each round', duration: GAME_DURATION_MS, goal: BLOCK_COUNT },
  [PERM_GAME]: { id: PERM_GAME, title: 'Perm Mania', subtitle: 'A faster groove each round', duration: PERM_DURATION_MS, goal: PHRASE_COUNT },
  [SLOT_GAME]: { id: SLOT_GAME, title: 'Facial Slot Machine', subtitle: 'Faster faces each round', duration: SLOT_DURATION_MS, goal: REEL_COUNT },
});

export function roundSettings(game, seed, difficulty = 1) {
  const level = Math.max(1, Math.min(5, Math.trunc(difficulty) || 1));
  if (game === SLOT_GAME) return { seed, difficulty: level, goal: REEL_COUNT, duration: SLOT_DURATION_MS, stepMs: 320 - (level - 1) * 30, retryMs: RETRY_MS };
  if (game === PERM_GAME) {
    const bpm = PERM_BPM + (level - 1) * 8;
    const totalNotes = permNotes(seed, bpm).length;
    return { seed, difficulty: level, goal: PHRASE_COUNT, duration: PHRASE_COUNT * 8 * 60_000 / bpm, bpm, hitWindow: Math.round(HIT_WINDOW_MS * PERM_BPM / bpm), totalNotes, maxScore: totalNotes * 1000 };
  }
  const blockCount = BLOCK_COUNT + (level - 1) * 10;
  return { seed, difficulty: level, goal: blockCount, blockCount, duration: GAME_DURATION_MS, freezeMs: MISTAKE_FREEZE_MS };
}

export function createRun(round, localStart, timingOffset = 0) {
  if (round.game === SLOT_GAME) return new SlotRun(round, localStart);
  return round.game === PERM_GAME ? new PermRun(round, localStart, timingOffset) : new TotemRun(round, localStart);
}

export const isRoundActive = round => Boolean(round && ['countdown', 'running', 'collecting'].includes(round.phase));

export function gameRules(game, round) {
  if (game === SLOT_GAME) return ['Match all three rows to the model face at the center marker.', 'Red stops the red row, green the green row, and blue the blue row—in any order.', 'Correct faces stay locked. A miss restarts only that row. Fastest complete face wins.'];
  if (game === PERM_GAME) return ['Watch the rhythm, then copy it with any of the three buttons.', 'One mistake or fewer in a phrase grows your hair.', 'Biggest hair wins; rhythm score breaks ties.'];
  return ['Match the bottom block with the same color button.', `Clear all ${round.blockCount} blocks as fast as you can.`, 'A wrong tap freezes your controls for 0.3 seconds.'];
}

export function comparePlayers(a, b, game) {
  const finishedA = a.result?.status === 'finished';
  const finishedB = b.result?.status === 'finished';
  if (finishedA !== finishedB) return finishedA ? -1 : 1;
  if (!finishedA) return 0;
  if (game === PERM_GAME) return b.result.cleared - a.result.cleared || b.result.score - a.result.score;
  return a.result.elapsed - b.result.elapsed;
}
