import { GAMES, gameRules, roundSettings } from '../shared/games.js';
import { CHOICE_GRACE_MS, ChoiceMatch, ChoiceRun } from '../shared/choice-round.js';
import { DAM_GAME, damStages, WORKSHOP_CONTROLS } from '../shared/workshop-games.js';
import { ScriptedDemo } from './scripted-demo.js';
import { DamScene } from './workshop-view.js';

export class DamDemo extends ScriptedDemo {
  constructor(options = {}) {
    const start = 450;
    const settings = { ...roundSettings(DAM_GAME, 31, options.round?.difficulty), game: DAM_GAME, goal: 2, playerIds: ['demo'] };
    const stages = damStages(settings, index => 1700 - index * 250);
    settings.duration = stages.at(-1).endsAt;
    const presses = stages.map(({ index, answerAt, puzzle }) => ({ at: start + answerAt + 550, color: (puzzle.answer + (index === 0 ? 1 : 0)) % 3 }));
    const cues = presses.map(({ at }) => ({ at, type: 'effect', sound: 'gameplayPress' }));
    cues.push({ at: start + stages[0].answerEnd + CHOICE_GRACE_MS + 250, type: 'effect', sound: 'stageWrong' },
      { at: start + stages[1].answerEnd + CHOICE_GRACE_MS + 250, type: 'complete' });
    super({ ...options, label: `${GAMES[DAM_GAME].title} demonstration`, instructions: gameRules(DAM_GAME), className: 'workshop-demo dam-demo',
      plan: { settings, start, presses, cues, completeAt: cues.at(-1).at, duration: start + settings.duration + 450, sceneOwnsCompletion: true },
      createRun: (round, start) => new ChoiceRun(round, start, stages),
    });
    this.dam = new DamScene();
    this.scene.append(this.dam.element);
    this.buttons.forEach((button, index) => { button.children[1].textContent = WORKSHOP_CONTROLS[DAM_GAME][index]; });
    this.paint(0);
  }

  resetRun(cycle) {
    super.resetRun(cycle);
    this.match = new ChoiceMatch(this.plan.settings, this.run.stages);
  }

  paint(time) {
    const phase = this.run.phase(time);
    for (const choice of this.run.pending.values()) {
      this.match.choose('demo', choice, choice.elapsed);
      this.run.acknowledge(choice.index);
    }
    this.match.advance(time - this.run.start);
    this.run.sync(this.match.state, 'demo');
    const result = this.match.state.results.find(result => result.index === phase.index);
    const age = time - this.run.start - (result?.at ?? time) - CHOICE_GRACE_MS;
    this.dam.render(phase.stage.puzzle, this.run.selections.get(phase.index)?.color, result, Math.max(0, age), !this.motion?.matches);
  }
}
