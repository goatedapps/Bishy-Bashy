export const LETTERS_GAME = 'type-in-letters';
export const LETTERS_DURATION_MS = 30_000;
export const LETTERS_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const LETTERS_INPUT_MS = 40;
export const LETTERS_SETTLE_MS = 120;
export const LETTERS_FEEDBACK_MS = 300;
export const LETTERS_PACKET_MS = 800;
export const LETTERS_MAX_ACTIONS = 768;

export function letterTarget(seed, index) {
  let state = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  return Array.from({ length: 3 }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return LETTERS_ALPHABET[Math.floor(state / 0x100000000 * 26)];
  }).join('');
}

export class LettersRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.seed = round.seed;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.index = -1;
    this.cleared = 0;
    this.mistakes = 0;
    this.done = false;
    this.elapsed = null;
    this.blockedUntil = localStart;
    this.sync(round.letters || { index: 0, opensAt: 0, phase: 'play', target: letterTarget(round.seed, 0), scores: {} });
  }

  sync(state, playerId) {
    if (!state) return;
    this.state = state;
    this.cleared = state.scores[playerId] || 0;
    if (state.index !== this.index) {
      this.index = state.index;
      this.cursor = 13;
      this.typed = '';
      this.trace = [];
      this.claim = null;
      this.claimAck = false;
      this.lastInput = -Infinity;
      this.feedback = null;
    }
    this.blockedUntil = state.phase === 'feedback' ? this.end : this.start + state.opensAt;
  }

  tap(color, time) {
    if (this.done || this.claim || this.state.phase !== 'play' || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.blockedUntil || time >= this.end || time - this.lastInput < LETTERS_INPUT_MS || this.trace.length >= LETTERS_MAX_ACTIONS) return { type: 'ignored' };
    this.lastInput = time;
    // Packed millisecond inputs keep a full round's proof inside the 8 KB message limit.
    this.trace.push([color, Math.floor(time - this.start)]);
    if (color !== 1) {
      this.cursor = (this.cursor + (color === 0 ? -1 : 1) + 27) % 27;
      return { type: 'move' };
    }
    if (this.cursor === 26) {
      this.typed = this.typed.slice(0, -1);
      return { type: 'erase' };
    }
    if (this.typed.length === 3) return { type: 'full' };
    this.typed += LETTERS_ALPHABET[this.cursor];
    if (this.typed === this.state.target) {
      this.claim = { index: this.index, actions: this.trace.map(action => [...action]) };
      return { type: 'claim' };
    }
    if (this.typed.length === 3) {
      this.mistakes++;
      this.feedback = { kind: 'miss', at: time };
      return { type: 'mistake' };
    }
    return { type: 'letter' };
  }
}

export function validateLetterClaim(round, state, claim, receivedElapsed) {
  if (!claim || claim.index !== state.index || !Array.isArray(claim.actions) || !claim.actions.length || claim.actions.length > LETTERS_MAX_ACTIONS) return null;
  const run = new LettersRun({ ...round, letters: { ...state, phase: 'play' } }, 0);
  let last = -Infinity;
  for (const action of claim.actions) {
    if (!Array.isArray(action) || action.length !== 2) return null;
    const [color, at] = action;
    if (!Number.isInteger(at) || at < state.opensAt || at < last + LETTERS_INPUT_MS || at >= round.duration || at > receivedElapsed + 250) return null;
    if (run.tap(color, at).type === 'ignored') return null;
    last = at;
  }
  if (!run.claim || receivedElapsed - last > LETTERS_PACKET_MS || run.claim.actions.length !== claim.actions.length) return null;
  return { elapsed: last, typed: run.typed };
}

export class LettersMatch {
  constructor(round) {
    this.round = round;
    this.state = { index: 0, target: letterTarget(round.seed, 0), opensAt: 0, phase: 'play', scores: Object.fromEntries(round.playerIds.map(id => [id, 0])), feedback: null };
    this.candidates = new Map();
    this.settleAt = null;
    this.nextAt = null;
  }

  claim(playerId, message, elapsed) {
    if (!Object.hasOwn(this.state.scores, playerId) || message.index !== this.state.index || this.state.phase !== 'play' || elapsed < this.state.opensAt || elapsed >= this.round.duration + LETTERS_PACKET_MS) return false;
    if (this.candidates.has(playerId)) return true;
    if (this.settleAt !== null && elapsed >= this.settleAt) return false;
    const candidate = validateLetterClaim(this.round, this.state, message, elapsed);
    if (!candidate) return false;
    this.candidates.set(playerId, candidate);
    this.settleAt ??= Math.min(this.round.duration + LETTERS_PACKET_MS, elapsed + LETTERS_SETTLE_MS);
    return true;
  }

  advance(elapsed) {
    let changed = false;
    if (this.state.phase === 'play' && this.settleAt !== null && elapsed >= this.settleAt) {
      const first = Math.min(...[...this.candidates.values()].map(candidate => candidate.elapsed));
      const winners = [...this.candidates].filter(([, candidate]) => candidate.elapsed === first).map(([id]) => id);
      winners.forEach(id => { this.state.scores[id]++; });
      this.state.feedback = { index: this.state.index, at: this.settleAt, winners, target: this.state.target };
      this.state.phase = 'feedback';
      this.nextAt = this.settleAt + LETTERS_FEEDBACK_MS;
      changed = true;
    }
    if (this.state.phase === 'feedback' && elapsed >= this.nextAt && this.nextAt < this.round.duration) {
      this.state.index++;
      this.state.target = letterTarget(this.round.seed, this.state.index);
      this.state.opensAt = this.nextAt;
      this.state.phase = 'play';
      this.candidates.clear();
      this.settleAt = null;
      changed = true;
    }
    return changed;
  }
}
