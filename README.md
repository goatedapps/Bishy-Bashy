# Bishy Bashy · Sync lab

A four-player connection and clock synchronization test, before building any mini-games.
Each device displays all four player slots and controls only its own finish button.

## Run on your Wi-Fi

Install Node.js 22.12 or newer, then run:

```sh
npm install
npm run dev
```

Open `http://localhost:3000` on the computer.
Create a room, open **Invite friends**, and scan the QR code from phones or tablets on the same Wi-Fi.
The server also prints the computer's network addresses; use the address for the Wi-Fi adapter if several appear.
If the automatically selected invitation address belongs to a VPN or virtual adapter, open the correct Wi-Fi address on the computer before creating the invitation.
Allow Node.js access to private networks if Windows Firewall asks.
Guest Wi-Fi with device isolation can prevent connections between devices.

Each player chooses a name, waits for at least three clock samples, and taps **Ready**.
The host starts the test, which schedules GO five seconds ahead.
Tap **Finish** any time during the ten-second test.
This is a timing instrument, not a reaction-time competition yet.
Every screen shows the collected results, ranked by reported local elapsed time.
For a browser-only smoke test, open separate tabs and use a separate player name in each tab.
Keep each tab visible in a separate window during the countdown and test, because hidden game tabs forfeit.

## What to test

1. Join from up to four devices and verify that everyone sees the same room and player names.
2. Ready every player and observe the shared countdown and GO.
3. Set **Delay my result message** to three seconds on one device, finish early there, and finish later on another device.
   The early finisher should rank first even if its message arrives last.
4. Use **Disconnect me for 5 seconds** during a test, then finish while disconnected.
   The result should be retained locally, retried after reconnection, and acknowledged once.
5. Switch apps during an active test and return.
   That device should show a forfeit while everyone else continues.
6. Let the timer expire without finishing.
   The device should report a timeout; an unreachable device is marked missing ten seconds after the test ends.
7. Download a report to compare results, estimated clock uncertainty, and each device's reported GO render delay.

Room codes are public invitation identifiers.
Reconnect credentials stay in session storage and are excluded from room broadcasts and downloaded reports.
Rejoining is automatic after a brief connection loss, and connected players inherit hosting if the host disconnects.
Rooms and results live in server memory; restarting the server clears them.
Disconnected player slots stay reserved until the player returns or the room expires after thirty minutes without connected players.
This milestone uses manual ready/start between tests; automatic tournament advancement and its fifteen-second reconnect wait are not implemented yet.

## How timing works

The client repeatedly exchanges four timestamps with the server and estimates round-trip delay and clock offset.
It uses the median offset from the five lowest-latency fresh samples, retaining up to twenty recent samples.
Server time is anchored once to a monotonic clock so changing the computer's wall clock does not move a test's start.
When a round is scheduled, each device freezes its mapping from the server start time to its own `performance.now()` clock.
Subsequent clock sampling cannot move the starting line during that round.
Finishing saves the elapsed duration locally and queues an idempotent result submission.
The server acknowledges the submission and ranks its elapsed duration independently of network arrival order.
It waits at most ten extra seconds after the round deadline to collect results.

The prototype trusts client-reported durations and provides basic sanity checks, not competitive anti-cheat.
Network asymmetry, browser scheduling, screen refresh rates, device sleep, and touch processing can still affect fairness.
Timing uncertainty is a heuristic based on round-trip delay and sample variation, not a certified accuracy bound.
GO render delay measures the first animation callback after a scheduled start, not when pixels physically appeared.
A high-speed recording of several physical screens is a useful next test of actual visible synchronization.
Do not infer cross-device screen accuracy from similar ping values alone.

## Static hosting and the connection server

```sh
npm run build
npm start
```

The build writes static browser files to `dist/`, with relative asset paths suitable for a GitHub Pages project site.
`npm start` serves those files and the WebSocket endpoint on the same port.
To use GitHub Pages, publish the `dist/` contents and run `server/index.js` on a separate WebSocket-capable Node host.
Set `ALLOWED_ORIGINS` to the exact frontend origin, such as `https://yourname.github.io`, before starting that server.
Several origins can be separated with commas, without spaces.
Terminate HTTPS/WSS at your hosting provider's proxy, and set `PORT` if needed.
In the app's **Connection server** field, enter `wss://your-server.example`.
The server must expose `/ws`; the client uses that path automatically.
Invitations preserve a separately configured server address.
A public HTTPS frontend cannot connect to an insecure `ws://` server on your local computer.
No public deployment, account, or hosting subscription is created by this prototype.

### GitHub Pages deployment

The repository includes `.github/workflows/pages.yml` to test, build, and publish `dist/` whenever `main` changes.
Enable Pages in **Settings → Pages** and select **GitHub Actions** as the source.
GitHub Free requires a public repository for Pages; keeping this repository private requires an eligible GitHub plan.
The intended website address is `https://goatedapps.github.io/Bishy-Bashy/` once Pages is enabled and the deployment succeeds.

Before the multiplayer server is hosted, the published page opens its connection settings and asks for a server address.
It does not attempt to use GitHub Pages as a WebSocket server.
Once the server is deployed, set the repository Actions variable `MULTIPLAYER_SERVER_URL` to its `wss://` address, then rerun the website deployment.
The build embeds that public address as `VITE_SERVER_URL`, so new visitors connect without entering it manually.
This address is public configuration and must not contain credentials.
Players can still override it in **Connection server**, and invitation links preserve overrides.

### Host the multiplayer server on Render

Render is a straightforward option for this prototype because its Node web services support secure WebSocket connections.
You need a Render account and permission for Render to read this GitHub repository.
No database, custom domain, or port forwarding on your home router is needed for this milestone.

1. In Render, create a **Web Service** from `goatedapps/Bishy-Bashy`, or create a **Blueprint** using the included `render.yaml`.
2. For manual setup, select the Node runtime and the Free instance type.
3. Set the build command to `npm ci && npm run build` and the start command to `npm start`.
4. Set the environment variable `ALLOWED_ORIGINS` to `https://goatedapps.github.io`, with no repository path or trailing slash.
5. Set the health check path to `/health` and deploy.
6. Copy the assigned service hostname and use `wss://` instead of `https://` for the game's connection server address.
7. Add that address as the GitHub Actions variable described above, then deploy Pages again.

Use a single server instance while rooms live in memory.
Restarts, redeployments, or service sleep clear all rooms, and players will need to create a new room.
Render's free service sleeps after fifteen minutes without inbound traffic and can take about a minute to wake up.
Open its HTTPS `/health` address before testing if it has been idle.
For consistent availability later, choose an always-on plan after checking current pricing.
This configuration does not subscribe to a hosting plan or create a Render account.

## Checks

```sh
npm test
npm run build
```

Automated checks cover clock estimation, shared starts, room capacity, player ownership, result ordering, reconnect submission, duplicate acknowledgments, forfeits, timeout collection, and WebSocket integration.
Physical phone and tablet testing is still required before choosing mini-games or promising a timing tolerance.
