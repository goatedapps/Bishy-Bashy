import { gsap } from 'gsap';
import { GAMES } from '../shared/games.js';
import { gameArt } from './game-art.js';
import { characterPortrait } from './characters.js';

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export class PartyPicker {
  constructor(onLock) {
    this.onLock = onLock;
    this.games = Object.keys(GAMES);
    this.root = document.getElementById('party-picker');
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.lanes = [];
    this.resize = new ResizeObserver(() => {
      for (const lane of this.lanes) {
        lane.list.style.setProperty('--pick-padding', `${Math.max(0, (lane.list.clientHeight - 70) / 2)}px`);
        this.go(lane, lane.index, true);
      }
    });
  }

  clear() {
    for (const lane of this.lanes) { gsap.killTweensOf(lane.list); clearTimeout(lane.timer); }
    this.resize.disconnect();
    this.lanes = [];
    this.key = null;
    this.root.replaceChildren();
  }

  render(room, playerId) {
    const set = room?.set;
    const active = set?.phase === 'party-picking';
    this.root.hidden = !active;
    if (!active) { if (this.key) this.clear(); return; }
    this.set = set;
    const key = `${set.id}/${set.cycle}/${playerId}`;
    if (key !== this.key) {
      this.clear(); this.key = key;
      const heading = node('div', 'party-pick-heading');
      this.timer = node('strong', 'party-pick-timer', '30');
      this.timer.setAttribute('aria-label', 'Seconds left to choose');
      heading.append(node('h2', '', 'Everyone picks a game!'), this.timer);
      const columns = node('div', 'party-pick-columns');
      columns.style.setProperty('--party-players', set.pickerIds.length);
      this.root.append(heading, node('p', 'party-pick-help', 'Scroll to choose. Lock it in before time runs out!'), columns);
      this.lanes = set.pickerIds.map((id, index) => {
        const player = room.players.find(player => player.id === id) || set.players.find(player => player.id === id);
        const own = id === playerId;
        const panel = node('section', `party-pick-lane${own ? ' you' : ''}`);
        panel.style.setProperty('--player-color', ['#ff617b', '#71d99a', '#65c9f1', '#c69af3'][index]);
        panel.setAttribute('aria-label', `${player.name}'s game choice`);
        const header = node('header', 'party-player');
        header.append(characterPortrait(player.characterId), node('strong', '', player.name + (own ? ' · You' : '')));
        const list = node('div', 'party-game-list');
        list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', `${player.name}'s games`);
        list.tabIndex = own ? 0 : -1;
        const status = node('strong', 'party-pick-status', own ? 'Your pick' : 'Choosing…');
        const lane = { id, own, panel, list, status, index: 0, locked: false, rows: [] };
        lane.rows = this.games.map((game, gameIndex) => {
          const row = node('div', 'party-game-row'); row.setAttribute('role', 'option');
          row.append(gameArt(game), node('span', '', GAMES[game].title));
          row.addEventListener('click', () => { if (own && !lane.locked) this.go(lane, gameIndex); });
          list.append(row); return row;
        });
        list.addEventListener('scroll', () => {
          if (!own || lane.locked || lane.moving) return;
          this.paint(lane, this.nearest(lane));
          clearTimeout(lane.timer);
          lane.timer = setTimeout(() => { if (!lane.locked && this.key === key) this.go(lane, this.nearest(lane)); }, 150);
        }, { passive: true });
        const interrupt = () => { gsap.killTweensOf(list); lane.moving = false; };
        list.addEventListener('pointerdown', interrupt);
        list.addEventListener('wheel', interrupt, { passive: true });
        list.addEventListener('keydown', event => {
          if (!own || lane.locked) return;
          const direction = { ArrowUp: -1, ArrowDown: 1 }[event.key];
          if (direction || event.key === 'Enter') { event.preventDefault(); direction ? this.go(lane, lane.index + direction) : this.lock(); }
        });
        if (!own) list.inert = true;
        panel.append(header, list, status); columns.append(panel);
        return lane;
      });
      this.lanes.forEach(lane => { this.resize.observe(lane.list); this.go(lane, 0, true); });
    }
    for (const lane of this.lanes) {
      const game = set.choices[lane.id];
      if (game && !lane.locked) {
        lane.locked = true;
        clearTimeout(lane.timer);
        this.go(lane, this.games.indexOf(game));
        lane.list.inert = true;
        lane.panel.classList.add('is-locked');
        lane.status.textContent = '✓ Locked in';
      }
    }
  }

  nearest(lane) {
    const center = lane.list.scrollTop + lane.list.clientHeight / 2;
    return lane.rows.reduce((best, row, index) => Math.abs(row.offsetTop + row.offsetHeight / 2 - center) < Math.abs(lane.rows[best].offsetTop + lane.rows[best].offsetHeight / 2 - center) ? index : best, 0);
  }

  paint(lane, index) {
    lane.index = index;
    lane.rows.forEach((row, i) => row.setAttribute('aria-selected', String(i === index)));
  }

  go(lane, index, immediate = false) {
    index = (index + this.games.length) % this.games.length;
    this.paint(lane, index);
    const row = lane.rows[index];
    const target = row.offsetTop + row.offsetHeight / 2 - lane.list.clientHeight / 2;
    clearTimeout(lane.timer);
    lane.moving = true;
    gsap.to(lane.list, { scrollTop: target, duration: immediate || this.reduced.matches ? 0 : .32, ease: 'power3.out', overwrite: true, onComplete: () => { lane.moving = false; } });
  }

  input(color) {
    const lane = this.lanes.find(lane => lane.own);
    if (!lane || lane.locked) return;
    if (color === 1) this.lock();
    else this.go(lane, lane.index + (color === 0 ? 1 : -1));
  }

  lock() {
    const lane = this.lanes.find(lane => lane.own);
    if (!lane || lane.locked) return;
    this.onLock({ type: 'party-lock', setId: this.set.id, cycle: this.set.cycle, game: this.games[lane.index] });
  }

  animate(serverNow) {
    if (!this.key) return;
    this.timer.textContent = String(Math.max(0, Math.ceil((this.set.pickEndAt - serverNow) / 1000)));
  }
}
