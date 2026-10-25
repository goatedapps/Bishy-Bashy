# Bishy Bashy

This is a four-device multiplayer synchronization prototype, with no mini-games yet.
The frontend uses Vite and browser JavaScript; `server/` is a separate Node WebSocket room service.
Run `npm run dev` for same-Wi-Fi testing, `npm test` for protocol and clock checks, and `npm run build` for static output in `dist/`.
The Pages workflow deploys `dist/` from `main`; `MULTIPLAYER_SERVER_URL` sets the public WebSocket address at build time.
`render.yaml` describes a single free Node service, with `ALLOWED_ORIGINS` set to the frontend origin rather than its repository path.

## Timing invariants

- Measure local input times with `performance.now()` and freeze the server-clock mapping when a test is scheduled.
- Rank self-reported elapsed durations, never result arrival order.
- Treat result submissions as idempotent, acknowledge them, and retain pending submissions across reconnects.
- Keep reconnect tokens private to their device; never include them in public room state, invitations, or reports.
- A connection loss does not itself forfeit a round, but hiding or reloading the active game does.
- Ping-based uncertainty and GO render delay are estimates, not proof of physical screen synchronization.

## Scope and maintenance

Keep the static frontend independently deployable to GitHub Pages with a configurable secure WebSocket endpoint.
Do not add game mechanics until the multiplayer test is verified on real devices.
Use one full sentence per line when substantially editing Markdown, and comment only on non-obvious constraints.
