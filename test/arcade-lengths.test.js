import test from 'node:test';
import assert from 'node:assert/strict';
import { roundSettings, createRun, gameRules } from '../shared/games.js';
import { ChoiceMatch } from '../shared/choice-round.js';
import { roundDetail } from '../shared/sets.js';
test('Arcade lengths grow while all Game Select counts remain unchanged',()=>{
 for(let level=1;level<=3;level++)for(const [game,arcadeGoal,selectGoal] of [['me-find-mistake',15,7+level],['facing-which-way',8,5],['fireworks-craze',10,7]]){
  const arcade=roundSettings(game,123,1,'arcade'),selected=roundSettings(game,123,level,'game-select');
  assert.equal(arcade.goal,arcadeGoal);assert.equal(selected.goal,selectGoal);
 }
});
test('extra Arcade Fireworks sets finish only after all ten sets, including 41 rockets',()=>{
 const round={id:'f',game:'fireworks-craze',...roundSettings('fireworks-craze',123,1,'arcade')},run=createRun(round,1000);let rockets=0;
 while(!run.done){
  const current=run.rockets;let at=current.at(-1).launchAt+100;
  for(const rocket of current.toReversed()){run.tap(rocket.color,at);at+=100;rockets++;}
  if(run.cleared===7)assert.equal(run.done,false);
 }
 assert.equal(run.goal,10);assert.equal(run.cleared,10);assert.equal(rockets,41);assert.ok(run.elapsed<round.duration);
});
test('all eight shared Arcade Facing sets retain three-second windows and settle authoritative scores',()=>{
 const round={id:'f',game:'facing-which-way',playerIds:['a','b'],...roundSettings('facing-which-way',123,1,'arcade')},run=createRun(round,0),match=new ChoiceMatch(round,run.stages);
 assert.equal(run.stages.length,8);assert.equal(round.duration,58400);assert.equal(run.stages.at(-1).endsAt,round.duration);
 for(const stage of run.stages){assert.equal(stage.answerEnd-stage.answerAt,3000);match.choose('a',{index:stage.index,color:stage.puzzle.answer,elapsed:stage.answerAt+100},stage.answerAt+110);match.advance(stage.answerEnd+80);}
 assert.equal(match.state.scores.a,8);assert.equal(match.state.scores.b,0);assert.match(gameRules(round.game,round).at(-1),/8 wins/);assert.match(roundDetail(round),/8 sets/);
});
test('Arcade Mistake advances through fifteen boards and counts correct answers',()=>{
 const round={id:'m',game:'me-find-mistake',...roundSettings('me-find-mistake',123,1,'arcade')},run=createRun(round,0);
 while(!run.done)run.tap((run.puzzle.odd+(run.index%3===0?1:0))%3,run.readyAt+200);
 assert.equal(run.index,15);assert.equal(run.cleared,10);assert.equal(run.mistakes,5);assert.ok(run.elapsed<round.duration);
});
