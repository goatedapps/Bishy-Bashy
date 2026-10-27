import { GAMES, roundSettings } from '../shared/games.js';
import { MODES, ARCADE_LENGTH, GAME_SELECT_LENGTH, setStandings, roundDetail } from '../shared/sets.js';

const $ = id => document.getElementById(id);
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export class SetView {
  constructor() {
    this.key = '';
    $('arcade-count').textContent = `${Math.min(ARCADE_LENGTH, Object.keys(GAMES).length)} games`;
    $('select-count').textContent = `${GAME_SELECT_LENGTH} rounds`;
    for (const game of Object.values(GAMES)) {
      const button = node('button', `game-choice choice-${game.id}`);
      button.type = 'button';
      button.dataset.game = game.id;
      button.setAttribute('aria-pressed', 'false');
      const art = node('span', 'game-choice-art');
      art.setAttribute('aria-hidden', 'true');
      if (game.id === 'perm-mania') {
        const avatar = node('span', 'perm-character');
        avatar.append(node('span', 'perm-hair'), node('span', 'perm-dancer dancer-1'));
        art.append(avatar);
      } else art.append(node('span', 'block red'), node('span', 'block green'));
      const copy = node('span', 'game-choice-copy');
      copy.append(node('strong', '', game.title), node('small', '', game.id === 'perm-mania' ? 'A faster groove each round' : 'A taller tower each round'));
      button.append(art, copy);
      $('game-picker').append(button);
    }
  }

  render(room, playerId) {
    const set = room.set;
    $('set-progress').hidden = !set;
    $('intermission').hidden = set?.phase !== 'intermission';
    $('standings-panel').hidden = !set?.history.length || set.phase === 'playing';
    if (!set) return;
    $('set-progress').textContent = `${MODES[set.mode].title} · ${set.mode === 'arcade' ? 'Game' : 'Round'} ${set.roundIndex + 1} of ${set.plan.length}`;
    if (set.phase === 'intermission') {
      const next = set.plan[set.roundIndex + 1];
      $('next-game').textContent = `Up next: ${GAMES[next].title}`;
      const level = set.mode === 'game-select' ? set.roundIndex + 2 : 1;
      const settings = { game: next, ...roundSettings(next, 0, level) };
      $('next-detail').textContent = `${roundDetail(settings)} · ${next === 'perm-mania' ? 'Watch, then copy with any button' : 'Match the bottom block'}`;
    }
    if (!set.history.length) return;
    const final = set.phase === 'complete';
    if (final) { $('results').hidden = true; $('play-view').hidden = true; }
    $('standings-panel').classList.toggle('final-standings', final);
    const key = `${set.id}/${set.history.length}/${set.phase}/${playerId}`;
    if (this.key === key) return;
    this.key = key;
    const standings = setStandings(set.players);
    const leaders = standings.filter(player => player.points > 0 && player.placement === 1);
    $('standings-label').textContent = `${MODES[set.mode].title} · ${final ? 'Set complete' : 'Total points'}`;
    $('standings-title').textContent = !final ? 'Set standings' : leaders.length > 1 ? 'A shared victory!' : leaders.length ? `${leaders[0].name} takes the crown!` : 'No winner this time';
    const last = set.history.at(-1);
    $('standings-rows').replaceChildren(...standings.map(player => {
      const row = node('div', `standing-row${player.id === playerId ? ' you' : ''}${player.placement === 1 && player.points ? ' leader' : ''}`);
      const earned = last.rows.find(item => item.playerId === player.id)?.points || 0;
      const name = node('strong', 'standing-name', player.name + (player.id === playerId ? ' · You' : ''));
      if (!final) {
        const result = last.rows.find(item => item.playerId === player.id)?.result;
        const detail = result?.status === 'finished' ? last.game === 'perm-mania' ? `${result.cleared} growth · ${result.score.toLocaleString()} rhythm score` : `${(result.elapsed / 1000).toFixed(3)} seconds` : ({ forfeit: 'Forfeited', timeout: 'Time expired', missing: 'Missed this round' }[result?.status] || '');
        name.append(node('small', '', detail));
      }
      row.append(node('span', 'standing-rank', String(player.placement)), name);
      if (!final) row.append(node('span', 'points-earned', `+${earned}`));
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
  }

  animate(room, serverNow) {
    const set = room.set;
    if (set?.phase !== 'intermission') return;
    const seconds = Math.max(0, Math.ceil((set.nextStartAt - serverNow) / 1000));
    const text = set.waitReason === 'sync' ? 'Synchronizing clocks…' : set.waitReason === 'players' ? 'Waiting for a player to reconnect…' : seconds ? `Continuing in ${seconds}s…` : 'Starting the next round…';
    if ($('intermission-countdown').textContent !== text) $('intermission-countdown').textContent = text;
  }
}
