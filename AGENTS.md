# Dokidoki Dash!

This is a four-device party game with playable Totem Shrinker, Perm Mania, Facial Slot Machine, Fireworks Craze, Mimicking Monkeys, Jump for the Meat, Burger Girl, Me Find Mistake, Dice, Dice, More Dice, Facing Which Way, It's Raining Coins, Dodge or Die!!, Type in Letters, Dynamite Spark, and Get Those Burgers Out!.
The Vite frontend deploys independently to GitHub Pages; `server/` is a separate Node WebSocket room service on Render.
Run `npm run dev`, `npm test`, and `npm run build` for preview, meaningful gameplay/protocol checks, and static output.
The Pages workflow deploys `main`; `MULTIPLAYER_SERVER_URL` supplies the public WebSocket endpoint.
Keep the single server instance while rooms live in memory.
Protocol version 14 adds concurrent per-slot meal drops; deploy frontend and backend together.

## Game and visuals

For every new minigame, use the game-designer (game-design) and game-feel skills.
Reuse suitable existing audio; do not download or create new audio, and let the user supply any missing sounds.
For new games, use `public/audio/Ding.mp3` once for each correctly completed set, phrase, sequence, or other meaningful success, including the final success where applicable.
Give every new minigame a suitable original illustrated background using the imagegen skill, keeping gameplay targets readable.
Use imagegen for illustrated game objects and characters in gameplay, posters, and How to play; do not substitute CSS shapes or emoji for food, dynamite, or other illustrated sprites.
Keep gameplay free of counts, progress trackers, item totals, and decorative bases or ovals unless explicitly requested; preserve the round timer, essential target slots, and final clear time.
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
`shared/fireworks.js` owns seven Game Select sets of 1, 3, 3 faster, 4, 5, 5, and 5 rockets, extended to ten in Arcade by repeating the final pattern, with colors visible from launch and inputs accepted until each scheduled landing.
Match airborne colors in any order; repeated colors consume the oldest matching rocket, and wrong or landed rockets retry only the current set after 650 ms.
`src/firework-view.js` and `src/fireworks.css` draw the live cues over the generated festival backdrop; remote cues follow published player state.
Fireworks launch audio follows each rocket's scheduled launch with bounded lookahead; deduplicate per rocket and attempt, and skip stale launches after interruption.
`shared/monkeys.js` owns Mimicking Monkeys' seeded expanding prefix, watch/play gates, and elapsed-time race through 5–9 stages.
Wrong responses replay the current prefix after recovery; completed stages persist, and demonstration inputs are ignored.
`src/monkey-view.js` and `src/monkeys.css` show the original monkey, color/shape flashes, and answer dots without revealing future answers; remote demonstrations use published player timing.
Memory demonstration tones use the local run's cue timestamps and a bounded audio lookahead; cancel them on replay, mute, finish, or interruption, and skip past cues on resume.
`shared/jump.js` owns seeded bounce arcs, inclusive landing windows, recovery, and the elapsed-time race to the final meat-reaching apex.
Any of the three buttons boosts a valid landing; preserve successful boosts after a miss and resolve final completion at its scheduled local apex, even on a delayed frame.
The fixed meat height is 16 height units in every round: Good landings add one unit and Perfect landings add two, so eight Perfect or sixteen Good landings reach it.
The green Perfect center is 30% of the landing half-window; keep the jump scene flush with the panel bottom without counters or progress bars, and retain the accepted elapsed time above CLEAR on each finished lane.
Jump has no timing bar; judge landings from the dinosaur and trampoline, keeping the landing ring, Good/Perfect feedback, and Perfect flourish aligned to the local input timestamp.
`src/jump-view.js` and `src/jump.css` draw the original dinosaur and landing guide; remote bounces follow published jump timing, and the home cast stays bounded to five characters as the catalog grows.
`shared/burger.js` owns seeded falling ingredients and automatic local catches; red/green/blue move the plate left/middle/right, misses keep completed layers, and delayed frames preserve scheduled landing times.
`shared/mistake.js` owns seeded odd-picture boards; red/green/blue choose top/middle/bottom, every answer advances after 260 ms feedback, and ranking uses correct-answer count without elapsed-time tiebreaks.
`src/catch-spot-view.js` and `src/catch-spot.css` render both games with original generated sprites; show the published current peer board and never show a future board during success feedback.
`shared/dice.js` owns 21 synchronized highest-die sets over 25 seconds; answer windows shrink every three sets from 2000 through 1600, 1200, 900, 600, 400, and 300 ms.
`shared/facing.js` owns five Game Select or eight Arcade synchronized covered-card sets, front/back pose composition, and three unique picture options; red/green/blue choose left/middle/right within three seconds after the turns.
Facing keeps the initial card upright while its cover closes over 400 ms, then holds it covered for 350 ms before turning.
`shared/choice-round.js` locks each player’s first answer privately, acknowledges retries, and settles server-owned scores only after each deadline plus 80 ms transport grace; missed answers never pause the shared schedule.
`src/shared-choice-view.js` renders common Dice/Facing challenges and options with fixed four-column player scores and post-deadline answer reveals.
Use `dice-roll.mp3` once per throw and `flip.mp3` once per duck turn with bounded lookahead, stale-cue skipping, and lifecycle cancellation.
`shared/coins.js` owns seeded gold/fake drops; red/green/blue select left/middle/right, and catches settle at the scheduled local landing time.
`shared/dodge.js` owns alternating tall walls and low hurdles; red/blue step left/right, green jumps, and collisions use the jump height at the scheduled impact.
Both games keep completed progress after mistakes; `src/coins-dodge-view.js` renders local and published remote challenges using the same seeded models.
`shared/letters.js` owns Type in Letters' 30-second shared-target race, wraparound alphabet/backspace input, bounded replay proofs, and 120 ms completion-time arbitration with 300 ms result feedback; the server owns scores and final results.
`src/letters-view.js` and `src/letters.css` keep the alphabet in one compact phone row and typed player boxes in fixed columns, including solo play; local matches highlight immediately and button presses use `Diuup.mp3`.
Type in Letters uses red/green/blue for left/enter/right and announces with supplied `type-in-letters-voice.mp3` plus applause; include it in both Arcade and Game Select.
`shared/sets.js` defines five-game Arcade, three-round Game Select, shared placement points, and cumulative standings.
`server/rooms.js` owns the fixed set roster, idempotent point awards, intermissions, and readiness gates.
Selecting Arcade stays in the lobby; Start set begins the shared single reel, which spins for 4.7 seconds, holds the chosen game for two seconds, then opens instructions.
The server owns the result, selection timestamps, and five-game plan without repeats; render only seven recycled reel rows.
Include every registered game in the Arcade reel and selection pool immediately; Arcade still chooses five distinct games per set.
`shared/sets.js` owns the common complete `arcadeGameIds()` catalog for both server selection and reel artwork.
After each Arcade podium's five seconds, show the next spin, then illustrated rules and an all-player Ready gate.
Game Select opens a separate shared game picker after Start set; Play selected game confirms the centered poster and announces it with its supplied voice and applause once, then opens instructions after two seconds while the matching voice/applause tails finish naturally.
Game Select shows rules once and uses the podium's all-player Ready gate between subsequent rounds, with a five-second minimum intermission.
Readiness never carries across a round or instructions screen, and countdowns require every connected player to be ready and freshly synchronized.
`shared/games.js` defines the three-second countdown for both room scheduling and the single `countdown.mp3` cue; resume at the current offset, preserve its tail past GO, and avoid layering the old GO cue.
The host may configure modes and games only outside an active set, resetting readiness; new guests must wait until the set finishes.
Game Select increases Totem blocks from 30 to 50 and Perm tempo from 128 to 144 BPM across three rounds.
Every device displays all four lanes, except Type in Letters, which uses one shared alphabet arena; each device controls its own player only.
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
`src/lobby-motion.js` and `src/lobby.css` own decorative cabinet/fan attract loops and four dancing mascot seats; use existing room players for occupancy, keep controls stationary, and revert all motion outside the lobby or under reduced motion.
Use the shared `src/game-art.js` artwork for the home cast, game posters, and illustrated rules.
`src/game-carousel.js` and `src/game-carousel.css` own Game Select's searchable looping horizontal poster carousel; settle host input before configuring, follow authoritative selections on guests, and cancel carousel motion outside the lobby.
Keep game instructions short and focused on the action and buttons; use only as many points as needed.
`src/instruction-sequence.js` pauses 1400 ms after the heading, then 700 ms after the artwork and 850 ms between instruction lines, with `how-to-play.mp3` for the heading and `Punch-button.mp3` for later steps.
Avoid hidden-tab reveal catch-up and enable Ready only after the last line and selected audio bank are ready.
The host's Back to modes action resets the shared set while keeping the room; confirm if a round has begun or scores exist.
Players may explicitly leave active sets after confirmation; preserve accepted finishes, forfeit unfinished rounds, and let remaining players continue without a missing-player wait.
The join handshake advertises `room-navigation`, `arcade-reel`, `asset-readiness`, `coins-dodge`, `live-gameplay-v2`, `set-exit`, `firework-sets`, `game-announcements`, `game-picker-screen`, `shared-letters`, `shared-choices`, and `mistake-points`; deploy frontend and backend together and show an actionable update message if required capabilities are absent.
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
Coin catches, cleared obstacles, dice, and direction successes also reuse `Ding.mp3`; Facing turn cues use `flip.mp3` with bounded local-clock lookahead and cancellation on replay, mute, interruption, or finish.
Perm phrase growth and complete Monkey sequences use `Ding.mp3` once per successful stage, including the final stage; individual response inputs retain their existing cues.
Menu and transition screens stream `public/audio/Background-ActionRock.mp3` through the music bus; pause it for countdown/gameplay and previews, preserving its position and existing mute/ownership settings.
Menu tracks reuse one gesture-authorized media element and retain separate playback positions to support first-entry playback on tablets.
The illustrated instructions screen streams `game-instructions.mp3` instead; pause the previous track before switching and preserve each track's position.
Post-game podiums play `podium-winner.mp3` once per round before menu music resumes; preserve deduplication across redraws and cancel the cue on navigation, mute, or interruption.
Enabled menu buttons use the cached `Button-Press.mp3` effect; the three gameplay buttons and their keyboard shortcuts use `Punch-button.mp3` (Jump uses supplied `bounce.mp3`) once through the shared tap handler, preserving game-specific sound cues.
`src/backgrounds.css` maps all non-Fireworks arenas to their optimized illustrated environments.
Set-based games briefly overlay a yellow circle or red cross across 90% of the lane width, centered in the player panel, and use `wrong.mp3` for failed sets; Perm judges at phrase settlement, not individual notes; Mistake feedback lasts 260 ms, and shared Dice/Facing reveal symbols only at the answer deadline.
`src/feedback.js` owns bounded local success and finish effects; keep decorative particles off reaction targets, cancel effects across round/lifecycle changes, and honor reduced motion.
The original disco score and synthesis live in `scripts/audio/`; regenerate `public/audio/` with `npm run audio:render` after changing them.
Facial Slot Machine's original carousel-funk score and match cues live in `scripts/audio/slots.js`, using the existing mix and lifecycle controls.
Decode audio banks per game and schedule Perm Mania demonstrations from the same frozen clock mapping as its visual guide.
Scale Perm music playback, demonstrations, visual beats, and judgment windows together with the round tempo; preserve musical phase when resuming audio.
Freeze any per-device rhythm timing adjustment when scheduling the round; muted play must remain possible with the visual guide.
Keep background music on one fixed participant by default, allow personal overrides, and preserve its phase across mute and interruption.
Results may stop music and countdown cues, but must not truncate an accepted local finish cue.

