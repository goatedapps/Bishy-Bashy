import { KAYA_GAME } from '../shared/kaya.js';
import { KayaScene } from './kaya-view.js';
import { diePortrait, setDie, duckPortrait, facingMoveLabel } from './dice-facing-view.js';
import { FACING_GAME } from '../shared/facing.js';

const SHAPES = ['●', '▲', '◆'];
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
export function diceThrowPose(age, color, reducedMotion = false) {
  if (reducedMotion || age < 0 || age >= 380) return { transform: '', height: 0 };
  const direction = color === 1 ? -1 : 1;
  if (age < 260) {
    const progress = age / 260;
    const remaining = 1 - progress;
    const height = remaining * (.35 + 2.6 * progress);
    return {
      transform: `translate(${direction * remaining * 35}%,${-height * 100}%) rotateX(${remaining * 540}deg) rotateZ(${direction * remaining * 240}deg) scale(${.72 + .28 * progress})`,
      height,
    };
  }
  const progress = (age - 260) / 120;
  const bounce = Math.sin(progress * Math.PI);
  return { transform: `translateY(${-bounce * 13}%) scale(${1 + .16 * (1 - progress) * Math.cos(progress * Math.PI * 2)},${1 - .16 * (1 - progress) * Math.cos(progress * Math.PI * 2)})`, height: bounce * .13 };
}

export function setDuckPose(duck, pose) {
  duck.classList.toggle('is-back', Boolean(pose.back));
  duck.style.transform = `rotate(${pose.angle}deg)`;
  duck.setAttribute('aria-label', `${pose.back ? 'Back' : 'Front'} of duck, rotated ${pose.angle} degrees`);
}

export class SharedChoiceStage {
  constructor() {
    this.element = node('section', 'shared-choice-stage');
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Shared challenge');
    this.header = node('div', 'shared-choice-heading');
    this.title = node('strong', '');
    this.clock = node('strong', 'shared-answer-clock');
    this.clock.setAttribute('aria-label', 'Answer time remaining');
    this.header.append(this.title, this.clock);
    this.demo = node('div', 'shared-demo');
    this.card = node('div', 'shared-duck-card');
    this.duck = duckPortrait();
    this.flap = node('span', 'facing-flap');
    this.card.append(this.duck, this.flap);
    this.kaya = new KayaScene();
    this.demo.append(this.card, this.kaya.element);
    this.options = node('div', 'shared-options');
    this.optionCards = Array.from({ length: 3 }, (_, color) => {
      const card = node('div', `shared-option option-${color}`);
      const shape = node('span', 'shared-option-shape', SHAPES[color]);
      const die = diePortrait(0), duck = duckPortrait();
      const players = node('div', 'shared-option-players');
      const shadow = node('span', 'dice-ground-shadow');
      shadow.setAttribute('aria-hidden', 'true');
      card.append(shape, shadow, die, duck, players);
      this.options.append(card);
      return { card, die, duck, players, shadow };
    });
    this.players = node('div', 'shared-choice-players');
    this.element.append(this.header, this.demo, this.options, this.players);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.rows = [];
  }

