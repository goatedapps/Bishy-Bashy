import test from 'node:test';
import assert from 'node:assert/strict';
import { diceSequence, DICE_GAME } from '../shared/dice.js';
import { facingSequence, applyTurn, poseKey, FACING_GAME } from '../shared/facing.js';
import { createRun, roundSettings, comparePlayers } from '../shared/games.js';
import { ChoiceMatch, CHOICE_GRACE_MS } from '../shared/choice-round.js';
import { RoomService } from '../server/rooms.js';
const settings = (game, level = 1) => ({ id: 'round', game, playerIds: ['a', 'b', 'c'], ...roundSettings(game, 123, level) });

test('dice have exactly one seeded highest face and all seven speed groups give at least 800 ms per throw over 30.7 seconds', () => {
  const boards = diceSequence(123, 1000);
  assert.deepEqual(boards, diceSequence(123, 1000));
  assert.notDeepEqual(boards, diceSequence(124, 1000));
  for (const board of boards) {
    assert.equal(new Set(board.values).size, 3);
    assert.ok(board.values.every(value => value >= 1 && value <= 6));
    assert.equal(board.values[board.answer], Math.max(...board.values));
  }
  for (let level = 1; level <= 5; level++) {
    const round = settings(DICE_GAME, level), run = createRun(round, 1000);
    assert.equal(round.duration, 30700);
    assert.equal(run.goal, 21);
    assert.equal(run.stages.at(-1).endsAt, 30700);
    assert.deepEqual(run.stages.map(s => s.answerEnd - s.answerAt), [2000,1600,1400,1200,1000,900,800].flatMap(ms => [ms,ms,ms]));
    run.stages.forEach((stage, index) => assert.equal(stage.startsAt, index ? run.stages[index - 1].endsAt : 0));
  }
});

test('duck back/front poses compose through flips and every seeded puzzle has exactly one matching picture', () => {
  for (const angle of [0,90,180,270]) for (const back of [false,true]) {
    const pose = { angle, back };
    assert.deepEqual(applyTurn(applyTurn(pose, { kind: 'mirror' }), { kind: 'mirror' }), pose);
  }
  const boards = facingSequence(123, 500, 6);
  assert.deepEqual(boards, facingSequence(123, 500, 6));
  assert.notDeepEqual(boards, facingSequence(124, 500, 6));
  for (const board of boards) {
    const final = board.moves.reduce(applyTurn, board.initial);
    assert.deepEqual(final, board.poses.at(-1));
    assert.equal(new Set(board.options.map(poseKey)).size, 3);
    assert.equal(poseKey(board.options[board.answer]), poseKey(final));
    assert.ok(board.moves.some(move => move.kind === 'mirror'));
  }
});

