import { captureVisual } from '../shared/visual-state.js';

export function resultMessage(round, local, status, elapsed, time) {
  const run = local.run;
  return {
    type: 'result', roundId: local.id, status, elapsed, cleared: run.cleared,
    mistakes: run.mistakes, visual: captureVisual(round.game, run, time), goDelay: local.goDelay,
    ...(['perm-mania', 'happy-days'].includes(round.game) ? { score: run.score } : {}),
    ...(round.game === 'facial-slot-machine' ? { reelMask: run.reelMask } : {}),
    ...(Array.isArray(run.proof) ? { proof: run.proof.map(edge => [...edge]) } : {}),
    ...(round.game === 'me-find-mistake' ? { attempted: run.index } : {}),
  };
}
