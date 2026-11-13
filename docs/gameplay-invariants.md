# Detailed gameplay constraints

Read the sections relevant to the game or shared system being changed.
Canonical setup and hosting instructions live in [README.md](../README.md).

## Game and visuals

For every new minigame, use the game-designer (game-design) and game-feel skills.
Reuse suitable existing audio; do not download or create new audio, and let the user supply any missing sounds.
For new games, use `public/audio/Ding.mp3` once for each correctly completed set, phrase, sequence, or other meaningful success, including the final success where applicable.
Give every new minigame a suitable original illustrated background using the imagegen skill, keeping gameplay targets readable.
Use imagegen for illustrated game objects and characters in gameplay, posters, and How to play; do not substitute CSS shapes or emoji for food, dynamite, or other illustrated sprites.
Keep gameplay free of counts, progress trackers, item totals, and decorative bases or ovals unless explicitly requested; preserve the round timer, essential target slots, and final clear time.
Optimize all generated artwork before use, retain the masters, and record prompts in `archive/artwork/`.
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
`shared/dice.js` owns 21 synchronized highest-die sets over 30.7 seconds; answer windows shrink every three sets from 2000 through 1600, 1400, 1200, 1000, 900, and 800 ms.
`shared/facing.js` owns five Game Select or eight Arcade synchronized covered-card sets, front/back pose composition, and three unique picture options; red/green/blue choose left/middle/right within three seconds after the turns.
Facing keeps the initial card upright while its cover closes over 400 ms, then holds it covered for 350 ms before turning.
`shared/choice-round.js` locks each player’s first answer privately, acknowledges retries, and settles server-owned scores only after each deadline plus 80 ms transport grace; missed answers never pause the shared schedule.
`src/shared-choice-view.js` renders common Dice/Facing/Kaya challenges and options with fixed four-column player scores and post-deadline answer reveals.
Use `dice-roll.mp3` once per throw and `flip.mp3` once per duck turn with bounded lookahead, stale-cue skipping, and lifecycle cancellation.
`shared/coins.js` owns seeded gold/fake drops; red/green/blue select left/middle/right, and catches settle at the scheduled local landing time.
`shared/dodge.js` owns alternating tall walls and low hurdles; red/blue step left/right, green jumps, and collisions use the jump height at the scheduled impact.
Both games keep completed progress after mistakes; `src/coins-dodge-view.js` renders local and published remote challenges using the same seeded models.
`shared/letters.js` owns five shared word windows of 10, 8, 6, 5, and 4 seconds, wraparound alphabet/backspace input, bounded replay proofs, 800 ms transport grace, and 300 ms result feedback; every player completing a word earns one point; the server owns scores and final results.
`src/letters-view.js` and `src/letters.css` keep the alphabet in one compact phone row and typed player boxes in fixed columns, including solo play; local matches highlight immediately and button presses use `Diuup.mp3`.
Type in Letters uses red/green/blue for left/enter/right and announces with supplied `type-in-letters-voice.mp3` plus applause; include it in both Arcade and Game Select.
`shared/sets.js` defines host-configured Arcade (3 to the full catalog, default 5), three-round Game Select, Party player-order playlists, shared placement points, and cumulative standings.
`server/rooms.js` owns the fixed set roster, idempotent point awards, intermissions, and readiness gates.
Selecting Arcade stays in the lobby; Start set begins the shared single reel, which spins for 4.7 seconds, holds the chosen game for two seconds, then opens instructions.
The server owns the result, selection timestamps, and host-sized game plan without repeats; render only seven recycled reel rows.
Include every registered game in the Arcade reel and selection pool immediately; Arcade chooses the configured number of distinct games per set.
`shared/sets.js` owns the common complete `arcadeGameIds()` catalog for both server selection and reel artwork.
After each Arcade podium's five seconds, show the next spin, then illustrated rules and an all-player Ready gate.
Game Select opens a separate shared game picker after Start set; Play selected game confirms the centered poster and announces it with its supplied voice and applause once, then opens instructions after two seconds while the matching voice/applause tails finish naturally.
Game Select shows rules once and uses the podium's all-player Ready gate between subsequent rounds, with a five-second minimum intermission.
Readiness never carries across a round or instructions screen, and countdowns require every connected player to be ready and freshly synchronized.
`shared/games.js` defines the three-second countdown for both room scheduling and the single `countdown.mp3` cue; resume at the current offset, preserve its tail past GO, and avoid layering the old GO cue.
The host may configure modes and games only outside an active set, resetting readiness; new guests must wait until the set finishes.
Game Select increases Totem blocks from 30 to 50 and Perm tempo from 128 to 144 BPM across three rounds.
Every device displays all four lanes, except shared Witch, Letters, Sesame, Dice, Facing, Kaya, Stationery, Clock, and Dam arenas.
Each device controls its own player only.
Keep the arena overlay above all character and effect layers, and show an explicit completion badge on every finished player lane.
`shared/visual-state.js` publishes bounded scene snapshots at 4 Hz and maps round-relative timestamps to each viewer's clock; projections never advance gameplay or award results.
`src/viewport.js` and `src/viewport.css` fit the active arena and shared controls inside the dynamic viewport, with controls outside the arena and instructions keeping Ready visible.
Compact tutorial spacing, controls, and player badges to fit the viewport while keeping the full content accessible on shorter screens.
On phones, keep the card and demo flexible so spare vertical space enlarges the tutorial and Ready stays near the safe bottom edge.
Use one shared scene or four equal-width lanes, including on phones.
Use `touch-action:none` on the gameplay control deck to prevent double-tap zoom and preserve pinch zoom elsewhere.
Final standings hide setup and restart controls and show Exit to every connected player.
`exit-set` records one vote per player for the current completed set and Party cycle.
Return to mode selection when all occupied seats have voted, preserving votes on reconnect and rechecking after a seat leaves or expires.
Party Exit and Continue votes replace each other, and Back to modes is host-only during an active set.
Facing turns take 1800–1400 ms across five available difficulties; its reverse duck sprite must expose a left-pointing bill while clearly showing its back.
Coins starts Arcade with 1200 ms falls and 700 ms launches; Game Select starts with 1300 ms falls and 720 ms launches, decreasing initial values by 80/40 ms per difficulty.
Every Coins round progressively halves both fall duration and launch interval over its first 36 pairs; freeze each pair’s timings at launch so airborne objects never change speed.
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
Keep rule summaries in How to play and out of the gameplay header.
`src/instruction-sequence.js` pauses 1400 ms after the heading, then 700 ms after the artwork and 850 ms between instruction lines, with `how-to-play.mp3` for the heading and `Punch-button.mp3` for later steps.
Avoid hidden-tab reveal catch-up and enable Ready only after the last line and selected audio bank are ready.
The host's Back to modes action resets the shared set while keeping the room; confirm if a round has begun or scores exist.
Players may explicitly leave active sets after confirmation; preserve accepted finishes, forfeit unfinished rounds, and let remaining players continue without a missing-player wait.
The join handshake advertises `room-navigation`, `arcade-reel`, `asset-readiness`, `coins-dodge`, `live-gameplay-v2`, `set-exit`, `firework-sets`, `game-announcements`, `game-picker-screen`, `shared-letters`, `shared-choices`, and `mistake-points`; deploy frontend and backend together and show an actionable update message if required capabilities are absent.
Facial Slot Machine uses `src/slot-view.js` and `src/slots.css`; remote reels use the published lock masks, per-row pauses, and stopped positions without resetting on snapshots.
Use the same three buttons and shared fixed control bar in every current and future game; do not add game-specific button layouts or replace them with a single Stop button.
Show three horizontal scrolling slot rows per player, stacked red, green, and blue, with upcoming faces visible at narrow widths too.
Set podium positions and points use cumulative totals; the separate Last game column shows that round's performance and earned points.
Original PNG masters and their provenance live in `archive/artwork/`; runtime images live in `public/assets/optimized/`.
Always optimize generated assets before using them in the game, retaining original masters and checking delivery file sizes before release.
`scripts/optimize-images.py` derives hashed WebP delivery images; `scripts/asset-manifest.mjs` versions runtime files and losslessly compresses WAV downloads before dev/build.
Keep supplied audio filenames exactly cased as their runtime references; the delivery manifest checks this for case-sensitive hosting.
`src/asset-loader.js` verifies and caches assets behind the animated startup loader; `assetGates` clients acknowledge the current instructions/intermission round before the server accepts Ready.
Keep screens visually driven; avoid redundant captions, decorative microcopy, and repeated instructions outside the rules screen.
Audio playback belongs in `src/audio.js`, starts only after a user gesture, and must have visual equivalents.
Burger catches and correct picture answers use `Ding.mp3`, including final successes; the Arcade reel loops `roulette.mp3` while spinning and plays `Game-select.mp3`, the selected game voice, and `applause.mp3` together once on landing.
`scripts/audio/arcade.js` maps supplied voice files (Me Find Mistake uses `me-find-mistake.mp3`); preload them, let voice/applause tails finish across the same round's instructions, and cancel on navigation, mute, or interruption without replaying stale selections.
Coin catches, cleared obstacles, dice, and direction successes also reuse `Ding.mp3`; Facing turn cues use `flip.mp3` with bounded local-clock lookahead and cancellation on replay, mute, interruption, or finish.
Perm phrase growth and complete Monkey sequences use `Ding.mp3` once per successful stage, including the final stage; individual response inputs retain their existing cues.
Menu and transition screens stream `public/audio/Background-Christmas.mp3` through the music bus; pause it for countdown/gameplay and previews, preserving its position and existing mute/ownership settings.
Menu tracks reuse one gesture-authorized media element and retain separate playback positions to support first-entry playback on tablets.
The illustrated instructions screen streams `game-instructions.mp3` instead; pause the previous track before switching and preserve each track's position.
Post-game podiums play `podium-winner.mp3` once per round before menu music resumes; preserve deduplication across redraws and cancel the cue on navigation, mute, or interruption.
Enabled menu buttons use the cached `Button-Press.mp3` effect; the three gameplay buttons and their keyboard shortcuts use `Punch-button.mp3` (Jump uses supplied `bounce.mp3`) once through the shared tap handler, preserving game-specific sound cues.
`src/backgrounds.css` maps all non-Fireworks arenas to their optimized illustrated environments.
Set-based games briefly overlay a yellow circle or red cross across 90% of the lane width, centered in the player panel, and use `wrong.mp3` for failed sets; Perm judges at phrase settlement, not individual notes; Mistake feedback lasts 260 ms, and shared Dice/Facing/Kaya reveal symbols only at the answer deadline.
`src/feedback.js` owns bounded local success and finish effects; keep decorative particles off reaction targets, cancel effects across round/lifecycle changes, and honor reduced motion.
The original disco score and synthesis live in `scripts/audio/`; regenerate `public/audio/` with `npm run audio:render` after changing them.
Facial Slot Machine's original carousel-funk score and match cues live in `scripts/audio/slots.js`, using the existing mix and lifecycle controls.
Decode audio banks per game and schedule Perm Mania demonstrations from the same frozen clock mapping as its visual guide.
Scale Perm music playback, demonstrations, visual beats, and judgment windows together with the round tempo; preserve musical phase when resuming audio.
Freeze any per-device rhythm timing adjustment when scheduling the round; muted play must remain possible with the visual guide.
Sound and music start enabled on every device after a user gesture; fresh guests default to 20% music and 70% effects, preserving saved personal overrides and playback phase.
Results may stop music and countdown cues, but must not truncate an accepted local finish cue.

