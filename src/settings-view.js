import { GAMES, isRoundActive } from '../shared/games.js';

const $ = id => document.getElementById(id);

export function updateSound({ audio, room, timingOffset }) {
  $('sound').classList.toggle('sound-off', !audio.enabled);
  $('sound').setAttribute('aria-pressed', String(audio.enabled));
  $('sound').setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Enable sound');
  $('music-mode').value = audio.preferences.musicMode;
  for (const [id, key] of [['music-volume', 'musicVolume'], ['effects-volume', 'effectsVolume']]) {
    const value = Math.round(audio.preferences[key] * 100);
    $(id).value = value;
    $(`${id}-value`).textContent = `${value}%`;
  }
  $('audio-status').textContent = ({ off: 'Sound is off.', loading: 'Loading sounds…', ready: 'Sound ready.', waiting: 'Tap Preview sound to try it.', unavailable: 'Some sounds could not load. Tap Preview sound to retry.' })[audio.status];
  const active = room?.set && room.set.phase !== 'complete' || room?.round && room.round.phase !== 'results';
  $('audio-preview').disabled = Boolean(active) || audio.status === 'loading';
  $('audio-preview').textContent = audio.previewing ? 'Stop preview' : 'Preview sound';
  $('timing-offset').value = timingOffset;
  $('timing-offset-value').textContent = `${timingOffset > 0 ? '+' : ''}${timingOffset} ms`;
  $('timing-offset').disabled = Boolean(active);
}

export function updateArcadeSettings({ room, playerId, selectedArcadeLength }) {
  const length = room?.arcadeLength ?? selectedArcadeLength;
  $('arcade-length').max = String(Object.keys(GAMES).length);
  $('arcade-length').value = String(length);
  $('arcade-length-value').textContent = String(length);
  $('arcade-length').disabled = Boolean(room && (room.hostId !== playerId || room.set || isRoundActive(room.round)));
  $('arcade-description').textContent = `Battle with your friends for ${length} randomly selected games`;
}
