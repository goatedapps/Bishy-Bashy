import { WitchDemo } from './witch-demo.js';
import { SesameDemo } from './sesame-demo.js';
import { BalloonDemo } from './balloon-demo.js';
import { MarketDemo } from './market-demo.js';
import { WorkshopDemo } from './workshop-demo.js';
import { MARKET_GAMES } from '../shared/market-games.js';
import { WORKSHOP_GAMES } from '../shared/workshop-games.js';
import { TotemDemo } from './totem-demo.js';
import { PermDemo } from './perm-demo.js';
import { SlotsDemo } from './slots-demo.js';
import { FireworksDemo } from './fireworks-demo.js';
import { MonkeysDemo } from './monkeys-demo.js';
import { RemainingDemo, REMAINING_DEMO_GAMES } from './remaining-demos.js';

export function createGameDemo(game, options) {
  if (WORKSHOP_GAMES.includes(game)) return new WorkshopDemo(game, options);
  if (MARKET_GAMES.includes(game)) return new MarketDemo(game, options);
  if (game === 'burst-the-balloon') return new BalloonDemo(options);
  if (game === 'open-sesame') return new SesameDemo(options);
  if (game === 'witch-delivery') return new WitchDemo(options);
  if (game === 'totem-shrinker') return new TotemDemo(options);
  if (game === 'perm-mania') return new PermDemo(options);
  if (game === 'facial-slot-machine') return new SlotsDemo(options);
  if (game === 'fireworks-craze') return new FireworksDemo(options);
  if (game === 'mimicking-monkeys') return new MonkeysDemo(options);
  if (REMAINING_DEMO_GAMES.includes(game)) return new RemainingDemo(game, options);
  return null;
}
