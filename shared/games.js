import { COIN_GAME, CoinRun, COIN_GOAL, COIN_DURATION_MS } from './coins.js';
import { DODGE_GAME, DodgeRun, DODGE_GOAL, DODGE_DURATION_MS } from './dodge.js';
import { TOTEM_GAME, TotemRun, BLOCK_COUNT, GAME_DURATION_MS, MISTAKE_FREEZE_MS } from './totem.js';
import { PERM_GAME, PermRun, PHRASE_COUNT, PERM_DURATION_MS, PERM_BPM, HIT_WINDOW_MS, permNotes } from './perm.js';
import { SLOT_GAME, SlotRun, SLOT_DURATION_MS, REEL_COUNT, RETRY_MS } from './slots.js';
import { FIREWORK_GAME, FireworkRun, FIREWORK_GOAL, FIREWORK_DURATION_MS } from './fireworks.js';
import { MONKEY_GAME, MonkeyRun, MONKEY_STAGES, MONKEY_DURATION_MS } from './monkeys.js';
import { JUMP_GAME, JumpRun, JUMP_GOAL, JUMP_DURATION_MS } from './jump.js';
import { BURGER_GAME, BurgerRun, BURGER_GOAL, BURGER_DURATION_MS } from './burger.js';
import { MISTAKE_GAME, MistakeRun, MISTAKE_GOAL, MISTAKE_DURATION_MS } from './mistake.js';
import { DICE_GAME, DiceRun, DICE_GOAL, DICE_DURATION_MS } from './dice.js';
import { FACING_GAME, FacingRun, FACING_GOAL, FACING_DURATION_MS } from './facing.js';
import { LETTERS_GAME, LettersRun, LETTERS_DURATION_MS } from './letters.js';

export const COUNTDOWN_MS = 3_000;

export const GAMES = Object.assign(Object.create(null), {
  [TOTEM_GAME]: { id: TOTEM_GAME, title: 'Totem Shrinker', subtitle: 'A taller tower each round', duration: GAME_DURATION_MS, goal: BLOCK_COUNT },
  [PERM_GAME]: { id: PERM_GAME, title: 'Perm Mania', subtitle: 'A faster groove each round', duration: PERM_DURATION_MS, goal: PHRASE_COUNT },
  [SLOT_GAME]: { id: SLOT_GAME, title: 'Facial Slot Machine', subtitle: 'Faster faces each round', duration: SLOT_DURATION_MS, goal: REEL_COUNT },
  [FIREWORK_GAME]: { id: FIREWORK_GAME, title: 'Fireworks Craze', subtitle: 'Quicker reactions each round', duration: FIREWORK_DURATION_MS, goal: FIREWORK_GOAL },
  [MONKEY_GAME]: { id: MONKEY_GAME, title: 'Mimicking Monkeys', subtitle: 'Longer tricks each round', duration: MONKEY_DURATION_MS, goal: MONKEY_STAGES },
  [JUMP_GAME]: { id: JUMP_GAME, title: 'Jump for the Meat', subtitle: 'Land, boost, reach the feast', duration: JUMP_DURATION_MS, goal: JUMP_GOAL },
  [BURGER_GAME]: { id: BURGER_GAME, title: 'Burger Girl', subtitle: 'Catch a fresh stack of ingredients', duration: BURGER_DURATION_MS, goal: BURGER_GOAL },
  [MISTAKE_GAME]: { id: MISTAKE_GAME, title: 'Me Find Mistake', subtitle: 'Find the picture that does not match', duration: MISTAKE_DURATION_MS, goal: MISTAKE_GOAL },
  [DICE_GAME]: { id: DICE_GAME, title: 'Dice, Dice, More Dice', subtitle: 'Spot the highest roll', duration: DICE_DURATION_MS, goal: DICE_GOAL },
  [FACING_GAME]: { id: FACING_GAME, title: 'Facing Which Way', subtitle: 'Follow the turns and flips', duration: FACING_DURATION_MS, goal: FACING_GOAL },
  [COIN_GAME]: { id: COIN_GAME, title: "It's Raining Coins", subtitle: 'Catch the gold, dodge the fakes', duration: COIN_DURATION_MS, goal: COIN_GOAL },
  [DODGE_GAME]: { id: DODGE_GAME, title: 'Dodge or Die!!', subtitle: 'Switch lanes and leap the hurdles', duration: DODGE_DURATION_MS, goal: DODGE_GOAL },
  [LETTERS_GAME]: { id: LETTERS_GAME, title: 'Type in Letters', subtitle: 'Race to type three letters first', sharedArena: true, duration: LETTERS_DURATION_MS, goal: 0 },
});

