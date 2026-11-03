# Dokidoki Dash!

A four-device party game with 24 registered minigames and Arcade, Game Select, and Party modes.
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
- Deploy frontend and backend together for protocol changes; current protocol is 32.
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
- Keep gameplay free of decorative bases, counters, totals, and progress bars unless explicitly requested; retain the round timer, essential target slots, and accepted final time.
- Every How to play screen uses an isolated looping mini-demo with actual game artwork, concise rules, the shared buttons, and the illustrated cat paw.
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
- Hiding or reloading active gameplay forfeits the round.
- Readiness does not carry between rounds; require fresh synchronization and asset readiness.
- Clock uncertainty and GO render delay do not prove physical display synchronization.

Witch’s Special Delivery replaces the planned Blaster Soda Race.
`shared/witch.js` owns deterministic running, braking, aim, and frog scoring; `server/witch-turns.js` owns shared turns and replay validation.
Speed, angle, and frog-score displays are explicitly requested exceptions to the counter-free rule.
Protocol 32 requires `witch-turns`; deploy both services together.

## Remaining planned games

- Burst the Balloon — rapid presses to inflate and burst a balloon.
- Wonder Oven — stop three matching food symbols.
