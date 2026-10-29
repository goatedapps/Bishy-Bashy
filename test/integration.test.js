import { captureVisual, RemoteRuns } from '../shared/visual-state.js';
import { COIN_GAME } from '../shared/coins.js';
import { DODGE_GAME, JUMP_MS, MOVE_MS } from '../shared/dodge.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createApp } from '../server/index.js';
import { createSequence, TotemRun } from '../shared/totem.js';
import { PermRun, PERM_GAME } from '../shared/perm.js';
import { SLOT_GAME } from '../shared/slots.js';
import { FIREWORK_GAME } from '../shared/fireworks.js';
import { MONKEY_GAME, MonkeyRun } from '../shared/monkeys.js';
import { JUMP_GAME, JumpRun } from '../shared/jump.js';
import { comparePlayers, createRun } from '../shared/games.js';
import { BURGER_GAME } from '../shared/burger.js';
import { MISTAKE_GAME } from '../shared/mistake.js';
import { DICE_GAME } from '../shared/dice.js';
import { FACING_GAME } from '../shared/facing.js';

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

for (const [mode, game, length] of [['arcade', 'totem-shrinker', 5], ['game-select', 'totem-shrinker', 3], ['game-select', PERM_GAME, 3], ['game-select', SLOT_GAME, 3], ['game-select', FIREWORK_GAME, 3], ['game-select', MONKEY_GAME, 3], ['game-select', JUMP_GAME, 3], ['game-select', BURGER_GAME, 3], ['game-select', MISTAKE_GAME, 3], ['game-select', DICE_GAME, 3], ['game-select', FACING_GAME, 3], ['game-select', COIN_GAME, 3], ['game-select', DODGE_GAME, 3]]) test(`${mode} ${game}: four WebSocket players complete the entire automatic set`, async t => {
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
  if (mode === 'arcade') {
    assert.equal(state.set.phase, 'selecting');
    time = state.set.selectionEndAt;
    waiting = receiveProtocol(clients[0], message => message.type === 'state' && message.room.set.phase === 'instructions');
    app.rooms.tick(); state = (await waiting).room;
  }
  assert.equal(state.round.phase, 'instructions');
  waiting = receiveProtocol(clients[0], message => message.type === 'state' && message.room.round.phase === 'countdown');
  clients.forEach(socket => send(socket, { type: 'ready', ready: true }));
  state = (await waiting).room;
  assert.equal(state.set.plan.length, length);
  if (mode === 'arcade') assert.equal(new Set(state.set.plan).size, 5);
  for (let index = 0; index < length; index++) {
    const round = state.round;
    assert.equal(round.difficulty, mode === 'arcade' ? 1 : index + 1);
    if (mode === 'game-select') assert.equal(round.game, game);
    const simulatedRuns = [COIN_GAME, DODGE_GAME].includes(round.game) ? clients.map((_, place) => {
      const run = createRun(round, 0);
      while (!run.done && (round.game === COIN_GAME ? run.landAt : run.impactAt) < run.end) {
        const fail = run.index < place;
        if (round.game === COIN_GAME) {
          run.tap(fail ? run.wave.decoy : run.wave.column, run.launchedAt + 1);
          run.advance(run.landAt);
        } else {
          const at = run.impactAt;
          if (run.obstacle.kind === 'hurdle') {
            if (!fail) run.tap(1, at - JUMP_MS / 2);
          } else {
            const target = fail ? (run.obstacle.safe + 1) % 3 : run.obstacle.safe;
            let moveAt = run.launchedAt + 1;
            while (run.position !== target) { run.tap(run.position > target ? 0 : 2, moveAt); moveAt += MOVE_MS; }
          }
          run.advance(at);
        }
      }
      assert.equal(run.done, true);
      return run;
    }) : round.game === JUMP_GAME ? clients.map((_, place) => {
      const run = new JumpRun(round, 0);
      for (let boost = 0; boost < round.goal; boost++) run.tap(boost % 3, run.landAt + place * 15);
      run.advance(run.finishAt);
      assert.equal(run.done, true);
      return run;
    }) : round.game === MONKEY_GAME ? clients.map((_, place) => {
      const run = new MonkeyRun(round, 0);
      for (let stage = 0; stage < round.goal; stage++) {
        const playAt = run.playAt;
        run.sequence.slice(0, run.length).forEach((color, note) => run.tap(color, playAt + note * (100 + place * 20)));
      }
      assert.equal(run.done, true);
      return run;
    }) : [BURGER_GAME, MISTAKE_GAME, DICE_GAME, FACING_GAME].includes(round.game) ? clients.map((_, place) => {
      const run = createRun(round, 0);
      if (round.game === BURGER_GAME) {
        for (let miss = 0; miss < place; miss++) {
          run.tap((run.column + 1) % 3, run.launchedAt + 1);
          run.advance(run.landAt);
        }
        while (!run.done && run.landAt < run.end) {
          run.tap(run.column, run.launchedAt + 1);
          run.advance(run.landAt);
        }
      } else while (!run.done) run.tap(round.game === MISTAKE_GAME ? run.puzzle.odd : run.puzzle.answer, (round.game === FACING_GAME ? run.playAt : run.readyAt) + 100 + place * 25);
      assert.equal(run.done, true);
      return run;
    }) : null;
    time = simulatedRuns ? round.startAt + Math.max(...simulatedRuns.map(run => run.elapsed)) + 100 : round.game === PERM_GAME ? round.endAt + 100 : round.startAt + 4000;
    waiting = receiveProtocol(clients[0], message => message.type === 'state' && message.room.set.history.length === index + 1);
    clients.forEach((socket, place) => send(socket, { type: 'result', roundId: round.id, status: 'finished', elapsed: simulatedRuns ? simulatedRuns[place].elapsed : round.game === PERM_GAME ? round.duration : 1000 + place * 500, cleared: round.goal, mistakes: simulatedRuns ? simulatedRuns[place].mistakes : 0, ...(round.game === SLOT_GAME ? { reelMask: 7 } : {}), ...(round.game === PERM_GAME ? { score: round.maxScore - place * 100 } : {}) }));
    state = (await waiting).room;
    assert.deepEqual(state.set.players.map(player => player.points), [10, 7, 4, 1].map(points => points * (index + 1)));
    if (index + 1 < length) {
      assert.equal(state.set.phase, 'intermission');
      time = state.set.nextStartAt;
      const next = receiveProtocol(clients[0], message => message.type === 'state' && message.room.round.id !== round.id && message.room.round.phase === 'countdown');
      const synced = receiveProtocol(clients[0], message => message.type === 'state' && message.room.players.every(player => player.sync?.at === time));
      clients.forEach(socket => send(socket, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 }));
      await synced; app.rooms.tick();
      if (mode === 'arcade') {
        const instructions = receiveProtocol(clients[0], message => message.type === 'state' && message.room.set.phase === 'instructions');
        time = app.rooms.rooms.get(code).set.selectionEndAt;
        app.rooms.tick();
        await instructions;
      }
      clients.forEach(socket => send(socket, { type: 'ready', ready: true }));
      state = (await next).room;
      assert.equal(state.set.roundIndex, index + 1);
      assert.ok(state.players.every(player => !player.ready));
    }
  }
  assert.equal(state.set.phase, 'complete');
  assert.equal(state.set.history.length, length);
  const exited = clients.map(socket => receiveProtocol(socket, message => message.type === 'state' && !message.room.set && !message.room.round));
  send(clients[1], { type: 'exit-set', setId: state.set.id });
  for (const message of await Promise.all(exited)) assert.equal(message.room.players.length, 4);
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
    assert.equal(joined.protocol, 6);
    code = joined.code;
    clients.push({ socket, ...joined });
    const ready = receive(socket, message => message.type === 'state' && message.room.players.some(player => player.id === joined.playerId && player.ready));
    send(socket, { type: 'sync', rtt: 20, uncertainty: 10, count: 5 });
    send(socket, { type: 'ready', ready: true });
    await ready;
  }
  const scheduled = clients.map(client => receive(client.socket, message => message.type === 'state' && message.room.round?.phase === 'countdown'));
  const instructions = receive(clients[0].socket, message => message.type === 'state' && message.room.round?.phase === 'instructions');
  send(clients[0].socket, { type: 'start' });
  await instructions;
  clients.forEach(client => send(client.socket, { type: 'ready', ready: true }));
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
  assert.ok(joined.capabilities.includes('room-navigation'));
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
  assert.deepEqual(await health.json(), { ok: true, protocol: 6, countdownMs: 3000 });
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

