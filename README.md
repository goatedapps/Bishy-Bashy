# Bishy Bashy

A four-player browser party game with Totem Shrinker, Perm Mania, Facial Slot Machine, Fireworks Craze, Mimicking Monkeys, Jump for the Meat, Burger Girl, Me Find Mistake, Dice, Dice, More Dice, Facing Which Way, It's Raining Coins, Dodge or Die!!, and Type in Letters.
Everyone sees all four players and controls only their own player.
The static website runs on GitHub Pages; a separate Node WebSocket server coordinates rooms and results.

- [Play](https://goatedapps.github.io/Bishy-Bashy/)
- [Multiplayer server health](https://bishy-bashy-server.onrender.com/health)
- [Approved visual mockup](mockups/totem-shrinker.html)

## Choose a mode

Create a room, share its QR code or invitation link, and join from up to four phones or tablets.
The landing screen only asks for your name and offers **Create room** or **Join room** with a room code.
The illustrated yellow homepage pairs a large Bishy Bashy! title with the create/join panel, and its question-mark button introduces the multiplayer mini-games and room-code setup across devices.
The homepage uses GSAP for a short title/panel entrance and a dinosaur companion greeting, with occasional idle movement that pauses while typing, in dialogs, or while the page is hidden.
The two upper sky stars wiggle continuously in opposite directions, including while typing, and pause in dialogs or when hidden.
Reduced-motion preferences show the settled homepage immediately, and leaving the homepage clears its animations.
After creating or joining a room, choose a mode on the room screen.
The lobby uses animated arcade-cabinet and fanned-card mode illustrations, chasing lights, drifting shapes, and four mascot seats with staggered squash-and-stretch dances and join bursts.
`src/lobby-motion.js` and `src/lobby.css` keep text and controls stationary, pause decorations while hidden or in dialogs, honor reduced motion, and clear lobby animations before a set starts.
Game Select opens a separate **Choose a game** screen after **Start set**; **Play selected game** confirms the centered poster.
The horizontal illustrated poster carousel loops in both directions with touch scrolling, mouse dragging, snapping, arrow and keyboard controls, and title search.
The host's centered poster selects the game after scrolling settles; guests follow the shared selection and cannot move the carousel.
The selected character dances inside its yellow frame, while neighboring posters stay smaller and tilted; reduced motion keeps the artwork still and makes centering immediate.
Choose **Arcade** for five different games selected at random, played once each in a random order.
Selecting Arcade keeps everyone in the room lobby; once friends have joined, the host taps **Start set** to start the single reel.
Before each Arcade game, the reel spins for 4.7 seconds and lands on the same server-chosen game on every device.
With sound enabled, `roulette.mp3` loops during the spin; `Game-select.mp3`, the selected game's voice clip, and `applause.mp3` play together once on landing.
`scripts/audio/arcade.js` maps the supplied voice filenames, including `me-find-mistake.mp3`, and the startup loader caches them before play.
The selected game stays visible for two seconds before How to play; there is no separate Spin button.
The five-game plan has no repeats, and repeated starts or reconnects do not reroll it.
Choose **Game Select** for three rounds of one game, with difficulty increasing each round.
Only the host can change the mode or chosen game after joining.
The host can use **Back to modes** to keep everyone in the same room and choose again.
Before the first countdown this returns immediately; during an active round or an unfinished set with scores, confirmation explains that the current set and scores will be cleared for everyone.
Rules screens include visual examples using the same artwork and color/shape controls as the game.
The instructions card pauses for 1.4 seconds after its playful “How to play” heading, then reveals the illustration after 700 ms and short instruction lines at 850 ms intervals.
Rules use only as many points as the game needs.
It uses `public/audio/how-to-play.wav` for the heading and `public/audio/Punch-button.mp3` for the illustration and each rule when effects are enabled.
Ready becomes available once the final line is visible; redraws do not restart the sequence, and reduced-motion settings remove the entrance animation.
**Leave** stays available during play and asks for confirmation before leaving an active set.
Leaving forfeits only an unfinished round; an already accepted finish and previously earned points remain credited, and the other players can continue.
Changing the setup resets everyone's Ready state; setup stays locked throughout the full set.
In Game Select, the host taps **Start set** to show the game's instructions, with no more than three points.
After clock synchronization, every connected player taps **Ready** on that screen before the shared three-second countdown can begin.
In Arcade, each completed game shows a cumulative podium for five seconds, followed by a fresh reel spin, the next game's instructions, and an all-player Ready gate.
In Game Select, instructions appear only once; subsequent rounds use a Ready button on the podium screen instead of repeating them.
Game Select intermissions last at least five seconds and wait until every connected player is ready.
Players may toggle readiness off again before the countdown starts.

Each round awards **10 / 7 / 4 / 1 set points** by placement.
Ties share placement points and skip the following occupied places: two tied first-place players earn 10 each, and the next player earns 4 for third.
Unfinished rounds, forfeits, missing results, and Perm rounds with zero rhythm score earn zero set points.
Final standings keep mode and game selection hidden and show an **Exit** button to every connected player.
Exit returns everyone to mode selection together; stale exits and attempts to exit an unfinished set are ignored.
The highest accumulated total wins the set; equal highest totals share victory, and a set with no points has no winner.
Final standings include a round-by-round points table.
Every transition and final screen restores a first/second/third podium using cumulative placement and total points.
The accompanying Last game column shows each player's most recent performance and the set points earned in that round.
The server awards points once per round and retains earned points if a player leaves between rounds.
New guests can join only after the full set ends; original players can reconnect during it.
The Arcade length and Game Select round count live in `shared/sets.js`, and new games join the shared catalog in `shared/games.js`.
The catalog currently contains thirteen games, all available in Game Select.
Arcade expands only at four-game milestones: it now selects five distinct games from twelve, adding the next batch when the catalog reaches sixteen.
`arcadeGameIds()` in `shared/sets.js` supplies the same eligible pool to server selection and the reel, so a spin cannot land on an omitted game.

## Play Totem Shrinker

Match the bottom block using red circle, green triangle, or blue diamond.
The controls also accept **1 / 2 / 3** or **J / K / L** on a keyboard.
Each correct tap clears one block immediately on that device.
Only the next five blocks are displayed, with the next block at the bottom.
All players receive the same seeded block sequence.
A wrong tap freezes that player's inputs for 300 milliseconds.
The first player to clear the tower wins, ranked by locally measured elapsed time.
Arcade uses 30 blocks; Game Select uses **30, 40, and 50 blocks** across its three rounds.
The round ends after 45 seconds; unfinished players time out.
Base gameplay settings live in `shared/totem.js`; difficulty settings live in `shared/games.js`.

Switching apps, hiding the tab, or reloading during a round forfeits that round.
A network disconnection alone does not forfeit: local play continues and a saved result retries after reconnecting.
The server accepts submissions for ten seconds after the round deadline.
Ready gates wait up to 15 seconds for a disconnected player to return, then may continue with ready connected players.
Skipped disconnected players earn zero for that round and may return for the next one.
Connected players are never skipped because they have not clicked Ready or their clock measurements need refreshing.
If no connected players remain, the set waits for one to return.
The disconnected player's slot remains reserved, and they can play the next round after returning.
Hosting moves to a connected player if the host disconnects.

Sound is optional and off by default.
Use the music-note button to enable music and effects, and the gear button for separate volume controls and a sound preview.
All essential cues also appear visually.
Enabled menu buttons play the user-supplied `public/audio/Button-Press.mp3` once per activation through the existing effects volume and mute controls.
The three gameplay buttons and their keyboard shortcuts play `public/audio/Punch-button.mp3` once per enabled press (Jump uses the supplied `public/audio/bounce.mp3` instead), alongside the game's success and mistake cues.
Fireworks Craze loads `public/audio/Fireworks.mp3` for each local rocket launch, including retries, without playing sounds for remote player rockets or replaying launches missed while muted or interrupted.
Local successes use brief, proportional feedback: colored chips for cleared Totem blocks, dancer pops and growth bursts in Perm Mania, matched reel badge pops in Slots, and copied-move dots and stage bursts in Monkeys.
Fireworks retain their expanding bursts with an impact ring, while Jump retains its boost sparks and squash-and-stretch with rising landing feedback.
Finishes receive a larger lane-local burst; feedback never moves reaction targets, changes timing windows, or blocks input, and optional motion follows the device's reduced-motion preference.
Physical phone audio and touch latency still need playtesting.

## Music and sound

Menus, game selection, intermissions, and standings loop the user-supplied `public/audio/Background-ActionRock.mp3` through the existing music volume and mute controls.
The illustrated instructions screen uses `public/audio/game-instructions.mp3` instead, with each track retaining its playback position when paused.
The instructions track has a +6 dB playback boost through the existing music volume control to compensate for its softer recording.
Both tracks play after a user gesture and pause for the round countdown and gameplay, with Action Rock returning on transition screens after the podium cue.
The same one-device-per-room policy and personal music overrides apply; hiding the page or previewing gameplay sounds pauses menu music.
Each post-game podium plays `public/audio/podium-winner.mp3` once through the effects controls before background music resumes, including the final set podium.
Repeated score updates do not restart the podium cue, and leaving the podium or muting cancels it without replaying it later.

The original soundtrack is a 128 BPM funky disco arcade loop, with an octave bass groove, four-on-the-floor drums, electric-piano-style chord stabs, and a bright melody.
An additional percussion and melody layer enters on a beat near the final ten seconds.
Correct taps have three wooden pop tones corresponding to the block colors; a wrong tap produces a springy falling sound.
Countdown, GO, finish, and timeout each have a distinct cue.
The countdown plays the user-supplied `public/audio/countdown.mp3` once across the three-second countdown, preserving its final beat and decay after GO without layering the old GO cue; rejoining audio mid-countdown skips to the current position rather than replaying it.

Music defaults to **One device per room**, using the first participant in that round's fixed player list.
Other players can enable effects without duplicating the room music.
Choose **This device** for personal music playback, such as headphones, or **Off** to keep effects only.
The music continues while that player waits after finishing, then stops when the room reaches results or the round deadline.
Network disconnection does not stop local audio; hiding the game, muting it, leaving, and forfeiting cancel scheduled playback.
The finish cue is allowed to ring through a results-screen transition.

Decoded sounds are cached and scheduled on the Web Audio clock from the agreed local start.
Enabling sound or returning from an audio interruption joins the current musical position and skips old countdown cues.
Sound loading and playback never gate gameplay or the result submission path.
Effects duck the music briefly, independent category gains control the balance, and a master limiter provides additional headroom.
Transient effects are capped at eight voices; the music uses two looping buffers.

Each game's mono WAV bank totals less than 2.5 MB and decodes only after sound is enabled for that game.
The normal and urgency loops each last 15 seconds at 32 kHz, with equal sample counts for phase alignment.
The gameplay score and synthesis are in `scripts/audio/` and use no third-party recordings or music services.
Regenerate the runtime files and their numerical analysis with:

```sh
npm run audio:render
```

These signal and lifecycle checks do not establish subjective sound quality or physical speaker latency.
Listen on target phones, headphones, and speakers to tune the final balance.

## Play Perm Mania

Choose **Game Select → Perm Mania** before creating a room, or let the host choose it before starting a set.
Arcade can also select Perm Mania randomly.
Every player receives the same eight seeded rhythm phrases.
Arcade uses 128 BPM; Game Select increases to **128, 136, and 144 BPM**.
Each phrase demonstrates four beats, then asks the player to repeat that rhythm over four beats.
Tap any colored button, **1 / 2 / 3**, or **J / K / L** in time with the notes.
Watching taps do not score; missing notes and extra response taps count as mistakes.
A phrase with at most one mistake grows the dancer's hair by one stage.
The round lasts eight complete phrases: 30 seconds at 128 BPM, down to about 26.7 seconds at the third round's 144 BPM.
The final result is submitted locally at that exact round duration.
Rankings use hair growth first and timing score second, with exact ties sharing a rank.
Completed rhythm rounds outrank forfeits and missing results; completion packet arrival order does not affect ranking.

The initial hit window is ±140 ms, with **Perfect** feedback within 55 ms.
These windows shrink proportionally with the higher tempo, and backing music, demonstrations, and visual beats speed up together.
Accurate hits award up to 1,000 rhythm-score points each; stray response taps subtract 250 without reducing that score below zero.
Rhythm score determines round placement after hair growth; placement then awards the shared set points.
An 80 ms input guard ignores simultaneous keys or accidental double input, while repeated mashing still fails phrases.
These are provisional casual-play settings, rather than a certified rhythm-game timing tolerance.
The **Rhythm timing** setting ranges from −150 to +150 ms and freezes when the local round is scheduled.
Increase it if taps consistently register late on a particular device or speaker setup.
The visual guide works while muted; enabling personal music can help players joining from different locations.

Perm Mania has its own disco backing, demonstration claps, and local hit/miss feedback.
Each successful phrase plays the supplied `public/audio/Ding.mp3` when hair growth is awarded, including the final phrase.
The demonstration sounds and visual notes share the agreed local timeline, but physical audio, display, and touch latency still require phone testing.
This is an independent adaptation of the rhythm-and-hair-growth concept described in [this player guide](https://gamefaqs.gamespot.com/ps/575837-bishi-bashi-special-2/faqs/13258), with original artwork and music.
[Perm Mania artwork notes](public/assets/perm-artwork.md) preserve the image-generation prompt and sprite layout.

## Play Facial Slot Machine

Choose **Game Select → Facial Slot Machine**, or encounter it in Arcade.
Match all three reels to the portrait above the stage.
All three rows spin at once, with neighboring portraits visible as they approach the center marker.
The **red** button stops the red row, **green** stops green, and **blue** stops blue, in any order.
Use **1 / 2 / 3** or **J / K / L** for the corresponding colors on a keyboard.
The portrait nearest the center marker at the local input timestamp is selected.
A correct face stays locked while the other rows continue.
A miss pauses only that row for 450 ms, then resumes its motion from the stopped position; previous matches remain locked.
Each row has its own 120 ms input guard, so simultaneous presses on different colors remain valid.
The first player to lock all three target portraits wins, ranked by local elapsed time, with a 30-second deadline.
Unfinished players receive zero set points.

Every player receives the same seeded target and reel order, calculated from the agreed round start.
There are six visually distinct portraits: Robot, Frog, Lion, Cat, Yeti, and Octopus.
Each reel cycles through all six once, begins away from the target, and repeats deterministically.
In Arcade, a portrait travels one position every 320 ms; Game Select uses **320, 290, and 260 ms** across its three rounds.
These are provisional casual-play timings and should be tuned from phone playtests.
Local input never waits for the server, and remote spinning follows the player's published pauses and lock positions at most four times a second.

The game uses a turquoise, pink, and butter-yellow photo-booth stage, with three colored horizontal reel strips stacked inside each player's cabinet.
The same three colored buttons retain their design and fixed position in all games, including future additions.
Its six original portraits were produced with the built-in image-generation tool.
[Facial Slot Machine artwork notes](public/assets/facial-slot-artwork.md) preserve the complete prompt, sprite order, and returned image details.
The mechanic is an independent adaptation of matching the target face across three reels, as described in the [original game's player guide](https://gamefaqs.gamespot.com/ps/575837-bishi-bashi-special-2/faqs/13258).

The original 128 BPM carousel-funk soundtrack combines a bouncing bassline, bright mallet melody, chord stabs, and claps.
A second layer enters near the final ten seconds, and successful locks, retries, GO, and a completed face have distinct synthesized cues.
The bank loads only for this game after sound is enabled, using the existing per-room music policy, mute controls, voice cap, and interruption handling.
The editable composition lives in `scripts/audio/slots.js`, and the delivered WAV files and numerical measurements live in `public/audio/`.
Automated signal and playback-lifecycle checks pass; balance and physical audio latency still need listening tests on target phones.

## Play Fireworks Craze

Choose **Game Select → Fireworks Craze**, or encounter it in Arcade.
Press matching color buttons before the rockets fall back to the ground.
Colors are visible from launch; rockets have no shape symbols.
Keyboard controls remain **1 / 2 / 3** or **J / K / L**.

Clear seven sets: **1 rocket, 3 rockets, 3 faster rockets, 4 rockets, then three sets of 5 rockets**.
Rockets launch one after another, and you may burst airborne colors in any order.
Repeated colors consume the oldest airborne matching rocket first.
A wrong color or an unburst rocket landing fails only the current set, followed by a **650 ms** recovery.
Completed sets remain credited.
Clear all seven sets before the **45-second** deadline; fastest local elapsed time wins.

At base difficulty, airtimes are **2600, 2600, 2200, 2100, 2000, 2000, and 2000 ms** across the sets.
Launch gaps are **420, 420, 340, 300, 260, 260, and 260 ms**.
Game Select scales those times to **100%, 94%, and 88%** across its three rounds.
These are provisional timings pending phone playtests.
Every accepted rocket creates a small firework display.
Completed sets play `Ding.mp3` and show a large yellow circle; failed sets play `wrong.mp3` and show a large red cross.
All feedback works visually while muted.
Remote lanes use bounded snapshots of the actual current set, launch schedule, and burst mask.

The original generated festival background remains in `public/assets/fireworks-festival.png`.
Its prompt is preserved in [Fireworks artwork notes](public/assets/fireworks-artwork.md).
`src/firework-view.js` and `src/fireworks.css` draw the colored rocket arcs and burst particles.
Each rocket reuses `Fireworks.mp3` at its scheduled local launch, skipping stale launches after interruptions.
Frontend and room service must deploy together with protocol 9.

## Play Mimicking Monkeys

Choose **Game Select → Mimicking Monkeys**, or encounter it in Arcade.
Watch the monkey demonstrate a sequence of red circles, green triangles, and blue diamonds, then copy the order using the shared three buttons.
Keyboard controls remain **1 / 2 / 3** or **J / K / L**.
The first sequence has two moves, and every completed stage adds one move to the same seeded prefix.
Watch inputs are ignored; a **Your turn** label and a question mark indicate when you can answer.
Copy the order at your own pace; this game does not judge rhythm.
Neutral dots show sequence length during demonstrations and fill as response moves are accepted, without exposing the answer order.
Repeated colors have a blank interval between flashes so they remain separate moves.

Arcade requires five stages, ending with a six-move sequence.
Game Select requires **5, 6, and 7 stages**, ending with sequences of **6 through 8 moves**.
Demonstration steps take **650, 610, and 570 ms**, with each shape visible for 65% of its step.
Each demonstration has a 550 ms lead-in and a 250 ms pause before answering.
A wrong answer resets only the current response and adds 600 ms recovery before that sequence is demonstrated again.
Completed stages remain credited, and a 100 ms input guard prevents simultaneous presses from submitting multiple answers.
Finish every stage before the 45-second deadline; fastest local elapsed time wins, and unfinished rounds earn zero set points.
These are provisional casual-play timings pending physical phone playtests.

Every device uses the same seeded prefix and freezes its local clock mapping when the round is scheduled.
Other lanes display the peer's actual demonstration phase and accepted response progress from published timing.
Optional demonstration tones reuse the existing three color sounds and are scheduled from the same local timestamps as the shape flashes, with a 150 ms audio lookahead.
Mute, replay, finish, and interruption cancel queued demonstration sounds; resuming skips past notes, and muted play remains fully supported.
Backing music, local hit/miss feedback, and finish cues reuse the original disco bank and shared audio controls.
Each fully correct local sequence plays the supplied `public/audio/Ding.mp3`, including the final sequence; individual matching inputs keep their color tones.
Audio scheduling checks do not establish physical speaker latency or subjective mix quality.

The original generated character lives in `public/assets/mimicking-monkey.png`, with its prompt preserved in [artwork notes](public/assets/monkeys-artwork.md).
The leafy stage, shape cues, and response indicators live in `src/monkey-view.js` and `src/monkeys.css`.
Deploy frontend and room service together to make the new catalog entry available; protocol 9 carries current scene snapshots and the announcement gate.

## Play Jump for the Meat

Choose **Game Select → Jump for the Meat**, or encounter it in Arcade.
The dinosaur bounces automatically; press **any of the three buttons** as it lands, when the landing ring turns gold or green.
Keyboard controls remain **1 / 2 / 3** or **J / K / L**.
Watch the dinosaur descend onto the trampoline to judge when to press; the timing bar has been removed so the scene has more vertical space.
The wide gold zone gives a **Good** landing, while its smaller green center gives **Perfect**, which adds twice as much height and shortens the race.
The meat stays at the same target height: **8 Perfect landings**, **16 Good landings**, or an equivalent mixture reaches it.
Each Good adds one of 16 height units; each Perfect adds two, capped at the target.
The arena shows height percentage rather than a fixed jump count.
Accepted boosts stretch the dinosaur briefly and create an impact burst; a Perfect landing also plays a distinct optional flourish.
After reaching the target height, reach the meat at the final jump's apex to finish; final flight time is included in your locally measured result.
Each finished lane immediately shows the accepted elapsed seconds above **CLEAR!**, including remote players while others continue.
An early tap or missed landing causes a 450 ms recovery before another attempt, while successful boosts remain credited.
A 100 ms input guard ignores simultaneous buttons and accidental double presses.
Unfinished players time out after 30 seconds and receive zero set points.

Arcade and every Game Select round use the same 16-unit meat height; later Game Select rounds adjust bounce speed and landing windows.
Base bounce periods shorten from **1,200 to 1,100 ms** in 50 ms steps, with a seeded −80, 0, or +80 ms adjustment per height shared by all players.
Landing windows narrow from **±150 to ±120 ms** in 15 ms steps; both window boundaries are inclusive.
The Perfect half-window is 30% of the landing half-window, rounded to **45, 41, 36, 32, and 27 ms** across the five difficulties, with inclusive boundaries.
Input judgments use the frozen local round clock, and a delayed animation frame cannot extend a missed landing or move the final apex time.
Remote bounces follow published launch timing and height; only local inputs determine a player's result.
These initial settings are provisional until playtested on phones.

The game uses an original generated dinosaur and roasted drumstick on a peach-and-sand stage, with the trampoline, landing rings, and impact particles drawn in code.
The delivered character is `public/assets/jump-dino.png`, with its full prompt preserved in [artwork notes](public/assets/jump-artwork.md).
Illustrated rules explain the landing and the three interchangeable buttons, and all essential cues remain visible while muted.
The game reuses the original opt-in disco audio bank for backing music, accepted boosts, misses, GO, and finish cues, plus the existing Perm growth flourish for Perfect landings.
Jump also preloads the user-supplied `public/audio/bounce.mp3` for each enabled gameplay button press, replacing Punch for both touch and keyboard input.
The finish cue, Perfect flourish, shared mute controls, and other games' button sounds keep their existing behavior.
Only the additional flourish and bounce clip are loaded for Jump; the full Perm music bank is unnecessary.
Automated timing comparisons confirm that all-Perfect play beats safe early landings at every difficulty; physical phone testing still needs to establish whether the choice feels satisfying.
Deploy frontend and room service together to register the new game in both catalogs.

## Play Burger Girl

Choose **Game Select → Burger Girl**, or encounter it in Arcade.
Red circle moves the chef's plate left, green triangle moves it to the middle, and blue diamond moves it right.
The selected position persists until another button is pressed.
Get under each falling ingredient before it reaches the plate; catches happen automatically on the local clock.
A move exactly on the landing timestamp counts, and a delayed frame cannot change an already scheduled landing time.

Catch lettuce, patty, tomato, and a top bun to serve one burger.
Serve **three burgers / twelve ingredients** to finish, ranked by local elapsed time; perfect runs can tie.
A miss costs **300 ms** of recovery and repeats that ingredient in a new seeded chute, keeping completed layers and served burgers.
Successful catches leave **160 ms** before the next ingredient starts.
Game Select shortens each fall from **1,100, 990, and 880 ms** across its three rounds.
The deadline is **35 seconds**, and unfinished rounds earn zero points.
These initial speeds are provisional until phone playtesting.

The chef, ingredient sprites, building stack, and delivered-burger flourish stay inside each player's lane.
Only local scheduled catches produce gameplay sounds; remote movement follows each player's published scene.
The common music bank, punch-button controls, `Ding.mp3` for every successful local catch, and miss cues use the existing opt-in audio system.
`shared/burger.js` owns the seed and catch rules; `src/catch-spot-view.js` and `src/catch-spot.css` draw the diner stage.

## Play Me Find Mistake

Choose **Game Select → Me Find Mistake**, or encounter it in Arcade.
Each local board shows three vertically stacked pictures: two identical copies and one changed picture.
Red circle chooses the top picture, green triangle the middle picture, and blue diamond the bottom picture.
Differences include silhouette, direction, hats, eyes, badges, and accessories rather than color alone.

Find **8, 9, or 10** odd pictures across the three Game Select rounds.
The picture pool grows from four to eight pairs, and all devices derive the same boards from the shared seed.
The first board has a **250 ms** observation gate.
Later boards accept answers immediately when they appear after the **260 ms** success feedback.
A correct answer shows a check and keeps the solved board for **260 ms** before revealing the next one.
A wrong answer marks only the selected picture, keeps the same puzzle, and locks answers for **600 ms** without losing completed puzzles.
Finish within **35 seconds**, ranked by local elapsed time.
These initial timings and picture pools are provisional until phone playtesting.

Remote lanes show the current published picture board and selected-answer feedback.
Only the local answered card pops on success; reduced-motion preferences remove decorative motion.
Every correct local answer plays `Ding.mp3`, including the final answer, through the existing effects volume and mute controls.
`shared/mistake.js` owns the seeded puzzle rules; `src/catch-spot-view.js` and `src/catch-spot.css` draw the picture cards.
The new games use the same instructions, Ready gates, Arcade selection, cumulative podium, reconnect handling, and result acknowledgments as the rest of the catalog.
Deploy the frontend and room service together; protocol 9 advertises `firework-sets`, `game-announcements`, and `game-picker-screen` alongside the existing required capabilities.
Original artwork and full generation prompts for both games are preserved in [artwork notes](public/assets/catch-spot-artwork.md).

## Play Dice, Dice, More Dice

Choose **Game Select → Dice, Dice, More Dice**.
This game is included in the twelve-game Arcade batch.
Three dice appear vertically in your lane; choose the die with the most dots using red for top, green for middle, or blue for bottom.
Each roll contains three distinct values from one to six, so there is always exactly one highest choice.
All devices receive the same seeded rolls.

Win **12, 14, or 16 rolls** across the three Game Select rounds.
Dice settle for **180 to 140 ms** across those rounds before revealing their values, then allow **180 ms** to observe the new board before inputs count.
Higher levels also tilt the dice by up to 20 degrees while preserving readable pip patterns.
A correct choice shows its check and retains the solved dice for **220 ms** before the next roll.
A wrong choice marks only the selected die and locks inputs for **600 ms**, retaining the board and all previous wins.
Finish within **35 seconds**, ranked by locally measured elapsed time.
These speeds and counts are provisional until phone playtests.

`shared/dice.js` owns seeded rolls and input gates.
`src/dice-facing-view.js` and `src/dice-facing.css` combine the generated dice jester with a velvet table, exact code-native die pips, rolling anticipation, and brief success pops.
Remote lanes show the published current dice and progress, and successful feedback never reveals the next board early.
Existing Punch button feedback, Ding successes, mistake cues, finish cues, and disco music are reused without creating audio files.

## Play Facing Which Way

Choose **Game Select → Facing Which Way**.
This game is included in the twelve-game Arcade batch.
Remember which way the duck points, then follow its covered card through clockwise turns, counterclockwise turns, and left-right flips.
The visible move symbol states a 90-degree turn, 180-degree turn, or horizontal flip; the picture stays hidden until a correct answer.
When **Answer** appears, red answers left, green up, and blue right.
Generated tricks never end a move pointing down, so every possible answer has one of the three shared buttons.

Solve **5, 6, and 7 tricks**, with **2, 3, and 4 moves per trick**, across three rounds.
Each trick shows the initial duck for **700 ms**, slides a separate flap down over the upright card for **400 ms**, holds it covered for **350 ms**, and then demonstrates moves at **1000, 925, and 850 ms per move** across the three rounds.
A **200 ms** handoff separates the final move from the answer phase; all demonstration inputs are ignored.
A correct answer reveals the final direction for **260 ms** and advances the trick count.
A wrong answer waits **450 ms**, then replays the same initial picture and moves while keeping completed tricks.
The deadline is **60 seconds**, ranked by local elapsed time; these initial timings are provisional until phone playtests.

`shared/facing.js` owns the seeded transformations, replay gates, and local timing.
The renderer maximizes the duck card within the lane, fitting diagonal turns inside its boundaries, and uses an opaque flap over the generated aviator duck.
Remote lanes follow the peer's published current card phase, turns, and answer feedback.
Reduced-motion settings replace decorative card motion with the same readable move symbols and phase timing.
Correct answers reuse Ding, and the move demonstration reuses `slot-lock.wav` on the local audio timeline with bounded lookahead, stale-cue skipping, and replay/finish cancellation.
Both games use original image-generated characters, delivered as resized WebP files with their PNG masters retained.
The complete prompts and source image details are in [Dice and Facing artwork notes](public/assets/dice-facing-artwork.md).
No new audio was downloaded or created.

## Play It's Raining Coins

Move the raccoon with **red = left, green = middle, blue = right** to catch gold star coins while avoiding the cracked purple fakes.
The three marked chutes match the shared control bar, whose captions show Left / Middle / Right during this game.
Collect 18 coins before the 40-second deadline; fastest completion wins.
A missed gold coin or a caught fake adds a mistake and a 400 ms recovery, keeping all collected coins.
Game Select shortens each fall from 1100 to 920 ms across three rounds, with a 100 ms handoff after a successful catch.
`shared/coins.js` owns seeded chute pairs and resolves landings at their scheduled local timestamp, accepting a lane change exactly at landing.

## Play Dodge or Die!!

Guide the helmeted fox with **red = one lane left, green = jump, blue = one lane right** using the same three gameplay buttons.
Tall walls block two lanes, leaving one open lane; striped low hurdles span all three lanes and require a jump at the landing line.
Clear 12 obstacles in Arcade; Game Select increases the goal from 12 to 14 and shortens each approach from 1350 to 1150 ms.
Every round has a 40-second deadline, and fastest completion wins.
A bump adds a 550 ms recovery and keeps completed obstacles; clear obstacles have a 180 ms handoff.
Jumps last 640 ms and clear a hurdle when their normalized height is at least 0.6 at impact, giving roughly a 378 ms valid launch window.
Tall walls require the open lane even while airborne; lane steps have a 100 ms cooldown and a jump cannot restart in midair.
`shared/dodge.js` owns the seeded wall lanes and alternating wall/hurdle schedule; delayed frames use scheduled impacts rather than frame arrival time.

Both games use the existing Ding success cue, mistake cue, gameplay button sound, countdown, and podium music without adding or creating audio.
Their initial difficulty values are provisional tuning, verified by deterministic simulations and desktop UI checks; player trials on phones can inform later pacing adjustments.
The new generated raccoon and fox are retained as PNG masters with hashed 512-pixel WebP delivery images totaling 105,204 bytes.
[Artwork prompts and provenance](public/assets/coins-dodge-artwork.md) record the built-in image-generation prompts and selected outputs.
Both games enter Game Select and the twelve-game Arcade batch immediately, together with Dice and Facing Which Way.


## Play Type in Letters

Choose **Game Select → Start set → Type in Letters → Play selected game**.
Everyone shares one alphabet and the same random three-letter target, with a **30-second countdown** above the arena.
The game supports the room's existing one-to-four-player roster, including three-player matches.
**Red moves left, blue moves right, and green enters the selected letter**.
Hold either movement button to keep moving, or use **1 / 2 / 3**, **J / K / L**, or **Left / Enter / Right** on a keyboard.
Movement wraps through **A–Z and ⌫**; select **⌫** with green to erase the last entered letter.
Incorrect entries stay visible so you can correct them.
Every target resets all pointers to **N** and clears the entered letters, giving everyone the same starting position.
The alphabet uses a single row on wide screens and three readable rows on phones.

The first player to type all three target letters wins **one typing point**.
The winner gets a yellow circle and `Ding.mp3`; everyone else gets a red cross and the existing `wrong.mp3` cue.
After **650 ms** of result feedback, a new shared target appears and the race continues until the timer reaches zero.
Most typing points wins the round; exact ties share placement, and players with zero typing points receive no placement points.
Game Select plays three 30-second rounds with the usual cumulative placement points and between-round Ready gates.
Type in Letters is the thirteenth game, so it enters Game Select immediately and waits for the next four-game catalog milestone before joining Arcade.

`shared/letters.js` owns seeded targets, local input, bounded replay proofs, and shared race settlement.
Each completed target sends a bounded input proof measured from the frozen local round clock; the server replays it before accepting a claim.
An **800 ms** collection window compares completion timestamps rather than awarding the first received packet.
This is bounded client-reported timing fairness, not proof of physical device synchronization or protection against a modified client.
Exact millisecond ties share one typing point.
Inputs at or after 30 seconds are rejected, but a valid pre-deadline claim can arrive within the final collection window.
The server owns typing points and final results; cosmetic pointer snapshots at **4 Hz** cannot award points or block local input.
Claims are retried until acknowledged; stale target/round claims, malformed proofs, and duplicate awards are rejected.
Disconnection preserves accepted points; hiding or reloading still forfeits under the existing lifecycle rules.

`src/letters-view.js` and `src/letters.css` render the shared arena, numbered player pointers, entered letters, scores, and result symbols.
[Type in Letters artwork notes](public/assets/letters-artwork.md) retain the built-in image-generation prompt and optimized background provenance.
No new audio is generated or downloaded; until a Type in Letters announcement voice is supplied, its announcement uses the existing applause without a voice.
Deploy frontend and room service together with **protocol 9** and the `shared-letters` capability.
The initial repeat interval, collection window, and feedback duration are provisional tuning values checked by deterministic tests and browser play, pending device playtests.

## Backgrounds, set feedback, and Game Select announcements

Every minigame now has its own original illustrated environment.
Fireworks retains its existing festival backdrop; eleven new backgrounds cover the other games.
`src/backgrounds.css` maps arena themes to optimized WebP deliveries, with all PNG masters retained in `public/assets/`.
[Background artwork notes](public/assets/background-artwork.md) preserve the built-in image-generation prompts.
The eleven new backgrounds total about **1.24 MB**; the full image delivery set stays below **3 MB**.
New games should follow the same background and optimization workflow.

Perm Mania, Mimicking Monkeys, Facing Which Way, and Fireworks publish set-result timestamps so each lane can display a large yellow circle for success or a red cross for failure.
Dice and Me Find Mistake show the same symbols for their individual puzzles.
Successful sets reuse `Ding.mp3`; failed sets reuse the supplied `wrong.mp3` through the effects bus.
Perm settles the whole phrase before showing or sounding its result; individual rhythm notes keep their existing feedback.
Symbols last 650 ms, sit at the center of each player panel, span 90% of its width, and remain visible with reduced motion and muted sound.

After Play selected game, the selected game's supplied voice and `applause.mp3` play together once.
The dedicated announcement screen lasts **two seconds**, then opens instructions while the matching voice and applause finish naturally.
Readiness resets when preparing the round; later rounds retain their podium Ready gates.
The server owns the two-second transition, so muted or disconnected devices cannot lengthen it; normal Ready gates still apply on instructions.
Me Find Mistake uses its existing `me-find-mistake.mp3` voice filename.

## Loading and delivery assets

An animated dinosaur and orbiting star introduce the game while all runtime artwork and audio download.
The progress bar reflects completed delivery bytes; failed or incomplete files keep the loader visible with a retry button, while successful downloads are retained.
Images are decoded before entry opens, and the three display fonts are warmed with a bounded wait and native font fallbacks.
After joining, Ready also waits for the selected game's audio bank to decode when sound is enabled; players can retry a failed bank or turn sound off to play muted.
The room service enforces the asset acknowledgment for this frontend, independently of clock synchronization and readiness.

Twelve optimized WebP images total **1,183,410 bytes**, down from **18,516,512 bytes** of PNG masters, a **93.6%** reduction.
Original generated PNGs and provenance remain in `public/assets/`; runtime styles use the smaller hashed files in `public/assets/optimized/`.
Run `python scripts/optimize-images.py` with Pillow after changing the PNG masters to regenerate delivery images and their CSS references.
The predev/prebuild script `scripts/asset-manifest.mjs` versions every runtime asset by content and derives gzip delivery files for suitable WAVs.
Gzip restores the exact original WAV bytes, preserving loop lengths and rhythm phase; browsers without decompression support download the original WAV instead.
Current audio delivery is **10,582,412 bytes**, compared with **12,756,440 bytes** before this lossless compression.
User-supplied MP3s retain their original encoding.
Persistent browser caching reuses validated files across visits, and content changes invalidate only the affected files.
Music MP3s use preloaded blob URLs without expanding full songs into decoded PCM buffers; gameplay banks decode only when needed.
Physical phone memory, startup speed on slow networks, audio balance, and touch latency still need device playtests.

## Run locally

Install Node.js 22.12 or newer, then run:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000` on the computer.
For phones on the same Wi-Fi, open one of the network addresses printed by the server, then create an invitation.
Choose the Wi-Fi adapter address if the computer also has VPN or virtual network adapters.
Allow Node.js access to private networks if Windows Firewall asks.
Guest Wi-Fi with device isolation can prevent local connections.

For a browser-only check, use separate windows with distinct player names.
Keep every game window visible during a round because hidden tabs forfeit.
Joining a new room from a duplicated tab may require leaving the copied session first.

## Timing and multiplayer

The client exchanges four timestamps to estimate round-trip delay and server clock offset.
It uses the median offset from the five lowest-latency fresh samples, retaining at most twenty recent samples.
Server time is anchored to a monotonic clock.
Every device freezes its server-to-local clock mapping when it receives a scheduled round.
All input and completion times use `performance.now()`; later clock measurements cannot move that round's start.

The server sends a shared random seed so each device derives the same sequence.
It does not validate each tap or send permission to clear a block.
Cosmetic progress broadcasts run at most four times per second per player and do not affect input response or rankings.
A finish is saved to a session-storage outbox, retried until acknowledged, and accepted idempotently.
Result arrival order does not affect the final ranking.
Every game ranks local elapsed time except Perm Mania, which ranks growth and timing score.

This friends-only game trusts client-reported results, with basic bounds and ownership checks.
It is not a competitive anti-cheat system.
Clock uncertainty and reported GO render delay are estimates, not proof of physical screen synchronization.
Network asymmetry, browser scheduling, touch processing, screen refresh, sleep, and audio hardware can affect perceived fairness.

Room codes are invitation identifiers.
Private reconnect tokens stay on their device and are excluded from broadcasts, invitation links, and timing exports.
Rooms and results live in server memory; a restart clears them.
An empty room expires after thirty minutes without connected players.
Use one server instance until shared room storage is implemented.

## Connection checks

Open the gear button for connection settings, ping, sample count, and uncertainty.
Its **Connection tests** section retains the original sync milestone's tools.

1. Join four devices and check that names and countdowns agree.
2. Clear blocks and check that friends see progress while only your controls affect your tower.
3. Set a three-second result delay on an early finisher and verify that arrival order does not change the winner.
4. Use **Disconnect for 5 seconds**, continue playing, and check that the finish is confirmed after reconnecting.
5. Switch apps during play and verify a forfeit while the room continues.
6. Let a round expire and check timeout results.
7. Export a timing report to inspect estimates and final timings without reconnect credentials.

```sh
npm test
npm run build
```

Automated checks cover deterministic gameplay, all five difficulty levels, shared schedules, room ownership and capacity, progress throttling, delayed and duplicate results, reconnection, and missing players.
Four-client WebSocket tests complete entire Arcade and Game Select sets for every current game, checking automatic progression and cumulative scoring.
Additional checks cover tied points, host migration, locked setup, skipped players, and tempo-scaled audio playback.
Physical phone/tablet playtesting remains necessary.

## Hosting

`npm run build` writes static files to `dist/` with relative paths for GitHub Pages.
`npm start` serves that build and the WebSocket endpoint on the port supplied by `PORT`, defaulting to 3000.
The health endpoint reports protocol version 9 for the shared Type in Letters race, Game Select picker, and existing gameplay and readiness gates.
Deploy the frontend and backend together when changing the multiplayer protocol.

The Pages workflow tests, builds, and deploys `main`.
The repository Actions variable `MULTIPLAYER_SERVER_URL` is embedded as `VITE_SERVER_URL`.
Its current public value is `wss://bishy-bashy-server.onrender.com`.
Server addresses are public configuration and must not contain secrets.
Players can override the address under Connection settings, and invitation links preserve that override.

The included `render.yaml` configures a single Node web service.
Use `npm ci && npm run build` to build and `npm start` to start.
Set `ALLOWED_ORIGINS=https://goatedapps.github.io` and the health path to `/health`.
Origins contain no repository path or trailing slash.
Additional allowed origins may be comma-separated.
HTTPS pages require a secure `wss://` server; the client uses its `/ws` endpoint automatically.
A sleeping hosted service may take time to wake up, and redeploying it clears rooms.

## Artwork and source layout

`shared/totem.js` defines the game rules and deterministic local run.
`shared/perm.js` defines the rhythm rules; `shared/games.js` supplies the catalog and difficulty settings.
`shared/slots.js` defines deterministic reel layouts, local stop judgments, and retry timing.
`shared/fireworks.js` defines seeded multi-rocket sets, airborne matching, landing deadlines, retries, and local set completion.
`shared/monkeys.js` defines seeded memory prefixes, demonstration/response phases, replay recovery, and stage completion.
`shared/jump.js` defines seeded jump arcs, landing judgments, retry timing, and final-apex completion.
`shared/sets.js` supplies mode lengths, random selection, placement awards, and cumulative ranking.
`src/main.js` coordinates lifecycle, timing, input, rooms, and the result outbox.
`src/game-view.js` renders towers and results; `src/audio.js` owns audio loading, mixing, and lifecycle.
`src/set-view.js` renders the mode choices, intermission, and cumulative standings.
`src/slot-view.js` and `src/slots.css` render the target portrait, four reel cabinets, and their feedback.
`scripts/audio/` contains the original composition and synthesis; `public/audio/` contains its rendered runtime assets.
`server/rooms.js` owns multiplayer room state and protocol validation.
`public/assets/totem-blocks.png` contains original generated character artwork reused from the approved mockup.
[Artwork notes](.lavish/totem-shrinker/artwork.md) preserve the generation prompt.
This is an independent game inspired by arcade party games, using original artwork.

## Multiplayer display and tablet layout

Each player publishes a bounded snapshot of their current scene at most four times per second, including object index, lane, and round-relative animation timestamps.
`shared/visual-state.js` validates the allowed fields and reconstructs each peer's current scene against the viewer's frozen round clock.
Remote Coins, Burger, and Dodge objects now use the actual falling object and player position, including changes after catches, misses, and jumps.
The same relay carries slot pauses, memory demonstrations, direction-card phases, picture boards, rockets, and dinosaur bounces.
These snapshots only draw peers; local inputs and result rankings remain independent of packet arrival.
Network delay and the quarter-second update cadence can produce brief visual lag after another player moves.
Refresh every device after deploying the paired frontend and server update; the frontend requires `live-gameplay-v2` support.

Active gameplay uses the visual viewport height and a flex layout, with the shared control bar outside the arena so tablet browser chrome cannot push it below the screen.
The Ready action remains visible while short screens can scroll the instructions card internally.
Facing turns now take 1000/925/850/775/700 ms across available difficulty levels, and Game Select plays only levels 1–3.
Arcade Coins uses 800 ms falls instead of 1100 ms; its instructions and actual countdown preserve that setting.

Menu and instructions music share one gesture-authorized media element with separate remembered positions, following [WebKit's media-element reuse guidance](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/).
The first playback request happens before awaiting audio-context resume or file decoding, so it stays attached to the enabling gesture.

The local Cleared banner sits above every character and effect inside the arena.
Each finished lane also shows a compact Cleared badge (Finished for Perm Mania), including peers who finish before the local player.
The final Exit action uses the current completed set ID and is available to hosts and guests without changing active-set navigation permissions.
