import { sanitizeVisual } from '../shared/visual-state.js';
import { randomBytes, randomUUID, randomInt } from 'node:crypto';
import { TOTEM_GAME } from '../shared/totem.js';
import { COUNTDOWN_MS, GAMES, roundSettings, isRoundActive } from '../shared/games.js';
import { PERM_GAME } from '../shared/perm.js';
import { SLOT_GAME, validReelMask } from '../shared/slots.js';
import { MODES, INTERMISSION_MS, WHEEL_SPIN_MS, REEL_HOLD_MS, createSetPlan, awardRound } from '../shared/sets.js';

export const ROUND_MS = 10_000;
export const GRACE_MS = 10_000;
export { COUNTDOWN_MS };
export const RECONNECT_WAIT_MS = 15_000;
const terminal = player => Boolean(player.result);

export class RoomService {
  constructor({ now, send }) {
    this.now = now;
    this.send = send;
    this.rooms = new Map();
  }

  error(client, message) { this.send(client, { type: 'error', message }); }
  roomFor(client) { return this.rooms.get(client.room); }
  playerFor(client) { return this.roomFor(client)?.players.find(player => player.client === client); }

  snapshot(room) {
    return {
      code: room.code, hostId: room.hostId, testNumber: room.testNumber, selectedGame: room.selectedGame, mode: room.mode, arcadePreview: room.arcadePreview, set: room.set,
      players: room.players.map(({ id, name, connected, ready, sync, result, progress, disconnectedAt }) => ({ id, name, connected, ready, sync, result, progress, disconnectedAt })),
      round: room.round ? { ...room.round } : null,
    };
  }

  broadcast(room) {
    room.updatedAt = this.now();
    const message = { type: 'state', room: this.snapshot(room) };
    room.players.forEach(player => { if (player.connected) this.send(player.client, message); });
  }

