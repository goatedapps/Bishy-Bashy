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

export function permNotes(seed, bpm = PERM_BPM) {
  const beat = 60_000 / bpm;
  return createPhrases(seed).flatMap((steps, phrase) => steps.map(step => ({ phrase, step, at: phrase * beat * 8 + beat * 4 + step * beat / 2 })));
}

export function demoCues(seed, bpm = PERM_BPM) {
  const beat = 60_000 / bpm;
  return createPhrases(seed).flatMap((steps, phrase) => steps.map(step => phrase * beat * 8 + step * beat / 2));
}

export class PermRun {
  constructor(round, localStart, timingOffset = 0) {
    this.id = round.id;
    this.start = localStart;
    this.duration = round.duration;
    this.end = localStart + round.duration;
    this.beatMs = 60_000 / (round.bpm || PERM_BPM);
    this.phraseMs = this.beatMs * 8;
    this.perfectWindow = 55 * PERM_BPM / (round.bpm || PERM_BPM);
    this.offset = Math.max(-150, Math.min(150, Number(timingOffset) || 0));
    this.window = round.hitWindow || HIT_WINDOW_MS;
    this.phrases = createPhrases(round.seed);
    this.notes = permNotes(round.seed, round.bpm || PERM_BPM).map(note => ({ ...note, hit: false, missed: false }));
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
    this.stageFeedback = null;
    this.events = [];
  }

  phase(time) {
    const elapsed = Math.max(0, Math.min(time - this.start, this.duration - 1));
    const phrase = Math.min(PHRASE_COUNT - 1, Math.floor(elapsed / this.phraseMs));
    const within = elapsed - phrase * this.phraseMs;
    const answering = within >= this.beatMs * 4 + this.offset - this.window;
    return { phrase, mode: answering ? 'play' : 'watch', steps: this.phrases[phrase], within, position: Math.min(7, Math.max(0, Math.floor((within - (answering ? this.beatMs * 4 : 0)) / (this.beatMs / 2)))) };
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
    while (this.settled < PHRASE_COUNT && elapsed >= (this.settled + 1) * this.phraseMs - .001) {
      const phrase = this.settled++;
      const at = this.start + (phrase + 1) * this.phraseMs;
      if (this.phraseMistakes[phrase] <= 1) {
        this.cleared++;
        this.stageFeedback = { correct: true, at };
        this.events.push({ type: 'growth', phrase, at });
      } else {
        this.stageFeedback = { correct: false, at };
        this.events.push({ type: 'stageWrong', phrase, at });
      }
    }
    if (time >= this.end) { this.done = true; this.elapsed = this.duration; }
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
      const perfect = error <= this.perfectWindow;
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
