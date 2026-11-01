import { createDemoLayout, demoNode } from './instruction-demo.js';

export class ScriptedDemo {
  constructor({ label, instructions, className, plan, createRun, onPress = () => {}, onWatch = () => {}, onComplete = () => {}, onLaunch = () => {} }) {
    Object.assign(this, createDemoLayout(label, instructions));
    this.element.classList.add(className);
    this.plan = plan;
    this.createRun = createRun;
    this.callbacks = { press: onPress, watch: onWatch, complete: onComplete, launch: onLaunch };
    this.completion = demoNode('strong', 'demo-completion', '○');
    this.completion.hidden = true;
    this.scene.append(this.completion);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.elapsed = 0;
    this.previousTime = null;
    this.resetRun(0);
  }

  resetRun(cycle) {
    this.cycle = cycle;
    this.applied = 0;
    this.run = this.createRun(this.plan.settings, this.plan.start);
  }

  advance(time, visible) {
    if (!visible) { this.previousTime = null; return; }
    const previousElapsed = this.elapsed;
    if (this.previousTime !== null) this.elapsed += Math.max(0, time - this.previousTime);
    this.previousTime = time;
    const cycle = Math.floor(this.elapsed / this.plan.duration);
    if (cycle !== this.cycle) this.resetRun(cycle);
    const within = this.elapsed - cycle * this.plan.duration;
    while (this.applied < this.plan.presses.length && cycle * this.plan.duration + this.plan.presses[this.applied].at <= this.elapsed) {
      const cue = this.plan.presses[this.applied++];
      this.run.tap(cue.color, cue.at);
    }
    this.run.advance?.(within);
    this.paint(within);
    this.paintControls(within);
    for (const cue of this.plan.cues) {
      const at = cycle * this.plan.duration + cue.at;
      if (previousElapsed < at && at <= this.elapsed && this.elapsed - at < 100) this.callbacks[cue.type]?.(cue.color);
    }
  }

  paintControls(time) {
    const presses = this.plan.presses;
    const cue = [...presses].reverse().find(cue => time >= cue.at - 300) || presses[0];
    const age = time - cue.at;
    this.buttons.forEach((button, index) => button.classList.toggle('pressed', index === cue.color && age >= 0 && age < 180));
    this.hand.style.left = `calc(${(cue.color + .5) * 100 / 3}% - 36px)`;
    this.hand.style.opacity = time >= cue.at - 300 && age < 350 ? '1' : '0';
    const handY = age < 0 ? 20 * Math.min(1, -age / 300) ** 3 : age < 180 ? 4 : 20;
    this.hand.style.transform = `translateY(${this.motion?.matches ? 0 : handY}px)`;
    const copying = this.run.phase ? this.run.phase(time).mode === 'play' || this.run.done : time >= presses[0].at - 300;
    this.lines.forEach((line, index) => line.classList.toggle('demo-active', index === Number(copying)));
    const completeAt = this.plan.completeAt + (this.plan.celebrateDelay || 0);
    this.completion.hidden = !this.run.done || time < completeAt || time >= completeAt + 650;
  }
}
