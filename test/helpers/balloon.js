export function pumpBalloon(run, at, interval = 100) {
  while (!run.done) {
    const color = run.proof.at(-1)?.[0] === 0 ? 2 : 0;
    if (run.tap(color, at).type === 'ignored') throw new Error('Pump input was rejected');
    at += interval;
  }
  return run;
}
