import { raccoonPortrait, runnerPortrait, coinPortrait } from './coins-dodge-view.js';
import { facePortrait } from './slot-view.js';
import { monkeyPortrait } from './monkey-view.js';
import { fireworkBadge } from './firework-view.js';
import { dinoPortrait } from './jump-view.js';
import { chefPortrait, ingredientPortrait, picturePortrait } from './catch-spot-view.js';
import { diePortrait, diceMascot, duckPortrait } from './dice-facing-view.js';

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function gameArt(game) {
  const art = node('span', `game-art art-${game}`);
  art.setAttribute('aria-hidden', 'true');
  if (game === 'its-raining-coins') art.append(raccoonPortrait());
  else if (game === 'dodge-or-die') art.append(runnerPortrait());
  else if (game === 'dice-dice-more-dice') art.append(diceMascot());
  else if (game === 'facing-which-way') art.append(duckPortrait());
  else if (game === 'burger-girl') art.append(chefPortrait());
  else if (game === 'me-find-mistake') art.append(picturePortrait(0));
  else if (game === 'jump-for-the-meat') art.append(dinoPortrait());
  else if (game === 'mimicking-monkeys') art.append(monkeyPortrait());
  else if (game === 'fireworks-craze') art.append(fireworkBadge());
  else if (game === 'facial-slot-machine') art.append(facePortrait(0));
  else if (game === 'perm-mania') {
    const dancer = node('span', 'perm-character');
    dancer.append(node('span', 'perm-hair'), node('span', 'perm-dancer dancer-1'));
    art.append(dancer);
  } else art.append(node('span', 'block blue'), node('span', 'block red'));
  return art;
}

function shapes(colors, className = '') {
  const group = node('div', `tutorial-shapes ${className}`);
  colors.forEach(color => group.append(node('span', `tutorial-symbol symbol-${color}`, ['●', '▲', '◆'][color])));
  return group;
}

