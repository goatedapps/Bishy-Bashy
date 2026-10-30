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

export function setDie(element, value) {
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
