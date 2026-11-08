import { SESAME_DIGITS, SESAME_GOAL, sesameTarget } from '../shared/sesame.js';
import { PlayerFooter } from './player-footer.js';

const DIAL_POSITIONS = [[59.4, 41.2], [66.4, 48.2], [69.4, 58.6], [58, 77.4], [47.8, 79.7],
  [37.5, 76.5], [30.7, 68.5], [28.6, 58], [32.1, 48.2], [39.9, 41.2]];

function node(tag, className, text = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

export class SesameDial {
  constructor() {
    this.element = node('div', 'sesame-dial');
    this.code = node('div', 'sesame-code');
    this.code.setAttribute('role', 'group');
    this.code.setAttribute('aria-label', 'Code to dial');
    this.slots = Array.from({ length: SESAME_GOAL }, () => node('span', 'sesame-slot'));
    this.code.append(...this.slots);
    const scene = node('div', 'sesame-phone-space');
    const phone = node('div', 'sesame-phone');
    this.digits = [...SESAME_DIGITS].map((digit, index) => {
      const key = node('span', 'sesame-key', digit);
      const [x, y] = DIAL_POSITIONS[index];
      key.style.left = `${x}%`;
      key.style.top = `${y}%`;
      phone.append(key);
      return key;
    });
    scene.append(phone);
    this.selection = node('span', 'sesame-selection');
    this.selection.setAttribute('role', 'status');
    this.element.append(this.code, scene, this.selection);
  }

  render(target, run, time, started) {
    const cleared = run?.cleared ?? 0;
    const cursor = run?.cursor ?? 0;
    const feedback = run?.feedback;
    const wrong = feedback && !feedback.correct && time < feedback.until;
    const key = `${target}/${started}/${cleared}/${cursor}/${wrong ? feedback.cursor : ''}`;
    if (key === this.key) return;
    this.key = key;
    this.slots.forEach((slot, index) => {
      slot.textContent = started ? target[index] : '•';
      slot.classList.toggle('is-entered', index < cleared);
      slot.classList.toggle('is-next', started && index === cleared);
      slot.classList.toggle('is-wrong', Boolean(wrong && index === cleared));
    });
    this.digits.forEach((key, index) => {
      key.classList.toggle('is-selected', index === cursor);
      key.classList.toggle('is-wrong', Boolean(wrong && feedback.cursor === index));
    });
    const announcement = !started ? 'Get ready' : cleared === SESAME_GOAL ? 'Code complete' :
      wrong ? `Wrong digit. Select ${target[cleared]}. Highlighted ${SESAME_DIGITS[cursor]}.` :
      `Next digit ${target[cleared]}. Highlighted ${SESAME_DIGITS[cursor]}.`;
    if (this.selection.textContent !== announcement) this.selection.textContent = announcement;
  }
}

export class SesameArena {
  constructor() {
    this.element = node('section', 'sesame-arena');
    this.dial = new SesameDial();
    const players = node('div', 'sesame-players');
    this.rows = Array.from({ length: 4 }, () => {
      const card = node('article', 'sesame-player');
      const status = node('strong', 'sesame-player-status');
      const footer = new PlayerFooter();
      card.append(status, footer.element);
      players.append(card);
      return { card, status, footer };
    });
    this.element.append(this.dial.element, players);
  }

  render(room, playerId, local, time) {
    const { round } = room;
    const mine = local?.id === round.id ? local : null;
    const started = mine ? time >= mine.start : round.phase !== 'countdown';
    const target = mine?.run.target ?? sesameTarget(round.seed);
    this.dial.render(target, mine?.run, time, started);
    const key = `${playerId}/${started}/${mine?.run.cleared}/${mine?.status}`;
    if (room === this.room && key === this.key) return;
    this.room = room;
    this.key = key;
    this.rows.forEach(({ card, status, footer }, index) => {
      const player = room.players[index];
      const own = Boolean(player && player.id === playerId);
      const result = player?.result ?? (own && mine?.done ? { status: mine.status, elapsed: mine.run.elapsed } : null);
      const cleared = own && mine ? mine.run.cleared : player?.progress?.cleared ?? 0;
      const racing = player && round.playerIds.includes(player.id);
      card.classList.toggle('you', own);
      card.classList.toggle('is-empty', !racing);
      footer.update(player, own);
      status.textContent = !player ? 'Open spot' : !racing ? 'Next round' :
        result?.status === 'finished' ? `${(result.elapsed / 1000).toFixed(2)} s` :
        result?.status === 'timeout' ? 'Time’s up' : result?.status === 'forfeit' ? 'Forfeited' :
        !player.connected ? 'Offline' : started ? target.slice(0, cleared).padEnd(SESAME_GOAL, '·') : 'Ready';
    });
  }
}
