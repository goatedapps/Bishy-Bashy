import { WITCH_GAME, WitchRun, WITCH_DURATION_MS, WITCH_GOAL } from './witch.js';
import { SHARK_GAME, SharkRun, SHARK_GOAL, SHARK_DURATION_MS } from './shark.js';
import { HORSE_GAME, HorseRun, HORSE_GOAL, HORSE_DURATION_MS } from './horse.js';
import { STAR_GAME, StarRun, STAR_DURATION_MS, STAR_GOAL } from './stars.js';
import { LADDER_GAME, LadderRun, ladderCourse, LADDER_DURATION_MS } from './ladder.js';
import { STATIONERY_GAME, StationeryRun, STATIONERY_GOAL, STATIONERY_DURATION_MS } from './stationery.js';
import { CLOCK_GAME, ClockRun, CLOCK_GOAL, CLOCK_DURATION_MS } from './clock.js';
import { HAPPY_GAME, HappyRun, HAPPY_GOAL, HAPPY_DURATION_MS, HAPPY_MAX_SCORE } from './happy.js';
import { KAYA_GAME, KayaRun, KAYA_GOAL, KAYA_DURATION_MS, kayaDuration } from './kaya.js';
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
import { FACING_GAME, FacingRun, FACING_GOAL, FACING_DURATION_MS, facingDuration } from './facing.js';
import { LETTERS_GAME, LettersRun, LETTERS_DURATION_MS } from './letters.js';
import { SESAME_GAME, SesameRun, SESAME_GOAL, SESAME_DURATION_MS } from './sesame.js';
import { BALLOON_GAME, BalloonRun, BALLOON_GOAL, BALLOON_DURATION_MS } from './balloon.js';
import { ANT_GAME, MARKET_GAMES, MARKET_SETTINGS, SATAY_GAME, WEATHER_GAME, createMarketRun, marketSettings } from './market-games.js';

import { DYNAMITE_GAME, DynamiteRun, DYNAMITE_GOAL, DYNAMITE_DURATION_MS } from './dynamite.js';

import { MEALS_GAME, MealsRun, MEALS_GOAL, MEALS_DURATION_MS } from './meals.js';

export const COUNTDOWN_MS = 3_000;

