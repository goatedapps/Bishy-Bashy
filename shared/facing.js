import { seededIndex } from './seeded-index.js';
import { ChoiceRun } from './choice-round.js';

export const FACING_GAME = 'facing-which-way';
export const FACING_GOAL = 5;
export const FACING_LOOK_MS = 700;
export const FACING_COVER_MS = 400;
export const FACING_COVER_HOLD_MS = 350;
export const FACING_HANDOFF_MS = 200;
export const FACING_ANSWER_MS = 3000;
export const FACING_REVEAL_MS = 650;
const normalize = angle => (angle % 360 + 360) % 360;
export const poseKey = pose => `${normalize(pose.angle)}/${pose.back ? 'back' : 'front'}`;

export function applyTurn(pose, move) {
  return move.kind === 'mirror' ? { angle: normalize(-pose.angle), back: !pose.back } : { angle: normalize(pose.angle + move.degrees), back: pose.back };
}

export function facingSequence(seed, count, turnCount) {
  const choose = seededIndex(seed);
  return Array.from({ length: count }, () => {
    const initial = { angle: 0, back: false };
    const moves = Array.from({ length: turnCount }, () => {
      const pick = choose(4);
      return pick === 3 ? { kind: 'mirror' } : { kind: 'rotate', degrees: [90, -90, 180][pick] };
    });
    if (!moves.some(move => move.kind === 'mirror')) moves[moves.length - 1] = { kind: 'mirror' };
    const poses = [initial];
    moves.forEach(move => poses.push(applyTurn(poses.at(-1), move)));
    const correct = poses.at(-1);
    const options = [correct, { angle: correct.angle, back: !correct.back }, { angle: normalize(correct.angle + (choose(3) + 1) * 90), back: correct.back }];
    for (let index = 2; index > 0; index--) { const other = choose(index + 1); [options[index], options[other]] = [options[other], options[index]]; }
    return { initial, moves, poses, options, answer: options.findIndex(pose => poseKey(pose) === poseKey(correct)) };
  });
}

export function facingDuration(stepMs = 1000, turnCount = 2) {
  return FACING_GOAL * (FACING_LOOK_MS + FACING_COVER_MS + FACING_COVER_HOLD_MS + turnCount * stepMs + FACING_HANDOFF_MS + FACING_ANSWER_MS + FACING_REVEAL_MS);
}
export const FACING_DURATION_MS = facingDuration();

export function facingStages(round) {
  let startsAt = 0;
  return facingSequence(round.seed, FACING_GOAL, round.turnCount).map((puzzle, index) => {
    const coverAt = startsAt + FACING_LOOK_MS;
    const coveredAt = coverAt + FACING_COVER_MS;
    const turnsAt = coveredAt + FACING_COVER_HOLD_MS;
    const answerAt = turnsAt + puzzle.moves.length * round.stepMs + FACING_HANDOFF_MS;
    const answerEnd = answerAt + FACING_ANSWER_MS;
    const endsAt = answerEnd + FACING_REVEAL_MS;
    const stage = { index, startsAt, coverAt, coveredAt, turnsAt, answerAt, answerEnd, endsAt, stepMs: round.stepMs, puzzle, cues: puzzle.moves.map((_, turn) => turnsAt + turn * round.stepMs) };
    startsAt = endsAt;
    return stage;
  });
}

export class FacingRun extends ChoiceRun {
  constructor(round, localStart) { super(round, localStart, facingStages(round)); }
}
