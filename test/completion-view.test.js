import test from 'node:test';
import assert from 'node:assert/strict';
import { GameView } from '../src/game-view.js';
import { createRun, roundSettings } from '../shared/games.js';

class Element {
  constructor() {
    this.className=''; this.dataset={}; this.children=[]; this.style={setProperty(){}}; this.attributes=new Map();
    this.classList={contains:name=>this.className.split(' ').includes(name),toggle:(name,value)=>{
      const names=new Set(this.className.split(' ').filter(Boolean));
      if(value)names.add(name);else names.delete(name);this.className=[...names].join(' ');
    }};
  }
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(name,value){this.attributes.set(name,value);}
  getAttribute(name){return this.attributes.get(name);}
}

test('every finished peer has a completion badge, local completion appears before acknowledgement, and new rounds reset badges',()=>{
  const previous=globalThis.document,nodes=new Map();
  globalThis.document={hidden:false,createElement:()=>new Element(),createTextNode:text=>text,getElementById:id=>{
    if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);
  }};
  try{
    const game='dodge-or-die',round={id:'round',game,phase:'running',...roundSettings(game,123)};
    const run=createRun(round,0),local={id:round.id,start:0,run,done:false};run.cleared=4;
    const room={selectedGame:game,round,players:[
      {id:'local',name:'You',connected:true,progress:{cleared:4,mistakes:0}},
      {id:'peer',name:'Friend',connected:true,progress:{cleared:round.goal,mistakes:0},result:{status:'finished',elapsed:12000}},
      {id:'quit',name:'Left',connected:true,progress:{cleared:0,mistakes:0},result:{status:'forfeit'}},
    ]};
    const view=new GameView();view.render(room,'local',local,13000);
    assert.equal(view.lanes[0].finishBadge.hidden,true);
    assert.equal(view.lanes[1].finishBadge.hidden,false);
    assert.equal(view.lanes[1].finishBadge.textContent,'✓ Cleared!');
    assert.equal(view.lanes[2].finishBadge.hidden,true);
    assert.equal(view.lanes[3].finishBadge.hidden,true);
    local.done=true;local.status='finished';run.done=true;run.cleared=round.goal;run.elapsed=13000;
    view.render(room,'local',local,13001);
    assert.equal(view.lanes[0].finishBadge.hidden,false);
    assert.equal(room.players[0].result,undefined);
    const next={...round,id:'next'};room.round=next;room.players.forEach(player=>{player.result=null;player.progress={cleared:0,mistakes:0};});
    view.render(room,'local',{id:next.id,start:14000,run:createRun(next,14000),done:false},14000);
    assert.ok(view.lanes.every(lane=>lane.finishBadge.hidden));
  }finally{globalThis.document=previous;}
});

test('Jump hides progress counters and shows each accepted local or remote finish time above CLEAR without waiting for other players', () => {
  const previous = globalThis.document, nodes = new Map();
  globalThis.document = { hidden: false, createElement: () => new Element(), createTextNode: text => text, getElementById: id => {
    if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id);
  } };
  try {
    const round = { id: 'jump-race', game: 'jump-for-the-meat', phase: 'running', ...roundSettings('jump-for-the-meat', 123) };
    const run = createRun(round, 0), local = { id: round.id, start: 0, run, done: false };
    run.cleared = 8;
    const room = { selectedGame: round.game, round, players: [
      { id: 'local', name: 'You', connected: true, progress: { cleared: 8, mistakes: 0 } },
      { id: 'peer', name: 'Friend', connected: true, progress: { cleared: 16, mistakes: 0 }, result: { status: 'finished', elapsed: 9380 } },
    ] };
    const view = new GameView();
    view.render(room, 'local', local, 9500);
    assert.equal(view.lanes[0].remaining.hidden, true);
    assert.equal(view.lanes[0].progress.hidden, true);
    assert.equal(view.lanes[0].finishBadge.hidden, true);
    assert.equal(view.lanes[1].finishBadge.hidden, false);
    assert.equal(view.lanes[1].finishBadge.textContent, '9.38 s\nCLEAR!');
    local.done = run.done = true;
    local.status = 'finished';
    run.cleared = 16;
    run.elapsed = 10300;
    view.render(room, 'local', local, 10400);
    assert.equal(view.lanes[0].finishBadge.hidden, false);
    assert.equal(view.lanes[0].finishBadge.textContent, '10.30 s\nCLEAR!');
    assert.equal(view.lanes[0].remaining.hidden, true);
    assert.equal(room.players[0].result, undefined);
    view.render(room, 'local', local, 25000);
    assert.equal(view.lanes[0].finishBadge.textContent, '10.30 s\nCLEAR!');
    room.players[1].result = { status: 'timeout', elapsed: null };
    view.render(room, 'local', local, 30000);
    assert.equal(view.lanes[1].finishBadge.hidden, true);
    assert.equal(view.lanes[1].jump.element.dataset.phase, 'expired');
  } finally { globalThis.document = previous; }
});
