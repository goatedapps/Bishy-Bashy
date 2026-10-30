import test from 'node:test';
import assert from 'node:assert/strict';
import { SharedChoiceStage } from '../src/shared-choice-view.js';
import { createRun, roundSettings } from '../shared/games.js';
import { ChoiceMatch } from '../shared/choice-round.js';
class Element {
  constructor(){this.dataset={};this.children=[];this.attributes=new Map();this.styles={};this.style={setProperty:(key,value)=>{this.styles[key]=value;}};this.classes=new Set();this.classList={add:name=>this.classes.add(name),toggle:(name,value)=>value?this.classes.add(name):this.classes.delete(name)};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(name,value){this.attributes.set(name,value);}
  getAttribute(name){return this.attributes.get(name);}
}
for(const game of ['dice-dice-more-dice','facing-which-way']) test(`${game}: common options and fixed player columns hide answers until the deadline`,()=>{
  const previous=globalThis.document;globalThis.document={createElement:()=>new Element()};
  try{
    const players=[{id:'a',name:'Solo',connected:true}];
    const round={id:'r',game,playerIds:['a'],...roundSettings(game,123)};
    const run=createRun(round,1000),match=new ChoiceMatch(round,run.stages);round.choice=match.state;
    const room={round,players,set:{players}},local={run},view=new SharedChoiceStage(),stage=run.stages[0];
    view.render(room,'a',local,999);
    assert.equal(view.rows[0].card.styles['grid-column'],'1');
    if(game==='facing-which-way'){
      view.render(room,'a',local,run.start+stage.turnsAt);
      assert.equal(view.options.hidden,true); assert.equal(view.duck.hidden,true);
      assert.equal(view.card.getAttribute('aria-label'),'Covered duck card');
    }
    run.tap(stage.puzzle.answer,run.start+stage.answerAt+10);
    match.choose('a',{index:0,color:stage.puzzle.answer,elapsed:stage.answerAt+10},stage.answerAt+20);
    view.render(room,'a',local,run.start+stage.answerAt+30);
    assert.equal(view.options.hidden,false);
    assert.equal(view.rows[0].selection.textContent,'Locked');
    assert.equal(view.rows[0].result.hidden,true);
    assert.ok(view.optionCards.every(option=>option.players.children.length===0));
    match.advance(stage.answerEnd+80);
    view.render(room,'a',local,run.start+stage.answerEnd-1);
    assert.equal(view.rows[0].result.hidden,true);
    view.render(room,'a',local,run.start+stage.answerEnd+80);
    assert.equal(view.rows[0].result.hidden,false);
    assert.equal(view.rows[0].score.textContent,'1');
    assert.equal(view.optionCards[stage.puzzle.answer].players.children.length,1);
    if(game==='facing-which-way') assert.match(view.optionCards[stage.puzzle.answer].duck.getAttribute('aria-label'), /Front|Back/);
    view.render(room,'a',local,run.start+run.stages[1].startsAt);
    assert.ok(view.optionCards.every(option=>option.players.children.length===0));
  }finally{globalThis.document=previous;}
});
