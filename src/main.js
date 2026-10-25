import QRCode from 'qrcode';
import { SyncedClock } from './clock.js';

const $ = id => document.getElementById(id);
const readStored = key => { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } };
const params = new URLSearchParams(location.search);
const session = readStored('bb-session');
const defaultServer = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
let serverUrl = params.get('server') || localStorage.getItem('bb-server') || defaultServer;
let socket, room, playerId = session?.playerId, token = session?.token;
let clock = new SyncedClock();
let localRound = null;
let pending = readStored('bb-pending');
let reconnectAt = 0, reconnectTimer, entryRequest = null, joining = false, intentionalClose = false;
let lastPong = 0, lastSyncSent = 0, lastPendingSent = 0, inviteUrl = '', lanUrls = [];
let hiddenSince = document.hidden ? performance.now() : null;
let events = [];
const playerColors = ['#ffdd4a', '#ff8eaf', '#88d9ff', '#a9e5a3'];

$('name').value = session?.name || localStorage.getItem('bb-name') || '';
$('room-input').value = params.get('room') || '';
$('server-url').value = serverUrl;

function notice(message) {
  $('notice').textContent = message;
  $('notice').hidden = !message;
}

function log(message) {
  events.unshift(`${new Date().toLocaleTimeString()}  ${message}`);
  events = events.slice(0, 6);
  $('event-log').replaceChildren(...events.map(event => { const line = document.createElement('p'); line.textContent = event; return line; }));
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
  try {
    const url = new URL(serverUrl);
    if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('Use an address starting with ws:// or wss://.');
    if (location.protocol === 'https:' && url.protocol !== 'wss:') throw new Error('An HTTPS page needs a secure wss:// connection server.');
    url.pathname = '/ws'; url.search = ''; url.hash = '';
    socket = new WebSocket(url);
  } catch (error) { joining = false; notice(error.message); return; }
  $('connection-badge').textContent = 'Connecting';
  socket.addEventListener('open', () => {
    clock = new SyncedClock();
    lastPong = performance.now();
    lastSyncSent = 0;
    log('Connected. Measuring clock offset.');
    notice('');
    if (entryRequest) send(entryRequest);
    else if (sessionStorage.getItem('bb-session')) {
      const saved = readStored('bb-session');
      if (saved) send({ type: 'join', code: saved.code, name: saved.name, token: saved.token });
    }
    for (let i = 0; i < 8; i++) setTimeout(() => { if (socket?.readyState === WebSocket.OPEN) ping(); }, i * 200);
  });
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'pong') {
      lastPong = performance.now();
      clock.add({ sent: message.sent, received: lastPong, serverReceived: message.serverReceived, serverSent: message.serverSent });
      const estimate = clock.estimate(lastPong);
      if (room && estimate && lastPong - lastSyncSent > 500) {
        send({ type: 'sync', ...estimate });
        lastSyncSent = lastPong;
      }
      setupLocalRound();
      updateMetrics();
    }
    if (message.type === 'joined') {
      playerId = message.playerId; token = message.token;
      const name = entryRequest?.name || readStored('bb-session')?.name || $('name').value;
      sessionStorage.setItem('bb-session', JSON.stringify({ code: message.code, token, playerId, name }));
      localStorage.setItem('bb-name', name);
      entryRequest = null; joining = false;
      $('welcome').hidden = true; $('room-view').hidden = false;
      log(`Joined room ${message.code}.`);
      if (pending && (pending.roomCode !== message.code || pending.playerId !== playerId)) clearPending();
    }
    if (message.type === 'state') {
      const previousId = room?.round?.id;
      room = message.room;
      if (room.round?.id !== previousId) {
        localRound = null;
        if (room.round && room.round.phase !== 'results') $('invite').hidden = true;
        if (pending && pending.message.roundId !== room.round?.id) clearPending();
      }
      setupLocalRound();
      if (pending && room.round?.phase === 'results') {
        const mine = room.players.find(player => player.id === playerId)?.result;
        if (mine) { clearPending(); $('submission-status').textContent = 'Result confirmed by the server.'; }
      }
      renderRoom();
    }
    if (message.type === 'result-ack' && pending?.message.roundId === message.roundId) {
      clearPending();
      $('submission-status').textContent = 'Result confirmed by the server.';
      log('Result received and acknowledged.');
    }
    if (message.type === 'error') {
      joining = false;
      notice(message.message);
      if (message.message.includes('could not be found')) {
        resetSession();
        entryRequest = null;
        notice(message.message);
        return;
      }
      if (entryRequest) { entryRequest = null; intentionalClose = true; socket.close(); }
      if (message.message.includes('window has closed') || message.message.includes('old or unknown')) clearPending();
    }
    if (message.type === 'left') resetSession();
  });
  socket.addEventListener('close', () => {
    $('connection-badge').textContent = 'Reconnecting';
    log('Connection lost. Local timing continues.');
    if (!intentionalClose) reconnectTimer = setTimeout(connect, Math.max(1000, reconnectAt - performance.now()));
    renderRoom();
  });
  socket.addEventListener('error', () => notice('Cannot reach the connection server. Check its address, Wi-Fi, and whether it is running.'));
}

