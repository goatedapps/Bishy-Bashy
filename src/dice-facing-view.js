import { DICE_REVEAL_MS, DICE_RETRY_MS } from '../shared/dice.js';
import { DIRECTION_NAMES, FACING_REVEAL_MS, FACING_RETRY_MS } from '../shared/facing.js';

const SHAPES = ['●', '▲', '◆'];
const ARROWS = ['←', '↑', '→'];
const PIPS = [[], [5], [1, 9], [1, 5, 9], [1, 3, 7, 9], [1, 3, 5, 7, 9], [1, 3, 4, 6, 7, 9]];
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function diePortrait(value = 6) {
  const element = node('span', 'die-portrait');
  element.setAttribute('role', 'img');
  const dots = Array.from({ length: 9 }, (_, index) => {
    const dot = node('i', 'die-pip');
    dot.style.gridArea = `${Math.floor(index / 3) + 1} / ${index % 3 + 1}`;
    dot.hidden = !PIPS[value].includes(index + 1);
    element.append(dot);
    return dot;
  });
  element.dots = dots;
  setDie(element, value);
  return element;
}

function setDie(element, value) {
  if (element.dataset.value === String(value)) return;
  element.dataset.value = String(value);
  element.setAttribute('aria-label', value ? `Die showing ${value}` : 'Covered die');
  element.dots.forEach((dot, index) => { dot.hidden = !PIPS[value].includes(index + 1); });
}

export function diceMascot() {
  const element = node('span', 'dice-mascot');
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', 'Cheerful dice jester');
  return element;
}

export function duckPortrait() {
  const element = node('span', 'direction-duck');
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', 'Aviator duck pointing right');
  return element;
}

export function facingMoveLabel(move) {
  return move.kind === 'mirror' ? '↔ Flip' : move.degrees === 180 ? '↻ 180°' : move.degrees > 0 ? '↻ 90°' : '↺ 90°';
}

export class DiceStage {
  constructor() {
    this.element = node('div', 'dice-stage');
    this.element.hidden = true;
    this.element.setAttribute('role', 'group');
    this.cards = Array.from({ length: 3 }, (_, color) => {
      const card = node('div', `dice-card option-${color}`);
      const face = diePortrait(0);
      const badge = node('span', 'choice-shape', SHAPES[color]);
      const stamp = node('span', 'choice-stamp');
      stamp.setAttribute('aria-hidden', 'true');
      card.append(badge, face, stamp);
      this.element.append(card);
      return { card, face, stamp };
    });
  }

  render(round, run, time, elapsed, active, present, cleared, terminal = false) {
    const feedback = run?.feedback;
    const age = feedback ? time - feedback.at : Infinity;
    const showing = age >= 0 && age < (feedback?.kind === 'hit' ? DICE_REVEAL_MS : DICE_RETRY_MS);
    const solved = feedback?.kind === 'hit' && (showing || terminal);
    const puzzle = solved ? feedback.puzzle : run?.puzzle;
    const visible = !active || Boolean(run && time >= run.start && (time >= run.shownAt || solved));
    this.element.classList.toggle('unoccupied', !present);
    this.element.classList.toggle('dice-rolling', Boolean(active && run && !visible && !terminal));
    this.cards.forEach(({ card, face, stamp }, color) => {
      const selected = (showing || solved && terminal) && feedback?.color === color;
      card.classList.toggle('choice-correct', Boolean(selected && solved));
      card.classList.toggle('choice-wrong', Boolean(selected && !solved));
      const value = !active ? [2, 6, 4][color] : visible ? puzzle.values[color] : 0;
      setDie(face, value);
      face.style.setProperty('--die-tilt', `${visible ? puzzle?.angles[color] || 0 : 0}deg`);
      stamp.hidden = !selected;
      stamp.textContent = solved ? '✓' : '×';
    });
    this.element.setAttribute('aria-label', !present ? 'Open spot' : !run && active ? `Remote player, ${cleared} rolls won` : !visible ? 'Rolling dice' : 'Choose the highest die: red top, green middle, blue bottom');
  }
}

