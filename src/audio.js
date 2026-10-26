const CUES = {
  hit: { notes: [520, 700], length: .065, wave: 'sine' },
  mistake: { notes: [150, 100], length: .09, wave: 'triangle' },
  tick: { notes: [440], length: .08, wave: 'sine' },
  go: { notes: [660, 880], length: .12, wave: 'sine' },
  finish: { notes: [523, 659, 784], length: .1, wave: 'sine' },
};

export class GameAudio {
  constructor() {
    this.enabled = localStorage.getItem('bb-sound') === 'on';
    this.context = null;
    this.voices = new Set();
    this.roundId = null;
  }

  async unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = .12;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch { /* Visual cues remain available when audio cannot start. */ }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('bb-sound', this.enabled ? 'on' : 'off');
    if (this.enabled) this.unlock();
    else this.cancel();
  }

  play(id, at = this.context?.currentTime) {
    const cue = CUES[id];
    if (!this.enabled || this.context?.state !== 'running' || !cue || this.voices.size + cue.notes.length > 12) return;
    cue.notes.forEach((frequency, index) => {
      const start = Math.max(this.context.currentTime, at) + index * cue.length;
      const voice = this.context.createOscillator();
      const gain = this.context.createGain();
      voice.type = cue.wave;
      voice.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.32, start + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, start + cue.length);
      voice.connect(gain).connect(this.master);
      this.voices.add(voice);
      voice.onended = () => { this.voices.delete(voice); voice.disconnect(); gain.disconnect(); };
      voice.start(start);
      voice.stop(start + cue.length + .01);
    });
  }

  countdown(roundId, localStart) {
    if (this.roundId === roundId || !this.enabled || this.context?.state !== 'running') return;
    this.cancel();
    this.roundId = roundId;
    const remaining = (localStart - performance.now()) / 1000;
    if (remaining < 0) return;
    for (let index = 3; index > 0; index--) if (remaining >= index) this.play('tick', this.context.currentTime + remaining - index);
    this.play('go', this.context.currentTime + remaining);
  }

  cancel() {
    for (const voice of this.voices) { try { voice.stop(); } catch {} }
    this.voices.clear();
    this.roundId = null;
  }
}
