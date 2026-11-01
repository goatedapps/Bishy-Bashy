import { COLORS } from '../shared/totem.js';

export const demoNode = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function createDemoLayout(label, instructions) {
  const element = demoNode('section', 'instruction-demo');
  element.setAttribute('aria-label', label);
  const scene = demoNode('div', 'instruction-demo-scene');
  scene.setAttribute('aria-hidden', 'true');
  const guide = demoNode('div', 'instruction-demo-guide');
  const list = demoNode('ol', 'instruction-demo-instructions');
  const lines = instructions.map(text => demoNode('li', '', text));
  list.append(...lines);
  const controls = demoNode('div', 'instruction-demo-controls');
  controls.setAttribute('aria-hidden', 'true');
  const buttons = COLORS.map((color, index) => {
    const button = demoNode('div', `hit-button ${color}`);
    button.append(demoNode('span', 'shape', ['●', '▲', '◆'][index]), demoNode('span', 'instruction-demo-button-label', color[0].toUpperCase() + color.slice(1)));
    controls.append(button);
    return button;
  });
  const hand = demoNode('span', 'instruction-demo-hand');
  controls.append(hand);
  guide.append(list, controls);
  element.append(scene, guide);
  return { element, scene, lines, buttons, hand };
}
