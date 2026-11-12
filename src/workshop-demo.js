import { GAMES, gameRules, roundSettings } from '../shared/games.js';
import { DAM_GAME, METRO_GAME, METRO_ARRIVAL_MS, METRO_ENTRY_MS, METRO_FORK_MS, SUSHI_GAME, WORKSHOP_CONTROLS, createWorkshopRun } from '../shared/workshop-games.js';
import { ScriptedDemo } from './scripted-demo.js';
import { WorkshopStage } from './workshop-view.js';

export function workshopDemoPlan(game, difficulty = 1) {
  const settings = { ...roundSettings(game, 31, difficulty), game };
  const start = 450;
  if (game === METRO_GAME) settings.trainCount = 3;
  else settings.goal = 3;
  const run = createWorkshopRun(settings, start);
  const presses = [];
  const cues = [];
  const collect = () => {
    for (const { type, at } of run.events.splice(0)) {
      cues.push(type === 'stageComplete' ? { type: 'complete', at } : { type: 'effect', sound: type, at });
    }
  };
  const press = (color, at) => {
    presses.push({ color, at });
    cues.push({ type: 'effect', sound: 'gameplayPress', at });
    const action = run.tap(color, at);
    collect();
    if (action.type === 'finished') cues.push({ type: 'complete', at });
  };

  if (game === DAM_GAME) {
    press((run.sequence[0].correct + 1) % 3, start + 750);
    for (const [index, puzzle] of run.sequence.entries()) press(puzzle.correct, start + 1600 + 1000 * index);
    const landing = run.sealAt;
    run.advance(landing);
    cues.push({ type: 'complete', at: landing });
  } else if (game === SUSHI_GAME) {
    let at = start + 650;
    for (const order of run.sequence) {
      for (const item of [...order].reverse()) {
        press(run.menu.findIndex(bucket => bucket.includes(item)), at);
        at += 440;
      }
      at += 450;
    }
  } else {
    const decisions = run.trains.flatMap(({ at, target }) => [
      { at: start + at + METRO_ENTRY_MS - 560, color: 0, direction: target >> 1 },
      { at: start + at + METRO_FORK_MS - 460, color: 1 + (target >> 1), direction: target & 1 },
    ]).sort((a, b) => a.at - b.at);
    for (const { at, color, direction } of decisions) {
      if (((run.switches >> color) & 1) !== direction) press(color, at);
    }
    run.advance(start + run.trains.at(-1).at + METRO_ARRIVAL_MS);
    collect();
  }
  cues.sort((a, b) => a.at - b.at);
  const completeAt = cues.at(-1).at;
  return { settings, start, presses, cues, completeAt, duration: completeAt + 1050, sceneOwnsCompletion: true };
}

export class WorkshopDemo extends ScriptedDemo {
  constructor(game, options = {}) {
    super({ ...options, label: `${GAMES[game].title} demonstration`, className: 'workshop-demo',
      instructions: gameRules(game), plan: workshopDemoPlan(game, options.round?.difficulty), createRun: createWorkshopRun });
    this.stage = new WorkshopStage();
    this.scene.append(this.stage.element);
    this.buttons.forEach((button, index) => { button.children[1].textContent = WORKSHOP_CONTROLS[game][index]; });
    this.paint(0);
  }

  paint(time) {
    this.stage.render(this.plan.settings, this.run, time, 0, true, true, this.run.cleared, this.run.done);
  }
}