  join(client, message) {
    if (this.roomFor(client)) return this.error(client, 'Leave your current room first.');
    if (typeof message.name !== 'string' || !message.name.trim()) return this.error(client, 'Enter your name first.');
    let room;
    if (message.type === 'create') {
      let code;
      do { code = Array.from(randomBytes(6), byte => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]).join(''); } while (this.rooms.has(code));
      room = { code, players: [], hostId: null, round: null, set: null, mode: MODES[message.mode] ? message.mode : 'arcade', testNumber: 0, selectedGame: GAMES[message.game] ? message.game : TOTEM_GAME, updatedAt: this.now() };
      this.rooms.set(code, room);
    } else {
      room = this.rooms.get(String(message.code).toUpperCase());
      if (!room) return this.error(client, 'That room could not be found. Check the code or create a new room.');
    }
    const returning = typeof message.token === 'string' && room.players.find(player => player.token === message.token);
    if (!returning && room.set && room.set.phase !== 'complete') return this.error(client, 'A set is underway. Join after the full set finishes.');
    if (!returning && room.round && room.round.phase !== 'results') return this.error(client, 'A round is underway. Join after it finishes.');
    if (!returning && room.players.length >= 4) return this.error(client, 'This room already has four players.');
    if (returning?.connected) return this.error(client, 'This player is already connected. Open a new tab to join as another player.');
    const player = returning || { id: randomUUID(), token: randomBytes(24).toString('hex'), name: message.name.trim().slice(0, 20), ready: false, sync: null, result: null, progress: { cleared: 0, mistakes: 0 } };
    player.client = client;
    player.connected = true;
    player.disconnectedAt = null;
    player.ready = false;
    player.sync = null;
    player.requiresAssets = message.assetGates === true;
    player.assetRound = null;
    if (!returning) room.players.push(player);
    client.room = room.code;
    if (!room.hostId || !room.players.some(p => p.id === room.hostId && p.connected)) room.hostId = player.id;
    this.send(client, { type: 'joined', protocol: 6, capabilities: ['room-navigation', 'arcade-wheel', 'arcade-reel', 'asset-readiness', 'coins-dodge', 'live-gameplay-v2'], token: player.token, playerId: player.id, code: room.code });
    this.broadcast(room);
  }

  handle(client, message) {
    const received = this.now();
    if (message.type === 'ping') {
      if (!Number.isFinite(message.sent)) return;
      return this.send(client, { type: 'pong', sent: message.sent, serverReceived: received, serverSent: this.now() });
    }
    if (message.type === 'create' || message.type === 'join') return this.join(client, message);
    const room = this.roomFor(client);
    const player = this.playerFor(client);
    if (!room || !player) return this.error(client, 'Join a room first.');
    if (message.type === 'sync') {
      const { rtt, uncertainty, count } = message;
      if (![rtt, uncertainty, count].every(Number.isFinite) || rtt < 0 || uncertainty < 0 || count < 0) return;
      player.sync = { rtt, uncertainty, count, at: received };
      return this.broadcast(room);
    }
    if (message.type === 'assets-ready') {
      if (message.roundId !== room.round?.id || !['instructions', 'intermission'].includes(room.set?.phase)) return;
      player.assetRound = message.ready === true ? room.round.id : null;
      if (!message.ready) player.ready = false;
      return this.broadcast(room);
    }
    if (message.type === 'ready') {
      const gate = room.set?.phase === 'instructions' || room.set?.phase === 'intermission' && room.mode === 'game-select';
      if (!gate && (room.set && room.set.phase !== 'complete' || isRoundActive(room.round))) return;
      if (message.ready && !this.isSynced(player)) return this.error(client, 'Wait for at least three fresh clock samples before getting ready.');
      if (message.ready && player.requiresAssets && player.assetRound !== room.round?.id) return this.error(client, 'Wait for the game assets to finish loading.');
      player.ready = Boolean(message.ready);
      if (room.set?.phase === 'instructions') this.tryBeginPrepared(room);
      else if (gate) this.advanceSet(room);
      return this.broadcast(room);
    }
    if (message.type === 'configure' || message.type === 'select-game') {
      if (player.id !== room.hostId) return this.error(client, 'Only the room host can choose the mode and game.');
      if (room.set || room.round && room.round.phase !== 'results') return;
      const mode = message.type === 'select-game' ? 'game-select' : message.mode;
      const game = message.game || room.selectedGame;
      if (!MODES[mode] || !GAMES[game] || room.selectedGame === game && room.mode === mode) return;
      room.selectedGame = game;
      room.mode = mode;
      room.arcadePreview = false;
      room.players.forEach(p => { p.ready = false; });
      return this.broadcast(room);
    }
    if (message.type === 'start') {
      if (player.id !== room.hostId) return this.error(client, 'Only the room host can start the round.');
      if (room.set) return;
      if (room.round && room.round.phase !== 'results') return;
      const participants = room.players.filter(p => p.connected);
      if (message.mode === 'sync' && room.players.some(p => !p.connected && received - p.disconnectedAt < RECONNECT_WAIT_MS)) return this.error(client, 'Waiting up to 15 seconds for a disconnected player.');
      if (message.mode === 'sync' && !participants.every(p => p.ready && this.isSynced(p))) return this.error(client, 'Everyone connected must be synchronized and ready.');
      if (message.mode === 'sync') room.set = null;
      else room.set = {
        id: randomUUID(), mode: room.mode, phase: 'playing', roundIndex: 0,
        plan: createSetPlan(room.mode, room.selectedGame, randomInt),
        players: room.players.map(p => ({ id: p.id, name: p.name, points: 0 })),
        history: [], nextStartAt: null, waitReason: null,
      };
      if (message.mode === 'sync') this.beginRound(room, true);
      else this.prepareRound(room);
      return this.broadcast(room);
    }
    if (message.type === 'progress') return this.progress(room, player, message, received);
    if (message.type === 'result') return this.result(client, room, player, message, received);
    if (message.type === 'back-to-modes') {
      if (player.id !== room.hostId) return this.error(client, 'Only the host can return everyone to mode selection.');
      if (!room.set && room.arcadePreview) { room.arcadePreview = false; return this.broadcast(room); }
      if (!room.set || message.setId !== room.set.id) return;
      room.set = null;
      room.round = null;
      room.arcadePreview = false;
      room.players.forEach(member => { member.ready = false; member.result = null; member.progress = { cleared: 0, mistakes: 0 }; });
      return this.broadcast(room);
    }
    if (message.type === 'leave') {
      if (isRoundActive(room.round) && room.round.playerIds.includes(player.id)) {
        room.round.departedResults ??= {};
        room.round.departedResults[player.id] = player.result || { status: 'forfeit', elapsed: null, reason: 'Left the room', cleared: player.progress.cleared, mistakes: player.progress.mistakes };
      }
      room.players = room.players.filter(p => p !== player);
      client.room = null;
      this.send(client, { type: 'left' });
      this.chooseHost(room);
      if (!room.players.length) this.rooms.delete(room.code);
      else {
        if (isRoundActive(room.round)) this.finishIfComplete(room);
        this.broadcast(room);
      }
    }
  }

  isSynced(player) {
    return player.sync && player.sync.count >= 3 && player.sync.rtt <= 1500 && this.now() - player.sync.at < 20_000;
  }

  readyWait(room) {
    const connected = room.players.filter(player => player.connected);
    if (!connected.length) return 'players';
    if (room.players.some(player => !player.connected && this.now() - player.disconnectedAt < RECONNECT_WAIT_MS)) return 'players';
    if (connected.some(player => !this.isSynced(player))) return 'sync';
    if (connected.some(player => player.requiresAssets && player.assetRound !== room.round?.id)) return 'assets';
    if (connected.some(player => !player.ready)) return 'ready';
    return null;
  }

  prepareRound(room) {
    const set = room.set;
    const game = set.plan[set.roundIndex];
    const difficulty = set.mode === 'game-select' ? set.roundIndex + 1 : 1;
    room.round = { id: randomUUID(), game, phase: 'instructions', playerIds: [], ...roundSettings(game, randomBytes(4).readUInt32LE(), difficulty, set.mode), setId: set.id, setRound: set.roundIndex + 1, totalRounds: set.plan.length };
    room.players.forEach(player => { player.ready = false; player.assetRound = null; });
    set.phase = 'instructions';
    set.nextStartAt = null;
    set.waitReason = 'ready';
    if (set.mode === 'arcade') {
      set.phase = room.round.phase = 'selecting';
      set.spinStartAt = this.now();
      set.spinEndAt = set.spinStartAt + WHEEL_SPIN_MS;
      set.selectionEndAt = set.spinEndAt + REEL_HOLD_MS;
    }
  }

  tryBeginPrepared(room) {
    if (room.set?.phase !== 'instructions') return false;
    const reason = this.readyWait(room);
    const changed = room.set.waitReason !== reason;
    room.set.waitReason = reason;
    if (reason) return changed;
    this.beginRound(room);
    return true;
  }

  beginRound(room, sync = false, participants = room.players.filter(player => player.connected)) {
    const set = room.set;
    const game = sync ? 'sync' : set.plan[set.roundIndex];
    const difficulty = set?.mode === 'game-select' ? set.roundIndex + 1 : 1;
    const settings = sync ? { duration: ROUND_MS } : roundSettings(game, room.round?.phase === 'instructions' ? room.round.seed : randomBytes(4).readUInt32LE(), difficulty, set?.mode);
    const startAt = this.now() + COUNTDOWN_MS;
    room.testNumber++;
    room.players.forEach(player => {
      player.result = participants.includes(player) ? null : { status: 'missing', elapsed: null, reason: 'Missed this round' };
      player.ready = false;
      player.progress = { cleared: 0, mistakes: 0, ...(game === SLOT_GAME ? { reelMask: 0 } : {}) };
      player.lastProgressAt = -Infinity;
    });
    room.round = {
      id: randomUUID(), game, phase: 'countdown', startAt,
      endAt: startAt + settings.duration, expiresAt: startAt + settings.duration + GRACE_MS,
      playerIds: participants.map(player => player.id),
      ...settings,
      ...(set ? { setId: set.id, setRound: set.roundIndex + 1, totalRounds: set.plan.length } : {}),
    };
    if (set) { set.phase = 'playing'; set.nextStartAt = null; set.waitReason = null; }
  }

  settleRound(room) {
    const set = room.set;
    if (!set || room.round.scored) return;
    room.round.scored = true;
    const rows = awardRound(set.players.map(member => ({ ...member, result: room.players.find(player => player.id === member.id)?.result || room.round.departedResults?.[member.id] })), room.round.game);
    for (const row of rows) set.players.find(member => member.id === row.playerId).points += row.points;
    set.history.push({ roundId: room.round.id, game: room.round.game, difficulty: room.round.difficulty, blockCount: room.round.blockCount, bpm: room.round.bpm, rows });
    set.phase = set.roundIndex + 1 === set.plan.length ? 'complete' : 'intermission';
    set.nextStartAt = set.phase === 'intermission' ? this.now() + INTERMISSION_MS : null;
    set.resumeAt = set.nextStartAt;
    set.waitReason = null;
    room.players.forEach(player => { player.ready = false; });
    if (set.phase === 'complete') set.completedAt = this.now();
  }

  advanceSet(room) {
    const set = room.set;
    if (set?.phase !== 'intermission') return false;
    if (set.mode === 'arcade') {
      if (this.now() < set.resumeAt) return false;
      set.roundIndex++;
      this.prepareRound(room);
      return true;
    }
    const waitReason = this.readyWait(room);
    const changed = set.waitReason !== waitReason;
    set.waitReason = waitReason;
    if (this.now() < set.resumeAt || waitReason) return changed;
    set.roundIndex++;
    this.beginRound(room);
    return true;
  }

  progress(room, player, message, received) {
    const round = room.round;
    if (!isRoundActive(round) || !GAMES[round.game] || round.id !== message.roundId || !round.playerIds.includes(player.id) || player.result || received < round.startAt || received > round.endAt) return;
    const { cleared, mistakes } = message;
    if (!Number.isInteger(cleared) || cleared < player.progress.cleared || cleared > round.goal || !Number.isInteger(mistakes) || mistakes < player.progress.mistakes || mistakes > 1000 || received - player.lastProgressAt < 150) return;
    if (round.game === PERM_GAME && (!Number.isInteger(message.score) || message.score < 0 || message.score > round.maxScore)) return;
    if (round.game === SLOT_GAME && (!validReelMask(message.reelMask, cleared) || (message.reelMask & player.progress.reelMask) !== player.progress.reelMask)) return;
    const visual = sanitizeVisual(round, message.visual, received - round.startAt);
    if (visual && visual.sample < (player.progress.visual?.sample ?? -1)) return;
    player.progress = { cleared, mistakes, ...(visual ? { visual } : player.progress.visual ? { visual: player.progress.visual } : {}), ...(round.game === SLOT_GAME ? { reelMask: message.reelMask } : {}), ...(round.game === PERM_GAME ? { score: message.score } : {}) };
    player.lastProgressAt = received;
    this.broadcast(room);
  }

  result(client, room, player, message, received) {
    const round = room.round;
    if (!round || round.id !== message.roundId || !round.playerIds.includes(player.id)) return this.error(client, 'This result belongs to an old or unknown test.');
    if (player.result) return this.send(client, { type: 'result-ack', roundId: round.id, status: player.result.status });
    if (!isRoundActive(round)) return this.error(client, 'This round is not accepting results.');
    if (round.phase === 'results' || received > round.expiresAt) return this.error(client, 'The result submission window has closed.');
    if (received < round.startAt) return this.error(client, 'The test has not started yet.');
    if (!['finished', 'forfeit', 'timeout'].includes(message.status)) return;
    if (round.game === SLOT_GAME && (!validReelMask(message.reelMask, message.cleared) || (message.reelMask & player.progress.reelMask) !== player.progress.reelMask || message.status === 'finished' && message.reelMask !== 7)) return this.error(client, 'Report the matched color rows before submitting a result.');
    if (message.status === 'finished' && (!Number.isFinite(message.elapsed) || message.elapsed < 0 || message.elapsed > round.duration || message.elapsed > received - round.startAt + 250)) return this.error(client, 'The reported finish time is outside this test.');
    const elapsedRace = GAMES[round.game] && round.game !== PERM_GAME;
    if (elapsedRace && message.status === 'finished' && (message.cleared !== round.goal || !Number.isInteger(message.mistakes) || message.mistakes < player.progress.mistakes || message.mistakes > 1000)) return this.error(client, 'Complete every match before submitting a result.');
    if (round.game === PERM_GAME && message.status === 'finished' && (received < round.endAt - 250 || message.elapsed !== round.duration || !Number.isInteger(message.cleared) || message.cleared < player.progress.cleared || message.cleared > round.goal || !Number.isInteger(message.score) || message.score < 0 || message.score > round.maxScore || !Number.isInteger(message.mistakes) || message.mistakes < player.progress.mistakes || message.mistakes > 1000)) return this.error(client, 'Wait for the rhythm round to finish before submitting a valid score.');
    if (message.status === 'timeout' && received < round.endAt) return this.error(client, 'The test has not timed out yet.');
    let cleared = null;
    if (GAMES[round.game]) {
      cleared = player.progress.cleared;
      if (Number.isInteger(message.cleared) && message.cleared >= cleared && message.cleared <= round.goal) cleared = message.cleared;
    }
    player.result = {
      status: message.status,
      elapsed: message.status === 'finished' ? message.elapsed : null,
      receivedAt: received,
      arrivalLag: message.status === 'finished' ? received - round.startAt - message.elapsed : null,
      goDelay: Number.isFinite(message.goDelay) && message.goDelay >= 0 ? message.goDelay : null,
      reason: message.status === 'forfeit' ? 'Left the game screen' : null,
      cleared,
      mistakes: Number.isInteger(message.mistakes) ? message.mistakes : null,
      ...(round.game === SLOT_GAME ? { reelMask: message.reelMask } : {}),
      ...(round.game === PERM_GAME ? { score: message.status === 'finished' ? message.score : 0 } : {}),
    };
    if (elapsedRace && message.status === 'finished') player.progress = { cleared: round.goal, mistakes: message.mistakes, ...(round.game === SLOT_GAME ? { reelMask: 7 } : {}) };
    if (round.game === PERM_GAME && message.status === 'finished') player.progress = { cleared, mistakes: message.mistakes, score: message.score };
    const visual = sanitizeVisual(round, message.visual, received - round.startAt);
    if (visual && visual.sample >= (player.progress.visual?.sample ?? -1)) player.progress = { ...player.progress, cleared, mistakes: player.result.mistakes ?? player.progress.mistakes, visual };
    this.send(client, { type: 'result-ack', roundId: round.id, status: player.result.status });
    this.finishIfComplete(room);
    this.broadcast(room);
  }

  finishIfComplete(room) {
    if (room.round && room.round.playerIds.every(id => !room.players.some(p => p.id === id) || terminal(room.players.find(p => p.id === id)))) {
      room.round.phase = 'results';
      this.settleRound(room);
    }
  }

  chooseHost(room) {
    if (!room.players.some(p => p.id === room.hostId && p.connected)) room.hostId = room.players.find(p => p.connected)?.id || null;
  }

  disconnect(client) {
    const room = this.roomFor(client);
    const player = this.playerFor(client);
    if (!player) return;
    player.connected = false;
    player.disconnectedAt = this.now();
    player.ready = false;
    this.chooseHost(room);
    this.broadcast(room);
  }

  tick() {
    const now = this.now();
    for (const [code, room] of this.rooms) {
      if (!room.players.some(p => p.connected) && now - room.updatedAt > 30 * 60_000) { this.rooms.delete(code); continue; }
      const round = room.round;
      if (!round) continue;
      if (round.phase === 'selecting') {
        if (now >= room.set.selectionEndAt) {
          round.phase = room.set.phase = 'instructions';
          room.set.waitReason = 'ready';
          this.broadcast(room);
        }
        continue;
      }
      if (round.phase === 'instructions') { if (this.tryBeginPrepared(room)) this.broadcast(room); continue; }
      if (round.phase === 'results') { if (this.advanceSet(room)) this.broadcast(room); continue; }
      let changed = false;
      if (now >= round.startAt && round.phase === 'countdown') { round.phase = 'running'; changed = true; }
      if (now >= round.endAt && round.phase === 'running') { round.phase = 'collecting'; changed = true; }
      if (now >= round.expiresAt) {
        room.players.forEach(player => { if (round.playerIds.includes(player.id) && !player.result) player.result = { status: 'missing', elapsed: null, reason: 'No result received before the deadline' }; });
        round.phase = 'results';
        this.settleRound(room);
        changed = true;
      }
      if (changed) this.broadcast(room);
    }
  }
}
