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
        this.go(lane, this.games.length + lane.index, true);
      }
    });
  }

  clear() {
    for (const lane of this.lanes) { gsap.killTweensOf(lane.list); lane.burst?.kill(); clearTimeout(lane.timer); }
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
    const fresh = this.key === key;
    if (key !== this.key) {
      this.clear(); this.key = key;
      const heading = node('div', 'party-pick-heading');
      this.timer = node('strong', 'party-pick-timer', '30');
      this.timer.setAttribute('aria-label', 'Seconds left to choose');
      heading.append(node('h2', '', 'Everyone picks a game!'), this.timer);
      const columns = node('div', 'party-pick-columns');
      this.root.append(heading, node('p', 'party-pick-help', 'Scroll to choose. Lock it in before time runs out!'), columns);
      const slots = Array.from({ length: 4 }, (_, index) => room.players[index]?.id ?? null);
      this.lanes = slots.map((id, index) => {
        const player = room.players.find(player => player.id === id) || set.players.find(player => player.id === id);
        const occupied = Boolean(player && set.pickerIds.includes(id));
        const own = occupied && id === playerId;
        const panel = node('section', `party-pick-lane${own ? ' you' : ''}`);
        panel.style.setProperty('--player-color', ['#ff617b', '#71d99a', '#65c9f1', '#c69af3'][index]);
        panel.setAttribute('aria-label', player ? `${player.name}'s game choice` : `Player ${index + 1}: Open spot`);
        const header = node('header', 'party-player');
        header.append(player ? characterPortrait(player.characterId) : node('span', 'party-empty-avatar', '○'), node('strong', '', player ? player.name + (own ? ' · You' : '') : 'Open spot'));
        const window = node('div', 'party-list-window');
        const list = node('div', 'party-game-list');
        list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', player ? `${player.name}'s games` : 'No player');
        list.tabIndex = own ? 0 : -1;
        const status = node('strong', 'party-pick-status', occupied ? own ? 'Your pick' : 'Choosing…' : 'Waiting to join');
        const lane = { id, own, occupied, panel, list, status, index: 0, cursor: this.games.length, locked: false, rows: [] };
        lane.rows = Array.from({ length: this.games.length * 3 }, (_, cursor) => {
          const gameIndex = cursor % this.games.length;
          const game = this.games[gameIndex];
          const row = node('div', 'party-game-row'); row.setAttribute('role', 'option');
          row.id = `party-game-${index}-${cursor}`;
          if (cursor < this.games.length || cursor >= this.games.length * 2) row.setAttribute('aria-hidden', 'true');
          row.append(gameArt(game), node('span', '', GAMES[game].title));
          row.addEventListener('click', () => { if (own && !lane.locked) this.go(lane, cursor); });
          list.append(row); return row;
        });
        list.addEventListener('scroll', () => {
          if (!own || lane.locked || lane.moving) return;
          this.paint(lane, this.nearest(lane));
          this.recenter(lane);
          clearTimeout(lane.timer);
          lane.timer = setTimeout(() => { if (!lane.locked && this.key === key) this.go(lane, this.nearest(lane)); }, 150);
        }, { passive: true });
        const interrupt = () => { gsap.killTweensOf(list); lane.moving = false; };
        list.addEventListener('pointerdown', interrupt);
        list.addEventListener('wheel', interrupt, { passive: true });
        list.addEventListener('keydown', event => {
          if (!own || lane.locked) return;
          const direction = { ArrowUp: -1, ArrowDown: 1 }[event.key];
          if (direction || event.key === 'Enter') { event.preventDefault(); direction ? this.go(lane, lane.cursor + direction) : this.lock(); }
        });
        if (!own) list.inert = true;
        window.append(list);
        panel.append(header, window, status); columns.append(panel);
        return lane;
      });
      this.lanes.forEach(lane => { this.resize.observe(lane.list); this.go(lane, this.games.length, true); });
    }
    for (const lane of this.lanes) {
      const connected = lane.occupied && room.players.some(player => player.id === lane.id && player.connected);
      lane.panel.classList.toggle('is-empty', !connected);
      if (!connected) lane.status.textContent = lane.occupied ? 'Offline' : 'Waiting to join';
      else if (!lane.locked) lane.status.textContent = lane.own ? 'Your pick' : 'Choosing…';
      else lane.status.textContent = '✓ Locked in';
      const game = set.choices[lane.id];
      if (game && !lane.locked) {
        lane.locked = true;
        clearTimeout(lane.timer);
        this.go(lane, this.closestCopy(lane, this.games.indexOf(game)), true);
        lane.list.inert = true;
        lane.panel.classList.add('is-locked');
        lane.status.textContent = '✓ Locked in';
        if (fresh && connected && !document.hidden) this.sparkle(lane);
      }
    }
  }

  nearest(lane) {
    const center = lane.list.scrollTop + lane.list.clientHeight / 2;
    return lane.rows.reduce((best, row, index) => Math.abs(row.offsetTop + row.offsetHeight / 2 - center) < Math.abs(lane.rows[best].offsetTop + lane.rows[best].offsetHeight / 2 - center) ? index : best, 0);
  }

  paint(lane, cursor) {
    lane.cursor = cursor;
    lane.index = cursor % this.games.length;
    lane.rows.forEach((row, i) => {
      row.classList.toggle('is-selected', i === cursor);
      row.setAttribute('aria-selected', String(i === this.games.length + lane.index));
    });
    lane.list.setAttribute('aria-activedescendant', lane.rows[this.games.length + lane.index].id);
  }

  closestCopy(lane, index) {
    return [index, index + this.games.length, index + this.games.length * 2].reduce((best, cursor) => Math.abs(cursor - lane.cursor) < Math.abs(best - lane.cursor) ? cursor : best);
  }

  recenter(lane) {
    const center = this.games.length + lane.index;
    if (lane.cursor === center) return;
    lane.list.scrollTop += lane.rows[center].offsetTop - lane.rows[lane.cursor].offsetTop;
    this.paint(lane, center);
  }

  go(lane, cursor, immediate = false) {
    if (cursor < 0 || cursor >= lane.rows.length) {
      const delta = cursor - lane.cursor;
      this.recenter(lane);
      cursor = lane.cursor + delta;
    }
    cursor = Math.max(0, Math.min(lane.rows.length - 1, cursor));
    this.paint(lane, cursor);
    const row = lane.rows[cursor];
    const target = row.offsetTop + row.offsetHeight / 2 - lane.list.clientHeight / 2;
    clearTimeout(lane.timer);
    lane.moving = true;
    gsap.to(lane.list, { scrollTop: target, duration: immediate || this.reduced.matches ? 0 : .32, ease: 'power3.out', overwrite: true, onComplete: () => { this.recenter(lane); lane.moving = false; } });
  }

  input(color) {
    const lane = this.lanes.find(lane => lane.own);
    if (!lane || lane.locked) return;
    if (color === 1) this.lock();
    else this.go(lane, lane.cursor + (color === 0 ? 1 : -1));
  }

  sparkle(lane) {
    if (this.reduced.matches) return;
    lane.burst?.kill();
    const burst = node('div', 'party-lock-sparkles'); burst.setAttribute('aria-hidden', 'true');
    const frame = lane.list.getBoundingClientRect(), panel = lane.panel.getBoundingClientRect();
    burst.style.left = `${frame.left + frame.width / 2 - panel.left}px`;
    burst.style.top = `${frame.top + frame.height / 2 - panel.top}px`;
    const stars = Array.from({ length: 16 }, (_, index) => {
      const star = node('i', '', '✦'); star.style.color = ['#edff35', '#fffdf5', '#45fff1', '#ff81df'][index % 4];
      burst.append(star); return star;
    });
    lane.panel.append(burst);
    lane.burst = gsap.fromTo(stars, { x: 0, y: 0, scale: .3, autoAlpha: 1 }, {
      x: index => Math.cos(index * Math.PI / 8) * (45 + index % 3 * 16),
      y: index => Math.sin(index * Math.PI / 8) * (40 + index % 3 * 16),
      rotation: index => index % 2 ? 120 : -120, scale: 1.3, autoAlpha: 0, duration: .75, ease: 'power2.out',
      onComplete: () => burst.remove(),
    });
  }

  lock() {
    const lane = this.lanes.find(lane => lane.own);
    if (!lane || lane.locked) return;
    this.onLock({ type: 'party-lock', setId: this.set.id, cycle: this.set.cycle, game: this.games[lane.index] });
  }

  animate(serverNow) {
    if (!this.key) return;
    this.timer.textContent = this.set.pickCompleteAt ? '✓' : String(Math.max(0, Math.ceil((this.set.pickEndAt - serverNow) / 1000)));
  }
}
