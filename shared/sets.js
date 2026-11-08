import { GAMES, comparePlayers } from './games.js';
import { PERM_GAME } from './perm.js';

export const ARCADE_LENGTH = 5;
export const PARTY_PICK_MS = 30_000;
export const PARTY_LOCK_HOLD_MS = 900;
export function arcadeLength(value) {
  return Number.isInteger(value) ? Math.max(3, Math.min(Object.keys(GAMES).length, value)) : ARCADE_LENGTH;
}
export const GAME_SELECT_LENGTH = 3;
export const INTERMISSION_MS = 5_000;
export const WHEEL_SPIN_MS = 4_700;
export const REEL_HOLD_MS = 2_000;
export const GAME_ANNOUNCEMENT_MS = 2_000;
export const PLACE_POINTS = [10, 7, 4, 1];
export const MODES = Object.assign(Object.create(null), {
  arcade: { title: 'Arcade', length: ARCADE_LENGTH },
  'game-select': { title: 'Game Select', length: GAME_SELECT_LENGTH },
  party: { title: 'Party', length: null },
});

export function arcadeGameIds(gameIds = Object.keys(GAMES)) {
  return [...gameIds];
}

export function createSetPlan(mode, game, chooseIndex = max => Math.floor(Math.random() * max), gameIds = Object.keys(GAMES), length = ARCADE_LENGTH) {
  if (mode === 'party') return [];
  if (mode === 'game-select') return Array(GAME_SELECT_LENGTH).fill(game);
  const shuffled = arcadeGameIds(gameIds);
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = chooseIndex(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled.slice(0, arcadeLength(length));
}

export function awardRound(players, game) {
  const ranked = players.filter(player => player.result?.status === 'finished' && (game !== PERM_GAME || player.result.score > 0) && (GAMES[game]?.scoring !== 'accuracy' || player.result.score > 0) && (GAMES[game]?.scoring !== 'points' || player.result.cleared > 0)).sort((a, b) => comparePlayers(a, b, game));
  return players.map(player => {
    const placement = ranked.includes(player) ? ranked.findIndex(other => comparePlayers(other, player, game) === 0) + 1 : null;
    return { playerId: player.id, name: player.name, result: player.result || { status: 'missing' }, placement, points: placement ? PLACE_POINTS[placement - 1] || 0 : 0 };
  });
}

export function setStandings(players) {
  const sorted = [...players].sort((a, b) => b.points - a.points);
  return sorted.map(player => ({ ...player, placement: sorted.findIndex(other => other.points === player.points) + 1 }));
}
