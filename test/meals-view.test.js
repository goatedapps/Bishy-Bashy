import { captureVisual, sanitizeVisual, RemoteRuns } from '../shared/visual-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MealsStage } from '../src/meals-view.js';
import { MealsRun, MEALS_GAME } from '../shared/meals.js';
class Element {
  constructor(){this.children=[];this.attributes=new Map();this.styles={};this.style={setProperty:(key,value)=>this.styles[key]=value};this.classes=new Set();this.classList={toggle:(name,value)=>value?this.classes.add(name):this.classes.delete(name)};}
  append(...nodes){this.children.push(...nodes);}
  setAttribute(key,value){this.attributes.set(key,value);}
}
test('meal view retains served requirements through feedback, fills final meal, and does not complete a forfeited meal',()=>{
  const previous=globalThis.document;globalThis.document={createElement:()=>new Element()};
  try{
    const round={id:'meal',game:MEALS_GAME,goal:6,duration:45000,seed:123},run=new MealsRun(round,1000),view=new MealsStage();
    const render=(time,terminal=false)=>view.render(round,run,time,0,true,true,run.cleared,terminal);
    render(999);assert.ok(view.columns.every(column=>column.falling.every(item=>item.hidden)));
    run.tap(0,1000);render(1100);assert.equal(view.columns[0].falling[0].hidden,false);
    const before=[...run.requirements];
    let at=1000;
    for(let row=0;row<Math.max(...before);row++){
      before.forEach((count,color)=>{if(row<count)run.tap(color,at);});
      run.advance(at+300);at+=300;
    }
    render(at+1);assert.equal(view.toast.hidden,false);
    assert.deepEqual(view.columns.map(column=>column.slots.filter(slot=>!slot.hidden).length),before);
    assert.ok(view.columns.every(column=>column.slots.filter(slot=>!slot.hidden).every(slot=>slot.classes.has('meal-filled'))));
    run.advance(at+300);render(at+300);
    assert.ok(view.columns.every(column=>column.slots.every(slot=>!slot.classes.has('meal-filled'))));
    run.done=true;render(at+300,true);
    assert.ok(view.columns.every(column=>column.slots.every(slot=>!slot.classes.has('meal-filled'))));
  }finally{globalThis.document=previous;}
});

test('simultaneous meal falls map to a remote clock and keep separate visual destinations',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>new Element()};
 try{
  const round={id:'concurrent',game:MEALS_GAME,goal:6,duration:45000,seed:123},run=new MealsRun(round,1000);
  const color=run.requirements.findIndex(count=>count>=2);assert.ok(color>=0);
  run.tap(color,1000);run.tap(color,1020);
  const state=sanitizeVisual(round,captureVisual(MEALS_GAME,run,1100),100);assert.ok(state);
  const remote=new RemoteRuns().get(round,{id:'peer',progress:{cleared:0,mistakes:0,visual:state}},5000);
  assert.equal(remote.pendingAt[color*3],5000);assert.equal(remote.pendingAt[color*3+1],5020);
  const view=new MealsStage();view.render(round,remote,5100,0,true,true,0,false);
  const items=view.columns[color].falling;
  assert.equal(items[0].hidden,false);assert.equal(items[1].hidden,false);
  assert.equal(items[0].styles['--target-slot'],0);assert.equal(items[1].styles['--target-slot'],1);
  assert.notEqual(items[0].styles['--fall'],items[1].styles['--fall']);
  const invalid=structuredClone(state);invalid.fields.pendingAt.push(0);assert.equal(sanitizeVisual(round,invalid,100),null);
 }finally{globalThis.document=previous;}
});
