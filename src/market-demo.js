import { GAMES, gameRules, roundSettings } from '../shared/games.js';
import { ANT_GAME, MARKET_CONTROLS, SATAY_GAME, WEATHER_GAME, createMarketRun } from '../shared/market-games.js';
import { MarketStage } from './market-view.js';
import { ScriptedDemo } from './scripted-demo.js';

function demoPlan(game, round) {
  const difficulty = round?.difficulty ?? 1;
  const settings = { ...roundSettings(game, 5, difficulty), game, goal: game === WEATHER_GAME ? 2 : 3 };
  const start = 550;
  const run = createMarketRun(settings, start);
  const presses = [];
  const cues = [];
  const press = (color, at) => {
    presses.push({ color, at });
    cues.push({ type: 'effect', sound: 'gameplayPress', at });
    const action = run.tap(color, at);
    for (const event of run.events.splice(0)) cues.push(event.type === 'stageComplete' ? { type: 'complete', at } : { type: 'effect', sound: event.type, at });
    if (action.type === 'finished') cues.push({ type: 'complete', at });
  };

  if (game === SATAY_GAME) {
    for (let index = 0; index < settings.goal; index++) {
      run.advance(run.nextAt ?? start);
      press(index, run.catchAt);
    }
  } else if (game === WEATHER_GAME) {
    let at = start + 700;
    for (let wave = 0; wave < settings.goal; wave++) {
      run.advance(at);
      const { colors, mask } = run.sequence[wave];
      for (const [side, color] of colors.entries()) {
        for (let slot = 0; slot < 3; slot++) {
          if (mask & (1 << (side * 3 + slot))) { press(color, at); at += 340; }
        }
      }
      at += 300;
    }
  } else if (game === ANT_GAME) {
    run.sequence.forEach((color, index) => press(color, start + 750 + index * 830));
  }
  const completeAt = presses.at(-1).at;
  return { settings, start, presses, cues, completeAt, duration: completeAt + 1100, sceneOwnsCompletion: true };
}

export class MarketDemo extends ScriptedDemo {
  constructor(game, options = {}) {
    super({ ...options, label: `${GAMES[game].title} demonstration`, className: 'market-demo',
      instructions: gameRules(game), plan: demoPlan(game, options.round), createRun: createMarketRun });
    this.stage = new MarketStage();
    this.scene.append(this.stage.element);
    this.buttons.forEach((button, index) => { button.children[1].textContent = MARKET_CONTROLS[game][index]; });
    this.paint(0);
  }

  paint(time) {
    this.stage.render(this.plan.settings, this.run, time, 0, true, true, this.run.cleared, this.run.done);
  }
}
