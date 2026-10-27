# Bishy Bashy

This is a four-device party game with playable Totem Shrinker and Perm Mania.
The Vite frontend deploys independently to GitHub Pages; `server/` is a separate Node WebSocket room service on Render.
Run `npm run dev`, `npm test`, and `npm run build` for preview, meaningful gameplay/protocol checks, and static output.
The Pages workflow deploys `main`; `MULTIPLAYER_SERVER_URL` supplies the public WebSocket endpoint.
Keep the single server instance while rooms live in memory.
Protocol version 3 includes host-controlled game selection; coordinate frontend/backend releases when changing it.

## Game and visuals

`shared/totem.js` owns the deterministic shared-seed sequence and local gameplay rules.
Initial tuning is 30 blocks, a 300 ms wrong-tap freeze, and a 45-second deadline.
Show the next five blocks with the next input at the bottom, and size the complete stack to fit inside its lane.
`shared/perm.js` owns Perm Mania's seeded call-and-response phrases, local timing judgments, hair growth, and fixed 30-second score round.
Perm Mania ranks growth, then timing score; Totem Shrinker ranks elapsed time.
`shared/games.js` is the common game registry and result ordering; the host may switch games only between rounds, resetting readiness.
Every device displays all four lanes, with controls for its own player only.
Shared styles live in `src/style.css`; game selection and the pink disco stage live in `src/games.css`.
Original generated sprites and their provenance live in `public/assets/`.
The portable design mockup remains in `mockups/`, with editable source/provenance in `.lavish/totem-shrinker/`.
Keep screens visually driven; avoid redundant captions, decorative microcopy, and repeated instructions outside the rules screen.
Audio playback belongs in `src/audio.js`, starts only after a user gesture, and must have visual equivalents.
The original disco score and synthesis live in `scripts/audio/`; regenerate `public/audio/` with `npm run audio:render` after changing them.
Load audio banks per game and schedule Perm Mania demonstrations from the same frozen clock mapping as its visual guide.
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
- Wait up to 15 seconds for disconnected players between rounds, then allow connected players to proceed.
- Clock uncertainty and GO render delay do not prove physical display synchronization.

## Maintenance

Keep the static frontend independently deployable with a configurable secure WebSocket endpoint.
Keep the canonical gameplay and hosting notes in README.md current.
Use one full sentence per line when substantially editing Markdown, and comment only on non-obvious constraints.
