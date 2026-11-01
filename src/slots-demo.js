import { SlotRun, slotLayout, FACE_NAMES, RETRY_MS } from '../shared/slots.js';
import { SlotStage, facePortrait } from './slot-view.js';
import { demoNode as node } from './instruction-demo.js';
import { ScriptedDemo } from './scripted-demo.js';

export function slotsDemoPlan(round = {}) {
  const settings = { id: 'slots-demo', seed: 123, duration: 30_000, stepMs: round.stepMs || 320, retryMs: RETRY_MS };
  const start = 900;
  const layout = slotLayout(settings.seed);
  const presses = [];
  let earliest = 1100;
  for (let color = 0; color < 3; color++) {
    const targetAt = layout.reels[color].indexOf(layout.target) * settings.stepMs;
    const period = FACE_NAMES.length * settings.stepMs;
    const elapsed = targetAt + Math.max(0, Math.ceil((earliest - targetAt) / period)) * period;
    presses.push({ type: 'press', color, at: start + elapsed });
    earliest = elapsed + 1100;
  }
  const completeAt = presses.at(-1).at;
  return { settings, start, presses, completeAt, duration: completeAt + 1700, cues: [...presses, { type: 'complete', at: completeAt }] };
}

export class SlotsDemo extends ScriptedDemo {
  constructor(options = {}) {
    super({ ...options, className: 'slots-demo', plan: slotsDemoPlan(options.round), createRun: (round, start) => new SlotRun(round, start),
      label: 'Facial Slot Machine demonstration: match the model face by pressing red, green, and blue when that face reaches the center of its row. The three rows lock, then the demonstration repeats.',
      instructions: ['Look at the model face.', 'Press each row’s color when that face reaches the center.'],
    });
    const target = node('div', 'demo-slot-target');
    target.append(node('strong', '', 'Model face'), facePortrait(this.run.layout.target));
    this.stage = new SlotStage();
    this.stage.cabinet.hidden = false;
    this.scene.append(target, this.stage.cabinet);
    this.paint(0);
    this.paintControls(0);
  }

  paint(time) {
    const run = this.run;
    const shownRun = this.motion?.matches ? Object.assign(Object.create(run), {
      reelElapsed: (color, at) => Math.round(run.reelElapsed(color, at) / run.stepMs) * run.stepMs,
    }) : run;
    this.stage.render(this.plan.settings, run.reelMask, Math.max(0, time - run.start), shownRun, true, true);
  }
}