`shared/dynamite.js` owns 13 seeded colour groups of four sections, a 40 ms input guard, 250 ms wrong-colour recovery, and a 45-second elapsed-time race.
`src/dynamite-view.js` uses a paused, locally clocked GSAP tween to smoothly scroll the continuous segmented wire while the spark descends; loop `electrical-buzz.mp3` only for the active local spark, stop it on finish/interruption, and preserve `dynamite-explode.mp3` in a dedicated finish group through results, defer podium audio until it ends, and duck music during the explosion.
`shared/meals.js` owns eight seeded fries/burger/drink orders; independent 300 ms drops fill required slots, taps on a full column play Wrong without altering the meal, each completed meal plays Ding once, and final elapsed time includes the last landing.
`src/meals-view.js` shows empty slots and falling items; presses use `plop.mp3`, and both new games show accepted clear times at the top of each player's column.
Every registered game is available in Arcade, Game Select, and Party.
The handshake requires `dynamite-meals` alongside existing capabilities.

## Timing invariants

- Measure local input with `performance.now()` and freeze the server-clock mapping when a round is scheduled.
- Rank elapsed durations, never packet arrival order.
- Cosmetic progress is throttled to at most 4 Hz per player and must never block local inputs.
- Treat result submissions as idempotent, acknowledge them, and persist pending submissions across reconnects.
- Keep reconnect tokens private; exclude them from broadcasts, invitations, and reports.
- Disconnection reserves the seat for 30 seconds with a visible countdown, then removes the player and preserves accepted results while forfeiting unfinished play.
A replacement can join an expired seat during a set, choose a character, and enter the next round with separate scores.
Hiding or reloading the active game still forfeits.
- Wait up to 15 seconds for disconnected players at a Ready gate, then allow ready connected players to continue; never skip a connected unready player.
- Clock uncertainty and GO render delay do not prove physical display synchronization.