export class FacingStage {
  constructor() {
    this.element = node('div', 'facing-stage');
    this.element.hidden = true;
    this.element.setAttribute('role', 'group');
    this.motionPreference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.phase = node('strong', 'facing-phase');
    this.card = node('div', 'facing-card');
    this.holder = node('div', 'facing-card-holder');
    this.duck = duckPortrait();
    this.back = node('span', 'facing-back');
    this.card.append(this.duck, this.back);
    this.holder.append(this.card);
    this.cue = node('strong', 'facing-cue');
    this.count = node('span', 'facing-count');
    this.options = node('div', 'facing-options');
    this.options.append(...ARROWS.map((arrow, index) => {
      const option = node('span', `option-${index}`);
      option.append(node('small', '', SHAPES[index]), node('b', '', arrow));
      return option;
    }));
    this.element.append(this.phase, this.holder, this.cue, this.count, this.options);
  }

  render(round, run, time, elapsed, active, present, cleared, terminal = false) {
    const feedback = run?.feedback;
    const age = feedback ? time - feedback.at : Infinity;
    const showing = age >= 0 && age < (feedback?.kind === 'hit' ? FACING_REVEAL_MS : FACING_RETRY_MS);
    const solved = feedback?.kind === 'hit' && (showing || terminal);
    const puzzle = solved ? feedback.puzzle : run?.puzzle;
    const phase = run?.phase(time) || { mode: active ? 'remote' : 'look' };
    const visible = !active || Boolean(run && time >= run.start && (!terminal && phase.mode === 'look' || solved));
    this.element.classList.toggle('unoccupied', !present);
    this.element.classList.toggle('choice-correct', Boolean(solved));
    this.element.classList.toggle('choice-wrong', Boolean(showing && !solved));
    this.duck.hidden = !visible;
    this.back.hidden = visible;
    let pose = solved || ['handoff', 'play'].includes(phase.mode) ? puzzle.poses.at(-1) : puzzle?.initial || { angle: 0, mirror: 1 };
    let transform = `rotate(${pose.angle}deg) scaleY(${pose.mirror})`;
    if (!solved && !terminal && phase.mode === 'cover' && !this.motionPreference?.matches) transform = `scaleX(${Math.abs(1 - 2 * phase.progress)}) ${transform}`;
    const turning = !solved && !terminal && phase.mode === 'turn';
    if (turning) {
      const move = puzzle.moves[phase.index];
      const previous = puzzle.poses[phase.index];
      const reduced = this.motionPreference?.matches;
      const progress = reduced ? 1 : Math.min(1, phase.progress / .7);
      const eased = 1 - (1 - progress) ** 3;
      pose = puzzle.poses[phase.index + 1];
      transform = move.kind === 'mirror' ? `scaleX(${1 - 2 * eased}) rotate(${previous.angle}deg) scaleY(${previous.mirror})` : `rotate(${previous.angle + move.degrees * eased}deg) scaleY(${previous.mirror})`;
    }
    this.card.style.transform = transform;
    this.duck.setAttribute('aria-label', visible ? `Duck pointing ${DIRECTION_NAMES[[180, 270, 0].indexOf(pose.angle)]?.toLowerCase() || 'right'}` : 'Covered picture');
    this.phase.textContent = solved ? 'Got it!' : terminal ? 'Done!' : showing ? 'Again!' : ({ look: 'Look!', cover: 'Cover!', turn: 'Track!', handoff: 'Get ready', play: 'Answer', remote: 'Watching…', done: 'Time’s up!' }[phase.mode] || '');
    this.cue.textContent = solved ? '✓' : showing ? '×' : turning ? facingMoveLabel(puzzle.moves[phase.index]) : phase.mode === 'play' ? '?' : '';
    this.count.textContent = turning ? `${phase.index + 1} / ${puzzle.moves.length}` : '';
    this.element.setAttribute('aria-label', !present ? 'Open spot' : !run && active ? `Remote player, ${cleared} tricks solved` : solved ? 'Correct direction found' : visible ? this.duck.getAttribute('aria-label') : turning ? `Covered card: ${facingMoveLabel(puzzle.moves[phase.index])}, move ${phase.index + 1} of ${puzzle.moves.length}` : phase.mode === 'play' ? 'Answer: red left, green up, blue right' : 'Card covered');
  }
}
