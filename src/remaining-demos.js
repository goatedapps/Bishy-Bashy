import { SharkRun, SHARK_JUMP_MS, SHARK_RECOVERY_MS } from '../shared/shark.js';
import { SharkStage } from './shark-view.js';
import { HorseRun } from '../shared/horse.js';
import { HorseStage } from './horse-view.js';
import { StarRun } from '../shared/stars.js';
import { StarStage } from './stars-view.js';
import { LadderRun } from '../shared/ladder.js';
import { LadderStage } from './ladder-view.js';
import { StationeryRun } from '../shared/stationery.js';
import { ClockRun } from '../shared/clock.js';
import { createSharedMatch } from '../shared/shared-match.js';
import { DeskClockStage } from './desk-clock-view.js';
import { HappyRun, happyChart } from '../shared/happy.js';
import { HappyStage } from './happy-view.js';
import { KayaRun } from '../shared/kaya.js';
import { roundSettings } from '../shared/games.js';
import { JumpRun } from '../shared/jump.js';
import { BurgerRun } from '../shared/burger.js';
import { MistakeRun } from '../shared/mistake.js';
import { CoinRun } from '../shared/coins.js';
import { DodgeRun, JUMP_MS } from '../shared/dodge.js';
import { DynamiteRun } from '../shared/dynamite.js';
import { MealsRun, MEALS_DROP_MS } from '../shared/meals.js';
import { DiceRun } from '../shared/dice.js';
import { FacingRun, facingDuration } from '../shared/facing.js';
import { LettersRun, LettersMatch, LETTERS_PACKET_MS } from '../shared/letters.js';
import { JumpStage } from './jump-view.js';
import { BurgerStage, MistakeStage } from './catch-spot-view.js';
import { CoinStage, DodgeStage } from './coins-dodge-view.js';
import { DynamiteStage } from './dynamite-view.js';
import { MealsStage } from './meals-view.js';
import { SharedChoiceStage } from './shared-choice-view.js';
import { LettersStage } from './letters-view.js';
import { ScriptedDemo } from './scripted-demo.js';

const START = 900;
const make = Type => (round, start) => new Type(round, start);

class ChoiceDemoRun {
  constructor(round, start) {
    const Type = round.game === 'stationery-master' ? StationeryRun : round.game === 'clock-stopper' ? ClockRun : round.game === 'wheres-kaya' ? KayaRun : round.game === 'facing-which-way' ? FacingRun : DiceRun;
    const run = new Type(round, start);
    run.stages = run.stages.slice(0, 1);
    run.goal = 1;
    run.end = start + run.stages[0].endsAt;
    const match = createSharedMatch({ ...round, playerIds: ['demo'] }, run.stages);
    const tap = run.tap.bind(run), advance = run.advance.bind(run);
    run.match = match;
    run.tap = (color, time) => {
      const result = tap(color, time);
      if (result.type === 'choice') match.choose('demo', run.pending.get(0) || run.selections.get(0), time - start);
      return result;
    };
    run.advance = time => {
      advance(time);
      match.advance(time - start);
      run.sync(match.state, 'demo');
      if (time >= run.end) { run.done = true; run.elapsed = run.end - start; }
    };
    return run;
  }
}

class LettersDemoRun extends LettersRun {
  constructor(round, start) {
    const match = new LettersMatch({ ...round, playerIds: ['demo'] });
    super({ ...round, letters: match.state }, start);
    this.match = match;
    this.end = start + match.state.closesAt + LETTERS_PACKET_MS;
  }
  tap(color, time) {
    const result = super.tap(color, time);
    if (result.type === 'claim') this.match.claim('demo', this.claim, time - this.start);
    return result;
  }
  advance(time) {
    if (this.done) return;
    this.match.advance(time - this.start);
    this.sync(this.match.state, 'demo');
    if (time >= this.end) { this.done = true; this.elapsed = this.end - this.start; }
  }
}

const RUNS = {
  'shark-jumper': make(SharkRun),
  'horse-speeder': make(HorseRun),
  'star-collector': make(StarRun),
  'ladder-climber': make(LadderRun),
  'stationery-master': make(ChoiceDemoRun), 'clock-stopper': make(ChoiceDemoRun),
  'happy-days': (round, start) => new HappyRun(round, start, 0, happyChart(round.seed).slice(0, 4)),
  'jump-for-the-meat': make(JumpRun), 'burger-girl': make(BurgerRun), 'me-find-mistake': make(MistakeRun),
  'its-raining-coins': make(CoinRun), 'dodge-or-die': make(DodgeRun), 'dynamite-spark': make(DynamiteRun),
  'get-those-burgers-out': make(MealsRun), 'dice-dice-more-dice': make(ChoiceDemoRun),
  'wheres-kaya': make(ChoiceDemoRun), 'facing-which-way': make(ChoiceDemoRun), 'type-in-letters': make(LettersDemoRun),
};
export const REMAINING_DEMO_GAMES = Object.keys(RUNS);

