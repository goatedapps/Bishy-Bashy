import { createSequence } from './totem.js';

export const PERM_GAME = 'perm-mania';
export const PERM_BPM = 128;
export const BEAT_MS = 60_000 / PERM_BPM;
export const PHRASE_COUNT = 8;
export const PHRASE_MS = BEAT_MS * 8;
export const PERM_DURATION_MS = PHRASE_MS * PHRASE_COUNT;
export const HIT_WINDOW_MS = 140;
const PATTERNS = [[0, 2, 4, 6], [0, 2, 5, 6], [0, 3, 4, 6], [0, 2, 4, 5, 6], [0, 1, 4, 6], [0, 2, 3, 6], [0, 3, 5, 6], [0, 1, 2, 4, 6]];

export function createPhrases(seed) {
  const digits = createSequence(seed, PHRASE_COUNT * 2);
  return Array.from({ length: PHRASE_COUNT }, (_, index) => [...PATTERNS[index === 0 ? 0 : (digits[index * 2] * 3 + digits[index * 2 + 1]) % PATTERNS.length]]);
}

export function permNotes(seed) {
  return createPhrases(seed).flatMap((steps, phrase) => steps.map(step => ({ phrase, step, at: phrase * PHRASE_MS + BEAT_MS * 4 + step * BEAT_MS / 2 })));
}

export function demoCues(seed) {
  return createPhrases(seed).flatMap((steps, phrase) => steps.map(step => phrase * PHRASE_MS + step * BEAT_MS / 2));
}

export class PermRun {
  constructor(round, localStart, timingOffset = 0) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.offset = Math.max(-150, Math.min(150, Number(timingOffset) || 0));
    this.window = round.hitWindow || HIT_WINDOW_MS;
    this.phrases = createPhrases(round.seed);
    this.notes = permNotes(round.seed).map(note => ({ ...note, hit: false, missed: false }));
    this.phraseMistakes = Array(PHRASE_COUNT).fill(0);
    this.settled = 0;
    this.cleared = 0;
    this.mistakes = 0;
    this.score = 0;
    this.hits = 0;
    this.perfects = 0;
    this.blockedUntil = 0;
    this.lastTap = -Infinity;
    this.done = false;
    this.elapsed = null;
    this.feedback = null;
    this.events = [];
  }

  phase(time) {
    const elapsed = Math.max(0, Math.min(time - this.start, PERM_DURATION_MS - 1));
    const phrase = Math.min(PHRASE_COUNT - 1, Math.floor(elapsed / PHRASE_MS));
    const within = elapsed - phrase * PHRASE_MS;
    const answering = within >= BEAT_MS * 4 + this.offset - this.window;
    return { phrase, mode: answering ? 'play' : 'watch', steps: this.phrases[phrase], within, position: Math.min(7, Math.max(0, Math.floor((within - (answering ? BEAT_MS * 4 : 0)) / (BEAT_MS / 2)))) };
  }

  advance(time) {
    if (this.done || time < this.start) return;
    const elapsed = Math.min(time, this.end) - this.start;
    for (const note of this.notes) {
      if (!note.hit && !note.missed && elapsed - this.offset > note.at + this.window) {
        note.missed = true;
        this.mistakes++;
        this.phraseMistakes[note.phrase]++;
        this.feedback = { kind: 'Miss', at: time };
      }
    }
    while (this.settled < PHRASE_COUNT && elapsed >= (this.settled + 1) * PHRASE_MS) {
      const phrase = this.settled++;
      if (this.phraseMistakes[phrase] <= 1) {
        this.cleared++;
        this.events.push({ type: 'growth', phrase, at: time });
      }
    }
    if (time >= this.end) { this.done = true; this.elapsed = this.end - this.start; }
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || time < this.start || time >= this.end || time - this.lastTap < 80) return { type: 'ignored' };
    this.advance(time);
    const elapsed = time - this.start - this.offset;
    let nearest;
    for (const note of this.notes) if (!nearest || Math.abs(note.at - elapsed) < Math.abs(nearest.at - elapsed)) nearest = note;
    const error = Math.abs(nearest.at - elapsed);
    if (error > this.window && this.phase(time).mode === 'watch') return { type: 'ignored' };
    this.lastTap = time;
    if (error <= this.window && !nearest.hit && !nearest.missed) {
      nearest.hit = true;
      this.hits++;
      const perfect = error <= 55;
      if (perfect) this.perfects++;
      this.score += Math.round(1000 - error / this.window * 500);
      this.feedback = { kind: perfect ? 'Perfect!' : 'Good!', at: time };
      return { type: 'hit', error, perfect };
    }
    this.mistakes++;
    this.phraseMistakes[this.phase(time).phrase]++;
    this.score = Math.max(0, this.score - 250);
    this.feedback = { kind: 'Oops!', at: time };
    return { type: 'mistake' };
  }
}
