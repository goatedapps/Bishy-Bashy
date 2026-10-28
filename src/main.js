import QRCode from 'qrcode';
import { SyncedClock } from './clock.js';
import { TOTEM_GAME } from '../shared/totem.js';
import { PERM_GAME, demoCues } from '../shared/perm.js';
import { SLOT_GAME } from '../shared/slots.js';
import { FIREWORK_GAME } from '../shared/fireworks.js';
import { MONKEY_GAME } from '../shared/monkeys.js';
import { JUMP_GAME } from '../shared/jump.js';
import { GAMES, createRun, roundSettings, isRoundActive, gameRules } from '../shared/games.js';
import { MODES, roundDetail } from '../shared/sets.js';
import { GameView } from './game-view.js';
import { SetView } from './set-view.js';
import { GameAudio } from './audio.js';
import { ruleVisual } from './game-art.js';

const $ = id => document.getElementById(id);
const readStored = key => { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } };
const params = new URLSearchParams(location.search);
const session = readStored('bb-session');
const hostedServer = import.meta.env.VITE_SERVER_URL?.trim();
const isGitHubPages = location.hostname.endsWith('.github.io');
const defaultServer = hostedServer || (isGitHubPages ? '' : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`);
let serverUrl = params.get('server') || localStorage.getItem('bb-server') || defaultServer;
let socket, room, playerId = session?.playerId;
let clock = new SyncedClock();
let localRound = null;
let navigationAction = null;
let supportsRoomNavigation = false;
let pending = readStored('bb-pending');
let reconnectAt = 0, reconnectTimer, entryRequest = null, joining = false, intentionalClose = false, joined = false;
let lastPong = 0, lastSyncSent = 0, lastPendingSent = -Infinity, lastProgressSent = 0, lastProgressKey = '';
let inviteUrl = '', lanUrls = [], events = [];
let hiddenSince = document.hidden ? performance.now() : null;
let selectedGame = GAMES[localStorage.getItem('bb-game')] ? localStorage.getItem('bb-game') : TOTEM_GAME;
let selectedMode = MODES[localStorage.getItem('bb-mode')] ? localStorage.getItem('bb-mode') : 'arcade';
let timingOffset = Math.max(-150, Math.min(150, Number(localStorage.getItem('bb-timing-offset')) || 0));
const view = new GameView();
const setView = new SetView();
const audio = new GameAudio({ onChange: () => updateSound() });
const buttons = [...document.querySelectorAll('.hit-button')];

$('name').value = session?.name || localStorage.getItem('bb-name') || '';
$('room-input').value = params.get('room') || '';
$('server-url').value = serverUrl;
updateSound();
updateGameProfile();
if (!serverUrl) notice('Enter your multiplayer server address in Connection settings.');

function notice(message) {
  $('notice').textContent = message;
  $('notice').hidden = !message;
}

function log(message) {
  events.unshift(`${new Date().toLocaleTimeString()}  ${message}`);
  events = events.slice(0, 8);
  $('event-log').replaceChildren(...events.map(event => {
    const line = document.createElement('p');
    line.textContent = event;
    return line;
  }));
}

function send(message) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}
function ping() { send({ type: 'ping', sent: performance.now() }); }

function connect() {
  clearTimeout(reconnectTimer);
  if (socket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(socket.readyState)) return;
  if (intentionalClose || performance.now() < reconnectAt) {
    if (!intentionalClose) reconnectTimer = setTimeout(connect, Math.max(100, reconnectAt - performance.now()));
    return;
  }
  let connection;
  try {
    const url = new URL(serverUrl);
    if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('Use an address starting with ws:// or wss://.');
    if (location.protocol === 'https:' && url.protocol !== 'wss:') throw new Error('This website needs a secure wss:// multiplayer server.');
    url.pathname = '/ws'; url.search = ''; url.hash = '';
    connection = new WebSocket(url);
    socket = connection;
    joined = false;
  } catch (error) { joining = false; notice(error.message); return; }
  $('connection-badge').textContent = 'Connecting';
  connection.addEventListener('open', () => {
    if (socket !== connection) return;
    clock = new SyncedClock();
    lastPong = performance.now();
    lastSyncSent = 0;
    log('Connected. Measuring clock offset.');
    notice('');
    const saved = readStored('bb-session');
    if (entryRequest) send(entryRequest);
    else if (saved) send({ type: 'join', code: saved.code, name: saved.name, token: saved.token });
    for (let i = 0; i < 8; i++) setTimeout(() => { if (socket === connection && connection.readyState === WebSocket.OPEN) ping(); }, i * 200);
  });
  connection.addEventListener('message', event => {
    if (socket !== connection) return;
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'pong') {
      lastPong = performance.now();
      clock.add({ sent: message.sent, received: lastPong, serverReceived: message.serverReceived, serverSent: message.serverSent });
      const estimate = clock.estimate(lastPong);
      if (joined && estimate && lastPong - lastSyncSent > 500) {
        send({ type: 'sync', ...estimate });
        lastSyncSent = lastPong;
      }
      setupLocalRound();
      updateMetrics();
    }
    if (message.type === 'joined') {
      if (message.protocol !== 6) {
        intentionalClose = true; joining = false; entryRequest = null; connection.close();
        notice('The multiplayer server needs the new game update. Try again after it has deployed.');
        return;
      }
      playerId = message.playerId;
      supportsRoomNavigation = message.capabilities?.includes('room-navigation') === true;
      joined = true;
      const name = entryRequest?.name || readStored('bb-session')?.name || $('name').value;
      sessionStorage.setItem('bb-session', JSON.stringify({ code: message.code, token: message.token, playerId, name }));
      localStorage.setItem('bb-name', name);
      entryRequest = null; joining = false;
      $('welcome').hidden = true; $('room-view').hidden = false;
      document.body.classList.add('in-room');
      log(`Joined room ${message.code}.`);
      if (pending && (pending.roomCode !== message.code || pending.playerId !== playerId)) clearPending();
      flushPending();
    }
    if (message.type === 'state' && joined) {
      const previousId = room?.round?.id;
      const previousPhase = room?.round?.phase;
      room = message.room;
      if (room.round?.id !== previousId) {
        window.scrollTo(0, 0);
        localRound = null; lastProgressKey = ''; lastProgressSent = 0;
        audio.cancel();
        $('submission-status').hidden = true;
        for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
        if (pending && pending.message.roundId !== room.round?.id) clearPending();
      }
      setupLocalRound();
      if (room.round?.phase === 'results') {
        if (previousPhase !== 'results') audio.stopRound();
        if (pending && room.players.find(player => player.id === playerId)?.result) confirmResult();
        sessionStorage.removeItem('bb-active-round');
      }
      renderRoom();
    }
    if (message.type === 'result-ack' && pending?.message.roundId === message.roundId) confirmResult();
    if (message.type === 'error') {
      joining = false;
      notice(message.message);
      if (message.message.includes('could not be found')) {
        resetSession(); entryRequest = null; notice(message.message); return;
      }
      if (entryRequest) { entryRequest = null; intentionalClose = true; connection.close(); }
      if (message.message.includes('window has closed') || message.message.includes('old or unknown')) clearPending();
    }
    if (message.type === 'left') resetSession();
  });
  connection.addEventListener('close', () => {
    if (socket !== connection) return;
    joined = false;
    log('Connection lost. Local play continues.');
    if (!intentionalClose) reconnectTimer = setTimeout(connect, Math.max(1000, reconnectAt - performance.now()));
    renderRoom();
  });
  connection.addEventListener('error', () => {
    if (socket === connection && !intentionalClose) notice('Cannot reach the multiplayer server. It may need a minute to wake up; reconnecting…');
  });
}

function enter(type) {
  if (joining || !$('name').reportValidity()) return;
  const code = $('room-input').value.trim().toUpperCase();
  if (type === 'join' && !/^[A-Z2-9]{6}$/.test(code)) return notice('Enter the six-character room code.');
  serverUrl = $('server-url').value.trim() || defaultServer;
  if (!serverUrl) return notice('Enter the hosted multiplayer server address in Connection settings.');
  localStorage.setItem('bb-server', serverUrl);
  entryRequest = { type, name: $('name').value.trim(), code, game: selectedGame, mode: selectedMode };
  joining = true; intentionalClose = false;
  audio.unlock();
  notice('Connecting to the room…');
  if (socket?.readyState === WebSocket.OPEN) send(entryRequest);
  else connect();
}

function resetSession() {
  intentionalClose = true; joined = false;
  socket?.close(); clearTimeout(reconnectTimer);
  room = null; localRound = null; playerId = null;
  audio.cancel(); clearPending();
  sessionStorage.removeItem('bb-session'); sessionStorage.removeItem('bb-active-round');
  $('welcome').hidden = false; $('room-view').hidden = true;
  $('submission-status').hidden = true;
  document.body.classList.remove('in-room');
  updateGameProfile();
  notice('');
}

function setupLocalRound() {
  const round = room?.round;
  const time = performance.now();
  const estimate = clock.estimate(time);
  if (!isRoundActive(round) || !GAMES[round.game] || localRound || !estimate || estimate.count < 3 || !round.playerIds.includes(playerId)) return;
  const start = round.startAt - estimate.offset;
  const savedResult = pending?.message.roundId === round.id ? pending.message : room.players.find(player => player.id === playerId)?.result;
  localRound = {
    id: round.id, start, end: round.endAt - estimate.offset, offset: estimate.offset, uncertainty: estimate.uncertainty,
    run: createRun(round, start, timingOffset), goDelay: null, done: Boolean(savedResult), status: savedResult?.status,
    mustForfeit: sessionStorage.getItem('bb-active-round') === round.id || time >= start, hiddenDuringPlay: false,
  };
  if (savedResult) {
    localRound.run.cleared = savedResult.cleared || 0;
    localRound.run.mistakes = savedResult.mistakes || 0;
    localRound.run.elapsed = savedResult.elapsed;
    if (round.game === PERM_GAME) localRound.run.score = savedResult.score || 0;
    if (round.game === SLOT_GAME) localRound.run.reelMask = savedResult.reelMask || 0;
    localRound.run.done = true;
  }
  sessionStorage.setItem('bb-active-round', round.id);
  log(`Round ${room.testNumber} scheduled. Clock mapping frozen.`);
  synchronizeAudio();
}

function synchronizeAudio() {
  const round = room?.round;
  if (document.hidden || !localRound || round?.phase === 'results' || localRound.done && localRound.status !== 'finished') return;
  audio.scheduleRound(localRound.id, localRound.start, localRound.end, round.playerIds[0] === playerId, localRound.done, { game: round.game, bpm: round.bpm || 128, cues: round.game === PERM_GAME ? demoCues(round.seed, round.bpm) : [] });
}

function clearPending() {
  pending = null;
  sessionStorage.removeItem('bb-pending');
}
function confirmResult() {
  clearPending();
  $('submission-status').textContent = 'Result confirmed.';
  $('submission-status').hidden = false;
  log('Result acknowledged.');
}

function complete(status, elapsed = null) {
  if (!localRound || localRound.done) return;
  localRound.done = true;
  localRound.status = status;
  localRound.run.done = true;
  const delay = status === 'finished' ? Number($('result-delay').value) : 0;
  pending = { roomCode: room.code, playerId, dueAt: Date.now() + delay, message: {
    type: 'result', roundId: localRound.id, status, elapsed, cleared: localRound.run.cleared,
    mistakes: localRound.run.mistakes, goDelay: localRound.goDelay,
    ...(room.round.game === PERM_GAME ? { score: localRound.run.score } : {}),
    ...(room.round.game === SLOT_GAME ? { reelMask: localRound.run.reelMask } : {}),
  } };
  sessionStorage.setItem('bb-pending', JSON.stringify(pending));
  lastPendingSent = -Infinity;
  $('submission-status').textContent = delay ? `Finish saved. Sending after ${delay / 1000} seconds of test delay.` : 'Result saved. Waiting for confirmation…';
  $('submission-status').hidden = false;
  log(status === 'finished' ? `Local finish: ${(elapsed / 1000).toFixed(3)} s.` : status === 'forfeit' ? 'Forfeited: game screen hidden or reloaded.' : 'Time expired.');
  if (status === 'finished') {
    audio.endPlayer();
    audio.play(room.round.game === SLOT_GAME ? 'slotWin' : 'finish');
  } else {
    audio.stopRound();
    if (status === 'timeout' && !document.hidden) audio.play('timeout');
  }
  flushPending();
  renderRoom();
}

function flushPending() {
  if (!joined || !pending || Date.now() < pending.dueAt || performance.now() - lastPendingSent < 1000) return;
  if (send(pending.message)) lastPendingSent = performance.now();
}

function enforceLifecycle(time) {
  if (!localRound || localRound.done || room?.round?.phase === 'results' || time < localRound.start) return;
  if (localRound.mustForfeit || document.hidden || localRound.hiddenDuringPlay) complete('forfeit');
  else if (room.round.game === PERM_GAME) {
    localRound.run.advance(time);
    for (const event of localRound.run.events.splice(0)) if (event.type === 'growth') audio.play('permGrow');
    if (localRound.run.done) complete('finished', localRound.run.elapsed);
  } else {
    if (room.round.game === FIREWORK_GAME || room.round.game === JUMP_GAME) localRound.run.advance(time);
    if (localRound.run.done) complete('finished', localRound.run.elapsed);
    else if (time >= localRound.end) complete('timeout');
    else if (room.round.game === MONKEY_GAME) audio.demonstrate(`${localRound.id}/${localRound.run.demoVersion}`, localRound.run.cues);
  }
}

function tap(color) {
  const time = performance.now();
  enforceLifecycle(time);
  if (!localRound || localRound.done || document.hidden || document.querySelector('dialog[open]') || room?.round?.phase === 'results') return;
  const action = localRound.run.tap(color, time);
  if (action.type === 'ignored') return;
  if (localRound.goDelay === null) localRound.goDelay = Math.max(0, time - localRound.start);
  if (action.type === 'finished') complete('finished', action.elapsed);
  else audio.play(action.type, { color, progress: localRound.run.cleared / room.round.goal, game: room.round.game });
  view.render(room, playerId, localRound, time);
  updateControls(time);
}

function sendProgress(time) {
  if (!joined || !localRound || localRound.done || time < localRound.start || time >= localRound.end || time - lastProgressSent < 250) return;
  const { cleared, mistakes } = localRound.run;
  const score = localRound.run.score;
  const reelMask = localRound.run.reelMask;
  const key = `${cleared}/${mistakes}/${score ?? ''}/${reelMask ?? ''}`;
  if (key === lastProgressKey) return;
  if (send({ type: 'progress', roundId: localRound.id, cleared, mistakes, ...(reelMask !== undefined ? { reelMask } : {}), ...(score !== undefined ? { score } : {}) })) {
    lastProgressSent = time; lastProgressKey = key;
  }
}

function updateMetrics() {
  const time = performance.now();
  const estimate = clock.estimate(time);
  const connected = joined && socket?.readyState === WebSocket.OPEN;
  $('ping').textContent = estimate ? `${estimate.rtt.toFixed(1)} ms` : '—';
  $('uncertainty').textContent = estimate ? `±${estimate.uncertainty.toFixed(1)} ms` : '—';
  $('samples').textContent = estimate ? String(estimate.count) : '0';
  $('connection-badge').textContent = !connected ? room ? 'Reconnecting' : 'Not connected' : estimate?.count >= 3 ? 'Connected · clock sampled' : 'Sampling clock';
  $('connection-dot').classList.toggle('offline', !connected);
  $('connection-dot').setAttribute('aria-label', connected ? 'Connected' : 'Reconnecting');
  $('disconnect').disabled = !connected;
  $('create').disabled = joining;
  if (!room) return;
  const inSet = room.set && room.set.phase !== 'complete';
  const idle = !inSet && (!room.round || room.round.phase === 'results');
  const gate = room.set?.phase === 'instructions' || room.set?.phase === 'intermission' && room.mode === 'game-select';
  const mine = room.players.find(player => player.id === playerId);
  $('ready').disabled = !gate || !connected || !estimate || estimate.count < 3 || estimate.rtt > 1500 || !mine?.sync || mine.sync.count < 3 || time + estimate.offset - mine.sync.at >= 20_000;
  $('ready').textContent = mine?.ready ? 'Not ready' : 'Ready';
  $('start').textContent = room.set?.phase === 'complete' ? 'Start new set' : 'Start set';
  const serverNow = time + (estimate?.offset || 0);
  const disconnected = room.players.filter(player => !player.connected);
  const wait = Math.max(0, ...disconnected.map(player => 15_000 - (serverNow - player.disconnectedAt)));
  $('start').disabled = !connected || !idle;
  let status = '';
  if (!connected) status = 'Reconnecting… Keep playing; your result stays saved on this device.';
  else if (idle) status = playerId === room.hostId ? 'Start the set when your friends have joined.' : 'Waiting for the host to start.';
  else if (gate) status = wait > 0 ? `Waiting ${Math.ceil(wait / 1000)}s for a friend to reconnect…` : !estimate || estimate.count < 3 ? 'Synchronizing clocks…' : mine?.ready ? 'Waiting for everyone to be ready…' : 'Tap Ready when you’re set.';
  else if (room.set?.phase === 'intermission') status = '';
  else if (localRound?.done) status = 'Waiting for the other players…';
  else if (!room.round.playerIds.includes(playerId)) status = 'You can play in the next round.';
  $('lobby-status').textContent = status;
  $('lobby-status').hidden = !status;
}


function renderRoom() {
  updateMetrics();
  if (!room) return;
  updateGameProfile();
  const active = isRoundActive(room.round);
  const gate = room.set?.phase === 'instructions' || room.set?.phase === 'intermission' && room.mode === 'game-select';
  $('room-code').textContent = room.code;
  $('occupancy').textContent = `· ${room.players.length}/4`;
  $('leave').disabled = false;
  $('back').hidden = playerId !== room.hostId || !room.set;
  $('ready-actions').hidden = Boolean(active || room.set?.phase === 'intermission' && room.mode === 'arcade');
  $('ready').hidden = !gate;
  $('start').hidden = playerId !== room.hostId || gate;
  $('control-deck').hidden = !active || !room.round.playerIds.includes(playerId);
  $('round-label').textContent = active ? room.set ? roundDetail(room.round) : `Round ${room.testNumber}` : 'Lobby';
  view.render(room, playerId, localRound, performance.now());
  setView.render(room, playerId);
}

function updateControls(time) {
  const disabled = !localRound || localRound.done || document.hidden || time < localRound.start || time >= localRound.end || time < localRound.run.blockedUntil || room?.round?.phase === 'results' || room?.round?.game === PERM_GAME && localRound.run.phase(time).mode === 'watch' || room?.round?.game === MONKEY_GAME && localRound.run.phase(time).mode !== 'play';
  for (const button of buttons) {
    const color = Number(button.dataset.color);
    button.disabled = disabled || Boolean(room?.round?.game === SLOT_GAME && localRound && ((localRound.run.reelMask & (1 << color)) || time < localRound.run.blockedReels[color]));
  }
}

function animate() {
  const time = performance.now();
  enforceLifecycle(time);
  const round = room?.round;
  let overlay = '', small = false;
  audio.setMenuScreen(!document.hidden && !isRoundActive(round), !room || room.players[0]?.id === playerId);
  if (isRoundActive(round)) {
    if (!localRound) { overlay = round.playerIds.includes(playerId) ? 'Syncing…' : 'Next round'; small = true; }
    else if (time < localRound.start) overlay = String(Math.ceil((localRound.start - time) / 1000));
    else {
      if (localRound.goDelay === null && !localRound.done) localRound.goDelay = time - localRound.start;
      if (localRound.done) { overlay = localRound.status === 'finished' ? round.game === PERM_GAME ? 'Fabulous!' : 'Cleared!' : localRound.status === 'forfeit' ? 'Forfeited' : 'Time’s up!'; small = true; }
      else if (time - localRound.start < 450) overlay = 'GO!';
    }
    const elapsed = localRound ? localRound.run.elapsed ?? Math.max(0, Math.min(time, localRound.end) - localRound.start) : 0;
    $('timer').textContent = (elapsed / 1000).toFixed(2);
  } else $('timer').textContent = '00.00';
  if ($('round-overlay').textContent !== overlay) $('round-overlay').textContent = overlay;
  $('round-overlay').hidden = !overlay;
  $('round-overlay').classList.toggle('small', small);
  const frozen = Boolean(localRound && !localRound.done && time < localRound.run.blockedUntil);
  const ownIndex = room?.players.findIndex(player => player.id === playerId) ?? -1;
  if (ownIndex >= 0) view.lanes[ownIndex].lane.classList.toggle('frozen', frozen);
  if (room) view.animate(room, localRound, time, time + (clock.estimate(time)?.offset ?? Date.now() - time) - (room.round?.startAt || 0));
  view.updateFeedback(room, localRound, time);
  if (room) setView.animate(room, time + (clock.estimate(time)?.offset ?? Date.now() - time));
  updateControls(time);
  requestAnimationFrame(animate);
}

async function prepareInvite() {
  const url = new URL(location.href);
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && lanUrls.length && serverUrl === defaultServer) url.host = new URL(lanUrls[0]).host;
  url.search = ''; url.searchParams.set('room', room.code);
  const address = new URL(serverUrl);
  if (address.host !== url.host || address.protocol !== (location.protocol === 'https:' ? 'wss:' : 'ws:')) url.searchParams.set('server', serverUrl);
  inviteUrl = url.href;
  $('invite-link').value = inviteUrl;
  $('copy-link').textContent = 'Copy link';
  $('invite-note').textContent = ['localhost', '127.0.0.1'].includes(url.hostname) ? 'Open this computer’s Wi-Fi address to invite phones on the same network.' : location.protocol === 'https:' ? 'Scan on a phone or share this link. Up to four players.' : 'Connect phones to the same Wi-Fi, then scan or share this link.';
  try { await QRCode.toCanvas($('qr'), inviteUrl, { width: 176, margin: 2, color: { dark: '#3b214d', light: '#fffdf5' } }); }
  catch { $('invite-note').textContent = 'Share the invitation link or enter the room code.'; }
}

function updateSound() {
  $('sound').classList.toggle('sound-off', !audio.enabled);
  $('sound').setAttribute('aria-pressed', String(audio.enabled));
  $('sound').setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Enable sound');
  $('music-mode').value = audio.preferences.musicMode;
  for (const [id, key] of [['music-volume', 'musicVolume'], ['effects-volume', 'effectsVolume']]) {
    const value = Math.round(audio.preferences[key] * 100);
    $(id).value = value;
    $(`${id}-value`).textContent = `${value}%`;
  }
  $('audio-status').textContent = ({ off: 'Sound is off.', loading: 'Loading sounds…', ready: 'Sound ready.', waiting: 'Tap Preview sound to try it.', unavailable: 'Some sounds could not load. Tap Preview sound to retry.' })[audio.status];
  const active = room?.set && room.set.phase !== 'complete' || room?.round && room.round.phase !== 'results';
  $('audio-preview').disabled = Boolean(active) || audio.status === 'loading';
  $('audio-preview').textContent = audio.previewing ? 'Stop preview' : 'Preview sound';
  $('timing-offset').value = timingOffset;
  $('timing-offset-value').textContent = `${timingOffset > 0 ? '+' : ''}${timingOffset} ms`;
  $('timing-offset').disabled = Boolean(active);
}

function updateGameProfile() {
  const active = isRoundActive(room?.round);
  const inSet = room?.set && room.set.phase !== 'complete';
  const mode = room?.mode || selectedMode;
  const profile = displayRound();
  const game = profile.game;
  const perm = game === PERM_GAME;
  const slots = game === SLOT_GAME;
  audio.selectGame(game);
  document.body.classList.toggle('perm-theme', Boolean(room && perm));
  document.body.classList.toggle('slot-theme', Boolean(room && slots));
  document.body.classList.toggle('firework-theme', Boolean(room && game === FIREWORK_GAME));
  document.body.classList.toggle('monkey-theme', Boolean(room && game === MONKEY_GAME));
  document.body.classList.toggle('jump-theme', Boolean(room && game === JUMP_GAME));
  document.body.classList.toggle('in-set', Boolean(inSet));
  const title = !room ? 'Bishy Bashy!' : room.set?.phase === 'complete' ? 'Set complete!' : room.set?.phase === 'intermission' ? 'Standings' : room.set?.phase === 'instructions' || active ? GAMES[game].title : 'Choose your mode';
  if (document.querySelector('.game-title').textContent !== title) document.querySelector('.game-title').textContent = title;
  document.title = `${room ? title : 'Party games'} · Bishy Bashy`;
  $('lobby-setup').hidden = !room || Boolean(inSet);
  $('game-browser').hidden = mode !== 'game-select';
  $('rhythm-guide').hidden = !perm || !active;
  $('slot-guide').hidden = !slots || !active;
  for (const button of document.querySelectorAll('[data-game]')) {
    button.setAttribute('aria-pressed', String(button.dataset.game === (room?.selectedGame || selectedGame)));
    button.disabled = Boolean(inSet || active || room && room.hostId !== playerId);
  }
  for (const button of document.querySelectorAll('[data-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    button.disabled = Boolean(inSet || active || room && room.hostId !== playerId);
  }
}

function displayRound() {
  if (room?.round && room.set?.phase !== 'complete') return room.round;
  const game = room?.selectedGame || selectedGame;
  return { game, ...roundSettings(game, 0) };
}

function requestNavigation(type) {
  if (!room) return;
  const inSet = room.set && room.set.phase !== 'complete';
  if (!joined || socket?.readyState !== WebSocket.OPEN) return notice('Connection lost. Wait for reconnection, then try again.');
  if ((type === 'back-to-modes' || inSet) && !supportsRoomNavigation) return notice('The multiplayer server needs the navigation update. Restart the server and refresh this page.');
  const confirm = type === 'leave' ? inSet : isRoundActive(room.round) || room.set?.history.length > 0 && inSet;
  if (!confirm) { send({ type, setId: room.set?.id }); return; }
  navigationAction = { type, code: room.code, setId: room.set?.id };
  const leaving = type === 'leave';
  $('navigation-title').textContent = leaving ? 'Leave this game?' : 'Back to mode selection?';
  $('navigation-description').textContent = leaving ? 'Your current unfinished round will be forfeited and you will leave the set. Your friends can keep playing.' : 'This ends the current set for everyone and clears its scores. Everyone stays in the room.';
  $('navigation-confirm-action').textContent = leaving ? 'Leave room' : 'End set and go back';
  $('navigation-stay').textContent = 'Keep playing';
  $('navigation-confirm').showModal();
}

function showRules() {
  const profile = displayRound();
  const game = profile.game;
  const activeSet = room?.set && room.set.phase !== 'complete';
  const gameHelp = activeSet || room?.mode === 'game-select';
  $('rules-title').textContent = gameHelp ? GAMES[game].title : 'How to play a set';
  $('rules-visual').replaceChildren(ruleVisual(gameHelp ? game : null));
  const rules = !gameHelp ? ['Arcade plays five different random games. Game Select plays five rounds of one game.', 'Read the rules and tap Ready. Every connected player must be ready before the countdown.', 'Each round awards 10 / 7 / 4 / 1 points by place. Most total points wins.'] : gameRules(game, profile);
  $('rules-list').replaceChildren(...rules.map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
  $('rules-note').textContent = 'Stay on this screen during the round; switching apps or reloading forfeits it.';
  $('rules').showModal();
}

$('create').addEventListener('click', () => enter('create'));
const unlockAudioFromGesture = () => {
  if (audio.enabled && (!audio.context || audio.context.state !== 'running' || audio.menu.active && !audio.menuPlaying)) audio.unlock();
};
document.addEventListener('pointerdown', unlockAudioFromGesture, { capture: true });
document.addEventListener('keydown', unlockAudioFromGesture, { capture: true });
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled || button.id === 'sound') return;
  if (button.classList.contains('hit-button')) return;
  audio.pressButton();
}, { capture: true });
$('entry-form').addEventListener('submit', event => { event.preventDefault(); enter('join'); });
$('ready').addEventListener('click', () => { notice(''); audio.unlock(); send({ type: 'ready', ready: !room.players.find(player => player.id === playerId)?.ready }); });
$('start').addEventListener('click', () => { audio.unlock(); send({ type: 'start' }); });
$('leave').addEventListener('click', () => requestNavigation('leave'));
$('back').addEventListener('click', () => requestNavigation('back-to-modes'));
$('navigation-stay').addEventListener('click', () => $('navigation-confirm').close());
$('navigation-confirm-action').addEventListener('click', () => {
  const action = navigationAction;
  if (action && room?.code === action.code) {
    if (send({ type: action.type, setId: action.setId })) $('navigation-confirm').close();
    else notice('Connection lost. Wait for reconnection, then try again.');
  }
});
$('navigation-confirm').addEventListener('close', () => { navigationAction = null; });
$('game-search').addEventListener('input', event => setView.filterGames(event.target.value));
$('rules-open').addEventListener('click', showRules);
$('settings-open').addEventListener('click', () => { updateSound(); $('settings').showModal(); });
$('sound').addEventListener('click', async () => {
  audio.toggle(); updateSound();
  audio.pressButton();
  await audio.unlock();
  synchronizeAudio();
});
$('audio-preview').addEventListener('click', () => audio.previewing ? audio.stopPreview() : audio.preview(room?.selectedGame || selectedGame));
$('settings').addEventListener('close', () => audio.stopPreview());
$('music-mode').addEventListener('change', () => { audio.setPreferences({ musicMode: $('music-mode').value }); synchronizeAudio(); });
for (const [id, key] of [['music-volume', 'musicVolume'], ['effects-volume', 'effectsVolume']]) {
  $(id).addEventListener('input', () => audio.setPreferences({ [key]: Number($(id).value) / 100 }));
}
$('timing-offset').addEventListener('input', () => {
  timingOffset = Number($('timing-offset').value);
  localStorage.setItem('bb-timing-offset', String(timingOffset));
  updateSound();
});
for (const button of document.querySelectorAll('[data-game]')) button.addEventListener('click', () => {
  if (room) send({ type: 'configure', mode: room.mode, game: button.dataset.game });
  else { selectedGame = button.dataset.game; localStorage.setItem('bb-game', selectedGame); updateGameProfile(); }
});
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => {
  if (room) send({ type: 'configure', mode: button.dataset.mode, game: room.selectedGame });
  else { selectedMode = button.dataset.mode; localStorage.setItem('bb-mode', selectedMode); updateGameProfile(); }
});
$('share').addEventListener('click', async () => { $('invite').showModal(); await prepareInvite(); });
$('copy-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(inviteUrl); $('copy-link').textContent = 'Copied!'; }
  catch { $('invite-link').select(); $('invite-note').textContent = 'Select and copy the invitation link.'; }
});
for (const button of buttons) {
  button.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); tap(Number(button.dataset.color)); });
  button.addEventListener('click', event => { if (event.detail === 0) tap(Number(button.dataset.color)); });
}
const keys = { '1': 0, j: 0, '2': 1, k: 1, '3': 2, l: 2 };
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  const color = keys[event.key.toLowerCase()];
  if (color === undefined) return;
  event.preventDefault(); tap(color);
});
$('disconnect').addEventListener('click', () => {
  reconnectAt = performance.now() + 5000;
  socket?.close();
  $('settings').close();
  log('Testing a 5-second disconnection.');
});
$('export').addEventListener('click', () => {
  const report = { exportedAt: new Date().toISOString(), room: room ? { code: room.code, roundNumber: room.testNumber, round: room.round, players: room.players } : null, clock: clock.estimate(performance.now()), local: localRound ? { roundId: localRound.id, uncertainty: localRound.uncertainty, goDelay: localRound.goDelay, cleared: localRound.run.cleared, mistakes: localRound.run.mistakes } : null, events, note: 'Client-reported timing; uncertainty and GO delay do not measure physical display or input latency.' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `bishy-bashy-${room?.code || 'timing'}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.addEventListener('visibilitychange', () => {
  const time = performance.now();
  if (document.hidden) {
    hiddenSince = time; audio.cancel();
    view.feedback.clear();
    if (localRound && time >= localRound.start && time < localRound.end && !localRound.done) complete('forfeit');
  } else {
    if (hiddenSince !== null && localRound && !localRound.done && hiddenSince < localRound.end && time >= localRound.start) {
      localRound.hiddenDuringPlay = true; complete('forfeit');
    }
    hiddenSince = null; ping();
    synchronizeAudio();
  }
});
window.addEventListener('pagehide', () => {
  audio.cancel();
  view.feedback.clear();
  if (localRound && performance.now() >= localRound.start && !localRound.done) complete('forfeit');
});
window.addEventListener('pageshow', event => {
  if (event.persisted && localRound && !localRound.done && performance.now() >= localRound.start) complete('forfeit');
  if (readStored('bb-session') && !intentionalClose) connect();
});
setInterval(() => {
  const time = performance.now();
  enforceLifecycle(time); sendProgress(time); flushPending(); renderRoom();
  if (socket?.readyState === WebSocket.OPEN && time - lastPong > 12_000) socket.close();
}, 250);
setInterval(() => { if (socket?.readyState === WebSocket.OPEN) ping(); }, 3000);
requestAnimationFrame(animate);
if (!isGitHubPages) fetch('/connection-info').then(response => response.json()).then(info => { lanUrls = info.lanUrls || []; }).catch(() => {});
if (session) connect();