export function ruleVisual(game) {
  const visual = node('div', 'rule-visual');
  const first = node('div', 'rule-example');
  const second = node('div', 'rule-example');
  let label;
  if (game === 'its-raining-coins') {
    first.append(coinPortrait(), gameArt(game), node('strong', '', 'Catch the gold'));
    second.append(coinPortrait(true), shapes([0, 1, 2], 'tutorial-buttons'), node('strong', '', 'Avoid the fakes'));
    label = 'Move the raccoon under gold star coins. Avoid cracked purple fakes. Red selects left, green middle, blue right.';
  } else if (game === 'dodge-or-die') {
    const road = node('div', 'tutorial-road');
    road.append(node('span', 'tutorial-wall wall-left'), node('span', 'tutorial-wall wall-right'), gameArt(game));
    first.append(road, node('strong', '', 'Dodge tall walls'));
    const jump = node('div', 'tutorial-road tutorial-road-jump');
    jump.append(node('span', 'tutorial-hurdle'), gameArt(game));
    second.append(jump, shapes([1], 'tutorial-buttons'), node('strong', '', 'Jump low hurdles'));
    label = 'Red moves left, green jumps, blue moves right. Move into the gap between tall walls and jump low hurdles before the landing line.';
  } else if (game === 'dice-dice-more-dice') {
    const dice = node('div', 'tutorial-dice');
    dice.append(diePortrait(2), diePortrait(6), diePortrait(4));
    first.append(dice, node('strong', '', 'Find the most dots'));
    second.append(shapes([1], 'tutorial-buttons'), node('strong', '', 'Pick the middle die'));
    label = 'The dice show 2, 6, and 4. Six is highest: choose green for the middle die.';
  } else if (game === 'facing-which-way') {
    const trick = node('div', 'tutorial-turn');
    trick.append(duckPortrait(), node('span', '', '↔'));
    first.append(trick, node('strong', '', 'Right, then a left-right flip'));
    second.append(shapes([0], 'tutorial-buttons'), node('strong', '', 'Now it points left'));
    label = 'Remember the duck pointing right. A left-right flip makes it point left. Red answers left, green up, blue right.';
  } else if (game === 'burger-girl') {
    const ingredient = node('div', 'tutorial-ingredient');
    ingredient.append(ingredientPortrait(0));
    first.append(ingredient, gameArt(game), node('strong', '', 'Watch the falling food'));
    second.append(shapes([0, 1, 2], 'tutorial-buttons'), node('strong', '', 'Move the plate under it'));
    label = 'Red moves the plate left, green to the middle, blue to the right. Catch each falling ingredient to build a burger.';
  } else if (game === 'me-find-mistake') {
    const pictures = node('div', 'tutorial-odd-pictures');
    pictures.append(picturePortrait(0), picturePortrait(0), picturePortrait(1));
    first.append(pictures, node('strong', '', 'Two match, one is different'));
    second.append(shapes([2], 'tutorial-buttons'), node('strong', '', 'Choose the odd picture'));
    label = 'Two owls have star badges; the third has a heart badge. Choose that different picture using its matching color button.';
  } else if (game === 'jump-for-the-meat') {
    first.append(gameArt(game), node('span', 'jump-meat'), node('strong', '', 'Time the landing'));
    const landing = node('div', 'tutorial-landing');
    landing.append(node('span', 'tutorial-good', 'Good +1'), node('span', 'tutorial-perfect', 'Perfect +2'));
    second.append(landing, shapes([0, 1, 2], 'tutorial-buttons'), node('strong', '', 'Aim for the green center'));
    label = 'Press any button when the dinosaur lands. The wide gold zone gives one boost; the small green center gives a Perfect two boosts.';
  } else if (game === 'mimicking-monkeys') {
    first.append(gameArt(game), shapes([0, 1, 2]), node('strong', '', 'Watch the order'));
    second.append(shapes([0, 1, 2], 'tutorial-buttons'), node('strong', '', 'Copy the order'));
    label = 'Watch red circle, green triangle, blue diamond; then press red, green, blue in that order.';
  } else if (game === 'perm-mania') {
    first.append(gameArt(game), node('div', 'tutorial-beats', '● · ● ●'), node('strong', '', 'Watch the rhythm'));
    second.append(node('div', 'tutorial-beats', '● · ● ●'), shapes([0, 1, 2], 'tutorial-buttons'), node('strong', '', 'Copy with any button'));
    label = 'Watch a rhythm, then copy its timing using any colored button.';
  } else if (game === 'facial-slot-machine') {
    first.append(gameArt(game), node('strong', '', 'Model face'));
    const rows = node('div', 'tutorial-reels');
    for (let color = 0; color < 3; color++) {
      const row = node('div', `tutorial-reel symbol-${color}`);
      row.append(node('span', '', ['●', '▲', '◆'][color]), facePortrait(1), facePortrait(0), facePortrait(2));
      rows.append(row);
    }
    second.append(rows, node('strong', '', 'Match each center face'));
    label = 'Match the model robot in all three rows. Each color button stops its own row at the center marker.';
  } else if (game === 'fireworks-craze') {
    first.append(node('span', 'tutorial-rocket', '✦'), node('strong', '', 'Wait for its color'));
    second.append(shapes([0]), shapes([0], 'tutorial-buttons'), node('strong', '', 'Press the matching button'));
    label = 'Wait for the rocket to reveal a red circle, then press the red circle button.';
  } else if (game === 'totem-shrinker') {
    first.append(gameArt(game), node('strong', '', 'Look at the bottom block'));
    second.append(shapes([0], 'tutorial-buttons'), node('strong', '', 'Match its color'));
    label = 'A red block is at the bottom of the tower. Press the red circle button to clear it.';
  } else {
    first.append(gameArt('totem-shrinker'), node('strong', '', 'Play together'));
    second.append(node('div', 'tutorial-beats', '10 · 7 · 4 · 1'), node('strong', '', 'Earn points by place'));
    label = 'Play together. Each round awards 10, 7, 4, or 1 points by placement.';
  }
  visual.setAttribute('role', 'img');
  visual.setAttribute('aria-label', label);
  first.setAttribute('aria-hidden', 'true');
  second.setAttribute('aria-hidden', 'true');
  visual.append(first, node('span', 'rule-arrow', '→'), second);
  return visual;
}
