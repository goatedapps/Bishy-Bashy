import { ChoiceMatch } from './choice-round.js';
import { StationeryMatch, STATIONERY_GAME } from './stationery.js';
import { ClockMatch, CLOCK_GAME } from './clock.js';

export function createSharedMatch(round, stages) {
  return round.game === STATIONERY_GAME ? new StationeryMatch(round, stages) : round.game === CLOCK_GAME ? new ClockMatch(round, stages) : new ChoiceMatch(round, stages);
}
