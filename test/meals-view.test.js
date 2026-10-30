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
    render(999);assert.ok(view.columns.every(column=>column.falling.hidden));
    run.tap(0,1000);render(1100);assert.equal(view.columns[0].falling.hidden,false);
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
