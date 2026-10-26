import QRCode from 'qrcode';
import { SyncedClock } from './clock.js';
import { TotemRun, TOTEM_GAME } from '../shared/totem.js';
import { GameView } from './game-view.js';
import { GameAudio } from './audio.js';

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
let pending = readStored('bb-pending');
let reconnectAt = 0, reconnectTimer, entryRequest = null, joining = false, intentionalClose = false, joined = false;
let lastPong = 0, lastSyncSent = 0, lastPendingSent = -Infinity, lastProgressSent = 0, lastProgressKey = '';
let inviteUrl = '', lanUrls = [], events = [];
let hiddenSince = document.hidden ? performance.now() : null;
const view = new GameView();
const audio = new GameAudio({ onChange: () => updateSound() });
const buttons = [...document.querySelectorAll('.hit-button')];

$('name').value = session?.name || localStorage.getItem('bb-name') || '';
$('room-input').value = params.get('room') || '';
$('server-url').value = serverUrl;
updateSound();
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
      if (message.protocol !== 2) {
        intentionalClose = true; joining = false; entryRequest = null; connection.close();
        notice('The multiplayer server needs the Totem Shrinker update. Try again after it has deployed.');
        return;
      }
      playerId = message.playerId;
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
  entryRequest = { type, name: $('name').value.trim(), code };
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
  document.body.classList.remove('in-room');
  notice('');
}

function setupLocalRound() {
  const round = room?.round;
  const time = performance.now();
  const estimate = clock.estimate(time);
  if (!round || round.game !== TOTEM_GAME || round.phase === 'results' || localRound || !estimate || estimate.count < 3 || !round.playerIds.includes(playerId)) return;
  const start = round.startAt - estimate.offset;
  const savedResult = pending?.message.roundId === round.id ? pending.message : room.players.find(player => player.id === playerId)?.result;
  localRound = {
    id: round.id, start, end: round.endAt - estimate.offset, offset: estimate.offset, uncertainty: estimate.uncertainty,
    run: new TotemRun(round, start), goDelay: null, done: Boolean(savedResult), status: savedResult?.status,
    mustForfeit: sessionStorage.getItem('bb-active-round') === round.id || time >= start, hiddenDuringPlay: false,
  };
  if (savedResult) {
    localRound.run.cleared = savedResult.cleared || 0;
    localRound.run.mistakes = savedResult.mistakes || 0;
    localRound.run.elapsed = savedResult.elapsed;
    localRound.run.done = true;
  }
  sessionStorage.setItem('bb-active-round', round.id);
  log(`Round ${room.testNumber} scheduled. Clock mapping frozen.`);
  synchronizeAudio();
}

function synchronizeAudio() {
  const round = room?.round;
  if (document.hidden || !localRound || round?.phase === 'results' || localRound.done && localRound.status !== 'finished') return;
  audio.scheduleRound(localRound.id, localRound.start, localRound.end, round.playerIds[0] === playerId, localRound.done);
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
  } };
  sessionStorage.setItem('bb-pending', JSON.stringify(pending));
  lastPendingSent = -Infinity;
  $('submission-status').textContent = delay ? `Finish saved. Sending after ${delay / 1000} seconds of test delay.` : 'Result saved. Waiting for confirmation…';
  $('submission-status').hidden = false;
  log(status === 'finished' ? `Local finish: ${(elapsed / 1000).toFixed(3)} s.` : status === 'forfeit' ? 'Forfeited: game screen hidden or reloaded.' : 'Time expired.');
  if (status === 'finished') {
    audio.endPlayer();
    audio.play('finish');
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
  else if (time >= localRound.end) complete('timeout');
}

function tap(color) {
  const time = performance.now();
  enforceLifecycle(time);
  if (!localRound || localRound.done || document.hidden || document.querySelector('dialog[open]') || room?.round?.phase === 'results') return;
  const action = localRound.run.tap(color, time);
  if (action.type === 'ignored') return;
  if (localRound.goDelay === null) localRound.goDelay = Math.max(0, time - localRound.start);
  if (action.type === 'finished') complete('finished', action.elapsed);
  else audio.play(action.type, { color, progress: localRound.run.cleared / room.round.blockCount });
  view.render(room, playerId, localRound, time);
  updateControls(time);
}

