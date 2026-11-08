import { SESAME_DIGITS } from '../../shared/sesame.js';

export function dialCode(run, at, step = 85) {
  for (const digit of run.target.slice(run.cleared)) {
    const desired = SESAME_DIGITS.indexOf(digit);
    while (run.cursor !== desired) {
      const forward = (desired - run.cursor + SESAME_DIGITS.length) % SESAME_DIGITS.length;
      if (run.tap(forward <= SESAME_DIGITS.length / 2 ? 2 : 0, at).type !== 'move') throw new Error('Dial movement was rejected');
      at += step;
    }
    if (run.tap(1, at).type === 'ignored') throw new Error('Digit selection was rejected');
    at += step;
  }
  return run;
}