function enter(type) {
  if (joining) return;
  if (!$('name').reportValidity()) return;
  const code = $('room-input').value.trim().toUpperCase();
  if (type === 'join' && !/^[A-Z2-9]{6}$/.test(code)) return notice('Enter the six-character room code.');
  serverUrl = $('server-url').value.trim() || defaultServer;
  localStorage.setItem('bb-server', serverUrl);
  entryRequest = { type, name: $('name').value.trim(), code };
  joining = true; intentionalClose = false;
  notice('Connecting to the room…');
  if (socket?.readyState === WebSocket.OPEN) send(entryRequest);
  else connect();
}

function resetSession() {
  intentionalClose = true;
  socket?.close(); clearTimeout(reconnectTimer);
  room = null; localRound = null; token = null; playerId = null;
  clearPending();
  sessionStorage.removeItem('bb-session'); sessionStorage.removeItem('bb-active-round');
  $('welcome').hidden = false; $('room-view').hidden = true; notice('');
}

function setupLocalRound() {
  const round = room?.round;
  const estimate = clock.estimate(performance.now());
  if (!round || round.phase === 'results' || localRound || !estimate || estimate.count < 3) return;
  const wasActive = sessionStorage.getItem('bb-active-round') === round.id;
  localRound = { id: round.id, start: round.startAt - estimate.offset, end: round.endAt - estimate.offset, offset: estimate.offset, uncertainty: estimate.uncertainty, goDelay: null, done: false, mustForfeit: wasActive, hiddenDuringPlay: false };
  sessionStorage.setItem('bb-active-round', round.id);
  const mine = room.players.find(player => player.id === playerId);
  if (mine?.result || pending?.message.roundId === round.id) localRound.done = true;
  log(`Start scheduled. Clock estimate frozen for test ${room.testNumber}.`);
}

function clearPending() {
  pending = null; sessionStorage.removeItem('bb-pending');
}

function complete(status, elapsed = null) {
  if (!localRound || localRound.done) return;
  localRound.done = true;
  const delay = status === 'finished' ? Number($('result-delay').value) : 0;
  pending = { roomCode: room.code, playerId, dueAt: Date.now() + delay, message: { type: 'result', roundId: localRound.id, status, elapsed, goDelay: localRound.goDelay } };
  sessionStorage.setItem('bb-pending', JSON.stringify(pending));
  lastPendingSent = 0;
  $('submission-status').textContent = delay ? `Finish saved locally. Sending after ${delay} ms of test delay.` : 'Result saved locally. Waiting for server confirmation.';
  log(status === 'finished' ? `Local finish: ${(elapsed / 1000).toFixed(3)} s.` : status === 'forfeit' ? 'Round forfeited: game screen was hidden or reloaded.' : 'Local test time expired.');
  flushPending();
  renderRoom();
}

