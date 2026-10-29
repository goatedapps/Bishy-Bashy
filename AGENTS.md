# Bishy Bashy

This is a four-device party game with playable Totem Shrinker, Perm Mania, Facial Slot Machine, Fireworks Craze, Mimicking Monkeys, Jump for the Meat, Burger Girl, Me Find Mistake, Dice, Dice, More Dice, Facing Which Way, It's Raining Coins, and Dodge or Die!!
The Vite frontend deploys independently to GitHub Pages; `server/` is a separate Node WebSocket room service on Render.
Run `npm run dev`, `npm test`, and `npm run build` for preview, meaningful gameplay/protocol checks, and static output.
The Pages workflow deploys `main`; `MULTIPLAYER_SERVER_URL` supplies the public WebSocket endpoint.
Keep the single server instance while rooms live in memory.
Protocol version 7 includes the Game Select announcement gate and multi-rocket Fireworks snapshots; coordinate frontend/backend releases when changing it.

## Game and visuals

For every new minigame, use the game-designer (game-design) and game-feel skills.
Reuse suitable existing audio; do not download or create new audio, and let the user supply any missing sounds.
For new games, use `public/audio/Ding.mp3` once for each correctly completed set, phrase, sequence, or other meaningful success, including the final success where applicable.
Give every new minigame a suitable original illustrated background using the imagegen skill, keeping gameplay targets readable.
Optimize all generated artwork before use, retain the masters, and record prompts in `public/assets/`.
`shared/totem.js` owns the deterministic shared-seed sequence and local gameplay rules.
Initial tuning is 30 blocks, a 300 ms wrong-tap freeze, and a 45-second deadline.
Show the next five blocks with the next input at the bottom, and size the complete stack to fit inside its lane.
`shared/perm.js` owns Perm Mania's seeded call-and-response phrases, local timing judgments, hair growth, and tempo-dependent round duration.
Perm Mania ranks growth, then timing score; Totem Shrinker ranks elapsed time.
`shared/slots.js` owns seeded portrait reels and local stops; Facial Slot Machine ranks elapsed time after matching all three reels.
Red, green, and blue stop their own continuously scrolling slot rows in any order; misses pause only that row for 450 ms and resume its motion without a jump.
Reels show approaching faces and judge the portrait nearest the center marker; Game Select reduces travel time per portrait from 320 to 260 ms across three Game Select rounds.
Track slot locks as a monotonic three-bit `reelMask`, rather than assuming the first N rows were stopped.
`shared/games.js` is the common game registry, difficulty settings, and result ordering.
`shared/fireworks.js` owns five seeded sets of 1, 3, 3 faster, 4, and 5 rockets, with colors visible from launch and inputs accepted until each scheduled landing.
Match airborne colors in any order; repeated colors consume the oldest matching rocket, and wrong or landed rockets retry only the current set after 650 ms.
`src/firework-view.js` and `src/fireworks.css` draw the live cues over the generated festival backdrop; remote cues follow published player state.
Fireworks launch audio follows each rocket's scheduled launch with bounded lookahead; deduplicate per rocket and attempt, and skip stale launches after interruption.
`shared/monkeys.js` owns Mimicking Monkeys' seeded expanding prefix, watch/play gates, and elapsed-time race through 5–9 stages.
Wrong responses replay the current prefix after recovery; completed stages persist, and demonstration inputs are ignored.
`src/monkey-view.js` and `src/monkeys.css` show the original monkey, color/shape flashes, and answer dots without revealing future answers; remote demonstrations use published player timing.
Memory demonstration tones use the local run's cue timestamps and a bounded audio lookahead; cancel them on replay, mute, finish, or interruption, and skip past cues on resume.
`shared/jump.js` owns seeded bounce arcs, inclusive landing windows, recovery, and the elapsed-time race to the final meat-reaching apex.
Any of the three buttons boosts a valid landing; preserve successful boosts after a miss and resolve final completion at its scheduled local apex, even on a delayed frame.
The wide gold landing window earns one boost; its green Perfect center (30% of the half-window) earns two, capped at the remaining goal.
Jump has no timing bar; judge landings from the dinosaur and trampoline, keeping the landing ring, +1/+2 feedback, and Perfect flourish aligned to the local input timestamp.
`src/jump-view.js` and `src/jump.css` draw the original dinosaur and landing guide; remote bounces follow published jump timing, and the home cast stays bounded to five characters as the catalog grows.
`shared/burger.js` owns seeded falling ingredients and automatic local catches; red/green/blue move the plate left/middle/right, misses keep completed layers, and delayed frames preserve scheduled landing times.
`shared/mistake.js` owns seeded odd-picture boards; red/green/blue choose top/middle/bottom, wrong answers keep the board, and correct answers retain their feedback before revealing the next board.
`src/catch-spot-view.js` and `src/catch-spot.css` render both games with original generated sprites; show the published current peer board and never show a future board during success feedback.
`shared/dice.js` owns seeded rolls with one unique maximum; red/green/blue choose top/middle/bottom, and misses preserve the current roll and completed progress.
`shared/facing.js` owns covered-card turns and left-right mirrors; red/green/blue answer left/up/right only after the demonstration, and misses replay the current trick.
Facing keeps its card upright while a separate flap slides down over 400 ms, then holds it fully covered for 350 ms before any numbered turn or turn sound.
Maximize the duck card inside its lane and fit diagonal turns to prevent overlap with adjacent players.
`src/dice-facing-view.js` combines exact code-native die pips with the generated dice jester and aviator duck artwork; never expose future boards, and preserve the revealed direction during success effects.
`shared/coins.js` owns seeded gold/fake drops; red/green/blue select left/middle/right, and catches settle at the scheduled local landing time.
`shared/dodge.js` owns alternating tall walls and low hurdles; red/blue step left/right, green jumps, and collisions use the jump height at the scheduled impact.
Both games keep completed progress after mistakes; `src/coins-dodge-view.js` renders local and published remote challenges using the same seeded models.
`shared/sets.js` defines five-game Arcade, three-round Game Select, shared placement points, and cumulative standings.
`server/rooms.js` owns the fixed set roster, idempotent point awards, intermissions, and readiness gates.
Selecting Arcade stays in the lobby; Start set begins the shared single reel, which spins for 4.7 seconds, holds the chosen game for two seconds, then opens instructions.
The server owns the result, selection timestamps, and five-game plan without repeats; render only seven recycled reel rows.
Expand the Arcade reel and selection pool only at catalog counts divisible by four (8, 12, 16, and so on); games added between those milestones are available immediately in Game Select.
`shared/sets.js` owns the common `arcadeGameIds()` batch boundary for both server selection and reel artwork.
After each Arcade podium's five seconds, show the next spin, then illustrated rules and an all-player Ready gate.
Game Select announces the chosen game with its supplied voice and applause once after Start set, then opens instructions after two seconds while the matching voice/applause tails finish naturally.
Game Select shows rules once and uses the podium's all-player Ready gate between subsequent rounds, with a five-second minimum intermission.
Readiness never carries across a round or instructions screen, and countdowns require every connected player to be ready and freshly synchronized.
`shared/games.js` defines the three-second countdown for both room scheduling and the single `countdown.mp3` cue; resume at the current offset, preserve its tail past GO, and avoid layering the old GO cue.
The host may configure modes and games only outside an active set, resetting readiness; new guests must wait until the set finishes.
Game Select increases Totem blocks from 30 to 50 and Perm tempo from 128 to 144 BPM across three rounds.
Every device displays all four lanes, with controls for its own player only.
Keep the arena overlay above all character and effect layers, and show an explicit completion badge on every finished player lane.
`shared/visual-state.js` publishes bounded scene snapshots at 4 Hz and maps round-relative timestamps to each viewer's clock; projections never advance gameplay or award results.
`src/viewport.js` and `src/viewport.css` fit the active arena and shared controls inside the visual viewport, with controls outside the arena and instructions keeping Ready visible.
Final standings hide setup and restart controls and show Exit to every connected player.
`exit-set` accepts only the current completed set ID and returns the whole room to mode selection; active-set Back to modes remains host-only.
Facing turns take 1000–700 ms across five available difficulties; Arcade coin falls take 800 ms, while Game Select starts at 1100 ms.
Shared styles live in `src/style.css`; the pink disco stage lives in `src/games.css`.
The landing page and set standings use `src/sets.css` and `src/set-view.js`.
The illustrated landing screen only creates or joins rooms; `src/home.css` scopes its landscape, central title, and form to outside rooms, and its help button introduces multiplayer room-code setup.
`src/home-motion.js` owns the homepage GSAP entrance and dinosaur companion; revert on room entry, honor reduced motion, and pause idle motion while typing, in dialogs, or hidden.
The two sky stars wiggle continuously above `home-landscape-motion.png`; match their positions to the fixed backdrop's cover scale and pause them when hidden or in dialogs.
Choose modes and games inside the room, with a short explanation visible on each mode card.
Use the shared `src/game-art.js` artwork for the home cast, equal-sized scrollable game cards, and illustrated rules; the library filters titles and accommodates future games without a wider page.
Keep game instructions short and focused on the action and buttons; use only as many points as needed.
`src/instruction-sequence.js` pauses 1400 ms after the heading, then 700 ms after the artwork and 850 ms between instruction lines, with `how-to-play.wav` for the heading and `Punch-button.mp3` for later steps.
Avoid hidden-tab reveal catch-up and enable Ready only after the last line and selected audio bank are ready.
The host's Back to modes action resets the shared set while keeping the room; confirm if a round has begun or scores exist.
Players may explicitly leave active sets after confirmation; preserve accepted finishes, forfeit unfinished rounds, and let remaining players continue without a missing-player wait.
The join handshake advertises `room-navigation`, `arcade-reel`, `asset-readiness`, `coins-dodge`, `live-gameplay-v2`, `set-exit`, `firework-sets`, and `game-announcements`; deploy frontend and backend together and show an actionable update message if required capabilities are absent.
Facial Slot Machine uses `src/slot-view.js` and `src/slots.css`; remote reels use the published lock masks, per-row pauses, and stopped positions without resetting on snapshots.
Use the same three buttons and shared fixed control bar in every current and future game; do not add game-specific button layouts or replace them with a single Stop button.
Show three horizontal scrolling slot rows per player, stacked red, green, and blue, with upcoming faces visible at narrow widths too.
Set podium positions and points use cumulative totals; the separate Last game column shows that round's performance and earned points.
Original generated sprites and their provenance live in `public/assets/`.
Always optimize generated assets before using them in the game, retaining original masters and checking delivery file sizes before release.
`scripts/optimize-images.py` derives hashed WebP delivery images; `scripts/asset-manifest.mjs` versions runtime files and losslessly compresses WAV downloads before dev/build.
Keep supplied audio filenames exactly cased as their runtime references; the delivery manifest checks this for case-sensitive hosting.
`src/asset-loader.js` verifies and caches assets behind the animated startup loader; `assetGates` clients acknowledge the current instructions/intermission round before the server accepts Ready.
The portable design mockup remains in `mockups/`, with editable source/provenance in `.lavish/totem-shrinker/`.
Keep screens visually driven; avoid redundant captions, decorative microcopy, and repeated instructions outside the rules screen.
Audio playback belongs in `src/audio.js`, starts only after a user gesture, and must have visual equivalents.
Burger catches and correct picture answers use `Ding.mp3`, including final successes; the Arcade reel loops `roulette.mp3` while spinning and plays `Game-select.mp3`, the selected game voice, and `applause.mp3` together once on landing.
`scripts/audio/arcade.js` maps supplied voice files (Me Find Mistake uses `me-find-mistake.mp3`); preload them, let voice/applause tails finish across the same round's instructions, and cancel on navigation, mute, or interruption without replaying stale selections.
Coin catches, cleared obstacles, dice, and direction successes also reuse `Ding.mp3`; Facing turn cues reuse `slot-lock.wav` with bounded local-clock lookahead and cancellation on replay, mute, interruption, or finish.
Perm phrase growth and complete Monkey sequences use `Ding.mp3` once per successful stage, including the final stage; individual response inputs retain their existing cues.
Menu and transition screens stream `public/audio/Background-ActionRock.mp3` through the music bus; pause it for countdown/gameplay and previews, preserving its position and existing mute/ownership settings.
Menu tracks reuse one gesture-authorized media element and retain separate playback positions to support first-entry playback on tablets.
The illustrated instructions screen streams `game-instructions.mp3` instead; pause the previous track before switching and preserve each track's position.
Post-game podiums play `podium-winner.mp3` once per round before menu music resumes; preserve deduplication across redraws and cancel the cue on navigation, mute, or interruption.
Enabled menu buttons use the cached `Button-Press.mp3` effect; the three gameplay buttons and their keyboard shortcuts use `Punch-button.mp3` once through the shared tap handler, preserving game-specific sound cues.
`src/backgrounds.css` maps all non-Fireworks arenas to their optimized illustrated environments.
Set-based games briefly overlay a yellow circle or red cross across 90% of the lane width, centered in the player panel, and use `wrong.mp3` for failed sets; Perm judges at phrase settlement, not individual notes.
`src/feedback.js` owns bounded local success and finish effects; keep decorative particles off reaction targets, cancel effects across round/lifecycle changes, and honor reduced motion.
The original disco score and synthesis live in `scripts/audio/`; regenerate `public/audio/` with `npm run audio:render` after changing them.
Facial Slot Machine's original carousel-funk score and match cues live in `scripts/audio/slots.js`, using the existing mix and lifecycle controls.
Decode audio banks per game and schedule Perm Mania demonstrations from the same frozen clock mapping as its visual guide.
Scale Perm music playback, demonstrations, visual beats, and judgment windows together with the round tempo; preserve musical phase when resuming audio.
Freeze any per-device rhythm timing adjustment when scheduling the round; muted play must remain possible with the visual guide.
Keep background music on one fixed participant by default, allow personal overrides, and preserve its phase across mute and interruption.
Results may stop music and countdown cues, but must not truncate an accepted local finish cue.