const INSTRUCTIONS = {
  'shark-jumper': ['Press the color of the next shark to jump onto it.', 'Landed sharks turn grey. Fall? Climb back up and continue.'],
  'horse-speeder': ['Tap green to accelerate; stop tapping to slow down.', 'Red moves left; blue moves right. Dodge horses and finish first.'],
  'star-collector': ['Hold red to tilt left; hold blue to tilt right.', 'Release to level. Collect stars; most in 45 seconds wins.'],
  'ladder-climber': ['Follow the ladder: red = left, green = middle, blue = right.', 'Press once per rung. Climb to the trophy.'],
  'stationery-master': ['Count each item and tap its button that many times.', 'Red: pencil. Green: eraser. Blue: sharpener. Counts loop 6 → 0.'],
  'clock-stopper': ['Watch the minute hand make its first full turn.', 'Press any button when it returns to 12.'],
  'happy-days': ['Press the matching color as a bar reaches the line.', 'Hold long bars. Release when the tail reaches the line.'],
  'wheres-kaya': ['Remember Kaya. Follow the blankets as they shuffle.', 'Choose Kaya: red = left, green = middle, blue = right.'],
  'jump-for-the-meat': ['Press any button as the dinosaur lands.', 'Perfect landings jump twice as high.'],
  'burger-girl': ['Move the plate under the falling food.', 'Red = left, green = middle, blue = right.'],
  'me-find-mistake': ['Find the picture that is different.', 'Red = top, green = middle, blue = bottom.'],
  'dice-dice-more-dice': ['Choose the die with the most dots.', 'Red = left, green = middle, blue = right.'],
  'facing-which-way': ['Watch the card turn and flip.', 'Choose its final picture: red left, green middle, blue right.'],
  'its-raining-coins': ['Move under gold coins. Avoid the fakes.', 'Red = left, green = middle, blue = right.'],
  'dodge-or-die': ['Move into gaps between walls. Red - Move left. Blue - Move right', 'Press green to jump over low hurdles.'],
  'type-in-letters': ['Move with red / blue. Enter with green.', 'Type the target before time runs out. Choose ⌫ to erase.'],
  'dynamite-spark': ['Press the color of the wire at the spark.', 'Tap four times per color, then follow the next color.'],
  'get-those-burgers-out': ['Fill every empty slot to serve the meal.', 'Red = fries, green = burger, blue = drink.'],
};