Keep the static frontend independently deployable with a configurable secure WebSocket endpoint.

Live Perm Watch cues use `perm-beat.mp3`; player presses use `hit-red.wav`, `hit-green.wav`, or `hit-blue.wav` for the actual button color.
Preserve the shared rhythm clock, phase and timing offset, and never layer Punch or the removed piano files.
Dice result circles remain visible in each player’s score box for 650 ms alongside one Ding per correct set, even when the next fast throw has begun.

Arcade uses 15 Me Find Mistake boards with a 45-second deadline, eight Facing Which Way sets with a derived 71.2-second schedule, and ten Fireworks sets with a 60-second deadline.
Game Select retains its existing board/set counts and timing; extra Arcade Fireworks sets reuse the final five-rocket pattern, and run models must honor `round.goal`.
Facing instructions and the match HUD derive their set counts from the scheduled round.

Get Those Burgers Out! accepts repeated presses while the same item is falling: each press reserves its own empty slot and launches an independent 300 ms drop.
Keep up to nine bounded per-slot timestamps in visual snapshots, map them between viewer clocks, and derive completion from the final scheduled landing; taps beyond filled or reserved requirements still play Wrong.

Totem Shrinker, Dodge or Die, and Mimicking Monkeys hide their bottom counters, progress bars, and decorative bases during gameplay so the active scene fills the available player-panel height.
Shared Facing/Dice layouts explicitly place their heading, demonstration, options, and scores in grid rows; the scores stay in the final bottom row even while options are hidden.

