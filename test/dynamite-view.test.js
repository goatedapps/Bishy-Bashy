import test from 'node:test';
import assert from 'node:assert/strict';
import { DynamiteStage } from '../src/dynamite-view.js';
import { DynamiteRun } from '../shared/dynamite.js';
class Element {
 constructor(){this.style={};this.children=[];this.attributes=new Map();this.classList={toggle(){}};}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(k,v){this.attributes.set(k,v);}
 getAttribute(k){return this.attributes.get(k);}
}
test('wire scrolling interpolates across the old 16-section boundary, keeps the same wire and resets on a new round',()=>{
 const previous=globalThis.document;globalThis.document={hidden:false,createElement:()=>new Element(),createElementNS:()=>new Element()};
 try{
  const round={id:'r',goal:52,seed:123,duration:45000},run=new DynamiteRun(round,0),view=new DynamiteStage();
  const render=at=>view.render(round,run,at,0,true,true,run.cleared,false);
  render(0);run.cleared=15;render(10);render(190);assert.equal(view.position.progress,15);
  const before=view.parts[0].getAttribute('d');run.cleared=16;render(200);assert.equal(view.parts[0].getAttribute('d'),before);
  render(290);assert.ok(view.position.progress>15&&view.position.progress<16);render(380);assert.equal(view.position.progress,16);
  assert.equal(view.parts.length,52);assert.equal(view.parts[16].getAttribute('stroke'),['#fa5366','#5cdb8d','#51bff5'][run.sequence[16]]);
  view.render({...round,id:'next'},new DynamiteRun({...round,id:'next'},1000),999,0,true,true,0,false);assert.equal(view.position.progress,0);
 }finally{globalThis.document=previous;}
});

test('all wire lanes share the seeded colors before GO, before peer snapshots, and in open spots', () => {
  const previous = globalThis.document;
  globalThis.document = { hidden: false, createElement: () => new Element(), createElementNS: () => new Element() };
  try {
    const round = { id: 'preview', goal: 52, seed: 456, duration: 45000 };
    const run = new DynamiteRun(round, 1000);
    const lanes = Array.from({ length: 4 }, () => new DynamiteStage());
    const colors = view => view.parts.map(part => part.getAttribute('stroke'));
    lanes[0].render(round, run, 999, 0, true, true, 0, false);
    for (let index = 1; index < 4; index++) {
      lanes[index].render(round, null, 999, 0, true, index !== 3, 0, false);
      assert.deepEqual(colors(lanes[index]), colors(lanes[0]));
      lanes[index].render(round, new DynamiteRun(round, 1000), 1000, 0, true, true, 0, false);
      assert.deepEqual(colors(lanes[index]), colors(lanes[0]));
    }
    const next = { ...round, id: 'next', seed: 789 };
    const nextRun = new DynamiteRun(next, 2000);
    lanes[0].render(next, nextRun, 1999, 0, true, true, 0, false);
    lanes[1].render(next, null, 1999, 0, false, false, 0, false);
    assert.deepEqual(colors(lanes[1]), colors(lanes[0]));
    assert.deepEqual(colors(lanes[1]), nextRun.sequence.map(color => ['#fa5366', '#5cdb8d', '#51bff5'][color]));
  } finally { globalThis.document = previous; }
});
