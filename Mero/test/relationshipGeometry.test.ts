import assert from 'node:assert/strict';
import test from 'node:test';
import { cubicPath, relationshipPairs, visibleCards } from '../lib/relationshipGeometry.ts';

test('visibleCards transforms board geometry and caps matrix input', () => {
  const cards = Array.from({ length: 60 }, (_, index) => ({ itemId: String(index), noteId: `note-${index}`, x: index * 10, y: 10, width: 100, height: 80 }));
  const visible = visibleCards(cards, { width: 1000, height: 600 }, { x: 5, y: 7, k: 2 });
  assert.equal(visible.length, 50);
  assert.deepEqual({ x: visible[0].centerX, y: visible[0].centerY }, { x: 105, y: 107 });
});

test('relationshipPairs emits each symmetric pair once and rejects invalid scores', () => {
  const cards = visibleCards([
    { itemId: 'a', noteId: 'a', x: 0, y: 0, width: 100, height: 100 },
    { itemId: 'b', noteId: 'b', x: 200, y: 0, width: 100, height: 100 },
    { itemId: 'c', noteId: 'c', x: 400, y: 0, width: 100, height: 100 },
  ], { width: 800, height: 600 }, { x: 0, y: 0, k: 1 });
  const pairs = relationshipPairs(cards, ['a', 'b', 'c'], [[1, 0.8, 0], [0.8, 1, Number.NaN], [0, Number.NaN, 1]], 0.5);
  assert.equal(pairs.length, 1);
  assert.equal(`${pairs[0].left.noteId}:${pairs[0].right.noteId}`, 'a:b');
  assert.match(cubicPath(pairs[0]), /^M 50 50 C /);
});

test('duplicate cards for one note are not linked to each other', () => {
  const cards = visibleCards([
    { itemId: 'a1', noteId: 'a', x: 0, y: 0, width: 10, height: 10 },
    { itemId: 'a2', noteId: 'a', x: 30, y: 0, width: 10, height: 10 },
  ], { width: 100, height: 100 }, { x: 0, y: 0, k: 1 });
  assert.deepEqual(relationshipPairs(cards, ['a'], [[1]], 0.5), []);
});
