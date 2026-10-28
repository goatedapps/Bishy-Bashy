# Bishy Bashy

This is a four-device party game with playable Totem Shrinker, Perm Mania, Facial Slot Machine, Fireworks Craze, Mimicking Monkeys, and Jump for the Meat.
The Vite frontend deploys independently to GitHub Pages; `server/` is a separate Node WebSocket room service on Render.
Run `npm run dev`, `npm test`, and `npm run build` for preview, meaningful gameplay/protocol checks, and static output.
The Pages workflow deploys `main`; `MULTIPLAYER_SERVER_URL` supplies the public WebSocket endpoint.
Keep the single server instance while rooms live in memory.
Protocol version 6 includes readiness gates and independent slot-row lock masks; coordinate frontend/backend releases when changing it.

## Game and visuals

`shared/totem.js` owns the deterministic shared-seed sequence and local gameplay rules.
Initial tuning is 30 blocks, a 300 ms wrong-tap freeze, and a 45-second deadline.
Show the next five blocks with the next input at the bottom, and size the complete stack to fit inside its lane.
`shared/perm.js` owns Perm Mania's seeded call-and-response phrases, local timing judgments, hair growth, and tempo-dependent round duration.
Perm Mania ranks growth, then timing score; Totem Shrinker ranks elapsed time.
`shared/slots.js` owns seeded portrait reels and local stops; Facial Slot Machine ranks elapsed time after matching all three reels.
Red, green, and blue stop their own continuously scrolling slot rows in any order; misses pause only that row for 450 ms and resume its motion without a jump.
Reels show approaching faces and judge the portrait nearest the center marker; Game Select reduces travel time per portrait from 320 to 200 ms across five rounds.
Track slot locks as a monotonic three-bit `reelMask`, rather than assuming the first N rows were stopped.
`shared/games.js` is the common game registry, difficulty settings, and result ordering.
`shared/fireworks.js` owns Fireworks Craze's seeded rockets, reveal windows, and local elapsed-time race to 12 bursts.
Early, wrong, and expired rockets advance the attempt and cost 300 ms; keep unrevealed colors hidden and render only the local player's actual reaction targets.
`src/firework-view.js` and `src/fireworks.css` draw the live cues over the generated festival backdrop; remote bursts follow cosmetic progress.
Fireworks launch audio follows the local run's `launchedAt` timestamp with bounded lookahead; deduplicate attempts and skip stale launches after interruption.
`shared/monkeys.js` owns Mimicking Monkeys' seeded expanding prefix, watch/play gates, and elapsed-time race through 5–9 stages.
Wrong responses replay the current prefix after recovery; completed stages persist, and demonstration inputs are ignored.
`src/monkey-view.js` and `src/monkeys.css` show the original monkey, color/shape flashes, and answer dots without revealing future answers or animating remote demonstrations.
Memory demonstration tones use the local run's cue timestamps and a bounded audio lookahead; cancel them on replay, mute, finish, or interruption, and skip past cues on resume.
`shared/jump.js` owns seeded bounce arcs, inclusive landing windows, recovery, and the elapsed-time race to the final meat-reaching apex.
Any of the three buttons boosts a valid landing; preserve successful boosts after a miss and resolve final completion at its scheduled local apex, even on a delayed frame.
The wide gold landing window earns one boost; its green Perfect center (30% of the half-window) earns two, capped at the remaining goal.
Keep the timing cursor, landing ring, +1/+2 feedback, and optional Perfect flourish consistent with the same local input timestamp.
`src/jump-view.js` and `src/jump.css` draw the original dinosaur and landing guide; remote bounces remain cosmetic, and the home cast stays bounded to five characters as the catalog grows.
`shared/sets.js` defines five-game Arcade, five-round Game Select, shared placement points, and cumulative standings.
`server/rooms.js` owns the fixed set roster, idempotent point awards, intermissions, and readiness gates.
Arcade shows a cumulative podium for eight seconds, then the next game's three-point rules and an all-player Ready gate.
Game Select shows rules once and uses the podium's all-player Ready gate between subsequent rounds, with an eight-second minimum intermission.
Readiness never carries across a round or instructions screen, and countdowns require every connected player to be ready and freshly synchronized.
`shared/games.js` defines the three-second countdown for both room scheduling and the single `countdown.mp3` cue; resume at the current offset, preserve its tail past GO, and avoid layering the old GO cue.
The host may configure modes and games only outside an active set, resetting readiness; new guests must wait until the set finishes.
Game Select increases Totem blocks from 30 to 70 and Perm tempo from 128 to 160 BPM across five rounds.
Every device displays all four lanes, with controls for its own player only.
Shared styles live in `src/style.css`; the pink disco stage lives in `src/games.css`.
The landing page and set standings use `src/sets.css` and `src/set-view.js`.
The landing screen only creates or joins rooms; choose modes and games inside the room, with a short explanation visible on each mode card.
Use the shared `src/game-art.js` artwork for the home cast, equal-sized scrollable game cards, and illustrated rules; the library filters titles and accommodates future games without a wider page.
The host's Back to modes action resets the shared set while keeping the room; confirm if a round has begun or scores exist.
Players may explicitly leave active sets after confirmation; preserve accepted finishes, forfeit unfinished rounds, and let remaining players continue without a missing-player wait.
The join handshake advertises `room-navigation`; show an actionable update message if a new frontend is connected to a server lacking Back/active-Leave support.
Facial Slot Machine uses `src/slot-view.js` and `src/slots.css`; remote reel animation is cosmetic and must not reset to zero on progress snapshots.
Use the same three buttons and shared fixed control bar in every current and future game; do not add game-specific button layouts or replace them with a single Stop button.
Show three horizontal scrolling slot rows per player, stacked red, green, and blue, with upcoming faces visible at narrow widths too.
Set podium positions and points use cumulative totals; the separate Last game column shows that round's performance and earned points.
Original generated sprites and their provenance live in `public/assets/`.
The portable design mockup remains in `mockups/`, with editable source/provenance in `.lavish/totem-shrinker/`.
Keep screens visually driven; avoid redundant captions, decorative microcopy, and repeated instructions outside the rules screen.
Audio playback belongs in `src/audio.js`, starts only after a user gesture, and must have visual equivalents.
Menu and transition screens stream `public/audio/Background-ActionRock.mp3` through the music bus; pause it for countdown/gameplay and previews, preserving its position and existing mute/ownership settings.
Enabled menu buttons use the cached `Button-Press.mp3` effect; the three gameplay buttons and their keyboard shortcuts use `Punch-button.mp3` once through the shared tap handler, preserving game-specific sound cues.
`src/feedback.js` owns bounded local success and finish effects; keep them off reaction targets and timing guides, cancel them across round/lifecycle changes, and honor reduced motion.
The original disco score and synthesis live in `scripts/audio/`; regenerate `public/audio/` with `npm run audio:render` after changing them.
Facial Slot Machine's original carousel-funk score and match cues live in `scripts/audio/slots.js`, using the existing mix and lifecycle controls.
Load audio banks per game and schedule Perm Mania demonstrations from the same frozen clock mapping as its visual guide.
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
4. [ ] Burger Girl — catching falling ingredients.
5. [ ] Me Find Mistake — spotting the odd picture out.
6. [ ] Dice, Dice, More Dice — quickly choosing the highest die.
7. [ ] Facing Which Way — tracking a picture through flips.
8. [ ] It's Raining Coins — moving to catch falling coins.
9. [ ] Dodge or Die!! — avoiding obstacles and timing jumps.
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
