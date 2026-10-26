import { AUDIO_FILES, BEAT } from '../scripts/audio/score.js';

const BASE_URL = import.meta.env?.BASE_URL || '/';
const DEFAULTS = { musicMode: 'auto', musicVolume: .65, effectsVolume: .8 };
const MUSIC_MODES = ['auto', 'on', 'off'];
const clamp = value => Math.max(0, Math.min(1, value));

export class GameAudio {
  constructor({ storage = globalThis.localStorage, createContext = () => new AudioContext(), now = () => performance.now(), fetchFile = (url, options) => fetch(url, options), onChange = () => {} } = {}) {
    this.storage = storage;
    this.createContext = createContext;
    this.now = now;
    this.fetchFile = fetchFile;
    this.onChange = onChange;
    this.enabled = this.read('bb-sound') === 'on';
    let saved;
    try { saved = JSON.parse(this.read('bb-audio') || '{}'); } catch { saved = {}; }
    this.preferences = {
      musicMode: MUSIC_MODES.includes(saved.musicMode) ? saved.musicMode : DEFAULTS.musicMode,
      musicVolume: Number.isFinite(saved.musicVolume) ? clamp(saved.musicVolume) : DEFAULTS.musicVolume,
      effectsVolume: Number.isFinite(saved.effectsVolume) ? clamp(saved.effectsVolume) : DEFAULTS.effectsVolume,
    };
    this.context = null;
    this.buffers = new Map();
    this.voices = new Set();
    this.target = null;
    this.countdownKey = null;
    this.musicKey = null;
    this.loading = null;
    this.loadFailed = false;
    this.previewing = false;
    this.previewRequest = 0;
  }

  read(key) { try { return this.storage?.getItem(key); } catch { return null; } }
  write(key, value) { try { this.storage?.setItem(key, value); } catch {} }
  get status() { return !this.enabled ? 'off' : this.loading ? 'loading' : this.loadFailed ? 'unavailable' : this.buffers.size && this.context?.state === 'running' ? 'ready' : 'waiting'; }

  initialize() {
    this.context = this.createContext();
    this.master = this.context.createGain();
    this.effectsBus = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.duck = this.context.createGain();
    this.limiter = this.context.createDynamicsCompressor();
    this.master.gain.value = .8;
    this.limiter.threshold.value = -5;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = .003;
    this.limiter.release.value = .12;
    this.effectsBus.connect(this.master);
    this.musicBus.connect(this.duck).connect(this.master);
    this.master.connect(this.limiter).connect(this.context.destination);
    this.applyVolumes();
    this.context.addEventListener('statechange', () => {
      if (this.context.state !== 'running') this.stopVoices(() => true, true);
      this.countdownKey = null; this.musicKey = null;
      if (this.context.state === 'running') this.synchronize();
      this.onChange();
    });
  }

  async unlock() {
    if (!this.enabled) return false;
    try {
      if (!this.context) this.initialize();
      if (this.context.state !== 'running') await this.context.resume();
      await this.load();
      this.synchronize();
      return this.context.state === 'running' && this.buffers.size > 0;
    } catch {
      this.loadFailed = true;
      this.onChange();
      return false;
    }
  }

