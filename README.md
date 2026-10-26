# Bishy Bashy

A four-player browser party game, with Totem Shrinker as the first playable round.
Everyone sees all four players and controls only their own tower.
The static website runs on GitHub Pages; a separate Node WebSocket server coordinates rooms and results.

- [Play](https://goatedapps.github.io/Bishy-Bashy/)
- [Multiplayer server health](https://bishy-bashy-server.onrender.com/health)
- [Approved visual mockup](mockups/totem-shrinker.html)

## Play Totem Shrinker

Create a room, share its QR code or invitation link, and join from up to four phones or tablets.
Wait for clock synchronization, then each player taps **Ready**.
The host taps **Start round** and everyone receives the same five-second countdown.

Match the bottom block using red circle, green triangle, or blue diamond.
The controls also accept **1 / 2 / 3** or **J / K / L** on a keyboard.
Each correct tap clears one block immediately on that device.
Only the next five blocks are displayed, with the next block at the bottom.
All players receive the same 30-block sequence.
A wrong tap freezes that player's inputs for 300 milliseconds.
The first player to clear all 30 wins, ranked by locally measured elapsed time.
The round ends after 45 seconds; unfinished players time out.
These initial block, freeze, and duration settings are provisional and live in `shared/totem.js`.

Switching apps, hiding the tab, or reloading during a round forfeits that round.
A network disconnection alone does not forfeit: local play continues and a saved result retries after reconnecting.
The server accepts submissions for ten seconds after the round deadline.
Between rounds, the host waits up to 15 seconds for a disconnected player before starting with the connected players.
The disconnected player's slot remains reserved, and they can play the next round after returning.
Hosting moves to a connected player if the host disconnects.
There is no automatic tournament progression yet.

Sound is optional and off by default.
Use the music-note button to enable short synthesized countdown, tap, mistake, and finish cues.
All essential cues also appear visually.
Physical phone audio and touch latency still need playtesting.

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

Automated checks cover deterministic gameplay, freezes, deadline boundaries, shared schedules, room ownership and capacity, progress throttling, delayed and duplicate results, reconnection, the between-round wait, missing players, and real four-client WebSocket rounds.
Physical phone/tablet playtesting remains necessary.

## Hosting

`npm run build` writes static files to `dist/` with relative paths for GitHub Pages.
`npm start` serves that build and the WebSocket endpoint on the port supplied by `PORT`, defaulting to 3000.
The health endpoint reports protocol version 2 for the playable game.
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
`src/main.js` coordinates lifecycle, timing, input, rooms, and the result outbox.
`src/game-view.js` renders towers and results; `src/audio.js` owns optional procedural sound.
`server/rooms.js` owns multiplayer room state and protocol validation.
`public/assets/totem-blocks.png` contains original generated character artwork reused from the approved mockup.
[Artwork notes](.lavish/totem-shrinker/artwork.md) preserve the generation prompt.
This is an independent game inspired by arcade party games, using original artwork.