`shared/dynamite.js` owns 13 seeded colour groups of four sections, a 40 ms input guard, 250 ms wrong-colour recovery, and a 45-second elapsed-time race.
`src/dynamite-view.js` uses a paused, locally clocked GSAP tween to smoothly scroll the continuous segmented wire while the spark descends; loop `electrical-buzz.mp3` only for the active local spark, stop it on finish/interruption, and preserve `dynamite-explode.mp3` in a dedicated finish group through results, defer podium audio until it ends, and duck music during the explosion.
`shared/meals.js` owns six seeded fries/burger/drink orders; independent 300 ms drops fill required slots, taps on a full column play Wrong without altering the meal, each completed meal plays Ding once, and final elapsed time includes the last landing.
`src/meals-view.js` shows empty slots and falling items; presses use `plop.mp3`, and both new games show accepted clear times at the top of each player's column.
All 15 registered games are available in both Arcade and Game Select.
The handshake requires `dynamite-meals` alongside existing capabilities.

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

Commit and push every completed change unless the user explicitly instructs otherwise.
Keep the static frontend independently deployable with a configurable secure WebSocket endpoint.
Keep the canonical gameplay and hosting notes in README.md current.
Use one full sentence per line when substantially editing Markdown, and comment only on non-obvious constraints.

Perm demonstrations alternate `piano-do.mp3` and `piano-re.mp3` by seeded note index; response taps use the nearest corresponding rhythm note with the frozen timing offset, and never layer Punch or the old Perm tap cues.
Dice result circles remain visible in each player’s score box for 650 ms alongside one Ding per correct set, even when the next fast throw has begun.

Arcade uses 15 Me Find Mistake boards with a 45-second deadline, eight Facing Which Way sets with a derived 58.4-second schedule, and ten Fireworks sets with a 60-second deadline.
Game Select retains its existing board/set counts and timing; extra Arcade Fireworks sets reuse the final five-rocket pattern, and run models must honor `round.goal`.
Facing instructions and the match HUD derive their set counts from the scheduled round.

Get Those Burgers Out! accepts repeated presses while the same item is falling: each press reserves its own empty slot and launches an independent 300 ms drop.
Keep up to nine bounded per-slot timestamps in visual snapshots, map them between viewer clocks, and derive completion from the final scheduled landing; taps beyond filled or reserved requirements still play Wrong.
