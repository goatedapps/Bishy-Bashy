import { GAMES, gameRules } from '../shared/games.js';
import { MODES, setStandings } from '../shared/sets.js';
import { gameArt, ruleVisual } from './game-art.js';
import { InstructionSequence } from './instruction-sequence.js';
import { ArcadeReel } from './arcade-reel.js';

const $ = id => document.getElementById(id);
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export class SetView {
  constructor({ onInstructionStep = () => {} } = {}) {
    this.key = '';
    this.wheel = new ArcadeReel();
    this.instructionSequence = new InstructionSequence({ onReveal: onInstructionStep });
    for (const game of Object.values(GAMES)) {
      const button = node('button', `game-choice choice-${game.id}`);
      button.type = 'button';
      button.dataset.game = game.id;
      button.setAttribute('aria-pressed', 'false');
      const art = gameArt(game.id);
      const copy = node('span', 'game-choice-copy');
      copy.append(node('strong', '', game.title), node('small', '', game.subtitle));
      button.append(art, copy);
      $('game-picker').append(button);
    }
  }

  filterGames(query) {
    const term = query.trim().toLocaleLowerCase();
    let shown = 0;
    for (const button of $('game-picker').children) {
      button.hidden = !GAMES[button.dataset.game].title.toLocaleLowerCase().includes(term);
      if (!button.hidden) shown++;
    }
    $('game-empty').hidden = shown > 0;
  }

  render(room, playerId) {
    const set = room.set;
    $('set-progress').hidden = !set;
    const instructions = set?.phase === 'instructions';
    const standingsVisible = set && ['intermission', 'complete'].includes(set.phase);
    $('game-instructions').hidden = !instructions;
    if (!instructions) this.instructionSequence.cancel();
    $('standings-panel').hidden = !standingsVisible;
    if (!set) return;
    $('results').hidden = true;
    if (instructions || standingsVisible || set.phase === 'selecting') $('play-view').hidden = true;
    $('set-progress').textContent = `${MODES[set.mode].title} · ${set.mode === 'arcade' ? 'Game' : 'Round'} ${set.roundIndex + 1} of ${set.plan.length}`;
    if (instructions) {
      if (this.instructionSequence.key !== room.round.id) {
        $('instructions-visual').replaceChildren(ruleVisual(room.round.game));
        $('instructions-list').replaceChildren(...gameRules(room.round.game, room.round).map(text => node('li', '', text)));
        this.instructionSequence.start(room.round.id, [$('instructions-title'), $('instructions-visual'), ...$('instructions-list').children], performance.now());
      }
      this.instructionSequence.advance(performance.now(), !document.hidden);
      this.renderReady(room, $('ready-players'), playerId);
    }
    if (!standingsVisible || !set.history.length) return;
    this.renderReady(room, $('podium-ready-players'), playerId);
    $('podium-ready-players').hidden = set.phase === 'complete' || set.mode === 'arcade';
    const final = set.phase === 'complete';
    if (final) { $('results').hidden = true; $('play-view').hidden = true; }
    $('standings-panel').classList.toggle('final-standings', final);
    const key = `${set.id}/${set.history.length}/${set.phase}/${playerId}`;
    if (this.key === key) return;
    this.key = key;
    const standings = setStandings(set.players);
    const leaders = standings.filter(player => player.points > 0 && player.placement === 1);
    $('standings-label').textContent = final ? 'Set complete!' : `${set.mode === 'arcade' ? 'Game' : 'Round'} ${set.history.length} complete!`;
    $('standings-title').textContent = !final ? 'Current standings' : leaders.length > 1 ? 'A shared victory!' : leaders.length ? `${leaders[0].name} takes the crown!` : 'No winner this time';
    const last = set.history.at(-1);
    $('set-podium').replaceChildren(...[standings[1], standings[0], standings[2]].map(player => {
      if (!player) return node('div', 'set-podium-empty');
      const seat = node('div', `set-podium-seat place-${player.placement}${player.id === playerId ? ' you' : ''}`);
      if (player.placement === 1 && player.points > 0) seat.append(node('span', 'podium-crown', '♛'));
      const avatar = node('div', `block ${['red', 'blue', 'green'][set.players.findIndex(member => member.id === player.id) % 3]}`);
      avatar.setAttribute('aria-hidden', 'true');
      const step = node('div', 'set-podium-step');
      const points = node('strong', '', `${player.points}`);
      points.append(node('small', '', ' pts'));
      step.append(node('div', 'podium-name', player.name + (player.id === playerId ? ' · You' : '')), points, node('span', 'podium-place', `${player.placement}${['', 'st', 'nd', 'rd'][player.placement] || 'th'} place`));
      seat.append(avatar, step);
      return seat;
    }));
    $('standings-rows').replaceChildren(...standings.map(player => {
      const row = node('div', `standing-row${player.id === playerId ? ' you' : ''}${player.placement === 1 && player.points ? ' leader' : ''}`);
      const earned = last.rows.find(item => item.playerId === player.id)?.points || 0;
      const name = node('strong', 'standing-name', player.name + (player.id === playerId ? ' · You' : ''));
      const result = last.rows.find(item => item.playerId === player.id)?.result;
      const detail = result?.status === 'finished' ? last.game === 'perm-mania' ? `${result.cleared} growth · ${result.score.toLocaleString()}` : `${(result.elapsed / 1000).toFixed(3)} s` : ({ forfeit: 'Forfeited', timeout: 'Time expired', missing: 'Missed round' }[result?.status] || '');
      row.append(node('span', 'standing-rank', String(player.placement)), name);
      const recent = node('span', 'points-earned');
      recent.append(node('strong', '', `+${earned}`), node('small', '', detail));
      row.append(recent);
      const points = node('span', 'standing-points');
      points.append(node('strong', '', String(player.points)), node('small', '', 'pts'));
      row.append(points);
      return row;
    }));
    const table = node('table', 'history-table');
    const head = document.createElement('thead');
    const header = document.createElement('tr');
    for (const text of ['Round', ...set.players.map(player => player.name)]) { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = text; header.append(cell); }
    head.append(header);
    const body = document.createElement('tbody');
    set.history.forEach((round, index) => {
      const row = document.createElement('tr');
      const title = document.createElement('th'); title.scope = 'row'; title.textContent = `${index + 1}. ${GAMES[round.game].title}`;
      row.append(title);
      for (const player of set.players) { const cell = document.createElement('td'); cell.textContent = String(round.rows.find(item => item.playerId === player.id)?.points || 0); row.append(cell); }
      body.append(row);
    });
    table.append(head, body);
    $('history-table').replaceChildren(table);
    $('set-history').hidden = !final;
    $('intermission-countdown').hidden = final;
  }

  instructionsComplete(roundId) {
    return this.instructionSequence.key === roundId && this.instructionSequence.complete;
  }

  renderReady(room, container, playerId) {
    const key = JSON.stringify(room.players.map(player => [player.id, player.ready, player.connected]));
    if (container.dataset.state === key) return;
    container.dataset.state = key;
    container.replaceChildren(...room.players.map(player => node('span', `ready-chip${player.ready ? ' is-ready' : ''}`, `${player.ready ? '✓' : '○'} ${player.name}${player.id === playerId ? ' · You' : ''}${!player.connected ? ' · Reconnecting' : ''}`)));
  }

  animate(room, serverNow) {
    const set = room.set;
    this.wheel.render(room, serverNow);
    if (set?.phase === 'instructions') this.instructionSequence.advance(performance.now(), !document.hidden);
    if (set?.phase !== 'intermission') return;
    const seconds = Math.max(0, Math.ceil((set.nextStartAt - serverNow) / 1000));
    const text = set.mode === 'arcade' ? seconds ? `Continuing in ${seconds}s…` : 'Continuing…' : set.waitReason === 'sync' ? 'Synchronizing clocks…' : set.waitReason === 'assets' ? 'Waiting for sounds to load…' : set.waitReason === 'players' ? 'Waiting for a friend to reconnect…' : set.waitReason === 'ready' ? 'Ready for another round?' : seconds ? `Starting in ${seconds}s…` : 'Starting the next round…';
    if ($('intermission-countdown').textContent !== text) $('intermission-countdown').textContent = text;
  }
}
