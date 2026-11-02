export const ARCADE_VOICE_FILES = {
  'star-collector': 'star-collector-voice.mp3',
  'ladder-climber': 'ladder-climber-voice.mp3',
  'clock-stopper': 'clock-stopper-voice.mp3',
  'stationery-master': 'stationery-master-voice.mp3',
  'happy-days': 'happy-days-voice.mp3',
  'wheres-kaya': 'wheres-kaya-voice.mp3',
  'get-those-burgers-out': 'get-the-burgers-out-voice.mp3',
  'dynamite-spark': 'dynamite-spark-voice.mp3',
  'totem-shrinker': 'totem-shrinker-voice.mp3',
  'perm-mania': 'perm-mania-voice.mp3',
  'facial-slot-machine': 'facial-slot-machine-voice.mp3',
  'fireworks-craze': 'fireworks-craze-voice.mp3',
  'mimicking-monkeys': 'mimicking-monkeys-voice.mp3',
  'jump-for-the-meat': 'jump-for-the-meat-voice.mp3',
  'burger-girl': 'burger-girl-voice.mp3',
  'me-find-mistake': 'me-find-mistake.mp3',
  'dice-dice-more-dice': 'dice-dice-more-dice-voice.mp3',
  'facing-which-way': 'facing-which-way-voice.mp3',
  'its-raining-coins': 'its-raining-coins-voice.mp3',
  'dodge-or-die': 'dodge-or-die-voice.mp3',
  'type-in-letters': 'type-in-letters-voice.mp3',
};

export const ARCADE_AUDIO_FILES = {
  applause: 'applause.mp3',
  ...Object.fromEntries(Object.entries(ARCADE_VOICE_FILES).map(([game, file]) => [`gameVoice:${game}`, file])),
};