`shared/characters.js` defines sixteen generated player characters; fresh create/join clients choose one before mode selection, and the server validates and preserves `characterId` across reconnects and set standings.
Each character can belong to one current room member, including disconnected members whose seats are reserved.
`src/characters.js` and `src/characters.css` own the character grid; use the chosen portraits in lobby seats and podiums, keeping minigame protagonist art unchanged.
Coins requires 36 catches and resolves the earliest outstanding pair on a fixed spawn schedule with no recovery pause, renders up to three overlapping pairs, and derives an immutable per-pair schedule from round start and index so remote snapshots cannot resize or restart the rain.
Coins and Slots fill fixed-size player-panel containers; never let reel contents, completion state or cached previous-round sizes determine panel height, and reset slot portrait caches on round changes.

Party mode gives every rostered player 30 seconds to lock one game; the server assigns random games at the deadline and plays all picks in player order, including duplicates.
`src/party-picker.js` and `src/party-picker.css` own four fixed player columns, grey inactive seats, looping three-copy lists, GSAP lock sparkles, shared three-button controls, reduced motion, and viewport fit.
Recenter Party list copies without changing the visible offset; retain a 900 ms server-owned all-locked hold so the final sparkle burst finishes before instructions.
Party locks use `Ding.mp3` once per newly observed choice; skip stale reconnect cues and preserve the last lock cue across the transition to instructions.
Party Continue requires all connected players and waits 15 seconds for disconnected friends; retain cumulative points, first-place win counts, and history across cycles, validating set ID and cycle on pick/continue commands.
Arcade length is host-only and immutable during a set; the range maximum comes from the shared game registry.
Keep small arena completion overlays explicitly dark on a solid light panel so themed arena colors cannot hide Cleared text.

Invitation URLs with a valid room code disable Create room and permit joining only.
Facing cards and options stay square within available arena space, and covered-card mirror parity persists between turns and through reveal.

Totem Shrinker instructions use `src/totem-demo.js` and the shared `src/instruction-demo.css`: a real-art five-block lane beside two rules and the shared three-color controls.
The demo clears green, blue, then red in a loop, synchronizes the illustrated cat paw and matching `hit-green.wav` / `hit-blue.wav` / `hit-red.wav` cue with each press, pauses while hidden or in a dialog, and uses discrete state changes under reduced motion.
Reuse each implemented demo in its rules dialog; games awaiting conversion retain their illustrated instructions.

All new or revised How to play screens use a looping mini-demo: actual gameplay artwork on the left, concise action instructions and the shared three buttons on the right, with the existing illustrated cat paw and synchronized feedback.
`src/instruction-demo.js` and `src/instruction-demo.css` own the shared layout; `src/game-demo.js` selects each game’s demo.
Perm Mania hides its bottom growth counter and progress bar; its tutorial uses one real seeded phrase at the scheduled tempo, copies it with colored hit sounds, grows hair once, then loops.
Perm tutorial Watch cues reuse `perm-beat.mp3`, response presses use `hit-red.wav` / `hit-green.wav` / `hit-blue.wav`, and the completed set uses Ding; live Watch cues keep the Perm beat while player presses use their matching colored hit.

Perm Mania’s tutorial presses green for every response beat; the instructions still explain that any button works.
Facial Slot Machine, Fireworks Craze, and Mimicking Monkeys use the common looping tutorial layout with their real run models and scene renderers.
`src/scripted-demo.js` owns their bounded input/cue timelines and hidden-screen pause; keep tutorial simulations isolated from real rounds and skip stale sounds.
Slots demonstrates all three row locks, Fireworks demonstrates the first three-rocket set with one rocket of each color, and Monkeys watches and copies one two-color sequence.

