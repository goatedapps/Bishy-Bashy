import { TotemDemo } from './totem-demo.js';
import { PermDemo } from './perm-demo.js';

export function createGameDemo(game, options) {
  if (game === 'totem-shrinker') return new TotemDemo(options);
  if (game === 'perm-mania') return new PermDemo(options);
  return null;
}
