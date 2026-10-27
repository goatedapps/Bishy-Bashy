import { createSequence } from './totem.js';

export const JUMP_GAME = 'jump-for-the-meat';
export const JUMP_DURATION_MS = 30_000;
export const JUMP_GOAL = 6;
export const JUMP_RECOVERY_MS = 450;

export class JumpRun {
  constructor(round, localStart) {
    this.id = round.id;
    this.start = localStart;
    this.end = localStart + round.duration;
    this.goal = round.goal;
    this.periodMs = round.periodMs;
    this.windowMs = round.windowMs;
    this.perfectMs = round.perfectMs ?? Math.round(round.windowMs * .3);
    this.delays = createSequence(round.seed, round.goal + 1).map(value => (value - 1) * 80);
    this.launchedAt = localStart;
    this.launchHeight = 0;
    this.cleared = 0;
    this.mistakes = 0;
    this.blockedUntil = 0;
    this.finishAt = null;
    this.feedback = null;
    this.lastTap = -Infinity;
    this.elapsed = null;
    this.done = false;
  }

  get arcMs() { return this.periodMs + this.delays[this.cleared]; }
  get landAt() { return this.launchedAt + this.arcMs; }
  get amplitude() { return .18 + this.cleared / this.goal * .58; }

  heightAt(time) {
    if (this.done) return .76;
    const fraction = Math.max(0, Math.min(1, (time - this.launchedAt) / this.arcMs));
    return this.launchHeight * (1 - fraction) + this.amplitude * 4 * fraction * (1 - fraction);
  }

  phase(time) {
    if (this.done) return 'finished';
    if (time < this.start) return 'waiting';
    if (time >= this.end) return 'expired';
    if (this.finishAt !== null) return 'reaching';
    if (time < this.blockedUntil) return 'stumble';
    const error = Math.abs(time - this.landAt);
    return error <= this.perfectMs ? 'perfect' : error <= this.windowMs ? 'land' : 'air';
  }

  miss(time) {
    this.mistakes++;
    this.feedback = { kind: 'miss', at: time, label: time < this.landAt ? 'Too early!' : 'Too late!' };
    this.blockedUntil = time + JUMP_RECOVERY_MS;
    this.launchedAt = this.blockedUntil;
    this.launchHeight = 0;
  }

  advance(time) {
    if (this.done || !Number.isFinite(time) || time < this.start) return;
    if (this.finishAt !== null) {
      if (time >= this.finishAt && this.finishAt < this.end) {
        this.done = true;
        this.elapsed = this.finishAt - this.start;
      }
      return;
    }
    // Settle missed landings at their deadline, so delayed frames cannot extend an arc.
    while (this.landAt + this.windowMs < Math.min(time, this.end)) this.miss(this.landAt + this.windowMs);
  }

  tap(color, time) {
    if (this.done || !Number.isInteger(color) || color < 0 || color > 2 || !Number.isFinite(time) || time < this.start || time >= this.end || this.finishAt !== null || time - this.lastTap < 100) return { type: 'ignored' };
    this.advance(time);
    if (time < this.blockedUntil) return { type: 'ignored' };
    this.lastTap = time;
    const phase = this.phase(time);
    if (phase !== 'land' && phase !== 'perfect') {
      this.miss(time);
      return { type: 'mistake' };
    }
    this.launchHeight = this.heightAt(time);
    const perfect = phase === 'perfect';
    const gain = Math.min(perfect ? 2 : 1, this.goal - this.cleared);
    this.cleared += gain;
    this.launchedAt = time;
    this.feedback = { kind: 'boost', at: time, perfect, gain };
    if (this.cleared === this.goal) this.finishAt = time + this.arcMs / 2;
    return { type: perfect ? 'jumpPerfect' : 'hit', gain };
  }
}
