# Dokidoki Dash!

A four-device party game with 32 registered minigames and Arcade, Game Select, and Party modes.
See [README.md](README.md) for setup, hosting, source ownership, and asset maintenance.
Before changing gameplay, tutorials, audio, layout, or multiplayer, read the relevant sections of [the detailed gameplay constraints](docs/gameplay-invariants.md).
Use [the gameplay reference](docs/gameplay.md) for player behavior and game-specific tuning.

## Working rules

- Prefer quality, simplicity, robustness, scalability, and long-term maintainability over development cost.
- Commit and push every completed change unless the user explicitly instructs otherwise.
- Run `npm test` and `npm run build` for meaningful gameplay/protocol checks and static output.
- Keep README.md current and these instructions concise; put game-specific detail in the linked constraints.
- Write each full sentence on its own physical line when substantially editing Markdown.
- Comment only on non-obvious intent, constraints, invariants, or tradeoffs.
- Keep the static frontend independently deployable with a configurable secure WebSocket endpoint.
- Deploy frontend and backend together for protocol changes; current protocol is 46.
- Keep a single server instance while rooms live in memory.

## Game and asset requirements

- For every new minigame, use the game-designer and game-feel skills.
- Use imagegen for original illustrated backgrounds, gameplay objects, characters, posters, and tutorials.
- Retain PNG masters and generation prompts in `archive/artwork/`, outside `public/`.
- Optimize artwork with `scripts/optimize-images.py`; runtime artwork belongs in `public/assets/optimized/`.
- Reuse supplied audio; do not download or create new sounds, and let the user supply missing sounds.
- Use `Ding.mp3` once per meaningful success, including the final success where applicable.
- Keep audio playback in `src/audio.js`, require a user gesture, provide visual equivalents, and honor mute and lifecycle cancellation.
- Use the same three buttons and shared fixed control bar in every game.
- Use one shared gameplay screen or four equal-width player lanes at every viewport size.
- Keep gameplay free of decorative bases, counters, totals, and progress bars unless explicitly requested; retain the round timer, essential target slots, and accepted final time.
- Every How to play screen uses an isolated looping mini-demo with actual game artwork, concise rules, the shared buttons, and the illustrated cat paw.
- Let tutorial cards and demos fill the available viewport height, keeping readiness and Ready visible; retain scrolling for shorter viewports and enlarged text.
- Honor reduced motion and hidden-screen pausing without replaying stale cues.

## Timing and multiplayer invariants

- Measure input with `performance.now()` and freeze the server-clock mapping when scheduling a round.
- Rank elapsed durations or game-specific scores, never packet arrival order.
- Throttle cosmetic progress to at most 4 Hz per player; peer projections never advance gameplay or award results.
- Acknowledge idempotent result submissions and retain pending submissions across reconnects.
- Keep reconnect tokens private and out of broadcasts, invitations, and reports.
- Preserve accepted finishes and earned points when a player leaves; unfinished play forfeits.
- Reserve disconnected seats for 30 seconds, then allow replacements to join the next round with separate scores.
- Ready gates may wait 15 seconds for disconnected players, but never skip a connected unready player.
- Final standings return to mode selection when every reserved seat has chosen Exit.
- Hiding or reloading active gameplay forfeits the round.
- Readiness does not carry between rounds; require fresh synchronization and asset readiness.
- Clock uncertainty and GO render delay do not prove physical display synchronization.

Witch’s Special Delivery replaces the planned Blaster Soda Race.
`shared/witch.js` owns deterministic running, braking, aim, and frog scoring; `server/witch-turns.js` owns shared turns and replay validation.
Speed, angle, and frog-score displays are explicitly requested exceptions to the counter-free rule.
Keep the cropped village scrolling and keep the speed badge beside the witch and anchor the quarter-circle angle gauge at the roof edge; green stops immediately and starts aiming.
Each accepted alternating press increases speed using `0.2 × presses + 0.02 × presses²`, with no decay or speed cap.
Keep the 540-unit runway and 16-unit/s opening pace; `witchTravelPace` softens movement above numeric speed 40 toward a 140-unit/s limit without capping numeric speed or throw power.
Calibrate a near-edge speed-120 throw at 45° to about 80 frogs and 2.4 seconds of flight.
Keep tutorial gauges hidden before measured layout and show the live frogs-passed counter during flight.
The handshake requires `witch-turns`, `witch-instant-aim`, `witch-cumulative-speed`, and `witch-power-curve`.

Open Sesame uses one seeded eight-digit code per round and ranks replay-validated completion times.
Keep the rotary dial readable on phones and retain accepted digits after a wrong selection.

Burst the Balloon counts 60 alternating red and blue presses and ranks replay-validated pop times.
Keep visible inflation tied to accepted presses and allow the final pop to display before standings.

Satay Snag, Glamour Brew, and Ant Air Mail share replay validation in `shared/market-games.js` and a real-scene tutorial renderer in `src/market-view.js`.
Keep Satay at ten tighter catches, advance Glamour Brew's illustrated look once per cleared set, and keep Ant Air Mail's courier continuous between waypoints.

Dam Good Fit uses eight shared, first-answer-locked puzzles with progressively shorter timers.
Sushi Switchboard gives each of ten orders one attempt; a wrong press fails the whole order, and only correctly served orders score.
Sushi Switchboard and Mole Metro share replay validation in `shared/workshop-games.js`.
Keep menu and switch labels readable on phones, and rank Mole Metro by delivered passengers.

## Remaining planned games

- **Goblin Garage Sale** — Bid on odd treasures using red for one coin, green for two, or blue for three.
  Bids reveal together, everyone pays their bid, and the highest bidder wins the item unless the top bid is tied, in which case the goblin keeps it.
  Build the most valuable haul from a limited purse.
- **Ghost Lens** — Photograph shy ghosts in a haunted hotel.
  Red rings a bell to lure them out, blue ducks behind the reception desk, and green snaps a photo.
  Rare poses score more, but a ghost vanishes if it catches you watching.
- **Crab Crane** — Fish cargo out of a rocking harbor with a swinging claw.
  Red reels the claw in, blue lowers it, and green toggles the grip.
  Lift crates out of the water and release them over the dock to land the most cargo.
- **Dragon Daycare** — Settle baby dragons before they set the nursery curtains on fire.
  Red feeds, green fans, and blue burps, with puffed cheeks and glowing nostrils showing when smoke builds up.
  Full, cool, comfortable dragons fall asleep, and the player who settles the most wins.
- **Possum Parcel Panic** — Rearrange each row of three parcels to match its delivery slip.
  Red swaps the left pair, blue swaps the right pair, and green ships the row.
  Race through the slips using as few swaps as possible.
- **Who Ate the Moon?** — Three creatures give statements about a missing bite of moon, and exactly one statement is true.
  Read the clues and press red, green, or blue to accuse the corresponding suspect.
  Solve the most cases to win.
- **Pie, Parry, Panic!** — Duel a pastry chef across a kitchen counter.
  Red throws a pie, green raises a tray to block, and blue fakes a throw to draw an early block.
  A blocked pie leaves the thrower open to a counter, and the first chef to land three hits wins.
- **Exact Change, Please!** — Pay a lunar vending machine exactly using red for one credit, green for four, and blue for six.
  Use as few coins as possible for each price, and start the payment over if you go above it.
- **One Bot Too Few** — A repair robot must hold a floor switch and reach a door across the room.
  Red and blue move the robot, and green rewinds the room while leaving behind a copy that repeats the previous moves.
  Use the copy to hold the switch while you race through the door.
