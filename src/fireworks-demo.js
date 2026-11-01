import { FireworkRun } from '../shared/fireworks.js';
import { FireworkStage } from './firework-view.js';
import { ScriptedDemo } from './scripted-demo.js';

export function createFireworksDemoRun(round, start) {
  const run = new FireworkRun(round, start);
  // Start with the first multi-rocket set so the example shows all three colors.
  run.cleared = 1;
  return run;
}

export function fireworksDemoPlan(round = {}) {
  const settings = { id: 'fireworks-demo', seed: 1, duration: 30_000, goal: 2, speed: round.speed || 1 };
  const start = 900;
  const run = createFireworksDemoRun(settings, start);
  const rockets = run.rockets;
  const presses = rockets.map(rocket => ({ type: 'press', color: rocket.color, at: rocket.launchAt + rocket.airMs / 2 }));
  const completeAt = presses.at(-1).at;
  const launches = rockets.map(rocket => ({ type: 'launch', at: rocket.launchAt }));
  return { settings, start, presses, completeAt, celebrateDelay: 450, duration: completeAt + 1900,
    cues: [...launches, ...presses, { type: 'complete', at: completeAt }].sort((a, b) => a.at - b.at),
  };
}

export class FireworksDemo extends ScriptedDemo {
  constructor(options = {}) {
    super({ ...options, className: 'fireworks-demo', plan: fireworksDemoPlan(options.round), createRun: createFireworksDemoRun,
      label: 'Fireworks Craze demonstration: three rockets launch with visible colors. A finger presses matching buttons to burst them in the air, then the demonstration repeats.',
      instructions: ['Watch the rocket colors.', 'Press matching buttons before the rockets land.'],
    });
    this.stage = new FireworkStage();
    this.stage.element.hidden = false;
    this.scene.append(this.stage.element);
    this.paint(0);
    this.paintControls(0);
  }

  paint(time) {
    this.stage.render(this.plan.settings, this.run, time, true, true, this.run.cleared, this.run.done);
  }
}