function flushPending() {
  if (!pending || Date.now() < pending.dueAt || performance.now() - lastPendingSent < 1000) return;
  if (send(pending.message)) { lastPendingSent = performance.now(); $('submission-status').textContent = 'Result sent. Waiting for server confirmation.'; }
}

function finish() {
  const time = performance.now();
  if (!localRound || document.hidden || localRound.done || time < localRound.start || time > localRound.end) return;
  complete('finished', time - localRound.start);
}

function updateMetrics() {
  const estimate = clock.estimate(performance.now());
  $('ping').textContent = estimate ? `${estimate.rtt.toFixed(1)} ms` : '—';
  const wallOffset = estimate ? estimate.offset - performance.timeOrigin : 0;
  $('offset').textContent = estimate ? `${wallOffset >= 0 ? '+' : ''}${wallOffset.toFixed(1)} ms` : '—';
  $('uncertainty').textContent = estimate ? `±${estimate.uncertainty.toFixed(1)} ms` : '—';
  $('samples').textContent = estimate ? String(estimate.count) : '0';
  $('connection-badge').textContent = socket?.readyState !== WebSocket.OPEN ? 'Reconnecting' : estimate?.count >= 3 ? 'Connected · clock sampled' : 'Sampling clock';
  const mine = room?.players.find(player => player.id === playerId);
  const idle = !room?.round || room.round.phase === 'results';
  $('ready').disabled = !idle || socket?.readyState !== WebSocket.OPEN || !estimate || estimate.count < 3;
  if (mine) $('ready').textContent = mine.ready ? 'Not ready' : 'Ready';
  $('start').disabled = !room?.players.every(player => player.connected && player.ready && player.sync?.count >= 3 && player.sync.rtt <= 1500);
  $('disconnect').disabled = socket?.readyState !== WebSocket.OPEN;
}

function renderRoom() {
  if (!room) return;
  $('room-code').textContent = room.code;
  $('occupancy').textContent = `${room.players.length} / 4 players`;
  const active = room.round && room.round.phase !== 'results';
  $('leave').disabled = Boolean(active);
  $('ready').hidden = Boolean(active);
  $('start').hidden = playerId !== room.hostId || Boolean(active);
  $('round-number').textContent = `Test ${String(room.testNumber || 1).padStart(2, '0')}`;
  $('players').replaceChildren(...Array.from({ length: 4 }, (_, index) => {
    const player = room.players[index];
    const lane = document.createElement('article');
    lane.className = `player-lane${player?.id === playerId ? ' is-you' : ''}${!player ? ' empty' : ''}`;
    lane.style.setProperty('--player-color', playerColors[index]);
    const face = document.createElement('div'); face.className = 'player-face'; face.textContent = player ? ['◕', '◉', '●', '◔'][index] : '+';
    const name = document.createElement('h3'); name.textContent = player ? player.name : 'Open spot';
    const tag = document.createElement('span'); tag.className = 'player-tag'; tag.textContent = player ? `${player.id === playerId ? 'You' : `Player ${index + 1}`}${player.id === room.hostId ? ' · Host' : ''}` : 'Invite a friend';
    const status = document.createElement('p');
    status.className = 'player-status';
    status.textContent = !player ? 'Waiting to join' : !player.connected ? 'Reconnecting…' : player.ready && !active ? '✓ Ready' : player.result ? ({ finished: `${(player.result.elapsed / 1000).toFixed(3)} s`, forfeit: 'Forfeited', timeout: 'Time expired', missing: 'No result' }[player.result.status]) : active ? (player.id === playerId && localRound?.done ? 'Sending result…' : 'In the test') : player.sync?.count >= 3 ? 'Clock sampled' : 'Syncing clock…';
    lane.append(tag, face, name, status);
    return lane;
  }));
  const hasResults = room.round?.phase === 'results';
  $('results').hidden = !hasResults;
  if (hasResults) renderResults();
  updateMetrics();
}

