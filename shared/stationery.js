import { ChoiceRun } from './choice-round.js';
import { seededIndex } from './seeded-index.js';

export const STATIONERY_GAME = 'stationery-master';
export const STATIONERY_WINDOWS_MS = [8000, 7400, 6800, 6200, 5600, 5000];
export const STATIONERY_GOAL = 6;
export const STATIONERY_MAX_COUNT = 6;
export const STATIONERY_THROW_MS = 500;
export const STATIONERY_THROW_STAGGER_MS = 80;
export const STATIONERY_INTRO_MS = 2000;
export const STATIONERY_GRACE_MS = 500;
export const STATIONERY_REVEAL_MS = 900;
export const STATIONERY_DURATION_MS = STATIONERY_WINDOWS_MS.reduce((sum, window) => sum + STATIONERY_INTRO_MS + window + STATIONERY_GRACE_MS + STATIONERY_REVEAL_MS, 0);
export const STATIONERY_NAMES = ['Pencil', 'Eraser', 'Sharpener'];

export function stationeryStages(round) {
  const choose = seededIndex(round.seed);
  let startsAt = 0;
  return STATIONERY_WINDOWS_MS.slice(0, round.goal || STATIONERY_GOAL).map((window, index) => {
    const counts = [1 + choose(STATIONERY_MAX_COUNT), 1 + choose(STATIONERY_MAX_COUNT), 1 + choose(STATIONERY_MAX_COUNT)];
    const cells = Array.from({ length: 28 }, (_, cell) => cell);
    for (let cell = 27; cell > 0; cell--) {
      const other = choose(cell + 1); [cells[cell], cells[other]] = [cells[other], cells[cell]];
    }
    const items = counts.flatMap((count, color) => Array.from({ length: count }, () => color)).map((color, item) => {
      const cell = cells[item];
      return { color, x: 8 + cell % 7 * 14 + (choose(21) - 10) / 10,
        y: 14 + Math.floor(cell / 7) * 24 + (choose(41) - 20) / 10, angle: choose(37) - 18 };
    });
    const answerAt = startsAt + STATIONERY_INTRO_MS, answerEnd = answerAt + window, revealAt = answerEnd + STATIONERY_GRACE_MS;
    const endsAt = revealAt + STATIONERY_REVEAL_MS;
    const stage = { index, startsAt, answerAt, answerEnd, revealAt, endsAt, puzzle: { counts, items } };
    startsAt = endsAt;
    return stage;
  });
}

export class StationeryRun extends ChoiceRun {
  constructor(round, start) {
    super(round, start, stationeryStages(round));
    this.traces = new Map(); this.counters = new Map(); this.lastInputs = [-Infinity, -Infinity, -Infinity];
  }
  phase(time) {
    const elapsed = time - this.start;
    if (!Number.isFinite(time) || elapsed < 0) return { mode: 'wait', index: 0, stage: this.stages[0] };
    const index = this.stages.findIndex(stage => elapsed < stage.endsAt);
    if (index < 0) return { mode: 'done', index: this.stages.length - 1, stage: this.stages.at(-1) };
    const stage = this.stages[index];
    return { mode: elapsed < stage.answerAt ? 'throw' : elapsed < stage.answerEnd ? 'play' : elapsed < stage.revealAt ? 'settling' : 'reveal', index, stage };
  }
  get counts() { return this.counters.get(this.index) || [0, 0, 0]; }
  tap(color, time) {
    const phase = this.phase(time);
    if (this.done || phase.mode !== 'play' || !Number.isInteger(color) || color < 0 || color > 2 || time - this.lastInputs[color] < 40) return { type: 'ignored' };
    this.index = phase.index;
    const counts = [...this.counts];
    this.lastInputs[color] = time;
    counts[color] = (counts[color] + 1) % (STATIONERY_MAX_COUNT + 1);
    this.counters.set(this.index, counts);
    const actions = [...(this.traces.get(this.index) || []), [color, Math.floor(time - this.start)]];
    this.traces.set(this.index, actions);
    this.pending.set(this.index, { index: this.index, actions });
    return { type: 'choice' };
  }
}

export class StationeryMatch {
  constructor(round, stages) {
    this.round = round; this.stages = stages; this.choices = new Map();
    this.state = { scores: Object.fromEntries(round.playerIds.map(id => [id, 0])), counters: {}, results: [] };
  }
  choose(playerId, message, receivedElapsed) {
    const { index, actions } = message, stage = this.stages[index];
    if (!Object.hasOwn(this.state.scores, playerId) || !Number.isInteger(index) || !stage || !Array.isArray(actions) || !actions.length || actions.length > Math.ceil((stage.answerEnd - stage.answerAt) / 40) * 3) return false;
    const key = `${playerId}/${index}`, prior = this.choices.get(key);
    if (prior && JSON.stringify(prior.actions) === JSON.stringify(actions)) return true;
    if (receivedElapsed < stage.answerAt || receivedElapsed >= stage.revealAt || this.state.results.some(result => result.index === index) || prior && actions.length <= prior.actions.length) return false;
    const counts = [0, 0, 0], last = [-Infinity, -Infinity, -Infinity];
    let previousAt = -Infinity;
    for (let position = 0; position < actions.length; position++) {
      const action = actions[position];
      if (!Array.isArray(action) || action.length !== 2) return false;
      const [color, at] = action;
      if (!Number.isInteger(color) || color < 0 || color > 2 || !Number.isInteger(at) || at < stage.answerAt || at >= stage.answerEnd || at < previousAt || at < last[color] + 40 || at > receivedElapsed + 250) return false;
      if (prior && position < prior.actions.length && (color !== prior.actions[position][0] || at !== prior.actions[position][1])) return false;
      counts[color] = (counts[color] + 1) % (STATIONERY_MAX_COUNT + 1);
      previousAt = last[color] = at;
    }
    const entry = { actions: actions.map(action => [...action]), counts };
    this.choices.set(key, entry);
    const current = this.state.counters[playerId];
    if (!current || index >= current.index) this.state.counters[playerId] = { index, counts: [...counts] };
    return true;
  }
  advance(elapsed) {
    let changed = false;
    for (const stage of this.stages) {
      if (elapsed < stage.revealAt || this.state.results.some(result => result.index === stage.index)) continue;
      const counts = Object.fromEntries(this.round.playerIds.map(id => [id, this.choices.get(`${id}/${stage.index}`)?.counts || [0, 0, 0]]));
      const correctIds = this.round.playerIds.filter(id => counts[id].every((count, color) => count === stage.puzzle.counts[color]));
      correctIds.forEach(id => { this.state.scores[id]++; });
      this.state.results.push({ index: stage.index, at: stage.revealAt, counts, answer: stage.puzzle.counts, correctIds });
      changed = true;
    }
    return changed;
  }
}
