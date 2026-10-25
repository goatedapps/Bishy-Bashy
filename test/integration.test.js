import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createApp } from '../server/index.js';

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
  assert.deepEqual(await health.json(), { ok: true });
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
