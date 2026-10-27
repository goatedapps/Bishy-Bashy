import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createApp } from '../server/index.js';
import { createSequence, TotemRun } from '../shared/totem.js';
import { PermRun, PERM_GAME } from '../shared/perm.js';
import { comparePlayers } from '../shared/games.js';

function receiveProtocol(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('message', listener); reject(new Error('Timed out waiting for set state')); }, 2000);
    function listener(data) {
      const message = JSON.parse(data.toString());
      if (predicate(message)) { clearTimeout(timer); socket.off('message', listener); resolve(message); }
    }
    socket.on('message', listener);
  });
}

for (const [mode, game, length] of [['arcade', 'totem-shrinker', 2], ['game-select', 'totem-shrinker', 5], ['game-select', PERM_GAME, 5]]) test(`${mode} ${game}: four WebSocket players complete the entire automatic set`, async t => {
  const app = await createApp();
  let time = 1_000_000;
  app.rooms.now = () => time;
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const url = `ws://127.0.0.1:${app.server.address().port}/ws`;
  const clients = [];
  const send = (socket, message) => socket.send(JSON.stringify(message));
  let code;
  for (let index = 0; index < 4; index++) {
    const socket = new WebSocket(url); await once(socket, 'open'); clients.push(socket);
    let waiting = receiveProtocol(socket, message => message.type === 'joined');
    send(socket, { type: index ? 'join' : 'create', name: `Player ${index}`, mode, game, code });
    const joined = await waiting; code = joined.code;
    waiting = receiveProtocol(socket, message => message.type === 'state' && message.room.players.some(player => player.id === joined.playerId && player.ready));
    send(socket, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 });
    send(socket, { type: 'ready', ready: true }); await waiting;
  }
  let waiting = receiveProtocol(clients[0], message => message.type === 'state' && message.room.round);
  send(clients[0], { type: 'start' });
  let state = (await waiting).room;
  assert.equal(state.set.plan.length, length);
  if (mode === 'arcade') assert.equal(new Set(state.set.plan).size, 2);
  for (let index = 0; index < length; index++) {
    const round = state.round;
    assert.equal(round.difficulty, mode === 'arcade' ? 1 : index + 1);
    if (mode === 'game-select') assert.equal(round.game, game);
    time = round.game === PERM_GAME ? round.endAt + 100 : round.startAt + 4000;
    waiting = receiveProtocol(clients[0], message => message.type === 'state' && message.room.set.history.length === index + 1);
    clients.forEach((socket, place) => send(socket, { type: 'result', roundId: round.id, status: 'finished', elapsed: round.game === PERM_GAME ? round.duration : 1000 + place * 500, cleared: round.goal, mistakes: 0, ...(round.game === PERM_GAME ? { score: round.maxScore - place * 100 } : {}) }));
    state = (await waiting).room;
    assert.deepEqual(state.set.players.map(player => player.points), [10, 7, 4, 1].map(points => points * (index + 1)));
    if (index + 1 < length) {
      assert.equal(state.set.phase, 'intermission');
      time = state.set.nextStartAt;
      const next = receiveProtocol(clients[0], message => message.type === 'state' && message.room.round.id !== round.id);
      const synced = receiveProtocol(clients[0], message => message.type === 'state' && message.room.players.every(player => player.sync?.at === time));
      clients.forEach(socket => send(socket, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 }));
      await synced; app.rooms.tick();
      state = (await next).room;
      assert.equal(state.set.roundIndex, index + 1);
      assert.ok(state.players.every(player => !player.ready));
    }
  }
  assert.equal(state.set.phase, 'complete');
  assert.equal(state.set.history.length, length);
});

