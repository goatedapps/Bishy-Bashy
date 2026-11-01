import { TotemDemo } from './totem-demo.js';
import { PermDemo } from './perm-demo.js';
import { SlotsDemo } from './slots-demo.js';
import { FireworksDemo } from './fireworks-demo.js';
import { MonkeysDemo } from './monkeys-demo.js';

export function createGameDemo(game, options) {
  if (game === 'totem-shrinker') return new TotemDemo(options);
  if (game === 'perm-mania') return new PermDemo(options);
  if (game === 'facial-slot-machine') return new SlotsDemo(options);
  if (game === 'fireworks-craze') return new FireworksDemo(options);
  if (game === 'mimicking-monkeys') return new MonkeysDemo(options);
  return null;
}