for (const game of [DICE_GAME,FACING_GAME]) {
  test(`${game}: synchronized windows lock the first input, keep choices private, and award every correct player once`, () => {
    const round = settings(game), run = createRun(round, 1000), match = new ChoiceMatch(round, run.stages);
    for (const stage of run.stages) {
      const at = run.start + stage.answerAt + 10;
      assert.equal(run.tap(stage.puzzle.answer, at).type, 'choice');
      assert.equal(run.tap((stage.puzzle.answer + 1) % 3, at + 1).type, 'ignored');
      for (const id of ['a','b']) assert.ok(match.choose(id, { index: stage.index, color: stage.puzzle.answer, elapsed: stage.answerAt + 10 }, stage.answerAt + 20));
      assert.equal(match.choose('a', { index: stage.index, color: (stage.puzzle.answer + 1) % 3, elapsed: stage.answerAt + 11 }, stage.answerAt + 21), false);
      assert.equal(match.advance(stage.answerEnd - 1), false);
      assert.equal(match.state.results.length, stage.index);
      assert.equal(JSON.stringify(match.state).includes('elapsed'), false);
      assert.equal(match.advance(stage.answerEnd + CHOICE_GRACE_MS), true);
      assert.deepEqual(match.state.results.at(-1).correctIds, ['a','b']);
      assert.equal(match.state.results.at(-1).choices.c, null);
      assert.equal(match.advance(stage.answerEnd + CHOICE_GRACE_MS), false);
    }
    assert.deepEqual(match.state.scores, { a: run.goal, b: run.goal, c: 0 });
    run.sync(match.state,'a'); assert.equal(run.cleared, run.goal);
    assert.equal(run.tap(0,run.end).type,'ignored');
    assert.equal(run.phase(run.end).mode,'done');
  });

  test(`${game}: malformed, early, stale, future and post-deadline choices cannot score; valid retries are idempotent`, () => {
    const round = settings(game), run = createRun(round,0), match = new ChoiceMatch(round,run.stages), stage = run.stages[0];
    const choice = { index: 0, color: stage.puzzle.answer, elapsed: stage.answerAt + 20 };
    for (const update of [{index:-1},{index:999},{color:3},{color:NaN},{elapsed:NaN},{elapsed:stage.answerAt-1},{elapsed:stage.answerEnd}]) assert.equal(match.choose('a',{...choice,...update},choice.elapsed),false);
    assert.equal(match.choose('outsider',choice,choice.elapsed),false);
    assert.equal(match.choose('a',choice,choice.elapsed+801),false);
    assert.equal(match.choose('a',choice,choice.elapsed-251),false);
    assert.equal(match.choose('a',choice,stage.answerEnd+80),false);
    assert.ok(match.choose('a',choice,choice.elapsed+30));
    match.advance(stage.answerEnd+80);
    assert.ok(match.choose('a',choice,stage.answerEnd+100));
    assert.equal(match.choose('b',choice,stage.answerEnd+100),false);
  });

  test(`${game}: server rejects forged finishes, reveals together and awards only once`, () => {
    let time=1000000;
    const messages=[];
    const service=new RoomService({now:()=>time,send:(client,message)=>messages.push({client,message:structuredClone(message)})});
    const clients=[{},{}];
    service.handle(clients[0],{type:'create',name:'Host',mode:'game-select',game});
    const room=service.rooms.get(clients[0].room);
    service.handle(clients[1],{type:'join',name:'Guest',code:room.code});
    service.handle(clients[0],{type:'start'});
    clients.forEach(client=>{service.handle(client,{type:'sync',rtt:20,uncertainty:10,count:5});service.handle(client,{type:'ready',ready:true});});
    const round=room.round,run=createRun(round,0);
    time=round.startAt+100;
    service.handle(clients[0],{type:'result',roundId:round.id,status:'finished',cleared:round.goal,elapsed:100,mistakes:0});
    assert.equal(room.players[0].result,null);
    for(const stage of run.stages){
      time=round.startAt+stage.answerAt+10;
      clients.forEach((client,index)=>service.handle(client,{type:'shared-choice',roundId:round.id,index:stage.index,color:index && stage.index===0 ? (stage.puzzle.answer+1)%3 : stage.puzzle.answer,elapsed:stage.answerAt+10}));
      assert.equal(round.choice.results.length,stage.index);
      time=round.startAt+stage.answerEnd-1;service.tick();
      assert.equal(round.choice.results.length,stage.index);
      time=round.startAt+stage.answerEnd+80;service.tick();
      assert.equal(round.choice.results.length,stage.index+1);
    }
    time=round.endAt;service.tick();
    assert.deepEqual(room.players.map(p=>p.result.cleared),[round.goal,round.goal-1]);
    assert.deepEqual(room.set.players.map(p=>p.points),[10,7]);
    service.tick(); assert.equal(room.set.history.length,1);
    assert.equal(comparePlayers({...room.players[0],result:{status:'finished',cleared:2,elapsed:100}}, {...room.players[1],result:{status:'finished',cleared:2,elapsed:500}},game),0);
  });
}

test('Facing has five shared three-second answer windows after the cover, hold and complete turn sequence', () => {
  for(let level=1;level<=5;level++){
    const round=settings(FACING_GAME,level),run=createRun(round,1000);
    assert.equal(run.stages.length,5);
    assert.equal(run.stages.at(-1).endsAt,round.duration);
    for(const stage of run.stages){
      assert.equal(stage.answerEnd-stage.answerAt,3000);
      assert.equal(stage.turnsAt-stage.coveredAt,350);
      assert.equal(run.phase(run.start+stage.coveredAt-1).mode,'cover');
      assert.equal(run.phase(run.start+stage.turnsAt).mode,'turn');
      assert.equal(run.phase(run.start+stage.answerAt-1).mode,'handoff');
      assert.equal(run.tap(0,run.start+stage.answerAt-1).type,'ignored');
      assert.equal(run.phase(run.start+stage.answerAt).mode,'play');
    }
  }
});