for (const game of ['burger-girl','its-raining-coins','dodge-or-die']) test(`${game}: four real connections receive the same live object state`, async t => {
  const app=await createApp();let time=100000;app.rooms.now=()=>time;
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.close());
  const url=`ws://127.0.0.1:${app.server.address().port}/ws`,clients=[];
  const send=(socket,message)=>socket.send(JSON.stringify(message));let code;
  for(let index=0;index<4;index++){
    const socket=new WebSocket(url);await once(socket,'open');clients.push(socket);
    const joined=receiveProtocol(socket,message=>message.type==='joined');
    send(socket,{type:index?'join':'create',name:`Peer ${index}`,mode:'game-select',game,code});code=(await joined).code;
  }
  let waiting=receiveProtocol(clients[0],message=>message.type==='state'&&message.room.set?.phase==='instructions');
  send(clients[0],{type:'start'});await waiting;
  waiting=receiveProtocol(clients[0],message=>message.type==='state'&&message.room.round?.phase==='countdown');
  clients.forEach(socket=>{send(socket,{type:'sync',rtt:10,uncertainty:5,count:5});send(socket,{type:'ready',ready:true});});
  const round=(await waiting).room.round,run=createRun(round,5000);
  run.position=2;
  time=round.startAt+500;
  const snapshots=clients.map(socket=>receiveProtocol(socket,message=>message.type==='state'&&message.room.players[1]?.progress.visual?.sample===500));
  send(clients[1],{type:'progress',roundId:round.id,cleared:0,mistakes:0,visual:captureVisual(game,run,5500)});
  for(const snapshot of await Promise.all(snapshots)){
    const peer=snapshot.room.players[1],remote=new RemoteRuns().get(round,peer,2000);
    assert.equal(remote.position,run.position);
    assert.deepEqual(game==='dodge-or-die'?remote.obstacle:game==='burger-girl'?remote.column:remote.wave,game==='dodge-or-die'?run.obstacle:game==='burger-girl'?run.column:run.wave);
    assert.equal(remote.launchedAt-remote.start,run.launchedAt-run.start);
  }
});
