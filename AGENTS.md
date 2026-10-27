# Bishy Bashy

This is a four-device party game with playable Totem Shrinker, Perm Mania, and Facial Slot Machine.
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
`shared/sets.js` defines two-game Arcade, five-round Game Select, shared placement points, and cumulative standings.
`server/rooms.js` owns the fixed set roster, idempotent point awards, intermissions, and readiness gates.
Arcade shows a cumulative podium for eight seconds, then the next game's three-point rules and an all-player Ready gate.
Game Select shows rules once and uses the podium's all-player Ready gate between subsequent rounds, with an eight-second minimum intermission.
Readiness never carries across a round or instructions screen, and countdowns require every connected player to be ready and freshly synchronized.
The host may configure modes and games only outside an active set, resetting readiness; new guests must wait until the set finishes.
Game Select increases Totem blocks from 30 to 70 and Perm tempo from 128 to 160 BPM across five rounds.
Every device displays all four lanes, with controls for its own player only.
Shared styles live in `src/style.css`; the pink disco stage lives in `src/games.css`.
The landing page and set standings use `src/sets.css` and `src/set-view.js`.
Facial Slot Machine uses `src/slot-view.js` and `src/slots.css`; remote reel animation is cosmetic and must not reset to zero on progress snapshots.
Use the same three buttons and shared fixed control bar in every current and future game; do not add game-specific button layouts or replace them with a single Stop button.
Show three horizontal scrolling slot rows per player, stacked red, green, and blue, with upcoming faces visible at narrow widths too.
Set podium positions and points use cumulative totals; the separate Last game column shows that round's performance and earned points.
Original generated sprites and their provenance live in `public/assets/`.
The portable design mockup remains in `mockups/`, with editable source/provenance in `.lavish/totem-shrinker/`.
Keep screens visually driven; avoid redundant captions, decorative microcopy, and repeated instructions outside the rules screen.
Audio playback belongs in `src/audio.js`, starts only after a user gesture, and must have visual equivalents.
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

## Maintenance

Keep the static frontend independently deployable with a configurable secure WebSocket endpoint.
Keep the canonical gameplay and hosting notes in README.md current.
Use one full sentence per line when substantially editing Markdown, and comment only on non-obvious constraints.
