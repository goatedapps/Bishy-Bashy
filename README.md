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

## Checks

```sh
npm test
npm run build
```

Automated checks cover clock estimation, shared starts, room capacity, player ownership, result ordering, reconnect submission, duplicate acknowledgments, forfeits, timeout collection, and WebSocket integration.
Physical phone and tablet testing is still required before choosing mini-games or promising a timing tolerance.
