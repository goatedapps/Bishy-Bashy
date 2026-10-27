# Bishy Bashy

A four-player browser party game with Totem Shrinker, Perm Mania, Facial Slot Machine, Fireworks Craze, and Mimicking Monkeys.
Everyone sees all four players and controls only their own player.
The static website runs on GitHub Pages; a separate Node WebSocket server coordinates rooms and results.

- [Play](https://goatedapps.github.io/Bishy-Bashy/)
- [Multiplayer server health](https://bishy-bashy-server.onrender.com/health)
- [Approved visual mockup](mockups/totem-shrinker.html)

## Choose a mode

Create a room, share its QR code or invitation link, and join from up to four phones or tablets.
The landing screen only asks for your name and offers **Create room** or **Join room** with a room code.
The Bishy Bashy! title and a cast of original game characters introduce the games without adding extra setup actions.
After creating or joining a room, choose a mode on the room screen.
Game Select uses equal-sized illustrated cards in a scrollable library, with a title search for a larger catalog.
Choose **Arcade** for five different games selected at random, played once each in a random order.
Choose **Game Select** for five rounds of one game, with difficulty increasing each round.
Only the host can change the mode or chosen game after joining.
The host can use **Back to modes** to keep everyone in the same room and choose again.
Before the first countdown this returns immediately; during an active round or an unfinished set with scores, confirmation explains that the current set and scores will be cleared for everyone.
Rules screens include visual examples using the same artwork and color/shape controls as the game.
**Leave** stays available during play and asks for confirmation before leaving an active set.
Leaving forfeits only an unfinished round; an already accepted finish and previously earned points remain credited, and the other players can continue.
Changing the setup resets everyone's Ready state; setup stays locked throughout the full set.
The host taps **Start set** to show the game's instructions, with no more than three points.
After clock synchronization, every connected player taps **Ready** on that screen before the shared five-second countdown can begin.
In Arcade, each completed game shows a cumulative podium for eight seconds, followed by the next game's instructions and a fresh all-player Ready gate.
The Arcade transition does not announce the next game.
In Game Select, instructions appear only once; subsequent rounds use a Ready button on the podium screen instead of repeating them.
Game Select intermissions last at least eight seconds and wait until every connected player is ready.
Players may toggle readiness off again before the countdown starts.

Each round awards **10 / 7 / 4 / 1 set points** by placement.
Ties share placement points and skip the following occupied places: two tied first-place players earn 10 each, and the next player earns 4 for third.
Unfinished rounds, forfeits, missing results, and Perm rounds with zero rhythm score earn zero set points.
The highest accumulated total wins the set; equal highest totals share victory, and a set with no points has no winner.
Final standings include a round-by-round points table.
Every transition and final screen restores a first/second/third podium using cumulative placement and total points.
The accompanying Last game column shows each player's most recent performance and the set points earned in that round.
The server awards points once per round and retains earned points if a player leaves between rounds.
New guests can join only after the full set ends; original players can reconnect during it.
The Arcade length and Game Select round count live in `shared/sets.js`, and new games join the shared catalog in `shared/games.js`.
Arcade selects five games from the catalog, which currently contains five games.

## Play Totem Shrinker

Match the bottom block using red circle, green triangle, or blue diamond.
The controls also accept **1 / 2 / 3** or **J / K / L** on a keyboard.
Each correct tap clears one block immediately on that device.
Only the next five blocks are displayed, with the next block at the bottom.
All players receive the same seeded block sequence.
A wrong tap freezes that player's inputs for 300 milliseconds.
The first player to clear the tower wins, ranked by locally measured elapsed time.
Arcade uses 30 blocks; Game Select uses **30, 40, 50, 60, and 70 blocks** across its five rounds.
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
Physical phone audio and touch latency still need playtesting.

## Music and sound

The original soundtrack is a 128 BPM funky disco arcade loop, with an octave bass groove, four-on-the-floor drums, electric-piano-style chord stabs, and a bright melody.
An additional percussion and melody layer enters on a beat near the final ten seconds.
Correct taps have three wooden pop tones corresponding to the block colors; a wrong tap produces a springy falling sound.
Countdown, GO, finish, and timeout each have a distinct cue.

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

Each game's mono WAV bank totals less than 2.5 MB and loads only after sound is enabled for that game.
The normal and urgency loops each last 15 seconds at 32 kHz, with equal sample counts for phase alignment.
The editable score and synthesis are in `scripts/audio/`; no third-party recordings or music services are used.
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
Arcade uses 128 BPM; Game Select increases to **128, 136, 144, 152, and 160 BPM**.
Each phrase demonstrates four beats, then asks the player to repeat that rhythm over four beats.
Tap any colored button, **1 / 2 / 3**, or **J / K / L** in time with the notes.
Watching taps do not score; missing notes and extra response taps count as mistakes.
A phrase with at most one mistake grows the dancer's hair by one stage.
The round lasts eight complete phrases: 30 seconds at 128 BPM, down to 24 seconds at 160 BPM.
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

Perm Mania has its own disco backing, demonstration claps, local hit/miss feedback, and hair-growth flourish.
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
In Arcade, a portrait travels one position every 320 ms; Game Select uses **320, 290, 260, 230, and 200 ms** across its five rounds.
These are provisional casual-play timings and should be tuned from phone playtests.
Local input never waits for the server, and cosmetic remote spinning follows the shared clock while lock counts update at most four times a second.

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
Wait for the rising golden rocket to reveal a red circle, green triangle, or blue diamond, then press the matching shared button.
Keyboard controls remain **1 / 2 / 3** or **J / K / L**.
Burst 12 fireworks before the 30-second deadline; fastest locally measured elapsed time wins.
Early presses, wrong colors, and expired reaction windows discard that rocket and add a 300 ms recovery before the next launch.
Completed bursts remain credited after mistakes; unfinished players receive zero set points.

All players receive the same seeded colors and reveal delays, with each player's attempts advancing locally.
The flight time is **550, 500, 450, 400, and 350 ms** across Game Select, plus a seeded delay of 0, 90, or 180 ms per rocket.
Reaction windows shrink from **900 to 500 ms**, in 100 ms steps, while Arcade uses the first difficulty.
These are provisional casual-play settings pending phone playtests.
Color stays hidden during flight, and matching shapes provide a color-independent visual cue once revealed.
The fuse bar shows time remaining; bursts and a cross provide visual success and miss feedback during muted play.
Other lanes show cosmetic bursts from progress reports rather than claiming to reproduce another device's private reaction timing.

The original generated festival background lives in `public/assets/fireworks-festival.png`, with the prompt preserved in [artwork notes](public/assets/fireworks-artwork.md).
Live rockets, reaction symbols, and burst particles are drawn by `src/firework-view.js` and `src/fireworks.css` for precise local feedback.
Fireworks reuses the existing original disco audio bank, including three color tones, miss, GO, and finish cues, under the shared opt-in sound controls.
Deploy both frontend and room service to make the new catalog entry available; the existing protocol 6 message schema is unchanged.

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
Game Select requires **5, 6, 7, 8, and 9 stages**, ending with sequences of **6 through 10 moves**.
Demonstration steps take **650, 610, 570, 530, and 490 ms**, with each shape visible for 65% of its step.
Each demonstration has a 550 ms lead-in and a 250 ms pause before answering.
A wrong answer resets only the current response and adds 600 ms recovery before that sequence is demonstrated again.
Completed stages remain credited, and a 100 ms input guard prevents simultaneous presses from submitting multiple answers.
Finish every stage before the 45-second deadline; fastest local elapsed time wins, and unfinished rounds earn zero set points.
These are provisional casual-play timings pending physical phone playtests.

Every device uses the same seeded prefix and freezes its local clock mapping when the round is scheduled.
Other lanes display each player's stage progress without reproducing their private demonstration or response timing.
Optional demonstration tones reuse the existing three color sounds and are scheduled from the same local timestamps as the shape flashes, with a 150 ms audio lookahead.
Mute, replay, finish, and interruption cancel queued demonstration sounds; resuming skips past notes, and muted play remains fully supported.
Backing music, local hit/miss feedback, and finish cues reuse the original disco bank and shared audio controls.
Audio scheduling checks do not establish physical speaker latency or subjective mix quality.

The original generated character lives in `public/assets/mimicking-monkey.png`, with its prompt preserved in [artwork notes](public/assets/monkeys-artwork.md).
The leafy stage, shape cues, and response indicators live in `src/monkey-view.js` and `src/monkeys.css`.
Deploy frontend and room service together to make the new catalog entry available; the protocol 6 message schema is unchanged.

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
Every client ranks Totem Shrinker, Facial Slot Machine, Fireworks Craze, and Mimicking Monkeys by elapsed time, and Perm Mania by growth and timing score.

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
Four-client WebSocket tests complete entire Arcade and Game Select sets for all five games, checking automatic progression and cumulative scoring.
Additional checks cover tied points, host migration, locked setup, skipped players, and tempo-scaled audio playback.
Physical phone/tablet playtesting remains necessary.

## Hosting

`npm run build` writes static files to `dist/` with relative paths for GitHub Pages.
`npm start` serves that build and the WebSocket endpoint on the port supplied by `PORT`, defaulting to 3000.
The health endpoint reports protocol version 6 for Ready-gated sets and independent Facial Slot Machine rows.
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
`shared/fireworks.js` defines seeded rocket reveals, reaction windows, recovery, and local burst completion.
`shared/monkeys.js` defines seeded memory prefixes, demonstration/response phases, replay recovery, and stage completion.
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
