import { GAMES, comparePlayers } from './games.js';
import { PERM_GAME } from './perm.js';
import { SLOT_GAME } from './slots.js';
import { FIREWORK_GAME } from './fireworks.js';
import { MONKEY_GAME } from './monkeys.js';
import { JUMP_GAME } from './jump.js';
import { LETTERS_GAME } from './letters.js';

export const ARCADE_LENGTH = 5;
export const GAME_SELECT_LENGTH = 3;
export const INTERMISSION_MS = 5_000;
export const WHEEL_SPIN_MS = 4_700;
export const REEL_HOLD_MS = 2_000;
export const GAME_ANNOUNCEMENT_MS = 2_000;
export const ARCADE_BATCH_SIZE = 4;
export const PLACE_POINTS = [10, 7, 4, 1];
export const MODES = Object.assign(Object.create(null), {
  arcade: { title: 'Arcade', length: ARCADE_LENGTH },
  'game-select': { title: 'Game Select', length: GAME_SELECT_LENGTH },
});

export function arcadeGameIds(gameIds = Object.keys(GAMES)) {
  return gameIds.slice(0, Math.floor(gameIds.length / ARCADE_BATCH_SIZE) * ARCADE_BATCH_SIZE);
}

export function createSetPlan(mode, game, chooseIndex = max => Math.floor(Math.random() * max), gameIds = Object.keys(GAMES)) {
  if (mode === 'game-select') return Array(GAME_SELECT_LENGTH).fill(game);
  const shuffled = arcadeGameIds(gameIds);
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = chooseIndex(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled.slice(0, ARCADE_LENGTH);
}

export function awardRound(players, game) {
  const ranked = players.filter(player => player.result?.status === 'finished' && (game !== PERM_GAME || player.result.score > 0) && (GAMES[game]?.scoring !== 'points' || player.result.cleared > 0)).sort((a, b) => comparePlayers(a, b, game));
  return players.map(player => {
    const placement = ranked.includes(player) ? ranked.findIndex(other => comparePlayers(other, player, game) === 0) + 1 : null;
    return { playerId: player.id, name: player.name, result: player.result || { status: 'missing' }, placement, points: placement ? PLACE_POINTS[placement - 1] || 0 : 0 };
  });
}

export function setStandings(players) {
  const sorted = [...players].sort((a, b) => b.points - a.points);
  return sorted.map(player => ({ ...player, placement: sorted.findIndex(other => other.points === player.points) + 1 }));
}

export function roundDetail(round) {
  if (round.game === 'dynamite-spark') return 'Reach the dynamite · Fastest wins';
  if (round.game === 'get-those-burgers-out') return 'Serve the meals · Fastest wins';
  if (round.game === 'type-in-letters') return '30 seconds · Most points wins';
  if (round.game === 'its-raining-coins') return `${round.goal} coins · Speed ${round.difficulty}`;
  if (round.game === 'dodge-or-die') return `${round.goal} obstacles · Speed ${round.difficulty}`;
  if (round.game === 'dice-dice-more-dice') return '21 throws · 25 seconds';
  if (round.game === 'facing-which-way') return '5 sets · Most correct wins';
  if (round.game === 'burger-girl') return `${round.goal / 4} burgers · Speed ${round.difficulty}`;
  if (round.game === 'me-find-mistake') return `${round.goal} pictures · Most correct wins`;
  if (round.game === JUMP_GAME) return `Reach the meat · Speed ${round.difficulty}`;
  if (round.game === MONKEY_GAME) return `${round.goal} stages · ${round.goal + 1} moves`;
  if (round.game === FIREWORK_GAME) return `${round.goal} sets · Speed ${round.difficulty}`;
  if (round.game === SLOT_GAME) return `3 reels · Speed ${round.difficulty}`;
  return round.game === PERM_GAME ? `${round.bpm} BPM` : `${round.blockCount} blocks`;
}
