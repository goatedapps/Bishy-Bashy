import { randomBytes, randomUUID } from 'node:crypto';

export const ROUND_MS = 10_000;
export const GRACE_MS = 10_000;
export const COUNTDOWN_MS = 5_000;
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
      code: room.code, hostId: room.hostId, testNumber: room.testNumber,
      players: room.players.map(({ id, name, connected, ready, sync, result }) => ({ id, name, connected, ready, sync, result })),
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
      room = { code, players: [], hostId: null, round: null, testNumber: 0, updatedAt: this.now() };
      this.rooms.set(code, room);
    } else {
      room = this.rooms.get(String(message.code).toUpperCase());
      if (!room) return this.error(client, 'That room could not be found. Check the code or create a new room.');
    }
    const returning = typeof message.token === 'string' && room.players.find(player => player.token === message.token);
    if (!returning && room.round && room.round.phase !== 'results') return this.error(client, 'A test is underway. Join after this round finishes.');
    if (!returning && room.players.length >= 4) return this.error(client, 'This room already has four players.');
    if (returning?.connected) return this.error(client, 'This player is already connected. Open a new tab to join as another player.');
    const player = returning || { id: randomUUID(), token: randomBytes(24).toString('hex'), name: message.name.trim().slice(0, 20), ready: false, sync: null, result: null };
    player.client = client;
    player.connected = true;
    player.ready = false;
    player.sync = null;
    if (!returning) room.players.push(player);
    client.room = room.code;
    if (!room.hostId || !room.players.some(p => p.id === room.hostId && p.connected)) room.hostId = player.id;
    this.send(client, { type: 'joined', token: player.token, playerId: player.id, code: room.code });
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
    if (message.type === 'ready') {
      if (room.round && room.round.phase !== 'results') return;
      if (message.ready && !this.isSynced(player)) return this.error(client, 'Wait for at least three fresh clock samples before getting ready.');
      player.ready = Boolean(message.ready);
      return this.broadcast(room);
    }
    if (message.type === 'start') {
      if (player.id !== room.hostId) return this.error(client, 'Only the room host can start the test.');
      if (room.round && room.round.phase !== 'results') return;
      if (!room.players.every(p => p.connected && p.ready && this.isSynced(p))) return this.error(client, 'Everyone must be connected, synchronized, and ready.');
      room.testNumber++;
      room.players.forEach(p => { p.result = null; p.ready = false; });
      const startAt = received + COUNTDOWN_MS;
      room.round = { id: randomUUID(), phase: 'countdown', startAt, endAt: startAt + ROUND_MS, expiresAt: startAt + ROUND_MS + GRACE_MS, duration: ROUND_MS, playerIds: room.players.map(p => p.id) };
      return this.broadcast(room);
    }
    if (message.type === 'result') return this.result(client, room, player, message, received);
    if (message.type === 'leave') {
      if (room.round && room.round.phase !== 'results') return this.error(client, 'Finish this test before leaving the room.');
      room.players = room.players.filter(p => p !== player);
      client.room = null;
      this.send(client, { type: 'left' });
      this.chooseHost(room);
      if (!room.players.length) this.rooms.delete(room.code);
      else this.broadcast(room);
    }
  }

  isSynced(player) {
    return player.sync && player.sync.count >= 3 && player.sync.rtt <= 1500 && this.now() - player.sync.at < 20_000;
  }

  result(client, room, player, message, received) {
    const round = room.round;
    if (!round || round.id !== message.roundId || !round.playerIds.includes(player.id)) return this.error(client, 'This result belongs to an old or unknown test.');
    if (player.result) return this.send(client, { type: 'result-ack', roundId: round.id, status: player.result.status });
    if (round.phase === 'results' || received > round.expiresAt) return this.error(client, 'The result submission window has closed.');
    if (received < round.startAt) return this.error(client, 'The test has not started yet.');
    if (!['finished', 'forfeit', 'timeout'].includes(message.status)) return;
    if (message.status === 'finished' && (!Number.isFinite(message.elapsed) || message.elapsed < 0 || message.elapsed > round.duration || message.elapsed > received - round.startAt + 250)) return this.error(client, 'The reported finish time is outside this test.');
    if (message.status === 'timeout' && received < round.endAt) return this.error(client, 'The test has not timed out yet.');
    player.result = {
      status: message.status,
      elapsed: message.status === 'finished' ? message.elapsed : null,
      receivedAt: received,
      arrivalLag: message.status === 'finished' ? received - round.startAt - message.elapsed : null,
      goDelay: Number.isFinite(message.goDelay) && message.goDelay >= 0 ? message.goDelay : null,
      reason: message.status === 'forfeit' ? 'Left the game screen' : null,
    };
    this.send(client, { type: 'result-ack', roundId: round.id, status: player.result.status });
    this.finishIfComplete(room);
    this.broadcast(room);
  }

  finishIfComplete(room) {
    if (room.round && room.round.playerIds.every(id => terminal(room.players.find(p => p.id === id)))) room.round.phase = 'results';
  }

  chooseHost(room) {
    if (!room.players.some(p => p.id === room.hostId && p.connected)) room.hostId = room.players.find(p => p.connected)?.id || null;
  }

  disconnect(client) {
    const room = this.roomFor(client);
    const player = this.playerFor(client);
    if (!player) return;
    player.connected = false;
    player.ready = false;
    this.chooseHost(room);
    this.broadcast(room);
  }

  tick() {
    const now = this.now();
    for (const [code, room] of this.rooms) {
      if (!room.players.some(p => p.connected) && now - room.updatedAt > 30 * 60_000) { this.rooms.delete(code); continue; }
      const round = room.round;
      if (!round || round.phase === 'results') continue;
      let changed = false;
      if (now >= round.startAt && round.phase === 'countdown') { round.phase = 'running'; changed = true; }
      if (now >= round.endAt && round.phase === 'running') { round.phase = 'collecting'; changed = true; }
      if (now >= round.expiresAt) {
        room.players.forEach(player => { if (round.playerIds.includes(player.id) && !player.result) player.result = { status: 'missing', elapsed: null, reason: 'No result received before the deadline' }; });
        round.phase = 'results';
        changed = true;
      }
      if (changed) this.broadcast(room);
    }
  }
}
