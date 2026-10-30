import test from 'node:test';
import assert from 'node:assert/strict';
import { DynamiteRun } from '../shared/dynamite.js';
import { roundSettings } from '../shared/games.js';
const round={id:'d',game:'dynamite-spark',...roundSettings('dynamite-spark',123)};
test('Dynamite has 13 distinct adjacent groups of four sections and completes on the 52nd local press',()=>{
 const run=new DynamiteRun(round,1000);assert.equal(run.sequence.length,52);
 for(let i=0;i<13;i++){assert.equal(new Set(run.sequence.slice(i*4,i*4+4)).size,1);if(i)assert.notEqual(run.sequence[i*4],run.sequence[i*4-1]);}
 assert.deepEqual(run.sequence,new DynamiteRun(round,0).sequence);
 while(!run.done){const cleared=run.cleared,at=1100+cleared*50;const result=run.tap(run.sequence[cleared],at);assert.equal(run.cleared,cleared+1);if(cleared===51){assert.equal(result.type,'finished');assert.equal(result.elapsed,2650);}}
 assert.equal(run.tap(0,4000).type,'ignored');
});
test('Dynamite rejects invalid and deadline taps, and wrong colours freeze without discarding progress',()=>{
 const run=new DynamiteRun(round,1000);for(const color of [-1,3,NaN])assert.equal(run.tap(color,1100).type,'ignored');
 for(const at of [999,NaN,Infinity,run.end])assert.equal(run.tap(0,at).type,'ignored');
 run.tap(run.sequence[0],1100);assert.equal(run.tap((run.sequence[1]+1)%3,1150).type,'mistake');assert.equal(run.cleared,1);
 assert.equal(run.tap(run.sequence[1],1399).type,'ignored');assert.equal(run.tap(run.sequence[1],1400).type,'move');assert.equal(run.cleared,2);
});
