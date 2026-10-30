import { LETTERS_ALPHABET } from '../shared/letters.js';

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function lettersPortrait() {
  const art = node('span', 'letters-mascot');
  for (const letter of 'ABC') art.append(node('i', '', letter));
  return art;
}

export class LettersStage {
  constructor() {
    this.element = node('section', 'letters-stage');
    this.element.setAttribute('aria-label', 'Shared alphabet race');
    this.element.hidden = true;
    this.target = node('div', 'letters-target');
    this.target.setAttribute('aria-label', 'Type these letters');
    this.targetLetters = Array.from({ length: 3 }, () => node('strong', '', '?'));
    this.target.append(...this.targetLetters);
    this.notice = node('div', 'letters-notice');
    this.notice.setAttribute('role', 'status');
    this.alphabet = node('div', 'letters-alphabet');
    this.keys = [...LETTERS_ALPHABET, '⌫'].map(letter => {
      const key = node('div', 'letter-key');
      key.append(node('span', '', letter));
      const markers = node('div', 'letter-markers');
      key.append(markers);
      this.alphabet.append(key);
      return { key, markers };
    });
    this.players = node('div', 'letters-players');
    this.element.append(this.target, this.notice, this.alphabet, this.players);
    this.rows = [];
    this.pointers = [];
  }

  render(room, playerId, local, time) {
    const round = room.round;
    const state = round.letters;
    if (!state) return;
    const run = local?.run;
    const started = local && time >= local.start;
    const ended = local && time >= local.end;
    const feedback = state.phase === 'feedback' ? state.feedback : null;
    const roster = (room.set?.players || room.players).filter(player => round.playerIds.includes(player.id));
    const key = `${round.id}/${roster.map(player => player.id).join('/')}`;
    if (this.rosterKey !== key) {
      this.rosterKey = key;
      this.pointers.forEach(pointer => pointer.remove());
      this.rows = roster.map((player, index) => {
        const card = node('article', `letter-player letter-player-${index}${player.id === playerId ? ' you' : ''}`);
        card.style.setProperty('grid-column', String(index + 1));
        const name = node('strong', 'letter-player-name', `${index + 1} · ${player.name}${player.id === playerId ? ' · You' : ''}`);
        const score = node('span', 'letter-score', '0');
        const typed = node('div', 'letter-typed');
        const slots = Array.from({ length: 3 }, () => node('span', '', '·'));
        typed.append(...slots);
        const outcome = node('span', 'letter-outcome');
        outcome.setAttribute('role', 'img');
        outcome.hidden = true;
        const status = node('small', 'letter-player-status');
        const pointer = node('span', `letter-pointer letter-pointer-${index}`, String(index + 1));
        pointer.setAttribute('aria-label', player.name);
        card.append(name, score, typed, status, outcome);
        return { card, score, slots, outcome, status, pointer };
      });
      this.pointers = this.rows.map(row => row.pointer);
      this.players.replaceChildren(...this.rows.map(row => row.card));
    }
    this.targetLetters.forEach((letter, index) => { letter.textContent = started ? state.target[index] : '?'; });
    this.element.classList.toggle('letters-settled', Boolean(feedback));
    const winners = feedback?.winners.map(id => roster.find(player => player.id === id)?.name).filter(Boolean) || [];
    const notice = !started ? 'Get ready!' : ended ? 'Time’s up!' : feedback ? `${winners.join(' & ')} +1` : run?.claim ? 'Matched!' : '';
    if (this.notice.textContent !== notice) this.notice.textContent = notice;
    this.keys.forEach(({ key: cell }, index) => cell.classList.toggle('is-your-key', started && run?.cursor === index && !run.done));
    roster.forEach((player, index) => {
      const row = this.rows[index];
      const member = room.players.find(member => member.id === player.id);
      const own = player.id === playerId;
      const published = member?.progress.letters;
      const current = own && run?.index === state.index ? run : published?.index === state.index ? published : null;
      const typed = started ? current?.typed || '' : '';
      const cursor = current?.cursor ?? 13;
      const parent = this.keys[cursor].markers;
      if (row.pointer.parentNode !== parent) parent.append(row.pointer);
      row.pointer.hidden = !started || Boolean(member?.result) || !member;
      row.pointer.setAttribute('aria-label', `${player.name}: ${cursor === 26 ? 'backspace' : LETTERS_ALPHABET[cursor]}`);
      row.score.textContent = String(state.scores[player.id] || 0);
      row.score.setAttribute('aria-label', `${state.scores[player.id] || 0} points`);
      row.slots.forEach((slot, position) => {
        slot.textContent = typed[position] || '·';
        slot.classList.toggle('is-correct', Boolean(typed[position] && typed[position] === state.target[position]));
        slot.classList.toggle('is-wrong', Boolean(typed[position] && typed[position] !== state.target[position]));
      });
      const won = feedback?.winners.includes(player.id);
      row.card.classList.toggle('letter-winner', Boolean(won));
      row.card.classList.toggle('letter-matched', own && Boolean(run?.claim));
      row.outcome.hidden = !feedback;
      row.outcome.className = `letter-outcome ${won ? 'letter-win' : 'letter-loss'}`;
      row.outcome.setAttribute('aria-label', won ? 'Won this set' : 'Lost this set');
      row.outcome.textContent = won ? '○' : '×';
      row.status.textContent = !member ? 'Left' : member.result?.status === 'forfeit' ? 'Forfeited' : member.result?.status === 'finished' ? '✓ Finished' : !member.connected ? 'Reconnecting…' : '';
    });
  }
}
