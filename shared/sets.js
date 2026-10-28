import { GAMES, comparePlayers } from './games.js';
import { PERM_GAME } from './perm.js';
import { SLOT_GAME } from './slots.js';
import { FIREWORK_GAME } from './fireworks.js';
import { MONKEY_GAME } from './monkeys.js';
import { JUMP_GAME } from './jump.js';

export const ARCADE_LENGTH = 5;
export const GAME_SELECT_LENGTH = 5;
export const INTERMISSION_MS = 8_000;
export const WHEEL_SPIN_MS = 5_500;
export const PLACE_POINTS = [10, 7, 4, 1];
export const MODES = Object.assign(Object.create(null), {
  arcade: { title: 'Arcade', length: ARCADE_LENGTH },
  'game-select': { title: 'Game Select', length: GAME_SELECT_LENGTH },
});

export function createSetPlan(mode, game, chooseIndex = max => Math.floor(Math.random() * max), gameIds = Object.keys(GAMES)) {
  if (mode === 'game-select') return Array(GAME_SELECT_LENGTH).fill(game);
  const shuffled = [...gameIds];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = chooseIndex(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled.slice(0, ARCADE_LENGTH);
}

export function awardRound(players, game) {
  const ranked = players.filter(player => player.result?.status === 'finished' && (game !== PERM_GAME || player.result.score > 0)).sort((a, b) => comparePlayers(a, b, game));
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
  if (round.game === 'burger-girl') return `${round.goal / 4} burgers · Speed ${round.difficulty}`;
  if (round.game === 'me-find-mistake') return `${round.goal} puzzles · Level ${round.difficulty}`;
  if (round.game === JUMP_GAME) return `${round.goal} boosts · Speed ${round.difficulty}`;
  if (round.game === MONKEY_GAME) return `${round.goal} stages · ${round.goal + 1} moves`;
  if (round.game === FIREWORK_GAME) return `${round.goal} bursts · Speed ${round.difficulty}`;
  if (round.game === SLOT_GAME) return `3 reels · Speed ${round.difficulty}`;
  return round.game === PERM_GAME ? `${round.bpm} BPM` : `${round.blockCount} blocks`;
}
