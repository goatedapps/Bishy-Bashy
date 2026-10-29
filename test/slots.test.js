import test from 'node:test';
import assert from 'node:assert/strict';
import { SlotRun, SLOT_GAME, slotLayout, reelFace, FACE_NAMES, validReelMask } from '../shared/slots.js';
import { createRun, roundSettings, gameRules, GAMES } from '../shared/games.js';
import { RoomService } from '../server/rooms.js';
const settings = (seed = 123, difficulty = 1) => ({ id: 'slots', game: SLOT_GAME, ...roundSettings(SLOT_GAME, seed, difficulty) });
function nextTarget(run, color, after) {
  let time = Math.max(after, run.blockedReels[color], run.lastTaps[color] + 120);
  while (reelFace(run.layout, color, run.reelElapsed(color,time), run.stepMs) !== run.layout.target) time += 1;
  return time;
}
test('seeded reels have six unique predictable faces and nearest-center judgments', () => {
  for (let seed=0;seed<100;seed++) {
    const layout=slotLayout(seed); assert.deepEqual(layout,slotLayout(seed));
    for (const reel of layout.reels) { assert.equal(new Set(reel).size,FACE_NAMES.length); assert.notEqual(reel[0],layout.target); }
    assert.deepEqual(Array.from({length:6},(_,i)=>reelFace(layout,0,i*320,320)),layout.reels[0]);
    assert.equal(reelFace(layout,0,159.99,320),layout.reels[0][0]);
    assert.equal(reelFace(layout,0,160,320),layout.reels[0][1]);
  }
});
test('colors stop their own rows in any order, including simultaneous independent presses', () => {
  const run=new SlotRun(settings(),1000);
  let time=nextTarget(run,2,run.start);
  assert.equal(run.tap(2,time).type,'slotLock'); assert.equal(run.reelMask,4);
  assert.equal(run.tap(2,time+500).type,'ignored');
  time=nextTarget(run,0,time+120); assert.equal(run.tap(0,time).type,'slotLock'); assert.equal(run.reelMask,5);
  time=nextTarget(run,1,time+120); assert.equal(run.tap(1,time).type,'finished'); assert.equal(run.reelMask,7);
  assert.equal(run.elapsed,time-run.start); assert.equal(run.cleared,3);
  const simultaneous=new SlotRun(settings(),0);
  assert.equal(simultaneous.tap(0,0).type,'slotMiss');
  assert.equal(simultaneous.tap(1,0).type,'slotMiss');
  assert.equal(simultaneous.tap(2,0).type,'slotMiss'); assert.equal(simultaneous.mistakes,3);
});
test('misses freeze only their own row, preserve other locks, and resume motion without a jump', () => {
  const run=new SlotRun(settings(),0);
  assert.equal(run.tap(0,0).type,'slotMiss'); assert.equal(run.tap(0,100).type,'ignored');
  assert.equal(run.reelElapsed(0,200),0); assert.equal(run.reelElapsed(1,200),200);
  assert.equal(run.reelElapsed(0,450),0); assert.equal(run.reelElapsed(0,451),1);
  const time=nextTarget(run,2,200); assert.equal(run.tap(2,time).type,'slotLock');
  assert.equal(run.reelMask,4); assert.equal(run.cleared,1);
});
test('all five difficulties and deadline boundaries remain local and deterministic', () => {
  assert.deepEqual(Array.from({length:5},(_,i)=>settings(1,i+1).stepMs),[320,290,260,230,200]);
  for(let level=1;level<=5;level++) {
    const round=settings(52,level),run=createRun(round,5000); let time=5000;
    for(const color of [1,2,0]) {time=nextTarget(run,color,time+120);run.tap(color,time);}
    assert.equal(run.cleared,3); assert.ok(run.elapsed<round.duration);
    assert.equal(run.tap(0,time+1000).type,'ignored');
    assert.equal(new SlotRun(round,0).tap(0,round.duration).type,'ignored');
  }
  assert.equal(validReelMask(4,1),true); assert.equal(validReelMask(4,2),false); assert.equal(validReelMask(8,1),false);
  for (const game of Object.keys(GAMES)) {
    const rules = gameRules(game, roundSettings(game, 1));
    assert.ok(rules.length > 0);
    assert.ok(rules.every(line => typeof line === 'string' && line.trim().length > 0));
  }
});
test('rules wait for every connected player; readiness and color masks cannot be bypassed', () => {
  let now=1000000; const messages=[];
  const service=new RoomService({now:()=>now,send:(client,message)=>messages.push({client,message:structuredClone(message)})});
  const host={},friend={}; service.handle(host,{type:'create',name:'Host',mode:'game-select',game:SLOT_GAME});
  const room=service.rooms.get(host.room);service.handle(friend,{type:'join',code:room.code,name:'Friend'});
  service.handle(host,{type:'start'}); assert.equal(room.round.phase,'instructions');
  for(const c of [host,friend])service.handle(c,{type:'sync',rtt:20,uncertainty:10,count:5});
  service.handle(host,{type:'ready',ready:true}); now+=60000;service.tick();assert.equal(room.round.phase,'instructions');
  for(const c of [host,friend])service.handle(c,{type:'sync',rtt:20,uncertainty:10,count:5});
  service.handle(friend,{type:'ready',ready:true});assert.equal(room.round.phase,'countdown');
  now=room.round.startAt+5000;
  service.handle(host,{type:'progress',roundId:room.round.id,cleared:1,mistakes:0,reelMask:4});assert.equal(room.players[0].progress.reelMask,4);
  now+=300;service.handle(host,{type:'progress',roundId:room.round.id,cleared:1,mistakes:0,reelMask:1});assert.equal(room.players[0].progress.reelMask,4);
  const result={type:'result',roundId:room.round.id,status:'finished',elapsed:1000,cleared:3,mistakes:0,reelMask:3};
  service.handle(host,result);assert.equal(room.players[0].result,null);
  result.reelMask=7;service.handle(host,result);service.handle(friend,{...result,elapsed:2000});
  assert.equal(room.set.phase,'intermission');assert.deepEqual(room.set.players.map(p=>p.points),[10,7]);
  service.handle(host,result);assert.equal(room.set.history.length,1);
  now=room.set.nextStartAt;for(const c of [host,friend])service.handle(c,{type:'sync',rtt:20,uncertainty:10,count:5});service.tick();
  assert.equal(room.set.phase,'intermission');service.handle(host,{type:'ready',ready:true});assert.equal(room.set.phase,'intermission');
  service.handle(friend,{type:'ready',ready:true});assert.equal(room.round.phase,'countdown');assert.equal(room.set.roundIndex,1);
});
