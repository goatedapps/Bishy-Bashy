import { gameRules, roundSettings } from '../shared/games.js';
import { SESAME_DIGITS, SESAME_GAME, SesameRun } from '../shared/sesame.js';
import { SesameDial } from './sesame-view.js';
import { ScriptedDemo } from './scripted-demo.js';

function sesameDemoPlan() {
  const settings = roundSettings(SESAME_GAME, 9123);
  const start = 650;
  const run = new SesameRun(settings, start);
  const presses = [], cues = [];
  let at = start + 350;
  const press = color => {
    presses.push({ color, at });
    cues.push({ type: 'effect', sound: 'lettersPress', at });
    run.tap(color, at);
    at += color === 1 ? 430 : 260;
  };
  for (const digit of run.target) {
    const desired = SESAME_DIGITS.indexOf(digit);
    while (run.cursor !== desired) {
      const forward = (desired - run.cursor + SESAME_DIGITS.length) % SESAME_DIGITS.length;
      press(forward <= SESAME_DIGITS.length / 2 ? 2 : 0);
    }
    press(1);
  }
  const completeAt = start + run.elapsed;
  cues.push({ type: 'complete', at: completeAt });
  return { settings, start, presses, cues, completeAt, duration: completeAt + 1900 };
}

export class SesameDemo extends ScriptedDemo {
  constructor(options = {}) {
    super({ ...options, label: 'Open Sesame demonstration', className: 'sesame-demo',
      instructions: gameRules(SESAME_GAME), plan: sesameDemoPlan(), createRun: (round, start) => new SesameRun(round, start) });
    this.stage = new SesameDial();
    this.scene.append(this.stage.element);
    this.paint(0);
  }

  paint(time) { this.stage.render(this.run.target, this.run, time, time >= this.plan.start); }
}