## Timing invariants

- Measure local input with `performance.now()` and freeze the server-clock mapping when a round is scheduled.
- Rank elapsed durations, never packet arrival order.
- Cosmetic progress is throttled to at most 4 Hz per player and must never block local inputs.
- Treat result submissions as idempotent, acknowledge them, and persist pending submissions across reconnects.
- Keep reconnect tokens private; exclude them from broadcasts, invitations, and reports.
- Disconnection does not forfeit; hiding or reloading the active game does.
- Wait up to 15 seconds for disconnected players at a Ready gate, then allow ready connected players to continue; never skip a connected unready player.
- Clock uncertainty and GO render delay do not prove physical display synchronization.

## Planned games: proposed build order

The user intends to build all 15 games below gradually, in addition to the three existing games.
This order prioritizes gameplay variety, with similar racing, button-mashing, and slot mechanics spaced out or added later.
Mark each entry complete as its game is implemented.

1. [x] Fireworks Craze — color reactions.
2. [x] Mimicking Monkeys — expanding memory sequences.
3. [x] Jump for the Meat — precisely timed bounces.
4. [x] Burger Girl — catching falling ingredients.
5. [x] Me Find Mistake — spotting the odd picture out.
6. [x] Dice, Dice, More Dice — quickly choosing the highest die.
7. [x] Facing Which Way — tracking a picture through flips.
8. [x] It's Raining Coins — moving to catch falling coins.
9. [x] Dodge or Die!! — avoiding obstacles and timing jumps.
10. [ ] Horse Speeder — accelerating and weaving between horses.
11. [ ] Shark Jumper — following colored input sequences.
12. [ ] Blaster Soda Race — alternating buttons to accelerate.
13. [ ] Building Climber — alternating buttons to climb.
14. [ ] Burst the Balloon — rapid button presses to inflate and burst a balloon.
15. [ ] Wonder Oven — stopping three matching food symbols.

## Maintenance

Keep the static frontend independently deployable with a configurable secure WebSocket endpoint.
Keep the canonical gameplay and hosting notes in README.md current.
Use one full sentence per line when substantially editing Markdown, and comment only on non-obvious constraints.