function renderResults() {
  const players = room.players.filter(player => room.round.playerIds.includes(player.id));
  const sorted = [...players].sort((a, b) => (a.result?.status === 'finished' ? a.result.elapsed : Infinity) - (b.result?.status === 'finished' ? b.result.elapsed : Infinity));
  let previousElapsed, previousRank;
  $('result-rows').replaceChildren(...sorted.map((player, index) => {
    const result = player.result;
    const rank = result?.status === 'finished' ? (result.elapsed === previousElapsed ? previousRank : index + 1) : '—';
    previousElapsed = result?.elapsed; previousRank = rank;
    const row = document.createElement('tr');
    if (player.id === playerId) row.className = 'your-result';
    const cells = [rank, player.name + (player.id === playerId ? ' (you)' : ''), result?.status === 'finished' ? `${(result.elapsed / 1000).toFixed(3)} s` : ({ forfeit: 'Forfeited', timeout: 'Time expired', missing: 'No result' }[result?.status] || '—'), Number.isFinite(result?.arrivalLag) ? `${Math.round(result.arrivalLag)} ms` : '—', Number.isFinite(result?.goDelay) ? `${result.goDelay.toFixed(1)} ms` : '—'];
    row.replaceChildren(...cells.map(value => { const cell = document.createElement('td'); cell.textContent = String(value); return cell; }));
    return row;
  }));
}

function animate() {
  const time = performance.now();
  const round = room?.round;
  $('finish').hidden = true;
  $('clock-face').classList.remove('is-go');
  if (!round) {
    $('countdown').textContent = 'Let’s sync.';
    $('round-label').textContent = 'Ready when you are.';
    $('round-message').textContent = 'Let your clock settle, then tap Ready. The host starts when everyone is ready.';
  } else if (round.phase === 'results') {
    $('countdown').textContent = 'All in.';
    $('round-label').textContent = 'Test complete';
    $('round-message').textContent = 'Compare the results below. Ready up to run another test.';
  } else if (!localRound) {
    $('countdown').textContent = 'Syncing…';
    $('round-message').textContent = 'Waiting for fresh clock measurements.';
  } else {
    if (time >= localRound.start && !localRound.done && (localRound.mustForfeit || document.hidden || localRound.hiddenDuringPlay)) complete('forfeit');
    if (time >= localRound.end && !localRound.done) complete('timeout');
    if (time < localRound.start) {
      $('countdown').textContent = String(Math.ceil((localRound.start - time) / 1000));
      $('round-label').textContent = 'Starting together';
      $('round-message').textContent = 'Keep this screen open. Tap Finish after GO.';
    } else if (!localRound.done) {
      if (localRound.goDelay === null) localRound.goDelay = time - localRound.start;
      $('countdown').textContent = 'GO!';
      $('clock-face').classList.add('is-go');
      $('round-label').textContent = `${((time - localRound.start) / 1000).toFixed(2)} s elapsed`;
      $('round-message').textContent = `${Math.max(0, (localRound.end - time) / 1000).toFixed(1)} s left. Your phone is keeping time.`;
      $('finish').hidden = false;
    } else {
      $('countdown').textContent = 'You’re done.';
      $('round-label').textContent = 'Waiting for the room';
      $('round-message').textContent = pending ? 'Your result is saved on this phone until the server confirms it.' : 'Stay here while the other players finish or reconnect.';
    }
  }
  requestAnimationFrame(animate);
}