export function remainingDemoPlan(game, round = {}) {
  const settings = { id: `${game}-demo`, game, ...roundSettings(game, 123), ...round, seed: 123, duration: 30_000 };
  let createRun = RUNS[game];
  if (!createRun) return null;
  if (['burger-girl', 'its-raining-coins'].includes(game)) settings.goal = game === 'burger-girl' ? 4 : 3;
  if (['me-find-mistake', 'get-those-burgers-out', 'facing-which-way'].includes(game)) settings.goal = 1;
  if (game === 'dodge-or-die') settings.goal = 2;
  if (game === 'facing-which-way') {
    settings.turnCount = 2;
    settings.duration = facingDuration(settings.stepMs, 2, 1);
  }
  const probe = createRun(settings, START);
  const presses = [], effects = [];
  const press = (color, at, sound) => {
    presses.push({ type: 'press', color, at });
    if (sound) effects.push({ type: 'effect', sound, at });
    probe.tap(color, at);
  };
  let completeAt, freezeAt, sampleComplete = false;
  if (game === 'shark-jumper') {
    let at = START + 600;
    for (let index = 0; index < 5; index++) {
      if (index === 2) {
        press((probe.sequence[probe.cleared] + 1) % 3, at, 'gameplayPress');
        at += SHARK_RECOVERY_MS + 400;
      }
      press(probe.sequence[probe.cleared], at, 'gameplayPress');
      at += SHARK_JUMP_MS + 500; probe.advance(at);
    }
    for (const event of probe.events) effects.push({ at: event.at, type: 'effect', sound: event.type });
    return { settings, createRun, start: START, sampleComplete: true, presses, cues: effects.sort((a,b) => a.at-b.at), completeAt: at, freezeAt: at, sceneOwnsCompletion: true, duration: at + 1400 };
  }
  if (game === 'horse-speeder') {
    for (let at = START + 300; at <= START + 9500; at += 50) {
      probe.advance(at);
      const wave = probe.traffic[probe.index];
      if (wave && probe.position !== wave.safe && at - probe.moveAt >= 180) press(probe.position > wave.safe ? 0 : 2, at, 'gameplayPress');
      if ((at - START - 300) % 200 === 0) press(1, at, 'gameplayPress');
    }
    for (const event of probe.events) effects.push({ at: event.at, type: 'effect', sound: event.type });
    return { settings, createRun, start: START, sampleComplete: true, presses, cues: effects.sort((a,b) => a.at-b.at), completeAt: START + 9500, freezeAt: START + 9500, sceneOwnsCompletion: true, duration: START + 10800 };
  }
  if (game === 'star-collector') {
    for (const [color, at, until] of [[2, 500, 1900], [0, 2200, 3700], [2, 4100, 5800]]) {
      presses.push({ color, at, holdUntil: until }, { color, at: until, type: 'release' });
      effects.push({ at, type: 'press', color });
    }
    const demo = createRun(settings, 0);
    for (const cue of presses) { demo.advance(cue.at); if (cue.type === 'release') demo.release(cue.color, cue.at); else demo.tap(cue.color, cue.at); }
    demo.advance(6500);
    for (const event of demo.events) effects.push({ at: event.at, type: 'effect', sound: event.type === 'carBump' ? 'carBump' : 'stageComplete' });
    return { settings, createRun, start: 0, sampleComplete: true, presses, cues: effects.sort((a,b) => a.at-b.at), completeAt: 6500, freezeAt: 6500, sceneOwnsCompletion: true, duration: 7800 };
  }
  if (game === 'ladder-climber') {
    let at = START + 800;
    for (const ladder of probe.course.slice(0, 2)) {
      for (let step = 0; step < ladder.steps; step++) { press(ladder.column, at, 'ladderStep'); at += 400; }
      effects.push({ type: 'complete', at: presses.at(-1).at });
    }
    completeAt = presses.at(-1).at; sampleComplete = true;
  } else if (game === 'stationery-master') {
    const stage = probe.stages[0];
    let at = START + stage.answerAt + 500;
    stage.puzzle.counts.forEach((count, color) => { for (let tap = 0; tap < count; tap++) { press(color, at); at += 300; } });
    completeAt = START + stage.revealAt;
    sampleComplete = true;
    probe.advance(completeAt);
  } else if (game === 'clock-stopper') {
    const stage = probe.stages[0];
    press(1, START + stage.targetAt);
    completeAt = START + stage.answerEnd + 80;
    sampleComplete = true;
    probe.advance(START + stage.endsAt);
  } else if (game === 'happy-days') {
    for (const note of probe.notes) {
      const at = START + note.at, end = at + note.duration;
      presses.push({ type: 'press', color: note.color, at, holdUntil: note.duration ? end : undefined });
      presses.push({ type: 'release', color: note.color, at: end + (note.duration ? 0 : 50) });
    }
    presses.sort((a, b) => a.at - b.at);
    for (const cue of presses) { if (cue.type === 'release') probe.release(cue.color, cue.at); else probe.tap(cue.color, cue.at); }
    completeAt = presses.at(-1).at + 100;
    freezeAt = completeAt;
    sampleComplete = true;
  } else if (game === 'jump-for-the-meat') {
    for (let index = 0; index < 3; index++) press(1, probe.landAt, 'jumpBounce');
    completeAt = presses.at(-1).at;
    freezeAt = completeAt + probe.arcMs / 2;
    sampleComplete = true;
  } else if (game === 'burger-girl' || game === 'its-raining-coins') {
    while (!probe.done) {
      const land = probe.landAt;
      press(game === 'burger-girl' ? probe.column : probe.wave.column, land - Math.min(game === 'burger-girl' ? 180 : 350, settings.fallMs / 2));
      probe.advance(land);
      effects.push({ type: 'complete', at: land });
    }
    completeAt = START + probe.elapsed;
  } else if (game === 'me-find-mistake') {
    press(probe.puzzle.odd, START + 1900);
    completeAt = presses[0].at;
  } else if (game === 'dodge-or-die') {
    const safe = probe.obstacle.safe;
    if (safe !== 1) press(safe === 0 ? 0 : 2, START + 650);
    else { press(0, START + 350); press(2, START + 650); }
    probe.advance(probe.impactAt);
    effects.push({ type: 'complete', at: probe.feedback.at });
    const impact = probe.impactAt;
    press(1, impact - JUMP_MS / 2);
    probe.advance(impact);
    completeAt = impact;
  } else if (game === 'dynamite-spark') {
    for (let index = 0; index < 8; index++) {
      press(probe.sequence[probe.cleared], START + 850 + index * 420);
      if ((index + 1) % 4 === 0) effects.push({ type: 'complete', at: presses.at(-1).at });
    }
    completeAt = presses.at(-1).at;
    sampleComplete = true;
  } else if (game === 'get-those-burgers-out') {
    let at = START + 800;
    const order = [...probe.requirements];
    order.forEach((count, color) => {
      for (let index = 0; index < count; index++) { press(color, at, 'mealPlop'); at += 450; }
    });
    completeAt = presses.at(-1).at + MEALS_DROP_MS;
    probe.advance(completeAt);
  } else if (game === 'type-in-letters') {
    let at = START + 700;
    for (const letter of probe.state.target) {
      const index = letter.charCodeAt(0) - 65;
      const left = (probe.cursor - index + 27) % 27, right = (index - probe.cursor + 27) % 27;
      for (let move = 0; move < Math.min(left, right); move++) { press(left < right ? 0 : 2, at, 'lettersPress'); at += 140; }
      press(1, at, 'lettersPress'); at += 350;
    }
    completeAt = probe.end;
    probe.advance(completeAt);
  } else {
    const stage = probe.stages[0];
    press(stage.puzzle.answer, START + stage.answerAt + (game === 'facing-which-way' ? 800 : 950));
    if (game === 'wheres-kaya') effects.push(...stage.cues.map(at => ({ type: 'effect', sound: 'kayaShuffle', at: START + at })));
    else if (game === 'facing-which-way') effects.push(...stage.cues.map(at => ({ type: 'effect', sound: 'facingFlip', at: START + at })));
    else effects.push({ type: 'effect', sound: 'diceRoll', at: START });
    completeAt = START + stage.answerEnd + 80;
    sampleComplete = true;
    probe.advance(START + stage.endsAt);
  }
  const sounded = new Set(effects.filter(cue => cue.type === 'effect').map(cue => cue.at));
  const cues = presses.filter(cue => !sounded.has(cue.at)).concat(effects);
  if (!cues.some(cue => cue.type === 'complete' && cue.at === completeAt)) cues.push({ type: 'complete', at: completeAt });
  return { settings, createRun, start: START, presses, cues: cues.sort((a, b) => a.at - b.at), completeAt,
    freezeAt, sampleComplete, sceneOwnsCompletion: ['clock-stopper', 'stationery-master'].includes(game), duration: Math.max(completeAt + 1700, freezeAt || 0) };
}

