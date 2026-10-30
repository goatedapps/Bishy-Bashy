import test from 'node:test';
import assert from 'node:assert/strict';
import { MealsRun, mealSequence, MEALS_GAME, MEALS_GOAL, MEALS_DURATION_MS, MEALS_DROP_MS, MEALS_SERVE_MS } from '../shared/meals.js';
const round = { id:'meals', game:MEALS_GAME, seed:123, goal:MEALS_GOAL, duration:MEALS_DURATION_MS };

test('meal orders are deterministic six-set requirements with one to three slots of every item', () => {
  assert.deepEqual(mealSequence(123), mealSequence(123));
  assert.notDeepEqual(mealSequence(123), mealSequence(124));
  assert.equal(mealSequence(123).length, 6);
  assert.ok(mealSequence(123).every(set => set.length === 3 && set.every(n => n >= 1 && n <= 3)));
});

test('meal inputs reserve one slot per colour, allow simultaneous other colours and settle on scheduled landings', () => {
  const run = new MealsRun(round,1000);
  assert.equal(run.tap(0,999).type,'ignored');
  for(const color of [-1,3,NaN,.5]) assert.equal(run.tap(color,1000).type,'ignored');
  assert.equal(run.tap(0,NaN).type,'ignored');
  for(let color=0;color<3;color++) assert.equal(run.tap(color,1000).type,'drop');
  assert.equal(run.tap(0,1001).type,'ignored');
  run.advance(1299); assert.equal(run.filledMask,0);
  run.advance(1300); assert.deepEqual(run.filled,[1,1,1]);
  assert.equal(run.feedback.at,1300);
});

test('six completed meals emit one success each and final elapsed includes the last scheduled landing on a delayed frame', () => {
  const run = new MealsRun(round,5000);
  let time=5000,lastAt=0;
  for(let set=0;set<6;set++){
    const required=[...run.requirements];
    for(let row=0;row<Math.max(...required);row++){
      required.forEach((count,color)=>{if(row<count) assert.equal(run.tap(color,time).type,'drop');});
      lastAt=time+MEALS_DROP_MS;
      run.advance(lastAt+50);
      time=lastAt+50;
    }
    assert.equal(run.cleared,set+1);
    assert.equal(run.events.length,set+1);
    assert.equal(run.events.at(-1).at,lastAt);
    if(set<5){
      assert.equal(run.tap(0,lastAt+MEALS_SERVE_MS-1).type,'ignored');
      time=lastAt+MEALS_SERVE_MS;
      run.advance(time);
    }
  }
  assert.equal(run.done,true);
  assert.equal(run.elapsed,lastAt-run.start);
  assert.equal(run.tap(0,lastAt+1).type,'ignored');
});

test('full columns cannot overflow, and a drop landing at the deadline cannot complete the meal', () => {
  const run=new MealsRun({...round,duration:300},1000);
  run.tap(0,1000);run.advance(1300);
  assert.equal(run.filledMask,0);
  assert.equal(run.tap(1,1300).type,'ignored');
  assert.equal(run.done,false);
  const full=new MealsRun(round,0);
  for(let count=0;count<full.requirements[0];count++) {full.tap(0,count*300);full.advance((count+1)*300);}
  assert.equal(full.tap(0,10000).type,'ignored');
  assert.equal(full.mistakes,0);
});
