import { replayWitch, WITCH_DURATION_MS, WITCH_HOLD_MS } from '../shared/witch.js';
import { COUNTDOWN_MS } from '../shared/games.js';

export class WitchTurns {
  constructor(round) {
    this.round = round;
    this.state = { index: 0, playerId: round.playerIds[0], startAt: round.startAt, endAt: round.startAt + WITCH_DURATION_MS, nextAt: null, scene: { actions: [], sample: 0 } };
  }
  replay(playerId, message, now) {
    const turn = this.state;
    if (turn.playerId !== playerId || message.turn !== turn.index || turn.nextAt !== null || now < turn.startAt || now > turn.endAt + 1000) return null;
    if (!Number.isFinite(message.sample) || message.sample > now - turn.startAt + 250 || message.sample < turn.scene.sample) return null;
    const prior = turn.scene.actions;
    if (!Array.isArray(message.proof) || message.proof.length < prior.length || prior.some((action, index) => action.some((value, field) => message.proof[index]?.[field] !== value))) return null;
    return replayWitch(message.proof, message.sample);
  }
  progress(playerId, message, now) {
    const run = this.replay(playerId, message, now);
    if (!run) return false;
    this.state.scene = { actions: run.proof, sample: message.sample };
    return true;
  }
  result(playerId, message, now) {
    if (this.state.playerId !== playerId || message.turn !== this.state.index || this.state.nextAt !== null || now < this.state.startAt) return null;
    let run = null;
    if (message.status === 'finished') {
      run = this.replay(playerId, message, now);
      if (!run?.done || Math.abs(run.elapsed - message.elapsed) > .1 || message.cleared !== run.cleared) return null;
      this.state.scene = { actions: run.proof, sample: message.sample };
    } else if (message.status !== 'forfeit') return null;
    this.state.nextAt = now + WITCH_HOLD_MS;
    return { status: message.status, elapsed: run?.elapsed ?? null, cleared: run?.cleared ?? 0, mistakes: run?.mistakes ?? 0, receivedAt: now, reason: run ? null : 'Left the game screen' };
  }
  advance(now, players, departedResults = {}) {
    const turn = this.state, player = players.find(player => player.id === turn.playerId);
    let changed = false;
    if (turn.nextAt === null && (!player || player.result || now >= turn.endAt + 1000)) {
      if (player && !player.result) player.result = { status: 'timeout', elapsed: null, cleared: 0, mistakes: 1, reason: 'Turn expired', receivedAt: now };
      turn.nextAt = now + WITCH_HOLD_MS; changed = true;
    }
    if (turn.nextAt === null || now < turn.nextAt) return { changed, complete: false };
    let index = turn.index + 1;
    while (index < this.round.playerIds.length) {
      const id = this.round.playerIds[index], next = players.find(player => player.id === id);
      if (next && !next.result && !departedResults[id]) break;
      index++;
    }
    if (index === this.round.playerIds.length) return { changed: true, complete: true };
    this.state = { index, playerId: this.round.playerIds[index], startAt: now + COUNTDOWN_MS, endAt: now + COUNTDOWN_MS + WITCH_DURATION_MS, nextAt: null, scene: { actions: [], sample: 0 } };
    return { changed: true, complete: false };
  }
}