async function prepareInvite() {
  const url = new URL(location.href);
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && lanUrls.length && serverUrl === defaultServer) {
    url.host = new URL(lanUrls[0]).host;
  }
  url.search = ''; url.searchParams.set('room', room.code);
  const address = new URL(serverUrl);
  if (address.host !== location.host || address.protocol !== (location.protocol === 'https:' ? 'wss:' : 'ws:')) url.searchParams.set('server', serverUrl);
  inviteUrl = url.href;
  $('invite-link').value = inviteUrl;
  $('invite-note').textContent = ['localhost', '127.0.0.1'].includes(url.hostname) ? 'This link points to this device only. Open the computer’s Wi-Fi address first to invite phones.' : 'For this local test, connect everyone to the same Wi-Fi. Allow this server through your firewall if prompted.';
  try { await QRCode.toCanvas($('qr'), inviteUrl, { width: 176, margin: 2, color: { dark: '#1935b8', light: '#ffffff' } }); } catch { $('invite-note').textContent = 'Use the invitation link or enter the room code.'; }
}

$('create').addEventListener('click', () => enter('create'));
$('entry-form').addEventListener('submit', event => { event.preventDefault(); enter('join'); });
$('ready').addEventListener('click', () => send({ type: 'ready', ready: !room.players.find(player => player.id === playerId)?.ready }));
$('start').addEventListener('click', () => send({ type: 'start' }));
$('finish').addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); finish(); });
$('finish').addEventListener('click', event => { if (event.detail === 0) finish(); });
$('leave').addEventListener('click', () => send({ type: 'leave' }));
$('share').addEventListener('click', async () => { $('invite').hidden = !$('invite').hidden; if (!$('invite').hidden) await prepareInvite(); });
$('copy-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(inviteUrl); $('copy-link').textContent = 'Copied!'; }
  catch { $('invite-link').select(); notice('Select and copy the invitation link above.'); }
});
$('disconnect').addEventListener('click', () => { reconnectAt = performance.now() + 5000; socket?.close(); log('Five-second disconnection test started.'); });
$('export').addEventListener('click', () => {
  const report = { exportedAt: new Date().toISOString(), room: { ...room, players: room.players.map(({ sync, ...player }) => ({ ...player, sync: sync ? { rtt: sync.rtt, uncertainty: sync.uncertainty, count: sync.count } : null })) }, localClock: clock.estimate(performance.now()), localStart: localRound ? { uncertainty: localRound.uncertainty, goDelay: localRound.goDelay } : null, notes: 'Local elapsed times are self-reported. Clock uncertainty and GO delay are diagnostics, not measured cross-device screen skew.' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `bishy-bashy-test-${room.testNumber}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.addEventListener('visibilitychange', () => {
  const time = performance.now();
  const hiddenAt = hiddenSince;
  hiddenSince = document.hidden ? time : null;
  if (!localRound || localRound.done || room?.round?.phase === 'results') return;
  if (document.hidden && time >= localRound.start && time < localRound.end) { localRound.hiddenDuringPlay = true; complete('forfeit'); }
  if (!document.hidden && time >= localRound.start && (localRound.hiddenDuringPlay || (hiddenAt !== null && hiddenAt < localRound.end))) complete('forfeit');
});
window.addEventListener('pagehide', () => {
  if (localRound && !localRound.done && performance.now() >= localRound.start && performance.now() < localRound.end) complete('forfeit');
});
window.addEventListener('online', () => { if (socket?.readyState === WebSocket.CLOSED && !intentionalClose) connect(); });

setInterval(() => {
  updateMetrics();
  flushPending();
  if (socket?.readyState === WebSocket.OPEN && performance.now() - lastPong > 12_000) socket.close();
}, 250);
setInterval(ping, 3000);
requestAnimationFrame(animate);

try {
  const response = await fetch('./connection-info');
  if (response.ok && response.headers.get('content-type')?.includes('application/json')) lanUrls = (await response.json()).lanUrls;
} catch { /* A static GitHub Pages copy does not expose local server addresses. */ }
if (session) { intentionalClose = false; connect(); }
