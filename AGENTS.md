# Bishy Bashy

This is a four-device party game with playable Totem Shrinker and Perm Mania.
The Vite frontend deploys independently to GitHub Pages; `server/` is a separate Node WebSocket room service on Render.
Run `npm run dev`, `npm test`, and `npm run build` for preview, meaningful gameplay/protocol checks, and static output.
The Pages workflow deploys `main`; `MULTIPLAYER_SERVER_URL` supplies the public WebSocket endpoint.
Keep the single server instance while rooms live in memory.
Protocol version 4 includes host-controlled modes and automatic sets; coordinate frontend/backend releases when changing it.

## Game and visuals

`shared/totem.js` owns the deterministic shared-seed sequence and local gameplay rules.
Initial tuning is 30 blocks, a 300 ms wrong-tap freeze, and a 45-second deadline.
Show the next five blocks with the next input at the bottom, and size the complete stack to fit inside its lane.
`shared/perm.js` owns Perm Mania's seeded call-and-response phrases, local timing judgments, hair growth, and tempo-dependent round duration.
Perm Mania ranks growth, then timing score; Totem Shrinker ranks elapsed time.
`shared/games.js` is the common game registry, difficulty settings, and result ordering.
`shared/sets.js` defines two-game Arcade, five-round Game Select, shared placement points, and cumulative standings.
`server/rooms.js` owns the fixed set roster, idempotent point awards, eight-second intermissions, and automatic progression.
The host may configure modes and games only outside an active set, resetting readiness; new guests must wait until the set finishes.
Game Select increases Totem blocks from 30 to 70 and Perm tempo from 128 to 160 BPM across five rounds.
Every device displays all four lanes, with controls for its own player only.
Shared styles live in `src/style.css`; the pink disco stage lives in `src/games.css`.
The landing page and set standings use `src/sets.css` and `src/set-view.js`.
Original generated sprites and their provenance live in `public/assets/`.
The portable design mockup remains in `mockups/`, with editable source/provenance in `.lavish/totem-shrinker/`.
Keep screens visually driven; avoid redundant captions, decorative microcopy, and repeated instructions outside the rules screen.
Audio playback belongs in `src/audio.js`, starts only after a user gesture, and must have visual equivalents.
The original disco score and synthesis live in `scripts/audio/`; regenerate `public/audio/` with `npm run audio:render` after changing them.
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
- Wait up to 15 seconds for disconnected or unsynchronized players between rounds, then continue with synchronized players and award skipped players zero for that round.
- Clock uncertainty and GO render delay do not prove physical display synchronization.

## Maintenance

Keep the static frontend independently deployable with a configurable secure WebSocket endpoint.
Keep the canonical gameplay and hosting notes in README.md current.
Use one full sentence per line when substantially editing Markdown, and comment only on non-obvious constraints.
