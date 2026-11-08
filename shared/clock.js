import { ChoiceRun, CHOICE_GRACE_MS, CHOICE_PACKET_MS } from './choice-round.js';

export const CLOCK_GAME = 'clock-stopper';
export const CLOCK_GOAL = 10;
export const CLOCK_LOOK_MS = 800;
export const CLOCK_REVEAL_MS = 900;
export const CLOCK_POINTS = [10, 7, 4, 1];
export const clockPeriod = index => Math.round(1200 - index * 700 / 9);
export function clockStages(round = {}) {
  let startsAt = 0;
  return Array.from({ length: round.goal || CLOCK_GOAL }, (_, index) => {
    const period = clockPeriod(index), spinAt = startsAt + CLOCK_LOOK_MS;
    const targetAt = spinAt + period, answerAt = spinAt + period / 2, answerEnd = spinAt + period * 1.5;
    const endsAt = answerEnd + CLOCK_REVEAL_MS;
    const stage = { index, startsAt, spinAt, targetAt, answerAt, answerEnd, endsAt, puzzle: { hour: index + 1, period } };
    startsAt = endsAt; return stage;
  });
}
export const CLOCK_DURATION_MS = clockStages().at(-1).endsAt;
export class ClockRun extends ChoiceRun {
  constructor(round, start) { super(round, start, clockStages(round)); }
  phase(time) {
    const elapsed = time - this.start;
    if (!Number.isFinite(time) || elapsed < 0) return { mode: 'wait', index: 0, stage: this.stages[0] };
    const index = this.stages.findIndex(stage => elapsed < stage.endsAt);
    if (index < 0) return { mode: 'done', index: this.stages.length - 1, stage: this.stages.at(-1) };
    const stage = this.stages[index];
    return { mode: elapsed < stage.spinAt ? 'look' : elapsed < stage.answerAt ? 'spin' : elapsed < stage.answerEnd ? 'play' : 'reveal', index, stage };
  }
}

export class ClockMatch {
  constructor(round, stages) {
    this.round = round; this.stages = stages; this.choices = new Map();
    this.state = { scores: Object.fromEntries(round.playerIds.map(id => [id, 0])), stops: {}, results: [] };
  }
  choose(playerId, message, receivedElapsed) {
    const { index, color, elapsed } = message, stage = this.stages[index];
    if (!Object.hasOwn(this.state.scores, playerId) || !Number.isInteger(index) || !stage || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(elapsed)) return false;
    const key = `${playerId}/${index}`, prior = this.choices.get(key);
    if (prior) return prior.color === color && prior.elapsed === elapsed;
    if (elapsed < stage.answerAt || elapsed >= stage.answerEnd || elapsed > receivedElapsed + 250 || receivedElapsed - elapsed > CHOICE_PACKET_MS || receivedElapsed >= stage.answerEnd + CHOICE_GRACE_MS || this.state.results.some(result => result.index === index)) return false;
    this.choices.set(key, { color, elapsed });
    const current = this.state.stops[playerId];
    if (!current || index >= current.index) this.state.stops[playerId] = { index, elapsed };
    return true;
  }
  advance(elapsed) {
    let changed = false;
    for (const stage of this.stages) {
      if (elapsed < stage.answerEnd + CHOICE_GRACE_MS || this.state.results.some(result => result.index === stage.index)) continue;
      const errors = Object.fromEntries(this.round.playerIds.map(id => {
        const choice = this.choices.get(`${id}/${stage.index}`);
        return [id, choice ? Math.round(choice.elapsed - stage.targetAt) : null];
      }));
      const correctIds = this.round.playerIds.filter(id => errors[id] !== null && Math.abs(errors[id]) <= stage.puzzle.period * .08);
      const awards = Object.fromEntries(this.round.playerIds.map(id => [
        id, correctIds.includes(id) ? CLOCK_POINTS[correctIds.filter(other => Math.abs(errors[other]) < Math.abs(errors[id])).length] : 0,
      ]));
      this.round.playerIds.forEach(id => { this.state.scores[id] += awards[id]; });
      this.state.results.push({ index: stage.index, at: stage.answerEnd + CHOICE_GRACE_MS, errors, awards, correctIds });
      changed = true;
    }
    return changed;
  }
}
