import { ChoiceRun } from './choice-round.js';
import { seededIndex } from './seeded-index.js';

export const DICE_GAME = 'dice-dice-more-dice';
export const DICE_GOAL = 21;
export const DICE_DURATION_MS = 25_000;

export function diceSequence(seed, count, difficulty = 1) {
  const choose = seededIndex(seed);
  return Array.from({ length: count }, () => {
    const faces = [1, 2, 3, 4, 5, 6];
    for (let index = faces.length - 1; index > 0; index--) {
      const other = choose(index + 1);
      [faces[index], faces[other]] = [faces[other], faces[index]];
    }
    const values = faces.slice(0, 3);
    return { values, answer: values.indexOf(Math.max(...values)), angles: values.map(() => (choose(5) - 2) * (difficulty - 1) * 5) };
  });
}

export const DICE_WINDOWS_MS = [2000, 1600, 1200, 900, 600, 400, 300];

export function diceStages(round) {
  let startsAt = 0;
  return diceSequence(round.seed, DICE_GOAL, round.difficulty).map((puzzle, index) => {
    const answerAt = startsAt;
    const answerEnd = answerAt + DICE_WINDOWS_MS[Math.floor(index / 3)];
    const endsAt = answerEnd + 190 + (index === DICE_GOAL - 1 ? 10 : 0);
    const stage = { index, startsAt, answerAt, answerEnd, endsAt, puzzle };
    startsAt = endsAt;
    return stage;
  });
}

export class DiceRun extends ChoiceRun {
  constructor(round, localStart) { super(round, localStart, diceStages(round)); }
}