export function roundSettings(game, seed, difficulty = 1, mode = 'game-select') {
  const level = Math.max(1, Math.min(5, Math.trunc(difficulty) || 1));
  if (game === LETTERS_GAME) return { seed, difficulty: level, goal: 0, duration: LETTERS_DURATION_MS };
  if (game === COIN_GAME) return { seed, difficulty: level, goal: COIN_GOAL, duration: COIN_DURATION_MS, fallMs: mode === 'arcade' ? 800 : 1100 - (level - 1) * 90 };
  if (game === DODGE_GAME) return { seed, difficulty: level, goal: DODGE_GOAL + level - 1, duration: DODGE_DURATION_MS, approachMs: 1350 - (level - 1) * 100 };
  if (game === DICE_GAME) return { seed, difficulty: level, goal: DICE_GOAL + (level - 1) * 2, duration: DICE_DURATION_MS, rollMs: 180 - (level - 1) * 20 };
  if (game === FACING_GAME) return { seed, difficulty: level, goal: FACING_GOAL + level - 1, duration: FACING_DURATION_MS, turnCount: level + 1, stepMs: 1000 - (level - 1) * 75 };
  if (game === BURGER_GAME) return { seed, difficulty: level, goal: BURGER_GOAL, duration: BURGER_DURATION_MS, fallMs: 1100 - (level - 1) * 110 };
  if (game === MISTAKE_GAME) return { seed, difficulty: level, goal: MISTAKE_GOAL + level - 1, duration: MISTAKE_DURATION_MS };
  if (game === JUMP_GAME) return { seed, difficulty: level, goal: JUMP_GOAL, duration: JUMP_DURATION_MS, periodMs: 1200 - (level - 1) * 50, windowMs: 150 - (level - 1) * 15, perfectMs: Math.round((150 - (level - 1) * 15) * .3) };
  if (game === MONKEY_GAME) return { seed, difficulty: level, goal: MONKEY_STAGES + level - 1, duration: MONKEY_DURATION_MS, stepMs: 650 - (level - 1) * 40 };
  if (game === FIREWORK_GAME) return { seed, difficulty: level, goal: FIREWORK_GOAL, duration: FIREWORK_DURATION_MS, speed: 1 - (level - 1) * .06 };
  if (game === SLOT_GAME) return { seed, difficulty: level, goal: REEL_COUNT, duration: SLOT_DURATION_MS, stepMs: 320 - (level - 1) * 30, retryMs: RETRY_MS };
  if (game === PERM_GAME) {
    const bpm = PERM_BPM + (level - 1) * 8;
    const totalNotes = permNotes(seed, bpm).length;
    return { seed, difficulty: level, goal: PHRASE_COUNT, duration: PHRASE_COUNT * 8 * 60_000 / bpm, bpm, hitWindow: Math.round(HIT_WINDOW_MS * PERM_BPM / bpm), totalNotes, maxScore: totalNotes * 1000 };
  }
  const blockCount = BLOCK_COUNT + (level - 1) * 10;
  return { seed, difficulty: level, goal: blockCount, blockCount, duration: GAME_DURATION_MS, freezeMs: MISTAKE_FREEZE_MS };
}

export function createRun(round, localStart, timingOffset = 0) {
  if (round.game === LETTERS_GAME) return new LettersRun(round, localStart);
  if (round.game === COIN_GAME) return new CoinRun(round, localStart);
  if (round.game === DODGE_GAME) return new DodgeRun(round, localStart);
  if (round.game === DICE_GAME) return new DiceRun(round, localStart);
  if (round.game === FACING_GAME) return new FacingRun(round, localStart);
  if (round.game === BURGER_GAME) return new BurgerRun(round, localStart);
  if (round.game === MISTAKE_GAME) return new MistakeRun(round, localStart);
  if (round.game === JUMP_GAME) return new JumpRun(round, localStart);
  if (round.game === MONKEY_GAME) return new MonkeyRun(round, localStart);
  if (round.game === FIREWORK_GAME) return new FireworkRun(round, localStart);
  if (round.game === SLOT_GAME) return new SlotRun(round, localStart);
  return round.game === PERM_GAME ? new PermRun(round, localStart, timingOffset) : new TotemRun(round, localStart);
}

export const isRoundActive = round => Boolean(round && ['countdown', 'running', 'collecting'].includes(round.phase));

export function gameRules(game) {
  if (game === LETTERS_GAME) return ['Red moves left, blue moves right, green enters a letter', 'Type the three letters first to win a point; choose ⌫ to erase', 'Most points in 30 seconds wins'];
  if (game === COIN_GAME) return ['Catch gold coins and avoid cracked purple coins', 'Red = left, green = middle, blue = right'];
  if (game === DODGE_GAME) return ['Move around tall walls and jump over low hurdles', 'Red moves left, blue moves right, green jumps'];
  if (game === DICE_GAME) return ['Pick the die with the most dots', 'Red = top, green = middle, blue = bottom'];
  if (game === FACING_GAME) return ['Remember where the duck points', 'Follow the turns and flips', 'When Answer appears: red = left, green = up, blue = right'];
  if (game === BURGER_GAME) return ['Move the plate to catch the falling food', 'Red = left, green = middle, blue = right'];
  if (game === MISTAKE_GAME) return ['Pick the picture that is different', 'Red = top, green = middle, blue = bottom'];
  if (game === JUMP_GAME) return ['Press any button as the dinosaur lands on the trampoline', 'Perfect landings climb twice as high as Good landings'];
  if (game === MONKEY_GAME) return ['Watch the monkey\'s color sequence', 'Copy the order with the matching buttons'];
  if (game === FIREWORK_GAME) return ['Press matching colors before the fireworks land', 'Clear every firework in any order', 'Each set gets harder'];
  if (game === SLOT_GAME) return ['Match all three rows to the model face', 'Red stops the red row, green the green row, and blue the blue row'];
  if (game === PERM_GAME) return ['Watch the rhythm', 'Copy it with any of the three buttons'];
  return ['Press the button that matches the bottom block\'s color', 'Clear the whole tower'];
}

export function comparePlayers(a, b, game) {
  const finishedA = a.result?.status === 'finished';
  const finishedB = b.result?.status === 'finished';
  if (finishedA !== finishedB) return finishedA ? -1 : 1;
  if (!finishedA) return 0;
  if (game === LETTERS_GAME) return b.result.cleared - a.result.cleared;
  if (game === PERM_GAME) return b.result.cleared - a.result.cleared || b.result.score - a.result.score;
  return a.result.elapsed - b.result.elapsed;
}