export const GAMES = Object.assign(Object.create(null), {
  [BALLOON_GAME]: { id: BALLOON_GAME, title: 'Burst the Balloon', subtitle: 'Pump up your balloon and pop it first', duration: BALLOON_DURATION_MS, goal: BALLOON_GOAL },
  [SESAME_GAME]: { id: SESAME_GAME, title: 'Open Sesame', subtitle: 'Dial the eight-digit code', sharedArena: true, duration: SESAME_DURATION_MS, goal: SESAME_GOAL },
  [WITCH_GAME]: { id: WITCH_GAME, title: 'Witch’s Special Delivery', subtitle: 'Run, brake, and turn a frog into a prince', sharedArena: true, turnBased: true, scoring: 'points', scoreNoun: 'frogs', duration: WITCH_DURATION_MS, goal: WITCH_GOAL },
  [SHARK_GAME]: { id: SHARK_GAME, title: 'Shark Jumper', subtitle: 'Match the shark and hop to safety', duration: SHARK_DURATION_MS, goal: SHARK_GOAL },
  [HORSE_GAME]: { id: HORSE_GAME, title: 'Horse Speeder', subtitle: 'Accelerate and weave through the field', duration: HORSE_DURATION_MS, goal: HORSE_GOAL },
  [STAR_GAME]: { id: STAR_GAME, title: 'Star Collector', subtitle: 'Tilt the maze and chase the stars', scoring: 'points', scoreNoun: 'stars', duration: STAR_DURATION_MS, goal: STAR_GOAL },
  [LADDER_GAME]: { id: LADDER_GAME, title: 'Ladder Climber', subtitle: 'Follow the ladders to the trophy', duration: LADDER_DURATION_MS, goal: 45 },
  [STATIONERY_GAME]: { id: STATIONERY_GAME, title: 'Stationery Master', subtitle: 'Count the desk, tap the totals', sharedArena: true, scoring: 'points', duration: STATIONERY_DURATION_MS, goal: STATIONERY_GOAL },
  [CLOCK_GAME]: { id: CLOCK_GAME, title: 'Clock Stopper', subtitle: 'Stop exactly on the hour', sharedArena: true, scoring: 'points', scoreNoun: 'pts', duration: CLOCK_DURATION_MS, goal: CLOCK_GOAL },
  [HAPPY_GAME]: { id: HAPPY_GAME, title: 'Happy Days', subtitle: 'Tap the beat, hold the melody', scoring: 'accuracy', duration: HAPPY_DURATION_MS, goal: HAPPY_GOAL },
  [KAYA_GAME]: { id: KAYA_GAME, title: "Where's Kaya", subtitle: 'Follow Kaya beneath the blankets', sharedArena: true, scoring: 'points', duration: KAYA_DURATION_MS, goal: KAYA_GOAL },
  [TOTEM_GAME]: { id: TOTEM_GAME, title: 'Totem Shrinker', subtitle: 'A taller tower each round', duration: GAME_DURATION_MS, goal: BLOCK_COUNT },
  [PERM_GAME]: { id: PERM_GAME, title: 'Perm Mania', subtitle: 'A faster groove each round', duration: PERM_DURATION_MS, goal: PHRASE_COUNT },
  [SLOT_GAME]: { id: SLOT_GAME, title: 'Facial Slot Machine', subtitle: 'Faster faces each round', duration: SLOT_DURATION_MS, goal: REEL_COUNT },
  [FIREWORK_GAME]: { id: FIREWORK_GAME, title: 'Fireworks Craze', subtitle: 'Quicker reactions each round', duration: FIREWORK_DURATION_MS, goal: FIREWORK_GOAL },
  [MONKEY_GAME]: { id: MONKEY_GAME, title: 'Mimicking Monkeys', subtitle: 'Longer tricks each round', duration: MONKEY_DURATION_MS, goal: MONKEY_STAGES },
  [JUMP_GAME]: { id: JUMP_GAME, title: 'Jump for the Meat', subtitle: 'Land, boost, reach the feast', duration: JUMP_DURATION_MS, goal: JUMP_GOAL },
  [BURGER_GAME]: { id: BURGER_GAME, title: 'Burger Girl', subtitle: 'Catch a fresh stack of ingredients', duration: BURGER_DURATION_MS, goal: BURGER_GOAL },
  [MISTAKE_GAME]: { id: MISTAKE_GAME, title: 'Me Find Mistake', subtitle: 'Find the picture that does not match', scoring: 'points', duration: MISTAKE_DURATION_MS, goal: MISTAKE_GOAL },
  [DICE_GAME]: { id: DICE_GAME, title: 'Dice, Dice, More Dice', subtitle: 'Spot the highest roll', sharedArena: true, scoring: 'points', duration: DICE_DURATION_MS, goal: DICE_GOAL },
  [FACING_GAME]: { id: FACING_GAME, title: 'Facing Which Way', subtitle: 'Follow the turns and flips', sharedArena: true, scoring: 'points', duration: FACING_DURATION_MS, goal: FACING_GOAL },
  [COIN_GAME]: { id: COIN_GAME, title: "It's Raining Coins", subtitle: 'Catch the gold, dodge the fakes', duration: COIN_DURATION_MS, goal: COIN_GOAL },
  [DODGE_GAME]: { id: DODGE_GAME, title: 'Dodge or Die!!', subtitle: 'Switch lanes and leap the hurdles', duration: DODGE_DURATION_MS, goal: DODGE_GOAL },
  [LETTERS_GAME]: { id: LETTERS_GAME, title: 'Type in Letters', subtitle: 'Complete each word before time runs out', sharedArena: true, scoring: 'points', duration: LETTERS_DURATION_MS, goal: 0 },
  [DYNAMITE_GAME]: { id: DYNAMITE_GAME, title: 'Dynamite Spark', subtitle: 'Race the spark down the wire', duration: DYNAMITE_DURATION_MS, goal: DYNAMITE_GOAL },
  [MEALS_GAME]: { id: MEALS_GAME, title: 'Get Those Burgers Out!', subtitle: 'Fill every slot and serve eight meals', goal: MEALS_GOAL, duration: MEALS_DURATION_MS },
  [SATAY_GAME]: { id: SATAY_GAME, title: 'Satay Snag', subtitle: 'Skewer falling hot dogs midair', ...MARKET_SETTINGS[SATAY_GAME] },
  [WEATHER_GAME]: { id: WEATHER_GAME, title: 'Bottled Weather', subtitle: 'Free the weather one bottle at a time', ...MARKET_SETTINGS[WEATHER_GAME] },
  [ANT_GAME]: { id: ANT_GAME, title: 'Ant Air Mail', subtitle: 'Route tiny paper planes to their burrows', ...MARKET_SETTINGS[ANT_GAME] },
});

