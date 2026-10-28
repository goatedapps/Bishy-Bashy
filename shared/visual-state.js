import { createRun } from './games.js';

const SCHEMAS = {
  'totem-shrinker': { blockedUntil: 'time' },
  'perm-mania': { blockedUntil: 'time' },
  'burger-girl': { index: 'index', position: 'column', launchedAt: 'time', blockedUntil: 'time' },
  'its-raining-coins': { index: 'index', position: 'column', launchedAt: 'time', blockedUntil: 'time' },
  'dodge-or-die': { index: 'index', position: 'column', launchedAt: 'time', blockedUntil: 'time', jumpAt: 'time' },
  'fireworks-craze': { index: 'index', launchedAt: 'time', blockedUntil: 'time' },
  'jump-for-the-meat': { launchedAt: 'time', blockedUntil: 'time', launchHeight: 'height', finishAt: 'nullableTime' },
  'mimicking-monkeys': { demoAt: 'time', playAt: 'time', entered: 'index', blockedUntil: 'time' },
  'me-find-mistake': { shownAt: 'time', blockedUntil: 'time' },
  'dice-dice-more-dice': { shownAt: 'time', blockedUntil: 'time' },
  'facing-which-way': { trialAt: 'time', blockedUntil: 'time' },
  'facial-slot-machine': { reelMask: 'mask', blockedReels: 'times', stoppedAt: 'durations', pausedMs: 'durations', missedFaces: 'faces' },
};
const relative = (time, start) => Number.isFinite(time) ? Math.max(-10000, time - start) : -10000;
const KINDS = new Set(['hit', 'miss', 'catch', 'decoy', 'clear', 'crash', 'boost', 'burst', 'Perfect!', 'Good!', 'Miss', 'Oops!']);

export function captureVisual(game, run, time) {
  const schema = SCHEMAS[game];
  if (!schema || !run) return undefined;
  const fields = {};
  for (const [key, type] of Object.entries(schema)) {
    const value = run[key];
    fields[key] = type === 'time' ? relative(value, run.start) : type === 'nullableTime' ? value === null ? null : relative(value, run.start) : type === 'times' ? value.map(item => relative(item, run.start)) : Array.isArray(value) ? [...value] : value;
  }
  const feedback = run.feedback ? { kind: run.feedback.kind, at: relative(run.feedback.at, run.start) } : null;
  if (feedback) for (const key of ['color', 'ingredient', 'gain', 'perfect', 'served']) if (run.feedback[key] !== undefined) feedback[key] = run.feedback[key];
  return { sample: Math.max(0, time - run.start), fields, feedback, done: run.done, elapsed: run.elapsed };
}

export function sanitizeVisual(round, visual, receivedElapsed) {
  if (!visual || typeof visual !== 'object' || !visual.fields || typeof visual.fields !== 'object') return null;
  const schema = SCHEMAS[round.game];
  if (!schema || !Number.isFinite(visual.sample) || visual.sample < 0 || visual.sample > Math.min(round.duration + 1000, receivedElapsed + 500)) return null;
  if (typeof visual.done !== 'boolean' || visual.elapsed !== null && (!Number.isFinite(visual.elapsed) || visual.elapsed < 0 || visual.elapsed > round.duration)) return null;
  const fields = {};
  const number = (value, low, high, integer = false) => Number.isFinite(value) && value >= low && value <= high && (!integer || Number.isInteger(value));
  for (const [key, type] of Object.entries(schema)) {
    const value = visual.fields[key];
    const valid = type === 'time' || type === 'nullableTime' ? type === 'nullableTime' && value === null || number(value, -10000, round.duration + 10000) : type === 'height' ? number(value, 0, 1) : ['times', 'durations', 'faces'].includes(type) ? Array.isArray(value) && value.length === 3 && value.every(item => type === 'faces' ? item === null || number(item, 0, 5, true) : number(item, type === 'times' ? -10000 : 0, round.duration + 10000)) : number(value, 0, type === 'column' ? 2 : type === 'mask' ? 7 : 2048, true);
    if (!valid) return null;
    fields[key] = Array.isArray(value) ? [...value] : value;
  }
  let feedback = null;
  if (visual.feedback !== null) {
    const value = visual.feedback;
    if (!value || !KINDS.has(value.kind) || !number(value.at, -10000, visual.sample + 500)) return null;
    feedback = { kind: value.kind, at: value.at };
    for (const key of ['color', 'ingredient', 'gain']) if (value[key] !== undefined) {
      if (!number(value[key], 0, key === 'ingredient' ? 3 : 2, true)) return null;
      feedback[key] = value[key];
    }
    for (const key of ['perfect', 'served']) if (value[key] !== undefined) {
      if (typeof value[key] !== 'boolean') return null;
      feedback[key] = value[key];
    }
  }
  return { sample: visual.sample, fields, feedback, done: visual.done, elapsed: visual.elapsed };
}

export class RemoteRuns {
  constructor() { this.runs = new Map(); }

  get(round, player, start) {
    const progress = player?.progress;
    const visual = progress?.visual;
    if (!visual) return null;
    const key = `${round.id}/${player.id}`;
    if (this.round !== round.id) { this.runs.clear(); this.round = round.id; }
    let entry = this.runs.get(key);
    if (!entry || entry.start !== start) {
      entry = { start, run: createRun(round, start), visual: null };
      this.runs.set(key, entry);
    }
    if (entry.visual !== visual) {
      const run = entry.run;
      Object.assign(run, { cleared: progress.cleared, mistakes: progress.mistakes, done: visual.done, elapsed: visual.elapsed });
      for (const [name, type] of Object.entries(SCHEMAS[round.game])) {
        const value = visual.fields[name];
        run[name] = type === 'time' ? start + value : type === 'nullableTime' ? value === null ? null : start + value : type === 'times' ? value.map(item => start + item) : Array.isArray(value) ? [...value] : value;
      }
      run.feedback = visual.feedback ? { ...visual.feedback, at: start + visual.feedback.at } : null;
      if (run.feedback && ['me-find-mistake', 'dice-dice-more-dice', 'facing-which-way'].includes(round.game)) run.feedback.puzzle = run.sequence[Math.max(0, Math.min(run.goal - 1, run.cleared - (run.feedback.kind === 'hit' ? 1 : 0)))];
      entry.visual = visual;
    }
    return entry.run;
  }
}