const STAGES = {
  'shark-jumper': SharkStage,
  'horse-speeder': HorseStage,
  'star-collector': StarStage,
  'ladder-climber': LadderStage,
  'stationery-master': DeskClockStage, 'clock-stopper': DeskClockStage,
  'happy-days': HappyStage,
  'jump-for-the-meat': JumpStage, 'burger-girl': BurgerStage, 'me-find-mistake': MistakeStage,
  'its-raining-coins': CoinStage, 'dodge-or-die': DodgeStage, 'dynamite-spark': DynamiteStage,
  'get-those-burgers-out': MealsStage, 'dice-dice-more-dice': SharedChoiceStage,
  'wheres-kaya': SharedChoiceStage, 'facing-which-way': SharedChoiceStage, 'type-in-letters': LettersStage,
};

export class RemainingDemo extends ScriptedDemo {
  constructor(game, options = {}) {
    const plan = remainingDemoPlan(game, options.round);
    super({ ...options, className: `remaining-demo demo-${game}`, plan, createRun: plan.createRun,
      label: `${game} animated gameplay demonstration. A cat paw performs the actions beside the instructions, then the example repeats.`, instructions: INSTRUCTIONS[game] });
    this.game = game;
    this.stage = ['stationery-master', 'clock-stopper'].includes(game) ? new DeskClockStage({ preview: true }) : new STAGES[game]();
    this.stage.element.hidden = false;
    this.scene.append(this.stage.element);
    this.paint(0);
    this.paintControls(0);
  }

  paint(time) {
    const round = this.plan.settings, run = this.run;
    if (run.match) {
      const player = { id: 'demo', name: 'Player', connected: true, progress: {} };
      const room = { players: [player], round: { ...round, playerIds: ['demo'], ...(this.game === 'type-in-letters' ? { letters: run.match.state } : { choice: run.match.state }) } };
      this.stage.render(room, 'demo', { run, start: run.start, end: run.end + 500 }, time);
    } else this.stage.render(round, run, time, Math.max(0, time - run.start), true, true, run.cleared, run.done);
  }
}
