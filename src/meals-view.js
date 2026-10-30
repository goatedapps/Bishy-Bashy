import { MEAL_NAMES, MEALS_DROP_MS, MEALS_SERVE_MS } from '../shared/meals.js';
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function mealPortrait(kind = 1) {
  const item = node('span', `meal-item meal-item-${kind}`);
  item.setAttribute('role', 'img');
  item.setAttribute('aria-label', MEAL_NAMES[kind]);
  return item;
}

export class MealsStage {
  constructor() {
    this.element = node('div', 'meals-stage');
    this.element.hidden = true;
    this.element.setAttribute('role', 'group');
    this.chutes = node('div', 'meals-chutes');
    this.columns = Array.from({ length: 3 }, (_, color) => {
      const chute = node('div', `meal-column meal-color-${color}`);
      const symbol = node('span', 'meal-button-symbol', ['●', '▲', '◆'][color]);
      const slots = Array.from({ length: 3 }, () => {
        const slot = node('span', 'meal-slot');
        slot.append(mealPortrait(color));
        return slot;
      });
      const falling = node('span', 'meal-falling');
      falling.append(mealPortrait(color));
      chute.append(symbol, ...slots, falling);
      this.chutes.append(chute);
      return { chute, slots, falling };
    });
    this.toast = node('strong', 'meals-toast', 'Served!');
    this.element.append(this.chutes, this.toast);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  render(round, run, time, elapsed, active, present, cleared, terminal = false) {
    const beforeStart = !active || !run || time < run.start;
    const age = run?.stageFeedback ? time - run.stageFeedback.at : Infinity;
    const feedback = age >= 0 && age < MEALS_SERVE_MS;
    const completed = terminal && run?.done && cleared >= run.goal;
    const servedIndex = feedback || completed ? Math.max(0, cleared - 1) : cleared;
    const requirements = run?.sequence[Math.min(servedIndex, run.goal - 1)] || [1, 1, 1];
    const filled = run?.filled || [0, 0, 0];
    this.element.classList.toggle('meal-served', feedback);
    this.element.classList.toggle('unoccupied', !present);
    this.toast.hidden = !feedback;
    this.columns.forEach(({ chute, slots, falling }, color) => {
      const at = run?.pendingAt[color] ?? -10000;
      const progress = Math.max(0, Math.min(1, (time - at) / MEALS_DROP_MS));
      const isFalling = !beforeStart && present && !terminal && at >= (run?.start ?? Infinity) && time >= at && progress < 1;
      const renderedFilled = feedback || completed ? requirements[color] : Math.min(requirements[color], filled[color] + (at >= (run?.start ?? Infinity) && !beforeStart && progress === 1 ? 1 : 0));
      chute.style.setProperty('--required', requirements[color]);
      slots.forEach((slot, index) => {
        slot.hidden = !present || index >= requirements[color];
        slot.classList.toggle('meal-filled', !beforeStart && index < renderedFilled);
        slot.style.setProperty('--slot', index);
        slot.setAttribute('aria-label', `${MEAL_NAMES[color]} slot ${index + 1}: ${!beforeStart && index < renderedFilled ? 'filled' : 'empty'}`);
      });
      falling.hidden = !isFalling;
      const eased = this.motion?.matches ? 1 : progress * progress;
      falling.style.setProperty('--fall', eased);
      falling.style.setProperty('--target-slot', filled[color]);
    });
    this.element.setAttribute('aria-label', !present ? 'Open spot' : beforeStart ? 'Get ready to pack meals' : `${cleared} of ${round.goal} meals served. Required: ${requirements.map((count, color) => `${count} ${MEAL_NAMES[color]}`).join(', ')}`);
  }
}
