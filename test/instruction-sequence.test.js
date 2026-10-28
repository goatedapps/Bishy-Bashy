import test from 'node:test';
import assert from 'node:assert/strict';
import { InstructionSequence } from '../src/instruction-sequence.js';

function setup() {
  const reveals = [];
  const elements = Array.from({ length: 5 }, (_, index) => {
    const classes = new Set();
    const attributes = new Map();
    return {
      index, classes, attributes,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
      setAttribute: (name, value) => attributes.set(name, value),
    };
  });
  const sequence = new InstructionSequence({ onReveal: step => reveals.push(step) });
  sequence.start('round', elements, 0);
  return { sequence, elements, reveals };
}

test('instructions reveal heading, artwork, and three rules over three seconds with one sound per step', () => {
  const { sequence, elements, reveals } = setup();
  assert.equal(sequence.complete, false);
  assert.ok(elements.every(element => element.attributes.get('aria-hidden') === 'true'));
  sequence.advance(0);
  sequence.advance(599);
  assert.deepEqual(reveals, [0]);
  sequence.advance(600);
  sequence.advance(1300);
  sequence.advance(2150);
  sequence.advance(2999);
  assert.deepEqual(reveals, [0, 1, 2, 3]);
  assert.equal(sequence.complete, false);
  sequence.advance(3000);
  assert.equal(sequence.complete, true);
  assert.deepEqual(reveals, [0, 1, 2, 3, 4]);
  assert.ok(elements.every(element => element.classes.has('is-revealed') && element.attributes.get('aria-hidden') === 'false'));
});

test('room redraws do not restart instructions, and a new round resets the sequence', () => {
  const { sequence, elements, reveals } = setup();
  sequence.advance(0);
  sequence.start('round', elements, 100);
  sequence.advance(100);
  assert.deepEqual(reveals, [0]);
  sequence.advance(650);
  sequence.start('next-round', elements, 700);
  assert.equal(sequence.revealed, 0);
  assert.ok(elements.every(element => !element.classes.has('is-revealed')));
  sequence.advance(700);
  assert.deepEqual(reveals, [0, 1, 0]);
});

test('hiding and delayed frames never release a backlog of sounds, and navigation cancels pending steps', () => {
  const { sequence, reveals } = setup();
  sequence.advance(0);
  sequence.advance(300, false);
  sequence.advance(10000, false);
  assert.deepEqual(reveals, [0]);
  sequence.advance(11000);
  sequence.advance(11001);
  assert.deepEqual(reveals, [0, 1]);
  sequence.advance(50000);
  assert.deepEqual(reveals, [0, 1, 2]);
  sequence.cancel();
  sequence.advance(100000);
  assert.deepEqual(reveals, [0, 1, 2]);
  assert.equal(sequence.complete, false);
});
