# Happy Days artwork and audio

Generated the artwork with the built-in imagegen tool on 2026-11-01.
Retained masters are `bg-happy-stage.png` and `happy-bird.png`.
The 1280-pixel background and 512-pixel transparent bird use hashed WebP delivery files at quality 86 and method 6.
They total 153,518 bytes, reduced from 3,510,206 bytes of original PNG masters.
The bird is used in the game poster, and the illustrated stage frames gameplay and the animated tutorial.
Rectangular note bars, hold lengths, and hit-line feedback are drawn in code for precise timing and resizing.

## Supplied audio and chart

The user supplied `happy-days-music.mp3`, `happy-days-voice.mp3`, and `wheres-kaya-voice.mp3`; no music or effects were generated or downloaded.
The supplied music SHA-256 is `d27a7cc22708a18ca753c037148da7a144fc175bbe95792d0ab9bb1403d8ba69`; recheck the chart alignment if the recording changes.
The music decodes at 48 kHz stereo and lasts 32.616 seconds; gameplay uses its first 30 seconds at the original speed.
An offline spectral-flux analysis of the first 30 seconds found 144 successive half-beat transients.
Fitting those transients gave 206.912 ms spacing, a 239.925 ms grid offset, an estimated 144.989 BPM, and 5.127 ms RMS timing error.
The original three-button arrangement uses a rounded 145 BPM grid with a 240 ms offset, 57 notes, and 17 holds lasting one or two beats.
The supplied red, green, and blue hit samples provide distinct D, F♯, and A tones at fixed pitch.
They use 35% voice gain without ducking the song on each press.
An offline mix estimate at default 65% music and 80% effects, through the existing 80% master level, peaks at −4.69 dBFS before the existing limiter.
This measures decoded samples and scheduling, not physical speaker or Bluetooth latency.
Temporary NumPy and SoundFile tools were used locally for analysis; they are not application dependencies.

## Background prompt

Use case: illustration-story.
Asset type: original illustrated arena background for Happy Days, a cheerful three-lane falling-note music game.
Landscape 3:2.
A whimsical open-air pastel music stage in a sunny garden, peach and lavender curtains at far edges, small flowering shrubs and a few gently glowing round stage lights confined to corners, distant rolling mint hills beneath a pale blue sky.
Large central 80 percent must be calm, dark desaturated midnight teal with a subtle warm gradient, uncluttered and low contrast so bright red green blue rectangular note bars and a hit line can be clearly read over it.
Polished hand-painted colorful family party-game illustration, soft textured shading and clean dark plum outlines only at the edges.
No words, logos, people, animals, piano keys, note lanes, falling bars, button symbols, score counters or interface elements.

## Mascot prompt

Use case: stylized-concept.
Asset type: original transparent mascot sprite for Happy Days falling-note rhythm party game poster.
One cute tiny sky-blue songbird wearing oversized soft lavender headphones, bright expressive eyes, small sunny yellow beak, happy open singing expression, two small wings raised in a dancing pose, orange feet, rounded chibi proportions.
Full body centered with generous transparent margins.
Polished hand-painted cartoon game illustration, thick clean dark purple outlines, colorful glossy shading, friendly and playful.
No musical note symbols, text, letters, stage, ground, ovals, shadows outside the character, extra characters, instruments or background.
Truly transparent background.
