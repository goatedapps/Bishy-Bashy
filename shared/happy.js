import { seededIndex } from './seeded-index.js';
export const HAPPY_GAME = 'happy-days';
export const HAPPY_DURATION_MS = 30_000;
export const HAPPY_BPM = 145;
export const HAPPY_BEAT_MS = 60_000 / HAPPY_BPM;
export const HAPPY_GRID_MS = 240;
export const HAPPY_GOOD_MS = 140;
export const HAPPY_PERFECT_MS = 55;
export const HAPPY_TRAVEL_MS = 2200;
export const HAPPY_TONES = ['D', 'F♯', 'A'];

// Seeded variations retain the recording's measured grid and equal scoring opportunities.
export function happyChart(seed = 0) {
  const choose = seededIndex(seed), busy = [-Infinity, -Infinity, -Infinity], notes = [];
  let phrase = -1, rest = 7, swapHolds = false;
  for (let beat = 4; beat <= 68; beat++) {
    const currentPhrase = Math.floor(beat / 8);
    if (phrase !== currentPhrase) {
      phrase = currentPhrase;
      rest = phrase === 0 ? 5 + choose(2) * 2 : 1 + choose(4) * 2;
      swapHolds = Boolean(choose(2));
    }
    if (phrase < 8 && beat % 8 === rest) continue;
    const at = Math.round(HAPPY_GRID_MS + beat * HAPPY_BEAT_MS);
    const preferred = choose(3), direction = choose(2) + 1;
    const color = [preferred, (preferred + direction) % 3, (preferred + direction * 2) % 3].find(lane => busy[lane] + HAPPY_GOOD_MS * 2 < at);
    if (color === undefined) throw new Error('Happy Days chart has overlapping note windows');
    const holdBeats = beat % 8 === 0 ? swapHolds ? 1 : 2 : beat % 8 === 4 ? swapHolds ? 2 : 1 : 0;
    const duration = Math.round(HAPPY_BEAT_MS * holdBeats);
    busy[color] = at + duration;
    notes.push({ index: notes.length, color, at, duration, phrase });
  }
  return notes;
}

export const HAPPY_GOAL = happyChart().length;
export const HAPPY_MAX_SCORE = HAPPY_GOAL * 1000;

export function validHappyScore(round, { cleared, mistakes, score }, finished = false) {
  return Number.isInteger(cleared) && cleared >= 0 && cleared <= round.goal &&
    Number.isInteger(mistakes) && mistakes >= 0 && cleared + mistakes <= round.goal &&
    Number.isInteger(score) && score % 500 === 0 && score >= cleared * 500 && score <= cleared * 1000 &&
    (!finished || cleared + mistakes === round.goal);
}

export class HappyRun {
  constructor(round, localStart, timingOffset = 0, notes = happyChart(round.seed)) {
    Object.assign(this, { id: round.id, start: localStart, end: localStart + round.duration, duration: round.duration,
      offset: Math.max(-150, Math.min(150, Number(timingOffset) || 0)), notes, goal: notes.length,
      judgments: Array(notes.length).fill(0), headErrors: Array(notes.length).fill(0), pressedMask: 0,
      cleared: 0, mistakes: 0, perfects: 0, goods: 0, score: 0, blockedUntil: 0,
      done: false, elapsed: null, feedback: null, events: [], settledPhrases: new Set() });
  }

  settle(note, grade, at) {
    if (this.judgments[note.index] >= 2) return;
    this.judgments[note.index] = grade;
    if (grade === 4) this.mistakes++;
    else {
      this.cleared++;
      this.score += grade === 2 ? 1000 : 500;
      if (grade === 2) this.perfects++; else this.goods++;
    }
    this.feedback = { kind: grade === 2 ? 'Perfect!' : grade === 3 ? 'Good!' : 'Miss', color: note.color, at };
  }

  advance(time) {
    if (this.done || !Number.isFinite(time) || time < this.start) return;
    const elapsed = Math.min(time, this.end) - this.start - this.offset;
    for (const note of this.notes) {
      const state = this.judgments[note.index];
      const deadline = note.at + (state === 1 ? note.duration : 0) + HAPPY_GOOD_MS;
      if ((state === 0 || state === 1) && elapsed > deadline) this.settle(note, 4, this.start + deadline + this.offset);
    }
    for (const phrase of new Set(this.notes.map(note => note.phrase))) {
      const at = Math.min(this.end, this.start + HAPPY_GRID_MS + (phrase + 1) * HAPPY_BEAT_MS * 8 + this.offset + HAPPY_GOOD_MS);
      if (time < at || this.settledPhrases.has(phrase)) continue;
      const notes = this.notes.filter(note => note.phrase === phrase);
      if (!notes.every(note => this.judgments[note.index] >= 2)) continue;
      this.settledPhrases.add(phrase);
      if (notes.every(note => this.judgments[note.index] < 4)) this.events.push({ type: 'stageComplete', at, final: at === this.end });
    }
    if (time >= this.end) {
      for (const note of this.notes) if (this.judgments[note.index] < 2) this.settle(note, 4, this.end);
      this.pressedMask = 0;
      this.done = true;
      this.elapsed = this.duration;
    }
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end) return { type: 'ignored' };
    this.advance(time);
    const mask = 1 << color;
    if (this.pressedMask & mask) return { type: 'ignored' };
    this.pressedMask |= mask;
    const elapsed = time - this.start - this.offset;
    const note = this.notes.filter(note => note.color === color && this.judgments[note.index] === 0)
      .sort((a, b) => Math.abs(a.at - elapsed) - Math.abs(b.at - elapsed))[0];
    const error = note ? Math.abs(elapsed - note.at) : Infinity;
    if (error > HAPPY_GOOD_MS) {
      this.feedback = { kind: 'Miss', color, at: time };
      return { type: 'mistake' };
    }
    this.headErrors[note.index] = error;
    if (note.duration) {
      this.judgments[note.index] = 1;
      this.feedback = { kind: error <= HAPPY_PERFECT_MS ? 'Perfect!' : 'Good!', color, at: time };
    } else this.settle(note, error <= HAPPY_PERFECT_MS ? 2 : 3, time);
    return { type: 'note', color, hold: note.duration > 0 };
  }

  release(color, time) {
    if (!Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time)) return { type: 'ignored' };
    const down = this.pressedMask & (1 << color);
    this.pressedMask &= ~(1 << color);
    if (!down || this.done || time < this.start) return { type: 'ignored' };
    this.advance(time);
    const note = this.notes.find(note => note.color === color && this.judgments[note.index] === 1);
    if (!note) return { type: 'ignored' };
    const error = Math.abs(time - this.start - this.offset - note.at - note.duration);
    this.settle(note, error > HAPPY_GOOD_MS ? 4 : Math.max(error, this.headErrors[note.index]) <= HAPPY_PERFECT_MS ? 2 : 3, time);
    return { type: 'release' };
  }
}