export function roundSettings(game, seed, difficulty = 1, mode = 'game-select') {
  const level = Math.max(1, Math.min(5, Math.trunc(difficulty) || 1));
  if (MARKET_GAMES.includes(game)) return marketSettings(game, seed, level);
  if (game === WITCH_GAME) return { seed, difficulty: level, goal: WITCH_GOAL, duration: WITCH_DURATION_MS };
  if (game === SHARK_GAME) return { seed, difficulty: level, goal: SHARK_GOAL + (level - 1) * 10, duration: SHARK_DURATION_MS };
  if (game === HORSE_GAME) return { seed, difficulty: level, goal: HORSE_GOAL, duration: HORSE_DURATION_MS, spacing: 140 - (level - 1) * 10 };
  if (game === STAR_GAME) return { seed, difficulty: level, goal: STAR_GOAL, duration: STAR_DURATION_MS };
  if (game === LADDER_GAME) return { seed, difficulty: level, goal: ladderCourse(seed).reduce((sum, ladder) => sum + ladder.steps, 0), ladderSets: 10, duration: LADDER_DURATION_MS };
  if (game === STATIONERY_GAME) return { seed, difficulty: level, goal: STATIONERY_GOAL, duration: STATIONERY_DURATION_MS };
  if (game === CLOCK_GAME) return { seed, difficulty: level, goal: CLOCK_GOAL, duration: CLOCK_DURATION_MS };
  if (game === HAPPY_GAME) return { seed, difficulty: level, goal: HAPPY_GOAL, duration: HAPPY_DURATION_MS, maxScore: HAPPY_MAX_SCORE };
  if (game === KAYA_GAME) return { seed, difficulty: level, goal: KAYA_GOAL, duration: kayaDuration(level) };
  if (game === MEALS_GAME) return { seed, difficulty: level, goal: MEALS_GOAL, duration: MEALS_DURATION_MS };
  if (game === DYNAMITE_GAME) return { seed, difficulty: level, goal: DYNAMITE_GOAL, duration: DYNAMITE_DURATION_MS };
  if (game === LETTERS_GAME) return { seed, difficulty: level, goal: 0, duration: LETTERS_DURATION_MS };
  if (game === SESAME_GAME) return { seed, difficulty: level, goal: SESAME_GOAL, duration: SESAME_DURATION_MS };
  if (game === BALLOON_GAME) return { seed, difficulty: level, goal: BALLOON_GOAL, duration: BALLOON_DURATION_MS };
  if (game === COIN_GAME) return { seed, difficulty: level, goal: COIN_GOAL, duration: COIN_DURATION_MS, fallMs: mode === 'arcade' ? 1200 : 1300 - (level - 1) * 80, spawnMs: mode === 'arcade' ? 700 : 720 - (level - 1) * 40 };
  if (game === DODGE_GAME) return { seed, difficulty: level, goal: DODGE_GOAL + level - 1, duration: DODGE_DURATION_MS, approachMs: 1350 - (level - 1) * 100 };
  if (game === DICE_GAME) return { seed, difficulty: level, goal: DICE_GOAL, duration: DICE_DURATION_MS };
  if (game === FACING_GAME) return { seed, difficulty: level, goal: mode === 'arcade' ? 8 : FACING_GOAL, duration: facingDuration(1800 - (level - 1) * 100, level + 1, mode === 'arcade' ? 8 : FACING_GOAL), turnCount: level + 1, stepMs: 1800 - (level - 1) * 100 };
  if (game === BURGER_GAME) return { seed, difficulty: level, goal: BURGER_GOAL, duration: BURGER_DURATION_MS, fallMs: 1100 - (level - 1) * 110 };
  if (game === MISTAKE_GAME) return { seed, difficulty: level, goal: mode === 'arcade' ? 15 : MISTAKE_GOAL + level - 1, duration: mode === 'arcade' ? 45000 : MISTAKE_DURATION_MS };
  if (game === JUMP_GAME) return { seed, difficulty: level, goal: JUMP_GOAL, duration: JUMP_DURATION_MS, periodMs: 1200 - (level - 1) * 50, windowMs: 150 - (level - 1) * 15, perfectMs: Math.round((150 - (level - 1) * 15) * .3) };
  if (game === MONKEY_GAME) return { seed, difficulty: level, goal: MONKEY_STAGES + level - 1, duration: MONKEY_DURATION_MS, stepMs: 650 - (level - 1) * 40 };
  if (game === FIREWORK_GAME) return { seed, difficulty: level, goal: mode === 'arcade' ? 10 : FIREWORK_GOAL, duration: mode === 'arcade' ? 60000 : FIREWORK_DURATION_MS, speed: 1 - (level - 1) * .06 };
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
  if (round.game === WITCH_GAME) return new WitchRun(round, localStart);
  if (round.game === SHARK_GAME) return new SharkRun(round, localStart);
  if (round.game === HORSE_GAME) return new HorseRun(round, localStart);
  if (round.game === STAR_GAME) return new StarRun(round, localStart);
  if (round.game === LADDER_GAME) return new LadderRun(round, localStart);
  if (round.game === STATIONERY_GAME) return new StationeryRun(round, localStart);
  if (round.game === CLOCK_GAME) return new ClockRun(round, localStart);
  if (round.game === HAPPY_GAME) return new HappyRun(round, localStart, timingOffset);
  if (round.game === KAYA_GAME) return new KayaRun(round, localStart);
  if (round.game === MEALS_GAME) return new MealsRun(round, localStart);
  if (round.game === DYNAMITE_GAME) return new DynamiteRun(round, localStart);
  if (round.game === LETTERS_GAME) return new LettersRun(round, localStart);
  if (round.game === SESAME_GAME) return new SesameRun(round, localStart);
  if (round.game === BALLOON_GAME) return new BalloonRun(round, localStart);
  if (MARKET_GAMES.includes(round.game)) return createMarketRun(round, localStart);
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

export function gameRules(game, round = {}) {
  if (game === SATAY_GAME) return ['Watch the hot dog fall toward the skewer.', 'Tap any button when they line up. Catch eight as fast as you can.'];
  if (game === WEATHER_GAME) return ['Match each bottle to its button. One press breaks one bottle.', 'Clear both trays to get a fresh set. Finish all six sets first.'];
  if (game === ANT_GAME) return ['Look where the paper plane’s nose points.', 'Red sends it left, green down, and blue right. Route all twelve first.'];
  if (game === WITCH_GAME) return ['Alternate red and blue to run faster', 'Hold green anywhere before the edge to stop and aim', 'Release green to throw. Most frogs passed wins'];
  if (game === SHARK_GAME) return ['Press the button matching the next shark’s color', 'Land on each shark to turn it into safe grey stone', 'Wrong color? Climb back up and continue. Fastest wins'];
  if (game === HORSE_GAME) return ['Tap green to accelerate; stop tapping to slow down', 'Red moves left; blue moves right. Dodge slower horses', 'Reach the finish first; bumps knock down your speed'];
  if (game === STAR_GAME) return ['Hold red to tilt left; hold blue to tilt right', 'Release to level the maze; green is unused', 'Steer the car into stars; most collected in 45 seconds wins'];
  if (game === LADDER_GAME) return ['Follow the ladder position: red = left, green = middle, blue = right', 'Press once per rung, then follow the next ladder', 'Climb all ten ladders to reach the trophy'];
  if (game === STATIONERY_GAME) return ['Count the pencils, erasers and sharpeners on the desk', 'Red = pencil, green = eraser, blue = sharpener; tap each total', 'Match all three counts before time runs out; 6 loops back to 0'];
  if (game === CLOCK_GAME) return ['Watch the minute hand make its first full turn', 'Press any button when it returns to 12', 'Accurate stops earn 10, 7, 4 or 1 points in order of accuracy'];
  if (game === HAPPY_GAME) return ['Press the matching color when a bar touches the line', 'Hold long bars; release when the tail reaches the line', 'Perfect = 1000 points, Good = 500, Missed = 0'];
  if (game === KAYA_GAME) return ['Remember Kaya, then follow the blankets', 'Choose Kaya: red = left, green = middle, blue = right', 'Eight sets get faster; each correct answer earns a point'];
  if (game === MEALS_GAME) return ['Fill the empty slots to complete each meal', 'Red = fries, green = burger, blue = drink', 'Serve all eight meals as fast as you can'];
  if (game === DYNAMITE_GAME) return ['Match the wire colour with the same button', 'Tap four sections per colour; clear all 13 groups', 'Reach the dynamite first; wrong colours briefly pause the spark'];
  if (game === LETTERS_GAME) return ['Red moves left, blue moves right, green enters a letter', 'Finish the three letters before time runs out to earn a point; choose ⌫ to erase', 'Everyone who finishes scores; each new word has less time'];
  if (game === SESAME_GAME) return ['Red moves left around the dial. Blue moves right.', 'Press green to enter the highlighted digit.', 'A wrong digit leaves your code in place. Finish all eight digits first.'];
  if (game === BALLOON_GAME) return ['Alternate red and blue to pump up your balloon.', 'Pop your balloon as fast as you can.'];
  if (game === COIN_GAME) return ['Catch gold coins and avoid cracked purple coins', 'Red = left, green = middle, blue = right'];
  if (game === DODGE_GAME) return ['Move into gaps between walls. Red - Move left. Blue - Move right', 'Press green to jump over low hurdles'];
  if (game === DICE_GAME) return ['Pick the highest of the three shared dice', 'Red = left, green = middle, blue = right', '21 throws get faster; most correct wins'];
  if (game === FACING_GAME) return ['Watch the shared duck card turn and flip', 'Choose its final picture: red = left, green = middle, blue = right', `You have 3 seconds; answers reveal together; most correct of ${round.goal || FACING_GOAL} wins`];
  if (game === BURGER_GAME) return ['Move the plate to catch the falling food', 'Red = left, green = middle, blue = right'];
  if (game === MISTAKE_GAME) return ['Pick the picture that is different', 'Red = top, green = middle, blue = bottom', 'Every answer moves on; most correct wins'];
  if (game === JUMP_GAME) return ['Press any button as the dinosaur lands on the trampoline', 'Perfect landings climb twice as high as Good landings'];
  if (game === MONKEY_GAME) return ['Watch the colors of the items the monkey holds', 'Copy the order with the matching buttons'];
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
  if (GAMES[game]?.scoring === 'accuracy') return b.result.score - a.result.score;
  if (GAMES[game]?.scoring === 'points') return b.result.cleared - a.result.cleared;
  if (game === PERM_GAME) return b.result.cleared - a.result.cleared || b.result.score - a.result.score;
  return a.result.elapsed - b.result.elapsed;
}