Every registered game has an animated How to play demo with the shared cat-paw artwork.
`src/remaining-demos.js` owns the remaining ten isolated examples and their real scene renderers; short jump/wire examples demonstrate progress without pretending to finish the full game.
Monkeys shows generated red-apple, green-pear, and blue-ball holding poses for the current cue, with a smaller centered character and no corner symbols; neutral poses during gaps must not reveal a future item.
Optimize only selected new image names when appropriate with `python scripts/optimize-images.py NAME...`, retaining new masters and prompts while avoiding unrelated asset changes.

Burger Girl serves five four-layer burgers; launch layers 56% of a fall apart within a burger, pause 700 ms between burgers, and reduce fall duration by 7% of the initial duration per served burger.
On a miss, retain caught layers and restart the missing ingredient and approaching layers after 300 ms; publish the same deterministic overlapping drops remotely.
Each served burger emits one stage-completion Ding and the common large yellow circle, including the final burger.
Shared Dice throws use the round clock for a 260 ms aerial tumble and 120 ms landing bounce with a shadow; preserve answer windows and show settled dice under reduced motion.

Dodge instructions say “Move into gaps between walls. Red - Move left. Blue - Move right” and separately explain green jumping; omit lane symbols beneath the fox in both gameplay and its shared tutorial scene.

Keep the Type in Letters tutorial alphabet in the same single 27-key row as gameplay.
Dynamite wire previews must use the shared seeded sequence even without a player run or remote snapshot; never substitute alternating placeholder colors.

`shared/kaya.js` owns Where’s Kaya’s eight seeded shared sets with 2–9 swaps, 900–145 ms initial-difficulty shuffle times, and 1.5-second private answer windows.
`src/kaya-view.js` renders one dog, two copies of the same kitten, and three copies of the same opaque blanket; animate swaps from the shared round clock and never expose the dog during covered phases.
Use supplied `card-move.mp3` once per shuffle with the common bounded cue scheduler; score and reveal through `ChoiceMatch`, with one Ding and the common large result circle for each correct player.
Kaya is in Arcade, Game Select, Party, and the animated cat-paw tutorial catalog; reduced motion removes the crossing arcs while preserving the essential horizontal tracking movement.
The handshake and health endpoint report protocol 43 with `kaya-shuffle`, `happy-days`, and `desk-clock`; deploy frontend and backend together.

`shared/happy.js` owns Happy Days’ seeded 57-note arrangements on the supplied recording’s 145 BPM grid, 17 hold notes, and 30-second duration.
Judge both press and release edges at ±55 ms for Perfect (1000 points) and ±140 ms for Good (500 points); a failed edge scores zero for that note, and holding early never collects future notes.
`src/held-input.js` merges independent pointer and keyboard sources per color; clear them on cancellation, focus loss, dialogs, and round changes without auto-repeating rhythm inputs.
`src/happy-view.js` renders three falling-note columns per player, glowing accepted notes and shrinking held tails; peer snapshots carry bounded note judgments, pressed masks, timing offsets, and scores without advancing gameplay.
Happy Days plays the first 30 seconds of supplied `happy-days-music.mp3` once, preserving its song position across mute without an urgency layer; reuse the three fixed-pitch colored hit samples at reduced level without ducking the song on each note.
Accuracy points determine placement independently of elapsed time or hit count; the server accepts only a full-duration result with consistent note totals and bounded 500-point score steps.
The Happy Days cat-paw tutorial includes release events and keeps the paw down through a hold; preserve existing tap-only tutorials when extending the shared demo runner.

Happy Days must render the same chart on the frozen round clock before GO and before a peer’s first snapshot, preserving negative countdown elapsed time instead of drawing time-zero placeholders.

`shared/stationery.js` schedules four seeded shared desks with 1–6 of each item and 8/7.4/6.8/6.2-second count windows.
The stage generator follows the room's published goal, including six-set rounds scheduled by older servers.
Red/green/blue increment pencil/eraser/sharpener counters from zero through six, wrapping back to zero; all three exact counts earn one point at settlement.
Validate monotonic bounded action proofs and acknowledge their revision so stale acknowledgements cannot discard newer counter updates; allow 500 ms transport grace and reveal targets only after settlement.
`shared/clock.js` owns ten shared clock sets, targeting hours 1–10 with constant per-set revolutions decreasing from 1200 to 500 ms.
Accept any button between half and one-and-a-half revolutions and award points only within 8% of a full revolution from the target.
Rank qualifying stops by absolute local error, sharing ties and awarding 10/7/4/1 points independently of packet arrival order.
`shared/shared-match.js` selects the authoritative match model; `src/desk-clock-view.js` renders the common desk, fixed four player counters, and individually stopped clocks using the same scene in cat-paw tutorials.
Both new games use supplied Punch/Ding/Wrong cues, original optimized art, and the common three controls; Clock results display points rather than correct-set counts.

