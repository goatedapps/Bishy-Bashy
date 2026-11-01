import { COLORS } from '../shared/totem.js';
import { createDemoLayout, demoNode as node } from './instruction-demo.js';

const SHAPES = ['●', '▲', '◆'];
const BLOCKS = [1, 2, 0, 1, 0, 2, 1, 2];
export const TOTEM_DEMO_STEP_MS = 2400;
export const TOTEM_DEMO_TAP_MS = 1450;
export const TOTEM_DEMO_LOOP_MS = TOTEM_DEMO_STEP_MS * 3 + 1200;
const clamp = value => Math.max(0, Math.min(1, value));

export function totemDemoFrame(elapsed, reducedMotion = false) {
  const cycle = Math.max(0, elapsed) % TOTEM_DEMO_LOOP_MS;
  const step = Math.min(2, Math.floor(cycle / TOTEM_DEMO_STEP_MS));
  const age = cycle - step * TOTEM_DEMO_STEP_MS;
  const tapped = age >= TOTEM_DEMO_TAP_MS;
  const clearing = clamp((age - TOTEM_DEMO_TAP_MS) / 280);
  const shift = reducedMotion ? Number(tapped) : 1 - (1 - clearing) ** 3;
  return {
    step, age, color: BLOCKS[step], tapped, shift,
    base: step + Number(shift === 1),
    offset: shift === 1 ? 0 : shift,
    pressed: tapped && age < TOTEM_DEMO_TAP_MS + 240,
    hand: age >= 900 && age < TOTEM_DEMO_TAP_MS + 650,
    handY: reducedMotion ? 0 : 24 * (1 - clamp((age - 900) / 550)) + (tapped ? 4 : 0),
  };
}

export class TotemDemo {
  constructor({ onPress = () => {} } = {}) {
    this.onPress = onPress;
    Object.assign(this, createDemoLayout(
      'Totem Shrinker demonstration: a cat paw presses green, blue, then red to clear the matching bottom blocks. The demonstration repeats.',
      ["Look at the bottom block's color.", 'Press the color button to clear it.'],
    ));
    this.element.classList.add('totem-demo');
    this.scene.append(node('strong', 'totem-demo-player', 'You'));
    this.blocks = Array.from({ length: 6 }, () => {
      const block = node('div', 'block totem-demo-block');
      block.append(node('span', 'glyph'));
      this.scene.append(block);
      return block;
    });
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.elapsed = 0;
    this.previousTime = null;
    this.paint(totemDemoFrame(0));
  }

  advance(time, visible) {
    if (!visible) { this.previousTime = null; return; }
    const previousElapsed = this.elapsed;
    if (this.previousTime !== null) this.elapsed += Math.max(0, time - this.previousTime);
    this.previousTime = time;
    const frame = totemDemoFrame(this.elapsed, this.motion?.matches);
    this.paint(frame);
    const pressedAt = this.elapsed - frame.age + TOTEM_DEMO_TAP_MS;
    if (previousElapsed < pressedAt && pressedAt <= this.elapsed && this.elapsed - pressedAt < 100) this.onPress?.(frame.color);
  }

  paint(frame) {
    this.blocks.forEach((block, index) => {
      const color = BLOCKS[frame.base + index] ?? 0;
      block.className = `block totem-demo-block ${COLORS[color]}`;
      block.children[0].textContent = SHAPES[color];
      block.style.bottom = `calc(8px + var(--demo-spacing) * ${index - frame.offset})`;
      block.style.opacity = String(index === 0 ? 1 - frame.offset : index === 5 ? frame.offset : 1);
      block.style.transform = `translateX(-50%) scale(${index === 0 ? 1 - frame.offset * .4 : 1})`;
      block.classList.toggle('demo-target', index === 0 && !frame.tapped);
    });
    this.buttons.forEach((button, index) => button.classList.toggle('pressed', frame.pressed && index === frame.color));
    this.lines.forEach((line, index) => line.classList.toggle('demo-active', index === Number(frame.age >= 900 && frame.age < 2100)));
    this.hand.style.left = `calc(${(frame.color + .5) * 100 / 3}% - 36px)`;
    this.hand.style.transform = `translateY(${frame.handY}px)`;
    this.hand.style.opacity = frame.hand ? '1' : '0';
  }
}
