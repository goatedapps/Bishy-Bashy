import { gsap } from 'gsap';
import { PlayerFooter } from './player-footer.js';
import { CHOICE_GRACE_MS } from '../shared/choice-round.js';
import { STATIONERY_GAME, STATIONERY_NAMES, STATIONERY_THROW_MS, STATIONERY_THROW_STAGGER_MS, STATIONERY_INTRO_MS } from '../shared/stationery.js';

const node = (tag, className, text) => {
  const element = document.createElement(tag); element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
export function stationeryPortrait(color = 0) {
  const image = node('span', `stationery-sprite stationery-kind-${color}`);
  image.setAttribute('role', 'img'); image.setAttribute('aria-label', STATIONERY_NAMES[color]);
  return image;
}
export function clockPortrait() {
  const element = node('span', 'stopper-clock');
  element.setAttribute('role', 'img');
  const dial = node('span', 'stopper-dial');
  element.append(dial);
  for (let hour = 1; hour <= 12; hour++) {
    const number = node('span', `clock-number${hour === 12 ? ' clock-twelve' : ''}`, String(hour));
    number.style.left = `${50 + Math.sin(hour * Math.PI / 6) * 29}%`;
    number.style.top = `${50 - Math.cos(hour * Math.PI / 6) * 29}%`;
    element.append(number);
  }
  element.hour = node('span', 'stopper-hour');
  element.minute = node('span', 'stopper-minute');
  element.append(element.hour, element.minute, node('span', 'stopper-hub'));
  element.hour.style.transform = 'rotate(30deg)';
  element.setAttribute('aria-label', 'Clock with its minute hand at 12');
  return element;
}

export class DeskClockStage {
  constructor({ preview = false } = {}) {
    this.preview = preview;
    this.element = node('section', 'shared-set-stage'); this.element.hidden = true;
    this.header = node('div', 'shared-set-heading');
    this.title = node('strong', ''); this.timer = node('strong', ''); this.header.append(this.title, this.timer);
    this.desk = node('div', 'stationery-desk'); this.desk.setAttribute('role', 'group');
    this.players = node('div', 'shared-set-players');
    this.element.append(this.header, this.desk, this.players);
    this.rows = []; this.items = [];
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  dispose() { this.tween?.kill(); this.tween = null; this.boardKey = null; }

  render(room, playerId, local, time) {
    const round = room.round, run = local?.run;
    if (!run || !round.choice) return;
    const stationery = round.game === STATIONERY_GAME;
    const phase = run.phase(time), stage = phase.stage, elapsed = time - run.start;
    const roster = (room.set?.players || room.players).filter(player => round.playerIds.includes(player.id));
    const seats = this.preview ? roster : Array.from({ length: 4 }, (_, index) => roster[index] || null);
    const rosterKey = `${round.id}/${roster.map(player => player.id).join('/')}`;
    this.element.className = `shared-set-stage ${stationery ? 'stationery-shared' : 'clock-shared'}`;
    this.desk.hidden = !stationery;
    this.header.hidden = !stationery;
    if (this.rosterKey !== rosterKey) {
      this.rosterKey = rosterKey;
      this.rows = seats.map((player, index) => {
        const card = node('article', `shared-set-player set-player-${index}${player?.id === playerId ? ' you' : ''}${!player ? ' empty' : ''}`);
        const heading = node('div', 'set-player-heading');
        const name = node('strong', 'set-player-name', player ? `${player.name}${player.id === playerId ? ' · You' : ''}` : 'Open spot');
        const score = node('strong', 'set-player-score'); heading.append(name, score);
        const counters = node('div', 'desk-counters');
        const counts = [0, 1, 2].map(color => {
          const cell = node('span', `desk-counter desk-color-${color}`), value = node('strong', '', '0'), target = node('small', '');
          cell.append(stationeryPortrait(color), value, target); counters.append(cell);
          return { cell, value, target };
        });
        const clockSpace = node('div', 'clock-space'), clock = clockPortrait(); clockSpace.append(clock);
        const timing = node('strong', 'clock-timing'), award = node('strong', 'clock-award');
        const result = node('span', 'set-player-result'); result.hidden = true;
        const footer = new PlayerFooter(player, player?.id === playerId);
        card.append(heading, counters, clockSpace, timing, award, result, footer.element);
        this.players.append(card);
        return { card, score, counters, counts, clockSpace, clock, timing, award, result };
      });
      this.players.replaceChildren(...this.rows.map(row => row.card));
    }
    const result = elapsed >= (stationery ? stage.revealAt : stage.answerEnd + CHOICE_GRACE_MS) ? round.choice.results.find(result => result.index === phase.index) : null;
    const age = result ? elapsed - result.at : Infinity;
    this.title.textContent = stationery ? 'Count the items on the desk' : phase.mode === 'look' || phase.mode === 'spin' ? `Watch · stop at ${stage.puzzle.hour}:00` : `Stop at ${stage.puzzle.hour}:00`;
    this.timer.textContent = phase.mode === 'wait' ? 'Get ready' : stationery && phase.mode === 'play' ? `${Math.max(0, (stage.answerEnd - elapsed) / 1000).toFixed(1)} s` : phase.mode === 'throw' ? 'Look closely…' : phase.mode === 'settling' ? 'Checking…' : '';
    if (stationery) {
      const key = `${round.id}/${phase.index}`;
      if (this.boardKey !== key) {
        this.tween?.kill();
        this.boardKey = key;
        this.tween = gsap.timeline({ paused: true });
        this.poses = [];
        this.items = stage.puzzle.items.map(item => {
          const image = stationeryPortrait(item.color); image.classList.add('desk-item');
          image.style.left = `${item.x}%`; image.style.top = `${item.y}%`;
          const pose = { x: item.color === 1 ? 120 - item.x : -item.x - 20, y: -item.y - 25, rotation: item.angle + (item.color === 1 ? -130 : 130), scale: 1.2 };
          const at = this.poses.length * STATIONERY_THROW_STAGGER_MS / 1000;
          this.poses.push(pose);
          this.tween.to(pose, { x: 0, rotation: item.angle, scale: 1, duration: STATIONERY_THROW_MS / 1000, ease: 'power2.out' }, at);
          this.tween.to(pose, { y: 0, duration: STATIONERY_THROW_MS / 1000, ease: 'bounce.out' }, at);
          return image;
        });
        this.desk.replaceChildren(...this.items);
      }
      const introElapsed = elapsed - stage.startsAt;
      this.tween.totalTime(Math.max(0, Math.min(STATIONERY_INTRO_MS, this.motion?.matches ? STATIONERY_INTRO_MS : introElapsed)) / 1000, true);
      this.items.forEach((item, index) => {
        const pose = this.poses[index];
        item.hidden = phase.mode === 'wait' || introElapsed < index * STATIONERY_THROW_STAGGER_MS + (this.motion?.matches ? STATIONERY_THROW_MS : 0);
        item.style.transform = `translate(-50%,-50%) translate(${pose.x}cqw,${pose.y}cqh) rotate(${pose.rotation}deg) scale(${pose.scale})`;
      });
      this.desk.setAttribute('aria-label', phase.mode === 'wait' ? 'Desk hidden until GO' : result ? `Pencils ${result.answer[0]}, erasers ${result.answer[1]}, sharpeners ${result.answer[2]}` : 'Count the scattered pencils, erasers and sharpeners');
    }
    seats.forEach((player, index) => {
      const row = this.rows[index];
      if (!player) {
        row.score.textContent = ''; row.counters.hidden = true; row.clockSpace.hidden = true;
        row.timing.hidden = false; row.timing.textContent = 'Waiting to join'; row.award.hidden = true; row.result.hidden = true;
        return;
      }
      row.score.textContent = String(round.choice.scores[player.id] || 0);
      row.counters.hidden = !stationery; row.clockSpace.hidden = stationery; row.timing.hidden = stationery; row.award.hidden = stationery;
      row.result.hidden = !result || age < 0 || age >= 650;
      const correct = result?.correctIds.includes(player.id);
      row.result.textContent = correct ? '○' : '×';
      row.result.className = `set-player-result ${correct ? 'set-correct' : 'set-wrong'}`;
      if (stationery) {
        const published = round.choice.counters?.[player.id];
        const counts = result?.counts[player.id] || (player.id === playerId ? run.counters.get(phase.index) : published?.index === phase.index ? published.counts : null) || [0, 0, 0];
        row.counts.forEach(({ cell, value, target }, color) => {
          value.textContent = String(counts[color]); target.hidden = !result; target.textContent = result ? `/ ${result.answer[color]}` : '';
          cell.classList.toggle('count-correct', Boolean(result && counts[color] === result.answer[color]));
          cell.classList.toggle('count-wrong', Boolean(result && counts[color] !== result.answer[color]));
        });
      } else {
        const published = round.choice.stops?.[player.id];
        const own = player.id === playerId ? run.selections.get(phase.index) : null;
        const stop = own?.elapsed ?? (published?.index === phase.index ? published.elapsed : null);
        const effective = stop ?? Math.min(elapsed, stage.answerEnd);
        const angle = Math.max(0, (effective - stage.spinAt) / stage.puzzle.period) * 360;
        row.clock.minute.style.transform = `rotate(${angle}deg)`;
        row.clock.hour.style.transform = `rotate(${stage.puzzle.hour * 30}deg)`;
        row.clock.classList.toggle('clock-stopped', stop !== null);
        row.clock.setAttribute('aria-label', `${stage.puzzle.hour}:00 target; minute hand ${Math.round(angle % 360)} degrees${stop !== null ? ', stopped' : ''}`);
        const error = result?.errors[player.id] ?? (stop !== null ? Math.round(stop - stage.targetAt) : null);
        row.timing.textContent = error === null ? phase.mode === 'reveal' ? 'No stop' : '' : error === 0 ? 'On the hour!' : `${Math.abs(error)} ms ${error < 0 ? 'early' : 'late'}`;
        row.award.textContent = result ? `+${result.awards[player.id]} pts` : '';
      }
    });
  }
}
