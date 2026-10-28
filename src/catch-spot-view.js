import { INGREDIENT_NAMES } from '../shared/burger.js';
import { PICTURE_NAMES } from '../shared/mistake.js';

const SHAPES = ['●', '▲', '◆'];
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function chefPortrait() {
  const element = node('span', 'burger-chef');
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', 'Burger chef holding a plate');
  return element;
}

export function ingredientPortrait(kind = 0) {
  const element = node('span', 'burger-ingredient');
  element.style.backgroundPosition = `${kind % 2 * 100}% ${Math.floor(kind / 2) * 100}%`;
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', INGREDIENT_NAMES[kind]);
  return element;
}

export function picturePortrait(picture = 0) {
  const element = node('span', 'odd-picture');
  setPicture(element, picture);
  return element;
}

function setPicture(element, picture) {
  if (element.dataset.picture === String(picture)) return;
  element.dataset.picture = String(picture);
  element.style.backgroundPosition = `${picture % 4 / 3 * 100}% ${Math.floor(picture / 4) / 3 * 100}%`;
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', PICTURE_NAMES[picture]);
}

export class BurgerStage {
  constructor() {
    this.element = node('div', 'catch-stage');
    this.element.hidden = true;
    this.chutes = node('div', 'catch-chutes');
    for (let column = 0; column < 3; column++) this.chutes.append(node('span', `catch-chute catch-color-${column}`, SHAPES[column]));
    this.falling = node('div', 'catch-falling');
    this.falling.append(ingredientPortrait());
    this.player = node('div', 'catch-player');
    this.player.append(chefPortrait());
    this.stack = node('div', 'burger-stack');
    this.layers = INGREDIENT_NAMES.map((_, kind) => {
      const layer = node('span', 'burger-layer');
      layer.append(ingredientPortrait(kind));
      this.stack.append(layer);
      return layer;
    });
    this.player.append(this.stack);
    this.toast = node('span', 'catch-toast');
    this.element.append(this.chutes, this.falling, this.player, this.toast);
    this.element.setAttribute('role', 'group');
  }

  render(round, run, time, elapsed, active, present, cleared, terminal = false) {
    const playing = active && present && !terminal && time >= (run?.launchedAt ?? Infinity) && time < (run?.end ?? -Infinity);
    const feedback = run?.feedback;
    const age = feedback ? time - feedback.at : Infinity;
    const showing = age >= 0 && age < 500;
    const served = showing && feedback.served;
    const layerCount = served ? 4 : cleared % 4;
    this.layers.forEach((layer, index) => { layer.hidden = index >= layerCount; });
    this.element.classList.toggle('unoccupied', !present);
    this.element.classList.toggle('burger-served', Boolean(served));
    this.element.classList.toggle('catch-success', Boolean(showing && feedback.kind === 'catch'));
    this.element.style.setProperty('--served-age', String(served ? age / 500 : 0));
    this.element.style.setProperty('--chef-column', String(run?.position ?? cleared % 3));
    this.falling.dataset.attempt = String(run?.index ?? 0);
    const progress = run ? (time - run.launchedAt) / run.fallMs : 0;
    this.falling.hidden = !playing || progress < 0 || progress > 1;
    this.falling.style.setProperty('--drop-column', String(run?.column ?? 1));
    this.falling.style.setProperty('--drop-progress', String(Math.max(0, Math.min(1, progress))));
    const kind = run?.ingredient ?? cleared % 4;
    if (this.kind !== kind) { this.kind = kind; this.falling.replaceChildren(ingredientPortrait(kind)); }
    this.toast.hidden = !showing;
    this.toast.textContent = !showing ? '' : feedback.kind === 'miss' ? 'Miss!' : served ? 'Served!' : '+1';
    this.element.setAttribute('aria-label', !present ? 'Open spot' : run && playing ? `${INGREDIENT_NAMES[kind]} falling in ${['left', 'middle', 'right'][run.column]} chute; plate ${['left', 'middle', 'right'][run.position]}` : `${Math.floor(cleared / 4)} burgers served`);
  }
}

export class MistakeStage {
  constructor() {
    this.element = node('div', 'mistake-stage');
    this.element.hidden = true;
    this.cards = Array.from({ length: 3 }, (_, column) => {
      const card = node('div', `mistake-card catch-color-${column}`);
      const badge = node('span', 'picture-button', SHAPES[column]);
      const picture = picturePortrait(0);
      const stamp = node('span', 'picture-stamp');
      stamp.setAttribute('aria-hidden', 'true');
      card.append(badge, picture, stamp);
      this.element.append(card);
      return { card, picture, stamp };
    });
    this.element.setAttribute('role', 'group');
  }

  render(round, run, time, elapsed, active, present, cleared, terminal = false) {
    const feedback = run?.feedback;
    const age = feedback ? time - feedback.at : Infinity;
    const showing = age >= 0 && age < (feedback?.kind === 'hit' ? 260 : 600);
    const solved = feedback?.kind === 'hit' && (showing || terminal);
    const puzzle = solved ? feedback.puzzle : run?.puzzle;
    const visible = Boolean(run && active && time >= run.start && (time >= run.shownAt || solved));
    this.element.classList.toggle('unoccupied', !present);
    this.cards.forEach(({ card, picture, stamp }, column) => {
      const selected = (showing || terminal && solved) && feedback?.color === column;
      card.classList.toggle('picture-correct', Boolean(selected && solved));
      card.classList.toggle('picture-wrong', Boolean(selected && !solved));
      picture.hidden = active && !visible;
      if (visible) setPicture(picture, puzzle.pictures[column]);
      else if (!active) setPicture(picture, column === 2 ? 1 : 0);
      stamp.hidden = !selected;
      stamp.textContent = solved ? '✓' : '×';
    });
    this.element.setAttribute('aria-label', !present ? 'Open spot' : !run && active ? `Remote player, ${cleared} puzzles solved` : solved ? 'Correct picture found' : visible ? 'Find the odd picture: red top, green middle, blue bottom' : 'Next pictures');
  }
}
