import { MonkeyRun } from '../shared/monkeys.js';
import { MonkeyStage } from './monkey-view.js';
import { ScriptedDemo } from './scripted-demo.js';

export function monkeysDemoPlan(round = {}) {
  const settings = { id: 'monkeys-demo', seed: 123, duration: 30_000, goal: 1, stepMs: round.stepMs || 650 };
  const start = 900;
  const run = new MonkeyRun(settings, start);
  const presses = run.cues.map((cue, index) => ({ type: 'press', color: cue.color, at: run.playAt + 500 + index * settings.stepMs }));
  const completeAt = presses.at(-1).at;
  const watches = run.cues.map(cue => ({ ...cue, type: 'watch' }));
  return { settings, start, presses, completeAt, duration: completeAt + 1700,
    cues: [...watches, ...presses, { type: 'complete', at: completeAt }],
  };
}

export class MonkeysDemo extends ScriptedDemo {
  constructor(options = {}) {
    super({ ...options, className: 'monkeys-demo', plan: monkeysDemoPlan(options.round), createRun: (round, start) => new MonkeyRun(round, start),
      label: 'Mimicking Monkeys demonstration: watch the monkey’s two colors, then a cat paw presses the same buttons in the same order. The completed sequence is celebrated, then the demonstration repeats.',
      instructions: ['Watch the items the monkey holds.', 'Press their colors in the same order.'],
    });
    this.stage = new MonkeyStage();
    this.stage.element.hidden = false;
    this.scene.append(this.stage.element);
    this.paint(0);
    this.paintControls(0);
  }

  paint(time) {
    this.stage.render(this.plan.settings, this.run, time, true, true, this.run.cleared, this.run.done);
  }
}