function sendProgress(time) {
  if (!joined || !localRound || localRound.done || time < localRound.start || time >= localRound.end || time - lastProgressSent < 250) return;
  const { cleared, mistakes } = localRound.run;
  const key = `${cleared}/${mistakes}`;
  if (key === lastProgressKey) return;
  if (send({ type: 'progress', roundId: localRound.id, cleared, mistakes })) {
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
  const idle = !room.round || room.round.phase === 'results';
  const mine = room.players.find(player => player.id === playerId);
  $('ready').disabled = !idle || !connected || !estimate || estimate.count < 3 || estimate.rtt > 1500;
  $('ready').textContent = mine?.ready ? 'Not ready' : 'Ready';
  const serverNow = time + (estimate?.offset || 0);
  const disconnected = room.players.filter(player => !player.connected);
  const wait = Math.max(0, ...disconnected.map(player => 15_000 - (serverNow - player.disconnectedAt)));
  const allReady = room.players.filter(player => player.connected).every(player => player.ready && player.sync?.count >= 3 && player.sync.rtt <= 1500 && serverNow - player.sync.at < 20_000);
  $('start').disabled = !connected || !idle || wait > 0 || !allReady;
  let status = '';
  if (!connected) status = 'Reconnecting… Keep playing; your result stays saved on this device.';
  else if (idle) status = wait > 0 ? `Waiting ${Math.ceil(wait / 1000)}s for a friend to reconnect…` : !estimate || estimate.count < 3 ? 'Synchronizing clocks…' : allReady ? playerId === room.hostId ? 'Everyone’s ready!' : 'Waiting for the host to start.' : mine?.ready ? 'Waiting for friends to get ready…' : 'Tap Ready when you’re set.';
  else if (localRound?.done) status = 'Waiting for the other players…';
  else if (!room.round.playerIds.includes(playerId)) status = 'You can play in the next round.';
  $('lobby-status').textContent = status;
  $('lobby-status').hidden = !status;
}

function renderRoom() {
  updateMetrics();
  if (!room) return;
  const active = room.round && room.round.phase !== 'results';
  $('room-code').textContent = room.code;
  $('occupancy').textContent = `· ${room.players.length}/4`;
  $('leave').disabled = Boolean(active);
  $('ready-actions').hidden = Boolean(active);
  $('start').hidden = playerId !== room.hostId;
  $('control-deck').hidden = !active || !room.round.playerIds.includes(playerId);
  $('round-label').textContent = active ? `Round ${room.testNumber}` : 'Lobby';
  view.render(room, playerId, localRound, performance.now());
}

function updateControls(time) {
  const disabled = !localRound || localRound.done || document.hidden || time < localRound.start || time >= localRound.end || time < localRound.run.blockedUntil || room?.round?.phase === 'results';
  for (const button of buttons) button.disabled = disabled;
}

function animate() {
  const time = performance.now();
  enforceLifecycle(time);
  const round = room?.round;
  let overlay = '', small = false;
  if (round && round.phase !== 'results') {
    if (!localRound) { overlay = round.playerIds.includes(playerId) ? 'Syncing…' : 'Next round'; small = true; }
    else if (time < localRound.start) overlay = String(Math.ceil((localRound.start - time) / 1000));
    else {
      if (localRound.goDelay === null && !localRound.done) localRound.goDelay = time - localRound.start;
      if (localRound.done) { overlay = localRound.status === 'finished' ? 'Cleared!' : localRound.status === 'forfeit' ? 'Forfeited' : 'Time’s up!'; small = true; }
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
  const active = room?.round && room.round.phase !== 'results';
  $('audio-preview').disabled = Boolean(active) || audio.status === 'loading';
  $('audio-preview').textContent = audio.previewing ? 'Stop preview' : 'Preview sound';
}

$('create').addEventListener('click', () => enter('create'));
$('entry-form').addEventListener('submit', event => { event.preventDefault(); enter('join'); });
$('ready').addEventListener('click', () => { audio.unlock(); send({ type: 'ready', ready: !room.players.find(player => player.id === playerId)?.ready }); });
$('start').addEventListener('click', () => { audio.unlock(); send({ type: 'start' }); });
$('leave').addEventListener('click', () => send({ type: 'leave' }));
$('rules-open').addEventListener('click', () => $('rules').showModal());
$('settings-open').addEventListener('click', () => { updateSound(); $('settings').showModal(); });
$('sound').addEventListener('click', async () => {
  audio.toggle(); updateSound();
  await audio.unlock();
  synchronizeAudio();
});
$('audio-preview').addEventListener('click', () => audio.previewing ? audio.stopPreview() : audio.preview());
$('settings').addEventListener('close', () => audio.stopPreview());
$('music-mode').addEventListener('change', () => { audio.setPreferences({ musicMode: $('music-mode').value }); synchronizeAudio(); });
for (const [id, key] of [['music-volume', 'musicVolume'], ['effects-volume', 'effectsVolume']]) {
  $(id).addEventListener('input', () => audio.setPreferences({ [key]: Number($(id).value) / 100 }));
}
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
