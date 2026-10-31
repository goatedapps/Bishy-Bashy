import test from 'node:test';
import assert from 'node:assert/strict';
import { CoinStage, DodgeStage } from '../src/coins-dodge-view.js';
import { createRun, roundSettings } from '../shared/games.js';
class Element {
  constructor() {
    this.dataset = {};
    this.children = [];
    this.attributes = new Map();
    this.style = { setProperty() {} };
    this.classes = new Set();
    this.classList = { add: name => this.classes.add(name), toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) };
  }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
}

function withDocument(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  try { run(); } finally { globalThis.document = previous; }
}

for (const [game, Stage] of [['its-raining-coins', CoinStage], ['dodge-or-die', DodgeStage]]) {
  test(`${game}: remote and countdown lanes hide actual targets, while local play shows only the current challenge`, () => withDocument(() => {
    const round = { id: game, game, ...roundSettings(game, 123) }, run = createRun(round, 1000), stage = new Stage();
    const targets = game === 'its-raining-coins' ? [stage.coin, stage.decoy] : stage.obstacles;
    stage.render(round, run, 999, 0, true, true, 0);
    assert.ok(targets.every(target => target.hidden));
    stage.render(round, run, 1200, 0, true, true, 0);
    assert.ok(targets.some(target => !target.hidden));
    assert.match(stage.element.getAttribute('aria-label'), game === 'its-raining-coins' ? /Gold coin/ : /open lane/);
    stage.render(round, undefined, 1200, 0, true, true, 3);
    assert.ok(targets.every(target => target.hidden));
    if (stage.warning) assert.equal(stage.warning.hidden, true);
    stage.render(round, run, 1200, 0, true, true, 3, true);
    assert.ok(targets.every(target => target.hidden));
  }));
}

test('Coins renders each overlapping pair without exposing future launches',()=>withDocument(()=>{
 const game='its-raining-coins',round={id:'overlap',game,...roundSettings(game,123)},run=createRun(round,1000),view=new CoinStage();
 view.render(round,run,run.start+round.spawnMs-1,0,true,true,0);
 assert.equal(view.drops.filter(pair=>!pair[0].hidden).length,1);
 view.render(round,run,run.start+round.spawnMs+1,0,true,true,0);
 assert.equal(view.drops.filter(pair=>!pair[0].hidden).length,2);
 assert.ok(view.drops[2].every(drop=>drop.hidden));
 run.position=run.wave.column;run.advance(run.landAt);
 view.render(round,run,run.start+round.fallMs+1,0,true,true,run.cleared);
 assert.ok(view.drops.filter(pair=>!pair[0].hidden).length>=1);
}));
