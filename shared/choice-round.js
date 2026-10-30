export const CHOICE_GRACE_MS = 80;
export const CHOICE_PACKET_MS = 800;
export const isSharedChoice = game => game === 'dice-dice-more-dice' || game === 'facing-which-way';

export class ChoiceRun {
  constructor(round, localStart, stages) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.stages = stages;
    this.cues = stages.flatMap(stage => stage.cues || []).map(at => ({ at: localStart + at }));
    this.rollCues = stages.map(stage => ({ at: localStart + stage.startsAt }));
    this.goal = stages.length;
    this.index = 0;
    this.cleared = 0;
    this.mistakes = 0;
    this.blockedUntil = localStart;
    this.done = false;
    this.elapsed = null;
    this.selections = new Map();
    this.pending = new Map();
  }

  get stage() { return this.stages[this.index]; }
  get puzzle() { return this.stage.puzzle; }
  get readyAt() { return this.start + this.stage.answerAt; }

  phase(time) {
    const elapsed = time - this.start;
    if (!Number.isFinite(time) || elapsed < 0) return { mode: 'wait', index: 0, stage: this.stages[0] };
    if (elapsed >= this.end - this.start) return { mode: 'done', index: this.stages.length - 1, stage: this.stages.at(-1) };
    const index = this.stages.findIndex(stage => elapsed < stage.endsAt);
    const stage = this.stages[index];
    if (elapsed >= stage.answerEnd) return { mode: 'reveal', index, stage };
    if (elapsed >= stage.answerAt) return { mode: 'play', index, stage };
    if (elapsed < stage.coverAt) return { mode: 'look', index, stage };
    if (elapsed < stage.coveredAt) return { mode: 'cover', index, stage, progress: (elapsed - stage.coverAt) / (stage.coveredAt - stage.coverAt) };
    if (elapsed < stage.turnsAt) return { mode: 'covered', index, stage };
    const turn = Math.floor((elapsed - stage.turnsAt) / stage.stepMs);
    if (turn < stage.puzzle.moves.length) return { mode: 'turn', index, stage, turn, progress: (elapsed - stage.turnsAt - turn * stage.stepMs) / stage.stepMs };
    return { mode: 'handoff', index, stage };
  }

  advance(time) { this.index = this.phase(time).index; }

  tap(color, time) {
    const phase = this.phase(time);
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || phase.mode !== 'play' || this.selections.has(phase.index)) return { type: 'ignored' };
    this.index = phase.index;
    const selection = { index: this.index, color, elapsed: time - this.start };
    this.selections.set(this.index, selection);
    this.pending.set(this.index, selection);
    return { type: 'choice' };
  }

  sync(state, playerId) {
    if (!state) return;
    this.cleared = state.scores[playerId] || 0;
    this.mistakes = state.results.filter(result => !result.correctIds.includes(playerId)).length;
  }
}

export class ChoiceMatch {
  constructor(round, stages) {
    this.round = round;
    this.stages = stages;
    this.choices = new Map();
    this.state = { scores: Object.fromEntries(round.playerIds.map(id => [id, 0])), results: [] };
  }

  choose(playerId, message, receivedElapsed) {
    const { index, color, elapsed } = message;
    if (!Object.hasOwn(this.state.scores, playerId) || !Number.isInteger(index) || !this.stages[index] || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(elapsed)) return false;
    const key = `${playerId}/${index}`;
    const prior = this.choices.get(key);
    if (prior) return prior.color === color && prior.elapsed === elapsed;
    const stage = this.stages[index];
    if (receivedElapsed < 0 || elapsed < stage.answerAt || elapsed >= stage.answerEnd || elapsed > receivedElapsed + 250 || receivedElapsed - elapsed > CHOICE_PACKET_MS || receivedElapsed >= stage.answerEnd + CHOICE_GRACE_MS || this.state.results.some(result => result.index === index)) return false;
    this.choices.set(key, { color, elapsed });
    return true;
  }

  advance(elapsed) {
    let changed = false;
    for (const stage of this.stages) {
      if (elapsed < stage.answerEnd + CHOICE_GRACE_MS || this.state.results.some(result => result.index === stage.index)) continue;
      const choices = Object.fromEntries(this.round.playerIds.map(id => [id, this.choices.get(`${id}/${stage.index}`)?.color ?? null]));
      const correctIds = this.round.playerIds.filter(id => choices[id] === stage.puzzle.answer);
      correctIds.forEach(id => { this.state.scores[id]++; });
      this.state.results.push({ index: stage.index, at: stage.answerEnd, answer: stage.puzzle.answer, choices, correctIds });
      changed = true;
    }
    return changed;
  }
}
