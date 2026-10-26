import { COLORS, createSequence } from '../shared/totem.js';

const SHAPES = ['●', '▲', '◆'];
const $ = id => document.getElementById(id);
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const resultLabel = result => result?.status === 'finished' ? `${(result.elapsed / 1000).toFixed(3)} s` : ({ forfeit: 'Forfeited', timeout: 'Time expired', missing: 'No result' }[result?.status] || 'Waiting…');

function block(color, surprised = false) {
  const element = node('div', `block ${COLORS[color]}${surprised ? ' surprised' : ''}`);
  element.dataset.color = color;
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', `${COLORS[color]} block`);
  element.append(node('span', 'glyph', SHAPES[color]));
  return element;
}

export class GameView {
  constructor() {
    this.lanes = Array.from({ length: 4 }, () => {
      const lane = node('article', 'lane');
      const name = node('h3', '');
      const zone = node('div', 'tower-zone');
      const tower = node('div', 'tower');
      zone.append(tower);
      const remaining = node('div', 'remaining');
      const progress = node('div', 'progress');
      const fill = node('span', '');
      progress.append(fill);
      const status = node('p', 'seat-status');
      lane.append(name, zone, node('div', 'base'), remaining, progress, status);
      $('player-lanes').append(lane);
      return { lane, name, tower, remaining, fill, status, towerKey: '' };
    });
    this.resultKey = '';
  }

  render(room, playerId, local, time) {
    const round = room.round;
    const active = round && round.phase !== 'results';
    const sequence = round ? createSequence(round.seed, round.blockCount) : [];
    $('arena').classList.toggle('lobby', !active);
    this.lanes.forEach((elements, index) => {
      const player = room.players[index];
      const own = player?.id === playerId;
      const ownRun = own && local?.id === round?.id ? local : null;
      const cleared = ownRun ? ownRun.run.cleared : player?.progress?.cleared || 0;
      const status = player?.result || (ownRun?.done ? { status: ownRun.status, elapsed: ownRun.run.elapsed } : null);
      const frozen = ownRun && !ownRun.done && time < ownRun.run.blockedUntil;
      elements.lane.className = `lane${own ? ' you' : ''}${!player ? ' empty' : ''}${frozen ? ' frozen' : ''}${active && status?.status === 'finished' ? ' finished' : ''}${active && status && status.status !== 'finished' ? ' forfeit' : ''}`;
      elements.name.textContent = player ? `${player.name}${own ? ' · You' : ''}` : 'Open spot';
      const colors = !player || !active ? [index % 3] : sequence.slice(cleared, cleared + 5).reverse();
      const key = `${colors.join(',')}/${Boolean(frozen)}`;
      if (key !== elements.towerKey) {
        elements.tower.replaceChildren(...colors.map(color => block(color, Boolean(frozen))));
        elements.towerKey = key;
      }
      const left = active && player ? Math.max(0, round.blockCount - cleared) : 0;
      if (elements.remaining.dataset.left !== String(left)) {
        elements.remaining.replaceChildren(node('strong', '', String(left)), document.createTextNode('left'));
        elements.remaining.dataset.left = left;
      }
      elements.fill.style.width = `${active && player ? cleared / round.blockCount * 100 : 0}%`;
      elements.status.textContent = !player ? 'Waiting to join' : !player.connected ? 'Reconnecting…' : active ? status ? resultLabel(status) : frozen ? 'Oops!' : '' : player.ready ? '✓ Ready' : player.sync?.count >= 3 ? (player.id === room.hostId ? 'Host' : 'Not ready') : 'Syncing…';
    });
    const hasResults = round?.phase === 'results';
    $('play-view').hidden = hasResults;
    $('results').hidden = !hasResults;
    if (hasResults) this.results(room, playerId);
  }

  results(room, playerId) {
    const key = JSON.stringify([room.round.id, room.players.map(player => [player.id, player.result])]);
    if (this.resultKey === key) return;
    this.resultKey = key;
    const sorted = room.players.filter(player => room.round.playerIds.includes(player.id)).sort((a, b) => (a.result?.status === 'finished' ? a.result.elapsed : Infinity) - (b.result?.status === 'finished' ? b.result.elapsed : Infinity));
    const finishers = sorted.filter(player => player.result?.status === 'finished');
    const winners = finishers.filter(player => player.result.elapsed === finishers[0]?.result.elapsed);
    $('result-round').textContent = `Round ${room.testNumber}`;
    $('result-title').textContent = winners.length > 1 ? 'It’s a tie!' : winners.length ? `${winners[0].name} wins!` : 'Time’s up!';
    $('podium').replaceChildren(...finishers.slice(0, 3).map((player, index) => {
      const rank = finishers.findIndex(other => other.result.elapsed === player.result.elapsed) + 1;
      const seat = node('div', 'podium-seat');
      const step = node('div', 'podium-step');
      step.append(node('strong', '', String(rank)), document.createTextNode(resultLabel(player.result)));
      seat.append(block(index % 3), node('div', 'podium-name', player.name), step);
      return seat;
    }));
    $('result-rows').replaceChildren(...sorted.map(player => {
      const result = player.result;
      const rank = result?.status === 'finished' ? finishers.findIndex(other => other.result.elapsed === result.elapsed) + 1 : '—';
      const row = node('div', `result-row${player.id === playerId ? ' you' : ''}`);
      const timing = node('div', 'result-time', resultLabel(result));
      if (result?.status === 'finished') timing.append(node('small', '', `${result.mistakes || 0} mistakes`));
      row.append(node('span', 'rank', String(rank)), node('span', 'result-name', player.name + (player.id === playerId ? ' · You' : '')), timing);
      return row;
    }));
  }
}
