const SVG = 'http://www.w3.org/2000/svg';
function shape(tag, attributes, text) {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

export function createWitchGauge() {
  const element = shape('svg', { viewBox: '0 0 132 136', class: 'witch-angle-gauge', role: 'img', 'aria-label': 'Throw angle 0 degrees' });
  element.append(shape('path', { d: 'M16 23 A75 75 0 0 1 91 98', fill: 'none', stroke: '#fff9ed', 'stroke-width': 2 }));
  for (const angle of [0, 30, 45, 60, 90]) {
    const radians = angle * Math.PI / 180;
    const x = 16 + Math.cos(radians) * 75, y = 98 - Math.sin(radians) * 75;
    element.append(shape('line', { x1: x, y1: y, x2: 16 + Math.cos(radians) * 80, y2: 98 - Math.sin(radians) * 80, stroke: '#fff9ed', 'stroke-width': 2 }));
  }
  element.append(shape('path', { d: 'M16 16 V98 H101', fill: 'none', stroke: '#ffb414', 'stroke-width': 6, 'stroke-linejoin': 'round' }));
  element.append(shape('path', { d: 'M16 16 V98 H101', fill: 'none', stroke: '#ffef6b', 'stroke-width': 2 }));
  for (const [text, x, y] of [['90°', 14, 13], ['60°', 56, 23], ['45°', 80, 42], ['30°', 100, 65], ['0°', 113, 100]]) {
    element.append(shape('text', { x, y, fill: '#fff9ed', 'font-size': 12, 'text-anchor': 'middle' }, text));
  }
  const needle = shape('line', { x1: 16, y1: 98, x2: 88, y2: 98, stroke: '#f44545', 'stroke-width': 3 });
  element.append(needle, shape('circle', { cx: 16, cy: 98, r: 3, fill: '#ffed6a' }));
  element.append(shape('rect', { x: 39, y: 105, width: 80, height: 27, rx: 1, fill: '#160f1b', stroke: '#ffcc27', 'stroke-width': 3 }));
  const value = shape('text', { x: 79, y: 126, fill: '#fffdf2', 'font-size': 23, 'font-weight': 900, 'text-anchor': 'middle' }, '0°');
  element.append(value);
  return { element, update(angle) {
    const degrees = Math.max(0, Math.min(90, angle));
    needle.setAttribute('transform', `rotate(${-degrees} 16 98)`);
    value.textContent = `${Math.round(degrees)}°`;
    element.setAttribute('aria-label', `Throw angle ${Math.round(degrees)} degrees`);
  } };
}
