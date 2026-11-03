import { WitchRun, WITCH_GAME } from '../shared/witch.js';
import { WitchStage } from './witch-view.js';
import { ScriptedDemo } from './scripted-demo.js';
import { gameRules } from '../shared/games.js';

export function witchDemoPlan() {
  const start = 900, run = new WitchRun({}, start), presses = [], cues = [];
  let at = start + 100, color = 0;
  while (run.x + run.speed * run.speed / 44 < 173 && at < 14000) {
    run.tap(color, at); presses.push({ color, at }); cues.push({ type: 'effect', sound: 'gameplayPress', at });
    color = 2 - color; at += 100; run.advance(at);
  }
  const releaseAt = at + run.speed / 22 * 1000 + 45 / 55 * 1000;
  presses.push({ color: 1, at, holdUntil: releaseAt }); run.tap(1, at);
  cues.push({ type: 'effect', sound: 'gameplayPress', at });
  presses.push({ type: 'release', color: 1, at: releaseAt }); run.release(1, releaseAt);
  cues.push({ type: 'effect', sound: 'witchLaunch', at: releaseAt });
  const completeAt = run.landAt; cues.push({ type: 'complete', at: completeAt });
  return { start, settings: { game: WITCH_GAME }, presses, cues, completeAt, duration: completeAt + 2400, sceneOwnsCompletion: true };
}
export class WitchDemo extends ScriptedDemo {
  constructor(options = {}) {
    const plan = witchDemoPlan();
    super({ ...options, label: 'Witch’s Special Delivery demonstration', instructions: gameRules(WITCH_GAME), className: 'witch-demo', plan, createRun: (round, start) => new WitchRun(round, start) });
    this.stage = new WitchStage(); this.scene.append(this.stage.element);
  }
  paint(time) { this.stage.render(this.plan.settings, this.run, time); }
}