Stationery uses the cluttered desk backdrop without baked-in pencils, erasers, or sharpeners; preserve exact countability of runtime objects.
Keep all four player columns visible in Stationery and Clock gameplay, including grey Open spot placeholders; only isolated tutorials omit empty seats.
Stationery proofs remain bounded by the window and 40 ms per-color input guard, allowing repeat counter cycles beyond 27 presses.
Use the supplied `stationery-master-voice.mp3` and `clock-stopper-voice.mp3` through the shared game announcement bank.

Every gameplay player column ends with the compact `src/player-footer.js` identity row using the chosen character and name; replace duplicate top labels to preserve vertical space, and keep empty-seat labels visible.
Use gold and a visible You label to distinguish the local column in gameplay and Party selection.
Stationery begins each set with a two-second GSAP throw sequence, seeking a paused timeline from shared elapsed time with 80 ms launches and 500 ms flights.
Counting opens only after all items land.
Reduced motion shows each landed item without flight, and round changes or navigation kill the old timeline; the tutorial uses the same renderer and input gates.

`shared/ladder.js` owns ten seeded ladders with 3–6 rungs each, changing left/middle/right positions, a 100 ms step guard, 250 ms wrong-position recovery, and 180 ms ladder handoffs.
Red/green/blue climb left/middle/right one rung per press; preserve completed rungs after a miss and rank final trophy arrival time within the 45-second deadline.
`src/ladder-view.js` scrolls the illustrated course and worker from local or published progress with paused GSAP tweens; retain compact player footers and omit progress counters.
Each accepted rung uses supplied `Diuup.mp3`; each completed ladder uses one Ding, including the final trophy arrival, which also plays `get-trophy.mp3` and `applause.mp3` together in the preserved finish group.
The cat-paw tutorial demonstrates two ladders using the real course and renderer; the new game joins Arcade, Game Select, and Party immediately.

Ladder positions share the player lane with roughly half-width overlap; keep worker and trophy centers aligned to the same left/middle/right mapping.
Alternate the rear climbing sprite’s reach on accepted-rung parity, reset its orientation for celebration, and deduplicate both trophy finish sounds by round ID.

Kaya and Clock gameplay hide both the shared heading row and match HUD, including answer/round timers; retain countdown overlays and player results.
Type in Letters uses chosen-avatar pointers outside the keys: seats 1 and 3 point down from two upper tiers, seats 2 and 4 point up from two lower tiers, avoiding collisions when cursors coincide.
Happy Days derives each chart from the shared round seed, varying lanes, odd-beat rests, and one/two-beat holds while retaining the music grid, 57 notes, 17 holds, judgment gaps, and equal maximum scores.
Use the same seed in local runs, remote pre-snapshot previews, and tutorials; never regenerate charts independently per player.

Kaya’s grid overrides must outrank both generic shared-choice and tutorial styles, regardless of stylesheet import order; retain explicitly square animal/blanket containers.
Clock and Stationery tutorials use their scene renderer’s result circle; suppress the generic demo completion overlay to avoid duplicate feedback.

Star Collector varies seeded bar lengths (94–226), vertical gaps (80–165), and floating/surface star placements throughout its course.
Generate exactly 64 stars from a continuous 44-second reference drive using the same movement integrator as live play, so one valid route collects every star before the deadline.
Preserve 64 bars, floating placements, wall clearance, and 40-unit star separation; all players, previews, tutorials, and server replays share the same layout.
Star Collector uses `shared/stars.js` for the seeded alternating-shelf course, fixed 120 Hz tilt physics, unique star pickups, and replay-validated 45-second scores.
Hold red/blue to tilt left/right, release to level with momentum, and keep green unused in the shared three-button bar.
`src/stars-view.js` rotates each maze and follows its car; peer smoothing must never run physics or award pickups.
Use supplied `car-bump.mp3` once per distinct impact and `Ding.mp3` once per star, preserving collected stars after collisions.
The catalog, looping cat-paw demo, illustrated assets, and supplied `star-collector-voice.mp3` cover all three set modes.
The protocol 43 handshake requires `star-collector`; deploy frontend and backend together.

Horse Speeder uses `shared/horse.js` for a 3200-unit race, 120 Hz speed/distance simulation, seeded moving traffic, and validated finish proofs within a 60-second deadline.
Red/blue move left/right in 180 ms; green taps add speed with a 100 ms guard, coasting slows down, and bumps reduce speed without losing distance or blocking steering.
Keep a safe lane in every traffic row and enough maximum-speed spacing for two lane changes plus reaction time; Game Select narrows row spacing from 140 to 120 across its three rounds.
`src/horse-view.js` renders bounded perspective traffic, rear-view gallop poses, the finish banner, and accepted clear times; keep gameplay free of speedometers, counters, and progress bars.
Overtakes and the finish use Ding, every gameplay/tutorial press uses `horse-gallop.mp3`, and horse collisions use `Punch-button.mp3`; the supplied `horse-speeder-voice.mp3` announces selection, and future horse-specific sounds must also be supplied.
Protocol 43 requires `horse-speeder`, and bounded result proofs fit the 16 KiB WebSocket limit; deploy frontend and backend together.