  render(room, playerId, local, time) {
    const round = room.round, run = local?.run;
    if (!run || !round.choice) return;
    const facing = round.game === FACING_GAME;
    const kaya = round.game === KAYA_GAME;
    const phase = run.phase(time), stage = phase.stage, puzzle = stage.puzzle;
    const roster = (room.set?.players || room.players).filter(player => round.playerIds.includes(player.id));
    const rosterKey = `${round.id}/${roster.map(player => player.id).join('/')}`;
    if (this.rosterKey !== rosterKey) {
      this.rosterKey = rosterKey;
      this.rows = roster.map((player, index) => {
        const card = node('article', `shared-player letter-player-${index}${player.id === playerId ? ' you' : ''}`);
        card.style.setProperty('grid-column', String(index + 1));
        const name = node('strong', 'shared-player-name', `${index + 1} · ${player.name}${player.id === playerId ? ' · You' : ''}`);
        const score = node('strong', 'shared-player-score');
        const selection = node('span', 'shared-player-selection');
        const result = node('span', 'shared-player-result');
        result.hidden = true;
        card.append(name, score, selection, result);
        return { card, score, selection, result };
      });
      this.players.replaceChildren(...this.rows.map(row => row.card));
    }
    this.element.className = `shared-choice-stage ${kaya ? 'shared-kaya' : facing ? 'shared-facing' : 'shared-dice'}`;
    const result = time - run.start >= stage.answerEnd ? round.choice.results.find(result => result.index === phase.index) : null;
    const canAnswer = phase.mode === 'play';
    const revealed = phase.mode === 'reveal' || phase.mode === 'done';
    this.title.textContent = `Set ${phase.index + 1} / ${run.goal}`;
    this.clock.textContent = canAnswer ? `${Math.max(0, (run.start + stage.answerEnd - time) / 1000).toFixed(1)} s` : phase.mode === 'wait' ? 'Get ready' : revealed ? 'Answers' : phase.mode === 'turn' ? facingMoveLabel(puzzle.moves[phase.turn]) : phase.mode === 'look' ? 'Look!' : 'Track the card';
    this.card.hidden = !facing;
    this.kaya.element.hidden = !kaya;
    this.demo.hidden = !kaya && (!facing || canAnswer || revealed);
    this.options.hidden = kaya || facing && !canAnswer && !revealed;
    if (kaya) {
      this.title.textContent = canAnswer ? "Where's Kaya?" : revealed ? 'There’s Kaya!' : phase.mode === 'look' ? 'Remember Kaya' : 'Follow the blankets';
      this.clock.textContent = canAnswer ? `${Math.max(0, (run.start + stage.answerEnd - time) / 1000).toFixed(1)} s` : phase.mode === 'wait' ? 'Get ready' : '';
      this.kaya.render(phase, result);
    }
    if (facing) {
      this.card.hidden = phase.mode === 'wait';
      const visible = phase.mode === 'look' || phase.mode === 'cover' && !this.motion?.matches || revealed;
      this.duck.hidden = !visible;
      const pose = revealed || canAnswer || phase.mode === 'handoff' ? puzzle.poses.at(-1) : phase.mode === 'turn' ? puzzle.poses[phase.turn] : puzzle.initial;
      setDuckPose(this.duck, { ...pose, angle: 0 });
      const side = pose.back ? -1 : 1;
      this.duck.style.transform = `scaleX(${side})`;
      let transform = `scaleX(${side}) rotate(${side * pose.angle}deg)`;
      if (phase.mode === 'turn') {
        const move = puzzle.moves[phase.turn];
        const progress = this.motion?.matches ? 1 : Math.min(1, phase.progress / .75);
        const eased = 1 - (1 - progress) ** 3;
        transform = move.kind === 'mirror' ? `scaleX(${side * Math.cos(Math.PI * eased)}) rotate(${side * pose.angle}deg)` : `scaleX(${side}) rotate(${side * (pose.angle + move.degrees * eased)}deg)`;
      }
      this.card.style.transform = transform;
      this.flap.hidden = visible && phase.mode !== 'cover';
      this.flap.style.transform = `translateY(${phase.mode === 'cover' && !this.motion?.matches ? -105 * (1 - phase.progress) : 0}%)`;
      this.card.setAttribute('aria-label', visible ? `${pose.back ? 'Back' : 'Front'} of duck, rotated ${pose.angle} degrees` : 'Covered duck card');
    }
    this.element.classList.toggle('shared-revealed', Boolean(result));
    this.optionCards.forEach(({ card, die, duck, players, shadow }, color) => {
      die.hidden = facing || kaya;
      duck.hidden = !facing;
      if (!this.options.hidden) {
        if (facing) setDuckPose(duck, puzzle.options[color]);
        else setDie(die, phase.mode === 'wait' ? 0 : puzzle.values[color]);
      }
      const throwAge = time - run.start - stage.startsAt;
      const pose = diceThrowPose(throwAge, color, facing || kaya || this.motion?.matches);
      die.style.transform = pose.transform;
      shadow.hidden = facing || kaya || phase.mode === 'wait';
      shadow.style.transform = `translateX(-50%) scale(${1 - pose.height * .45})`;
      shadow.style.opacity = String(.24 - pose.height * .15);
      card.classList.toggle('shared-correct-option', Boolean(result && result.answer === color));
      const markersKey = result ? `${round.id}/${phase.index}/${JSON.stringify(result.choices)}` : '';
      if (players.dataset.state !== markersKey) {
        players.dataset.state = markersKey;
        players.replaceChildren(...(result ? roster.flatMap((player, index) => result.choices[player.id] === color ? [node('span', `shared-choice-chip letter-pointer-${index}`, `${index + 1} ${result.correctIds.includes(player.id) ? '✓' : '×'}`)] : []) : []));
      }
    });
    const feedbackResult = [...round.choice.results].reverse().find(entry => {
      const age = time - run.start - entry.at;
      return age >= 0 && age < 650;
    });
    roster.forEach((player, index) => {
      const row = this.rows[index], member = room.players.find(member => member.id === player.id);
      row.score.textContent = String(round.choice.scores[player.id] || 0);
      row.result.hidden = !feedbackResult;
      const correct = feedbackResult?.correctIds.includes(player.id);
      row.result.textContent = correct ? '○' : '×';
      row.result.className = `shared-player-result ${correct ? 'shared-player-correct' : 'shared-player-wrong'}`;
      row.result.setAttribute('aria-label', correct ? 'Correct answer' : 'Wrong or missed answer');
      row.selection.textContent = !member ? 'Left' : member.result?.status === 'forfeit' ? 'Forfeited' : !member.connected ? 'Reconnecting' : result ? result.choices[player.id] === null ? '—' : SHAPES[result.choices[player.id]] : player.id === playerId && run.selections.has(phase.index) ? 'Locked' : '';
    });
  }
}
