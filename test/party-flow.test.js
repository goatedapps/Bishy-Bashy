import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../server/rooms.js';
import { INTERMISSION_MS, GAME_SELECT_LENGTH } from '../shared/sets.js';
import { roundSettings } from '../shared/games.js';

test('Arcade configuration stays in the lobby, then Start set opens the automatic reel', () => {
  const service = new RoomService({ now:()=>100000, send(){} }), host={};
  service.handle(host,{type:'create',name:'Host',mode:'game-select'});
  const room=service.rooms.get(host.room);
  service.handle(host,{type:'configure',mode:'arcade'});
  assert.equal(room.mode,'arcade'); assert.equal(room.set,null); assert.equal(room.round,null);
  service.handle(host,{type:'start'});
  assert.equal(room.set.phase,'selecting');
});

test('three-round Game Select has a five-second standings minimum and requires exit after final results', () => {
  let time=100000;
  const service=new RoomService({now:()=>time,send(){}}),host={};
  service.handle(host,{type:'create',name:'Host',mode:'game-select'});
  const room=service.rooms.get(host.room);
  service.handle(host,{type:'start'});
  const ready=()=>{service.handle(host,{type:'sync',rtt:10,uncertainty:5,count:5});service.handle(host,{type:'ready',ready:true});};
  ready();
  assert.equal(GAME_SELECT_LENGTH,3);assert.equal(INTERMISSION_MS,5000);
  for(let index=0;index<3;index++){
    assert.equal(room.round.totalRounds,3);
    time=room.round.startAt+2000;
    service.handle(host,{type:'result',roundId:room.round.id,status:'finished',elapsed:1000,cleared:room.round.goal,mistakes:0});
    if(index<2){
      assert.equal(room.set.nextStartAt-time,5000);
      ready();time=room.set.nextStartAt-1;service.tick();assert.equal(room.set.phase,'intermission');
      time++;service.tick();assert.equal(room.set.phase,'playing');
    }
  }
  const id=room.set.id;
  service.handle(host,{type:'start'});service.handle(host,{type:'configure',mode:'arcade'});
  assert.equal(room.set.id,id);assert.equal(room.set.phase,'complete');assert.equal(room.mode,'game-select');
  service.handle(host,{type:'back-to-modes',setId:id});assert.equal(room.set,null);
});

test('Facing turns are slower at every difficulty and Arcade coin rain keeps its faster pacing through countdown', () => {
  for(let difficulty=1;difficulty<=5;difficulty++) assert.ok(roundSettings('facing-which-way',123,difficulty).stepMs>=700);
  let time=100000;
  const service=new RoomService({now:()=>time,send(){}}),host={};
  service.handle(host,{type:'create',name:'Host',mode:'arcade'});
  const room=service.rooms.get(host.room);
  service.handle(host,{type:'start'});
  room.set.plan[0]='its-raining-coins';service.prepareRound(room);
  assert.equal(room.round.fallMs,800);
  time=room.set.selectionEndAt;service.tick();
  service.handle(host,{type:'sync',rtt:10,uncertainty:5,count:5});service.handle(host,{type:'ready',ready:true});
  assert.equal(room.round.phase,'countdown');assert.equal(room.round.fallMs,800);
  assert.equal(roundSettings('its-raining-coins',123).fallMs,1100);
});

test('Exit is final-results-only, accepts a guest, and returns every player to modes once', () => {
  let time=100000;
  const service=new RoomService({now:()=>time,send(){}}),host={},guest={};
  service.handle(host,{type:'create',name:'Host',mode:'game-select'});
  const room=service.rooms.get(host.room);
  service.handle(guest,{type:'join',name:'Guest',code:room.code});
  service.handle(host,{type:'start'});
  const id=room.set.id;
  for(const client of [host,guest]) service.handle(client,{type:'exit-set',setId:id});
  assert.equal(room.set.id,id);
  for(let round=0;round<3;round++) {
    for(const client of [host,guest]) {service.handle(client,{type:'sync',rtt:10,uncertainty:5,count:5});service.handle(client,{type:'ready',ready:true});}
    time=room.round.startAt+2000;
    for(const client of [host,guest]) service.handle(client,{type:'result',roundId:room.round.id,status:'finished',elapsed:1000,cleared:room.round.goal,mistakes:0});
    if(round<2){time=room.set.nextStartAt;service.tick();}
  }
  assert.equal(room.set.phase,'complete');
  service.handle(guest,{type:'exit-set',setId:'old-set'});
  assert.equal(room.set.id,id);
  service.handle(guest,{type:'exit-set',setId:id});
  assert.equal(room.set,null);assert.equal(room.round,null);
  assert.equal(room.players.length,2);
  assert.ok(room.players.every(player=>!player.ready&&!player.result));
  service.handle(host,{type:'configure',mode:'arcade'});
  service.handle(guest,{type:'exit-set',setId:id});
  assert.equal(room.mode,'arcade');assert.equal(room.set,null);
});