Shark Jumper uses `shared/shark.js` for a seeded color-matching zigzag climb: press the next shark’s color, jump for 240 ms, and turn it grey only after landing.
The protagonist is a cute puppy; wrong colors cause a fall and one-second climb-back onto the last safe shark without losing completed jumps.
Use `plop.mp3` once at jump takeoff and `shark-splash.mp3` once at the 220 ms water impact; use Ding only for the full completed path.
`src/shark-view.js` keeps eight bounded shark slots, authored jump/fall/climb motion, discrete reduced-motion states, and published remote timing without advancing peer gameplay.
Start Arcade with 30 sharks and Game Select with 30/40/50 across its rounds; rank the final scheduled landing within 45 seconds and validate bounded jump histories on the server.
Include the real recovery in the cat-paw tutorial; keep the common controls and omit gameplay counters and progress bars.
Protocol 43 requires `shark-jumper`; deploy frontend and backend together.

`src/result-message.js` builds the actual client finish payload and includes any run-owned replay proof automatically; exercise this builder in Shark Jumper server and WebSocket regression tests.
Shark Jumper masks submerged sprite pixels using the wave alpha, then displays only a feathered foam crest; never overlay opaque rectangular water strips or leave body parts visible below the waterline.
Keep the puppy above water layers and share wave occlusion across gameplay, tutorials, grey sharks, and posters; Shark jump presses use Plop alone without Punch.

Horse impacts publish the struck lane in feedback; `src/horse-view.js` seeks a bounded backward recoil and separates/fades that opponent to avoid visual pass-through.
Keep recoil cosmetic, preserve distance and steering, reset by round, and honor reduced motion on local and peer scenes.

Stationery server tests must set fake packet receipt after the final submitted action; a fixed three-second offset rejects valid larger seeded desks as future input.
When checking releases, verify the GitHub Pages workflow and public frontend assets separately from Render’s room-service deployment.

Shark sprite size is bounded by panel width and height; use `test/fixtures/shark-visual.html` under Vite to check desktop, narrow-phone, and wide layouts with the real renderer.
Fireworks shows only its in-scene Set label, derived from `round.goal`; hide the redundant bottom counter and progress bar.

## Witch’s Special Delivery

Use `shared/witch.js` for local inputs and server replay; freeze the round clock mapping across all player turns.
`server/witch-turns.js` owns active-player identity, per-turn start/deadline, append-only proof validation, and the transformation hold.
Only the active player accepts inputs or submits a result; duplicate accepted results acknowledge without advancing or awarding twice.
Scores count frogs passed, excluding the transformed landing frog; equal counts share placement.
Use a 540-unit runway and quadratic speed growth from the total accepted alternating press count, with no decay or speed cap.
The first accepted press starts movement at 16 units/s; `witchTravelPace` retains twice the numeric speed up to speed 40, then smoothly approaches 140 units/s.
The soft limit applies only to runway travel: the speed badge, tap growth, and launch velocity retain the uncapped quadratic value.
Keep the running camera scale unchanged; local runs, spectator projections, tutorials, and replay validation share the same travel curve.
A near-edge speed-120 throw at 45° reaches about 80 frogs; leave headroom above that target.
Green instantly stops translation and freezes speed before the edge; aim starts immediately and launches only on an explicit green release.
Clear merged pointer/keyboard holds on cancellation; dialog/focus cancellation cancels the hold without throwing.
Display the requested speed, angle, and four-player frog scores; keep controls shared and stationary.
Spectator rendering uses isolated cosmetic copies and never changes an authoritative run or awards results.
Size the transformed prince to the scene and center him on the landing frog, even when a high throw zooms the camera out.
Use the same real model and artwork in the looping cat-paw tutorial.
Artwork masters and prompts live in `archive/artwork/`; delivered images total approximately 381 KB.
The protocol 46 handshake requires `witch-turns`, `witch-instant-aim`, `witch-cumulative-speed`, and `witch-power-curve`; deploy frontend and backend together.

## Open Sesame

`shared/sesame.js` owns the seeded eight-digit code, wrapping rotary cursor, 40 ms input guard, and 30-second deadline.
Accept the next digit only and preserve the correct prefix on a mistake.
Rank completed codes by replay-verified elapsed time, with the common placement points and ties.
Keep the dial shared in layout but local in control, and show all four player identities and accepted times on narrow screens.
Use the live dial renderer in the isolated cat-paw tutorial, supplied Diuup for presses, Wrong for misses, and one Ding for the completed code.
Deploy the frontend and backend together with protocol 43 and the `open-sesame` capability.