  async load() {
    if (this.loading) return this.loading;
    const missing = Object.entries(AUDIO_FILES).filter(([id]) => !this.buffers.has(id));
    if (!missing.length) { this.loadFailed = false; return; }
    this.loading = Promise.allSettled(missing.map(async ([id, file]) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await this.fetchFile(`${BASE_URL}audio/${file}?v=1`, { signal: controller.signal });
        if (!response.ok) throw new Error('Audio download failed');
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(id, buffer);
      } finally { clearTimeout(timeout); }
    }));
    this.onChange();
    const result = await this.loading;
    this.loadFailed = result.some(item => item.status === 'rejected');
    this.loading = null;
    this.countdownKey = null;
    this.stopVoices(voice => voice.group === 'round');
    this.onChange();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.write('bb-sound', this.enabled ? 'on' : 'off');
    if (!this.enabled) {
      this.stopPreview();
      this.stopVoices(() => true);
      this.countdownKey = null; this.musicKey = null;
    }
    this.onChange();
  }

  toggle() { this.setEnabled(!this.enabled); }

  setPreferences(changes) {
    if (MUSIC_MODES.includes(changes.musicMode)) this.preferences.musicMode = changes.musicMode;
    for (const key of ['musicVolume', 'effectsVolume']) if (Number.isFinite(changes[key])) this.preferences[key] = clamp(changes[key]);
    this.write('bb-audio', JSON.stringify(this.preferences));
    this.applyVolumes();
    if (this.preferences.musicMode === 'off' || this.preferences.musicVolume === 0) this.stopVoices(voice => voice.group === 'preview-music');
    this.synchronize();
    this.onChange();
  }

  applyVolumes() {
    if (!this.context) return;
    const at = this.context.currentTime;
    this.effectsBus.gain.setTargetAtTime(this.preferences.effectsVolume * .6, at, .015);
    this.musicBus.gain.setTargetAtTime(this.preferences.musicVolume * .5, at, .025);
  }

  source(id, { at = this.context?.currentTime, group = 'effects', offset = 0, loop = false, end = null, rate = 1 } = {}) {
    const buffer = this.buffers.get(id);
    if (!this.enabled || this.context?.state !== 'running' || !buffer) return null;
    if (group === 'effects') {
      const effects = [...this.voices].filter(voice => voice.group === group);
      if (effects.length >= 8) this.stopVoice(effects[0]);
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.loop = loop;
    if (loop) { source.loopStart = 0; source.loopEnd = buffer.duration; }
    const start = Math.max(this.context.currentTime, at);
    gain.gain.setValueAtTime(loop ? 0 : 1, start);
    if (loop) gain.gain.linearRampToValueAtTime(1, start + .08);
    if (end !== null) {
      gain.gain.setValueAtTime(1, Math.max(start, end - .1));
      gain.gain.linearRampToValueAtTime(0, end);
    }
    source.connect(gain).connect(group === 'music' || group === 'preview-music' ? this.musicBus : this.effectsBus);
    const voice = { source, gain, group, id, stopped: false };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect(); gain.disconnect();
      if (group.startsWith('preview-') && ![...this.voices].some(other => other.group.startsWith('preview-'))) {
        this.previewing = false;
        this.onChange();
      }
    };
    source.start(start, offset);
    if (end !== null) source.stop(end + .01);
    return voice;
  }

  play(id, { color = 0, progress = 0, at = this.context?.currentTime, group = 'effects' } = {}) {
    if (id === 'hit') id = ['red', 'green', 'blue'][color] || 'red';
    const voice = this.source(id, { at, group, rate: ['red', 'green', 'blue'].includes(id) ? 1 + clamp(progress) * .04 : 1 });
    if (voice && group === 'effects') {
      const time = Math.max(this.context.currentTime, at);
      this.duck.gain.cancelScheduledValues(time);
      this.duck.gain.setValueAtTime(this.duck.gain.value, time);
      this.duck.gain.linearRampToValueAtTime(id === 'mistake' ? .4 : .66, time + .012);
      this.duck.gain.setTargetAtTime(1, time + .09, .06);
    }
  }

  scheduleRound(id, start, end, musicOwner, playerDone = false) {
    if (this.target?.id !== id) {
      this.stopRound();
      this.stopPreview();
      this.target = { id, start, end, musicOwner, playerDone };
    } else Object.assign(this.target, { musicOwner, playerDone });
    this.synchronize();
  }

  synchronize() {
    if (!this.enabled || this.context?.state !== 'running' || !this.target || !this.buffers.size) return;
    const { id, start, end, musicOwner, playerDone } = this.target;
    const now = this.now();
    if (now >= end) { this.stopRound(); return; }
    const audioNow = this.context.currentTime;
    if (!playerDone && this.countdownKey !== id) {
      this.countdownKey = id;
      for (let count = 3; count >= 0; count--) {
        const remaining = (start - count * 1000 - now) / 1000;
        if (remaining >= 0) this.play(count ? 'tick' : 'go', { at: audioNow + remaining, group: 'round' });
      }
    }
    const allowed = this.preferences.musicMode === 'on' || this.preferences.musicMode === 'auto' && musicOwner;
    if (!allowed || this.preferences.musicVolume === 0) {
      this.stopVoices(voice => voice.group === 'music');
      this.musicKey = null;
      return;
    }
    const musicKey = `${id}:${this.buffers.has('urgency')}`;
    if (this.musicKey === musicKey || !this.buffers.has('music')) return;
    this.stopVoices(voice => voice.group === 'music');
    this.musicKey = musicKey;
    const elapsed = Math.max(0, (now - start) / 1000);
    const at = audioNow + Math.max(0, (start - now) / 1000);
    const audioEnd = audioNow + (end - now) / 1000;
    const base = this.buffers.get('music');
    this.source('music', { at, group: 'music', loop: true, offset: elapsed % base.duration, end: audioEnd });
    const urgencyBeat = Math.ceil(Math.max(0, (end - start - 10_000) / 1000) / BEAT) * BEAT;
    const urgentAt = Math.max(now, start + urgencyBeat * 1000);
    const urgency = this.buffers.get('urgency');
    if (urgency) this.source('urgency', {
      at: audioNow + (urgentAt - now) / 1000, group: 'music', loop: true,
      offset: ((urgentAt - start) / 1000) % urgency.duration, end: audioEnd,
    });
  }

  stopVoice(voice, immediate = false) {
    if (voice.stopped) return;
    voice.stopped = true;
    const at = this.context.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(at);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, at);
      voice.gain.gain.linearRampToValueAtTime(0, at + (immediate ? 0 : .025));
      voice.source.stop(at + (immediate ? 0 : .03));
    } catch {}
    this.voices.delete(voice);
  }

  stopVoices(predicate, immediate = false) {
    for (const voice of this.voices) if (predicate(voice)) this.stopVoice(voice, immediate);
  }

  stopRound() {
    this.target = null; this.musicKey = null; this.countdownKey = null;
    this.stopVoices(voice => voice.group === 'round' || voice.group === 'music');
  }

  endPlayer() {
    if (this.target) this.target.playerDone = true;
    this.stopVoices(voice => voice.group === 'round');
  }

  cancel() {
    this.stopRound();
    this.stopPreview();
    this.stopVoices(() => true);
  }

  async preview() {
    if (this.target) return;
    const request = ++this.previewRequest;
    this.setEnabled(true);
    if (!await this.unlock() || request !== this.previewRequest || !this.enabled || this.target) return;
    this.stopPreview(false);
    this.previewing = true;
    const at = this.context.currentTime + .03;
    if (this.preferences.musicMode !== 'off' && this.preferences.musicVolume > 0) this.source('music', { at, group: 'preview-music', loop: true, end: at + 8 });
    for (const [id, delay] of [['red', .5], ['green', .8], ['blue', 1.1], ['mistake', 1.6], ['tick', 2.5], ['tick', 3.5], ['tick', 4.5], ['go', 5.5], ['finish', 6.3]]) this.play(id, { at: at + delay, group: 'preview-effects' });
    this.onChange();
  }

  stopPreview(invalidate = true) {
    if (invalidate) this.previewRequest++;
    this.stopVoices(voice => voice.group.startsWith('preview-'));
    this.previewing = false;
    this.onChange();
  }
}
