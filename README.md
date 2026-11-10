# Dokidoki Dash!

A four-player browser party game with 29 minigames, illustrated tutorials, and shared multiplayer rooms.
Each device controls its own player through the same red, green, and blue buttons.
The frontend deploys independently to GitHub Pages; a separate Node WebSocket service coordinates rooms and results.
This is an independent game with original artwork.

- [Play](https://goatedapps.github.io/Bishy-Bashy/)
- [Server health](https://bishy-bashy-server.onrender.com/health)
- [Gameplay and multiplayer reference](docs/gameplay.md)
- [Detailed gameplay constraints for maintainers](docs/gameplay-invariants.md)
- [Artwork archive and generation prompts](archive/artwork/README.md)

## Run locally

Install Node.js 22.12 or newer, then run:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000` on the computer.
Phones on the same Wi-Fi can use one of the network addresses printed by the server.
Allow Node.js access to private networks if Windows Firewall asks; guest-network device isolation can prevent local connections.
For local multiplayer checks, use separate browser windows with distinct player names and keep every window visible during play.

```sh
npm test
npm run build
npm start
```

Tests cover deterministic gameplay, timing, audio lifecycle, multiplayer protocols, reconnects, complete sets, and scoring.
The integration tests need permission to open local WebSocket connections.
Physical phone and tablet playtesting remains necessary for input, screen, and audio latency.
`npm start` serves the generated `dist/` frontend and the room service on `PORT`, defaulting to 3000.

## Play and modes

Create a room, choose a character, and share its room code, QR code, or invitation link.
Invitation links with a valid room code permit joining only.
Choose a mode inside the room before starting a set.

| Mode | How it works |
| --- | --- |
| Arcade | The host chooses 3 to all registered games, default 5; a shared reel selects distinct games. |
| Game Select | Choose one game and play three rounds with increasing difficulty. |
| Party | Each rostered player locks one game in 30 seconds; play the picks in player order, including duplicates. |

All 29 games are available in every mode:
Burst the Balloon, Open Sesame, Witch’s Special Delivery, Totem Shrinker, Perm Mania, Facial Slot Machine, Fireworks Craze, Mimicking Monkeys, Jump for the Meat, Burger Girl, Me Find Mistake, Dice, Dice, More Dice, Facing Which Way, It's Raining Coins, Dodge or Die!!, Type in Letters, Dynamite Spark, Get Those Burgers Out!, Where’s Kaya, Happy Days, Stationery Master, Clock Stopper, Ladder Climber, Star Collector, Horse Speeder, Shark Jumper, Satay Snag, Bottled Weather, and Ant Air Mail.
The common keyboard shortcuts are **1 / 2 / 3** or **J / K / L**.
Game instructions explain each game's actions and any additional keyboard controls.

Readiness resets between rounds and waits for every connected player and a fresh clock estimate.
Witch’s Special Delivery is turn-based: alternate red/blue to run, hold green to stop and aim, then release to throw a potion over a row of frogs.
Everyone watches the same turn, the landing frog becomes a prince, and the most frogs passed wins.
Open Sesame is a simultaneous race to dial one shared eight-digit code using red and blue to move and green to select.
Burst the Balloon is a simultaneous race to pop a balloon by alternating red and blue.
Satay Snag races to catch eight hot dogs, Bottled Weather races to shatter six sets of bottles, and Ant Air Mail races to route twelve shrinking paper planes.
Set placements award **10 / 7 / 4 / 1 points**, with ties sharing placement points.
Party mode retains cumulative points, win counts, and history between cycles.
Hiding or reloading an active game forfeits the round; a network disconnection alone allows local play and pending-result retries.
Disconnected seats are reserved for 30 seconds, and Ready gates wait up to 15 seconds for disconnected players.
Accepted finishes and earned points survive a player leaving.

## Hosting

`npm run build` writes the static frontend to `dist/` with relative URLs for GitHub Pages.
The Pages workflow tests, builds, and deploys `main`.
Set the repository Actions variable `MULTIPLAYER_SERVER_URL` to the public secure WebSocket endpoint; the build embeds it as `VITE_SERVER_URL`.
The configured service address is `wss://bishy-bashy-server.onrender.com`.
Server addresses are public configuration and must not contain secrets.
Players can override the endpoint in Connection settings, and invitations preserve the override.

`render.yaml` configures the Node service with build command `npm ci && npm run build` and start command `npm start`.
Set `ALLOWED_ORIGINS=https://goatedapps.github.io`; additional origins may be comma-separated, with no repository path or trailing slash.
HTTPS pages require `wss://`, and the client connects at `/ws`.
Use `/health` for the health check; it reports protocol version 39.
Deploy frontend and backend together when changing protocol requirements, and verify both deployments separately.
Keep one server instance while rooms live in memory; restarting or redeploying the service clears rooms.
A sleeping service may need time to wake up.

## Assets and generated files

Original PNG masters and generation prompts are retained in `archive/artwork/`, outside the published website.
Only optimized delivery artwork belongs in `public/assets/optimized/`.
After changing a master, use Pillow to regenerate all delivery images or select names:

```sh
python scripts/optimize-images.py
python scripts/optimize-images.py shark-sprites shark-wave
```

The optimizer reads the archive, updates hashed WebP files and CSS references, and removes superseded delivery images.
`npm run dev` and `npm run build` regenerate `src/asset-manifest.js` and losslessly compressed WAV delivery files.
The startup loader verifies and caches runtime assets; retain original runtime WAVs for browsers without decompression support.
Audio filenames must match runtime references exactly, including letter case.

Reuse supplied audio; new sounds must come from the user.
The original synthesized scores live in `scripts/audio/`; regenerate their runtime files with `npm run audio:render`.
Signal analysis is printed to the terminal rather than published as an unused JSON file.
The legacy Perm demo/hit/miss WAVs and synthesized countdown WAV have been retired; Perm uses its supplied beat and colored hits, and the countdown uses `countdown.mp3`.

`dist/`, `node_modules/`, `.npm-cache/`, and `*.log` are generated local files and are ignored by Git.
The retired `mockups/` and `.lavish/` prototypes have been removed; their original Totem artwork prompt remains in the archive.

## Source layout

| Location | Responsibility |
| --- | --- |
| `shared/` | Seeded game models, catalog, timing, visual snapshots, and set scoring. |
| `server/rooms.js` | Room ownership, protocol validation, readiness, results, and set transitions. |
| `src/main.js` | Client session, round lifecycle, clock mapping, input, and pending submissions. |
| `src/settings-view.js`, `src/invitation.js` | Settings display and invitation links/QR codes. |
| `src/*-view.js`, `src/*.css` | Game scenes, shared screens, and layout. |
| `src/audio.js` | Gesture-authorized audio banks, mixing, scheduling, and cancellation. |
| `src/*demo*.js` | Isolated looping How to play examples using real models and artwork. |
| `scripts/` | Asset delivery generation, image optimization, and audio synthesis. |
| `test/` | Gameplay, rendering, audio, protocol, and integration checks. |

Local gameplay measures input with `performance.now()` and freezes its clock mapping at round scheduling.
Results use elapsed duration or game-specific scores; packet arrival order never decides placement.
Cosmetic peer snapshots run at most four times per second and never advance gameplay.
Reconnect tokens remain private and must not appear in broadcasts, invitations, or reports.