## Burst the Balloon

`shared/balloon.js` owns 60 alternating red and blue presses, the 40 ms minimum gap between accepted inputs, the 25-second deadline, and the finish proof.
Either pump button can start and repeating one has no effect on inflation or timing.
Publish cosmetic inflation at no more than 4 Hz and show a pop only after completion.
The server acknowledges a valid finish immediately and holds the last pop for 550 ms before settling standings.
Center the POP label and burst particles over the balloon at every lane width.
Use the shared control deck with green disabled and supplied Diuup for accepted pumps.
Play `balloon-burst.mp3` with one Ding at the burst.
Use the live balloon renderer in the isolated cat-paw tutorial and retain discrete growth and the pop label under reduced motion.
Deploy frontend and backend together with protocol 43 and the `burst-the-balloon` capability.

## Satay Snag, Glamour Brew, and Ant Air Mail

`shared/market-games.js` owns the seeded challenges and replays integer-microsecond input histories on the server.
Satay accepts one press per sausage within an inclusive catch window of ±50 ms at base difficulty, narrowing by 7 ms per level.
Base drops reach the skewer in 690–870 ms, and each round requires ten catches within 30 seconds.
Advance unattended drops from their scheduled deadlines, preserve completed catches on a miss, and keep the visual catch at the skewer height.
Glamour Brew presents two seeded stacks of distinct colors per set and removes exactly one matching potion on each accepted press.
Advance one illustrated look after each of ten cleared sets, and keep the 440 ms makeover and refill gate independent of the 420 ms wrong-button recovery.
Ant Air Mail follows one paper courier through a seeded path of twelve legs, avoiding retraced waypoints.
Pan, widen the camera, and shrink the plane continuously during each 480 ms leg before settling its next heading at the waypoint.
Keep the final silhouette readable in a narrow lane, and use discrete waypoint poses in reduced motion.
Use one Ding for each catch, cleared potion set, and correctly chosen flight leg, including the final success.
The room acknowledges finishes immediately and shows the last animation for 550 ms before standings.
Peer snapshots render only the published attempt, stacks, or flight leg and never advance another player’s game.
The protocol 43 handshake requires `satay-snag`, `glamour-brew`, and `ant-air-mail`.

## Dam Good Fit, Sushi Switchboard, and Mole Metro

`shared/workshop-games.js` owns the seeded puzzles, menus, orders, and train schedules.
Dam Good Fit uses the shared-choice clock and server-owned first-answer locks for eight puzzles.
Its choice presses and tutorial step cues use the existing `Button-Press.mp3` click instead of `Punch-button.mp3`; success and failure cues remain separate.
Shorten each answer window by 470 ms, and reveal choices only after the deadline and transport grace.
Award one repair per correct choice and animate the plug and splash from the scheduled reveal.
Sushi Switchboard places every menu item in exactly one bucket and accepts two items in either order, including repeated colors.
Each of ten tickets has one attempt: a wrong press fails the entire order, including partial service, and never awards a point or retries that order.
After success or failure, hold feedback for 550 ms, then allow 250 ms to read the next ticket before accepting input.
Rank correctly served orders without a speed tiebreak; retain earned orders at the 36-second deadline and replay-validate both early and deadline finishes.
Publish the ticket index separately from correct orders, and retain the resolved ticket mask for peer feedback.
Use clock-driven GSAP easing for food pops, customer reactions, and ticket handoffs; reduced motion retains static result colors and symbols.
Play one Ding per correct order, including the last, and Wrong for a failed final ticket without an extra finish Ding.
Mole Metro latches a route at each junction before processing inputs at that same timestamp.
Trains earn three passengers at their pictured station if it is empty, and any non-crashed arrival occupies its station for 2,750 ms.
The seeded schedule avoids adjacent identical destinations, so a perfect run is possible even at the tightest headway.
The server replays bounded input histories and ranks Metro by passenger count at the round deadline.
Keep the Sushi Switchboard menu above four equal lanes and show each customer’s order in their speech bubble.
`src/workshop-view.js` draws both live lanes and isolated looping tutorials, and visual projections use only published train routes and outcomes.
Use Ding once per correctly chosen repair, served order, and successful arrival, with no extra Ding when the Metro timer expires.
Deploy frontend and backend together with protocol 44 and the `dam-good-fit`, `sushi-switchboard`, and `mole-metro` capabilities.
Protocol 44 separates Sushi’s attempted tickets from its score and rejects clients using the former retry rules.
