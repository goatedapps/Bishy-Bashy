import test from 'node:test';
import assert from 'node:assert/strict';
import { SlotStage } from '../src/slot-view.js';
import { slotLayout } from '../shared/slots.js';
class Element{
 constructor(){this.dataset={};this.style={setProperty(){}};this.children=[];this.attrs={};this.classList={toggle(){}};}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(name,value){this.attrs[name]=value;}
}
test('slot stages discard previous-round faces and locks even if their cached step is unchanged',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>new Element()};
 try{
  const stage=new SlotStage();
  for(let round=0;round<3;round++){
   const settings={id:`round-${round}`,seed:123+round,stepMs:320-round*30};
   stage.render(settings,0,0,undefined,true,true);
   const layout=slotLayout(settings.seed);
   stage.reels.forEach((reel,row)=>{
    assert.equal(reel.faces[2].dataset.face,String(layout.reels[row][0]));
    assert.match(reel.window.attrs['aria-label'],/spinning/);
   });
   stage.render(settings,7,100,undefined,true,true);
   assert.ok(stage.reels.every(reel=>reel.faces.every(face=>face.dataset.face===String(layout.target))));
  }
 }finally{globalThis.document=previous;}
});
