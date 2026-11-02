import { ChoiceRun } from './choice-round.js';
import { seededIndex } from './seeded-index.js';

export const KAYA_GAME = 'wheres-kaya';
export const KAYA_GOAL = 8;
const PAIRS = [[0, 1], [1, 2], [0, 2]];
const LOOK_MS = 1600, COVER_MS = 450, HOLD_MS = 250, HANDOFF_MS = 250, ANSWER_MS = 1500, REVEAL_MS = 900;
export const kayaStepMs = (index, difficulty = 1) => Math.max(100, [900, 720, 560, 420, 300, 220, 180, 145][index] - (difficulty - 1) * 15);
export const kayaDuration = (difficulty = 1, goal = KAYA_GOAL) => Array.from({ length: goal }, (_, index) =>
  LOOK_MS + COVER_MS + HOLD_MS + (index + 2) * kayaStepMs(index, difficulty) + HANDOFF_MS + ANSWER_MS + REVEAL_MS).reduce((sum, duration) => sum + duration, 0);
export const KAYA_DURATION_MS = kayaDuration();

export function kayaStages(round) {
  const choose = seededIndex(round.seed);
  let startsAt = 0;
  return Array.from({ length: round.goal || KAYA_GOAL }, (_, index) => {
    const initial = [0, 1, 2];
    for (let slot = 2; slot > 0; slot--) {
      const other = choose(slot + 1);
      [initial[slot], initial[other]] = [initial[other], initial[slot]];
    }
    const orders = [[...initial]], moves = [];
    let previous = choose(PAIRS.length);
    for (let shuffle = 0; shuffle < index + 2; shuffle++) {
      const pairIndex = shuffle ? (previous + 1 + choose(2)) % PAIRS.length : previous;
      const [left, right] = PAIRS[pairIndex];
      const order = [...orders.at(-1)];
      [order[left], order[right]] = [order[right], order[left]];
      moves.push({ left, right });
      orders.push(order);
      previous = pairIndex;
    }
    const stepMs = kayaStepMs(index, round.difficulty);
    const coverAt = startsAt + LOOK_MS, coveredAt = coverAt + COVER_MS;
    const turnsAt = coveredAt + HOLD_MS;
    const answerAt = turnsAt + moves.length * stepMs + HANDOFF_MS;
    const answerEnd = answerAt + ANSWER_MS, endsAt = answerEnd + REVEAL_MS;
    const stage = { index, startsAt, coverAt, coveredAt, turnsAt, stepMs, answerAt, answerEnd, endsAt,
      cues: moves.map((_, shuffle) => turnsAt + shuffle * stepMs),
      puzzle: { initial, moves, orders, answer: orders.at(-1).indexOf(0) } };
    startsAt = endsAt;
    return stage;
  });
}

export class KayaRun extends ChoiceRun {
  constructor(round, localStart) { super(round, localStart, kayaStages(round)); }
}