for (const game of ['totem-shrinker', PERM_GAME]) test(`${game}: four real connections share progress and accept a delayed finish once`, async t => {
  const app = await createApp();
  let time = 1_000_000;
  app.rooms.now = () => time;
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const url = `ws://127.0.0.1:${app.server.address().port}/ws`;
  const clients = [];
  const receive = (socket, predicate) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('message', listener); reject(new Error('Missing round message')); }, 2000);
    function listener(data) {
      const message = JSON.parse(data.toString());
      if (predicate(message)) { clearTimeout(timer); socket.off('message', listener); resolve(message); }
    }
    socket.on('message', listener);
  });
  const send = (socket, message) => socket.send(JSON.stringify(message));
  let code;
  for (let index = 0; index < 4; index++) {
    const socket = new WebSocket(url);
    await once(socket, 'open');
    const waiting = receive(socket, message => message.type === 'joined');
    send(socket, { type: index ? 'join' : 'create', game, mode: 'game-select', code, name: `Player ${index + 1}` });
    const joined = await waiting;
    assert.equal(joined.protocol, 4);
    code = joined.code;
    clients.push({ socket, ...joined });
    const ready = receive(socket, message => message.type === 'state' && message.room.players.some(player => player.id === joined.playerId && player.ready));
    send(socket, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 });
    send(socket, { type: 'ready', ready: true });
    await ready;
  }
  const scheduled = clients.map(client => receive(client.socket, message => message.type === 'state' && message.room.round));
  send(clients[0].socket, { type: 'start' });
  const states = await Promise.all(scheduled);
  const round = states[0].room.round;
  for (const state of states) assert.deepEqual(createSequence(state.room.round.seed), createSequence(round.seed));
  time = round.startAt + 2000;
  const cleared = game === PERM_GAME ? 2 : 12;
  const progress = receive(clients[3].socket, message => message.type === 'state' && message.room.players[0].progress.cleared === cleared);
  send(clients[0].socket, { type: 'progress', roundId: round.id, cleared, mistakes: 0, ...(game === PERM_GAME ? { score: 8000 } : {}) });
  await progress;
  const disconnected = receive(clients[3].socket, message => message.type === 'state' && !message.room.players[0].connected);
  clients[0].socket.close();
  await disconnected;
  if (game === PERM_GAME) time = round.endAt + 100;
  for (let index = 1; index < 4; index++) {
    const ack = receive(clients[index].socket, message => message.type === 'result-ack');
    send(clients[index].socket, { type: 'result', roundId: round.id, status: 'finished', elapsed: game === PERM_GAME ? round.duration : 1500 + index * 100, cleared: game === PERM_GAME ? index : 30, mistakes: 0, ...(game === PERM_GAME ? { score: 4000 * index } : {}) });
    await ack;
  }
  time = (game === PERM_GAME ? round.endAt : round.startAt) + 5000;
  const returning = new WebSocket(url);
  await once(returning, 'open');
  let waiting = receive(returning, message => message.type === 'joined');
  send(returning, { type: 'join', code, token: clients[0].token, name: 'Player 1' });
  await waiting;
  const run = game === PERM_GAME ? new PermRun(round, 0) : new TotemRun(round, 0);
  if (game === PERM_GAME) { run.notes.forEach(note => run.tap(0, note.at)); run.advance(run.end); }
  else run.sequence.forEach((color, index) => run.tap(color, 100 + index * 30));
  const result = { type: 'result', roundId: round.id, status: 'finished', elapsed: run.elapsed, cleared: run.cleared, mistakes: run.mistakes, ...(game === PERM_GAME ? { score: run.score } : {}) };
  waiting = receive(clients[3].socket, message => message.type === 'state' && message.room.round.phase === 'results');
  send(returning, result);
  const finished = (await waiting).room;
  assert.ok(comparePlayers(finished.players[0], finished.players[1], game) < 0);
  assert.ok(finished.players[0].result.arrivalLag > 4000);
  waiting = receive(returning, message => message.type === 'result-ack');
  send(returning, { ...result, elapsed: 1 });
  await waiting;
  assert.equal(app.rooms.rooms.get(code).players[0].result.elapsed, run.elapsed);
});

test('real WebSocket clients can create, synchronize, and join a room', async t => {
  const app = await createApp();
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const port = app.server.address().port;
  const url = `ws://127.0.0.1:${port}/ws`;
  const host = new WebSocket(url);
  await once(host, 'open');
  const messages = [];
  host.on('message', data => messages.push(JSON.parse(data.toString())));
  const receive = (socket, predicate) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off('message', onMessage); reject(new Error('Timed out waiting for protocol message')); }, 2000);
    function onMessage(data) { const message = JSON.parse(data.toString()); if (predicate(message)) { clearTimeout(timeout); socket.off('message', onMessage); resolve(message); } }
    socket.on('message', onMessage);
  });
  let waiting = receive(host, message => message.type === 'joined');
  host.send(JSON.stringify({ type: 'create', name: 'Host' }));
  const joined = await waiting;
  assert.equal(joined.code.length, 6);
  waiting = receive(host, message => message.type === 'pong');
  host.send(JSON.stringify({ type: 'ping', sent: 100 }));
  const pong = await waiting;
  assert.equal(pong.sent, 100);
  assert.ok(pong.serverSent >= pong.serverReceived);
  let state;
  for (let index = 1; index <= 3; index++) {
    const friend = new WebSocket(url);
    await once(friend, 'open');
    waiting = receive(host, message => message.type === 'state' && message.room.players.length === index + 1);
    friend.send(JSON.stringify({ type: 'join', code: joined.code, name: `Friend ${index}` }));
    state = await waiting;
  }
  assert.equal(state.room.players.length, 4);
  assert.equal(state.room.players[1].name, 'Friend 1');
  assert.equal(JSON.stringify(state).includes(joined.token), false);
  const health = await fetch(`http://127.0.0.1:${port}/health`);
  assert.deepEqual(await health.json(), { ok: true, protocol: 4 });
  const info = await fetch(`http://127.0.0.1:${port}/connection-info`);
  assert.ok(Array.isArray((await info.json()).lanUrls));
});

test('WebSocket upgrade rejects an unrelated browser origin', async t => {
  const app = await createApp();
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const socket = new WebSocket(`ws://127.0.0.1:${app.server.address().port}/ws`, { origin: 'https://unrelated.example' });
  const [error] = await once(socket, 'error');
  assert.match(error.message, /403/);
});

test('WebSocket upgrade allows the configured GitHub Pages origin', async t => {
  const app = await createApp({ allowedOrigins: ['https://goatedapps.github.io'] });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const socket = new WebSocket(`ws://127.0.0.1:${app.server.address().port}/ws`, { origin: 'https://goatedapps.github.io' });
  await once(socket, 'open');
  assert.equal(socket.readyState, WebSocket.OPEN);
});
