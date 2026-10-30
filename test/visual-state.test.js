import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, createRun, roundSettings } from '../shared/games.js';
import { captureVisual, sanitizeVisual, RemoteRuns } from '../shared/visual-state.js';
import { RoomService } from '../server/rooms.js';

for (const game of Object.keys(GAMES).filter(id => !GAMES[id].sharedArena)) test(`${game}: visual snapshots translate between device clocks without changing local simulation`, () => {
  const round = { id: game, game, ...roundSettings(game, 123) };
  const run = createRun(round, 500000);
  const state = captureVisual(game, run, run.start + 350);
  const safe = sanitizeVisual(round, JSON.parse(JSON.stringify(state)), 400);
  assert.ok(safe, game);
  const progress = { cleared: run.cleared, mistakes: run.mistakes, visual: safe };
  const remote = new RemoteRuns().get(round, { id: 'other', progress }, 1000);
  assert.notEqual(run, remote);
  assert.equal(remote.start, 1000);
  assert.deepEqual(captureVisual(game, remote, 1350), state);
  assert.equal(run.start, 500000);
  assert.equal(run.cleared, 0);
});

test('coin, burger, and dodge remote scenes retain the true lane and event timing after successes and recoveries', () => {
  for (const game of ['its-raining-coins', 'burger-girl', 'dodge-or-die']) {
    const round = { id: game, game, ...roundSettings(game, 123) };
    const run = createRun(round, 500000);
    if (game === 'dodge-or-die') run.position = run.obstacle.safe;
    else run.tap(game === 'burger-girl' ? run.column : run.wave.column, run.start);
    run.advance(game === 'dodge-or-die' ? run.impactAt : run.landAt);
    run.position = 2;
    const elapsed = run.launchedAt - run.start + 200;
    const visual = sanitizeVisual(round, captureVisual(game, run, run.start + elapsed), elapsed);
    assert.ok(visual);
    const player = { id: 'other', progress: { cleared: run.cleared, mistakes: run.mistakes, visual } };
    const remote = new RemoteRuns().get(round, player, 8000);
    assert.equal(remote.position, 2);
    assert.equal(remote.index, run.index);
    assert.equal(remote.launchedAt - remote.start, run.launchedAt - run.start);
    assert.deepEqual(game === 'dodge-or-die' ? remote.obstacle : game === 'burger-girl' ? remote.column : remote.wave, game === 'dodge-or-die' ? run.obstacle : game === 'burger-girl' ? run.column : run.wave);
    assert.equal((8000 + elapsed - remote.launchedAt), (run.start + elapsed - run.launchedAt));
  }
});

test('visual relays reject oversized indices, invalid lanes, future samples, non-finite times, and unsafe metadata', () => {
  const round = { id: 'coin', game: 'its-raining-coins', ...roundSettings('its-raining-coins', 123) };
  const run = createRun(round, 1000), valid = captureVisual(round.game, run, 1200);
  for (const mutate of [state => state.fields.position = 3, state => state.fields.index = 2049, state => state.fields.launchedAt = Infinity, state => state.sample = 2000]) {
    const state = structuredClone(valid); mutate(state);
    assert.equal(sanitizeVisual(round, state, 200), null);
  }
  const extra = structuredClone(valid); extra.fields.token = 'private'; extra.feedback = { kind:'catch', at:100, color:1, html:'<script>' };
  const safe = sanitizeVisual(round, extra, 200);
  assert.ok(safe);
  assert.equal('token' in safe.fields, false);
  assert.equal('html' in safe.feedback, false);
});

test('room broadcasts the actual peer scene without progress changes, rejects stale scene packets, and keeps finish state', () => {
  let time = 100000;
  const service = new RoomService({ now: () => time, send() {} }), host = {}, guest = {};
  service.handle(host, { type:'create', name:'Host', mode:'game-select', game:'its-raining-coins' });
  const room = service.rooms.get(host.room);
  service.handle(guest, { type:'join', name:'Guest', code:room.code });
  service.handle(host, { type:'start' });
  for (const client of [host, guest]) { service.handle(client, { type:'sync', rtt:10, uncertainty:5, count:5 }); service.handle(client, { type:'ready', ready:true }); }
  const round = room.round, run = createRun(round, 5000);
  time = round.startAt + 300;
  run.position = 0;
  const first = captureVisual(round.game, run, 5300);
  service.handle(guest, { type:'progress', roundId:round.id, cleared:0, mistakes:0, visual:first });
  assert.equal(service.snapshot(room).players[1].progress.visual.fields.position, 0);
  time += 250; run.position = 2;
  const second = captureVisual(round.game, run, 5550);
  service.handle(guest, { type:'progress', roundId:round.id, cleared:0, mistakes:0, visual:second });
  assert.equal(room.players[1].progress.visual.fields.position, 2);
  time += 250;
  service.handle(guest, { type:'progress', roundId:round.id, cleared:0, mistakes:0, visual:first });
  assert.equal(room.players[1].progress.visual.sample, second.sample);
  time = round.startAt + 25000; run.cleared = round.goal; run.done = true; run.elapsed = 24000;
  service.handle(guest, { type:'result', roundId:round.id, status:'finished', elapsed:24000, cleared:round.goal, mistakes:0, visual:captureVisual(round.game, run, 30000) });
  assert.equal(room.players[1].progress.visual.done, true);
  assert.equal(room.players[1].progress.cleared, round.goal);
  assert.equal(JSON.stringify(service.snapshot(room)).includes(room.players[1].token), false);
});

test('played states reconstruct feedback and active phases for every lane-based minigame', () => {
  for (const game of Object.keys(GAMES).filter(id => !GAMES[id].sharedArena)) {
    const round={id:game,game,...roundSettings(game,123)},run=createRun(round,500000);
    let time=run.start+100;
    if(game==='get-those-burgers-out'){run.tap(0,time);time+=300;run.advance(time);}
    else if(game==='dynamite-spark')run.tap(run.sequence[0],time);
    else if(game==='totem-shrinker')run.tap(run.sequence[0],time);
    else if(game==='perm-mania'){time=run.start+run.notes[0].at;run.tap(0,time);}
    else if(game==='facial-slot-machine')run.tap(0,time);
    else if(game==='fireworks-craze'){time=run.rockets[0].launchAt+10;run.tap(run.rockets[0].color,time);}
    else if(game==='mimicking-monkeys'){time=run.playAt;run.tap(run.sequence[0],time);}
    else if(game==='jump-for-the-meat'){time=run.landAt;run.tap(0,time);}
    else if(game==='burger-girl'||game==='its-raining-coins'){run.tap(game==='burger-girl'?run.column:run.wave.column,time);time=run.landAt;run.advance(time);}
    else if(game==='dodge-or-die'){run.position=run.obstacle.safe;time=run.impactAt;run.advance(time);}
    else {time=game==='facing-which-way'?run.playAt:run.readyAt;run.tap(game==='me-find-mistake'?run.puzzle.odd:run.puzzle.answer,time);}
    const visual=captureVisual(game,run,time+1),safe=sanitizeVisual(round,visual,time+1-run.start);
    assert.ok(safe,game);
    const remote=new RemoteRuns().get(round,{id:'peer',progress:{cleared:run.cleared,mistakes:run.mistakes,visual:safe}},2000);
    assert.deepEqual(captureVisual(game,remote,2000+time+1-run.start),visual,game);
    if(run.feedback?.puzzle)assert.deepEqual(remote.feedback.puzzle,run.feedback.puzzle,game);
  }
});
