import { gameRules, roundSettings } from '../shared/games.js';
import { BALLOON_GAME, BALLOON_GOAL, BalloonRun } from '../shared/balloon.js';
import { BalloonStage } from './balloon-view.js';
import { ScriptedDemo } from './scripted-demo.js';

function balloonDemoPlan() {
  const settings = roundSettings(BALLOON_GAME, 0);
  const start = 650;
  const presses = Array.from({ length: BALLOON_GOAL }, (_, index) => ({
    color: index % 2 === 0 ? 0 : 2, at: start + 250 + Math.min(index, 4) * 245 + Math.max(0, index - 4) * 150,
  }));
  const completeAt = presses.at(-1).at;
  const cues = presses.slice(0, -1).map(({ at }) => ({ type: 'effect', sound: 'lettersPress', at }));
  cues.push({ type: 'effect', sound: 'balloonPop', at: completeAt }, { type: 'complete', at: completeAt });
  return { settings, start, presses, cues, completeAt, duration: completeAt + 1800, sceneOwnsCompletion: true };
}

export class BalloonDemo extends ScriptedDemo {
  constructor(options = {}) {
    super({ ...options, label: 'Burst the Balloon demonstration', className: 'balloon-demo',
      instructions: gameRules(BALLOON_GAME), plan: balloonDemoPlan(), createRun: (round, start) => new BalloonRun(round, start) });
    this.stage = new BalloonStage();
    this.scene.append(this.stage.element);
    this.paint(0);
  }

  paint(time) {
    this.stage.render(this.plan.settings, this.run, time, time - this.plan.start, true, true, this.run.cleared, this.run.done);
  }
}
