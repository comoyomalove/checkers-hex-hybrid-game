import assert from 'node:assert/strict';
import test from 'node:test';
import '../rules.js';

const rules = globalThis.CheckersHexRules;

test('empty board permits all placements and has no connection', () => {
  const board = rules.createBoard();
  assert.equal(board.length, 8);
  assert.equal(rules.legalMoves(board, 1).type, 'place');
  assert.equal(rules.legalMoves(board, 1).moves.length, 64);
  assert.equal(rules.hasConnection(board, 1), false);
  assert.equal(rules.hasConnection(board, 2), false);
  board[0][0] = 1;
  assert.equal(board[1][0], null);
});

test('an existing-piece capture takes priority over placement', () => {
  const board = rules.createBoard();
  board[3][3] = 1;
  board[2][3] = 2;
  assert.deepEqual(rules.legalMoves(board, 1), {
    type: 'existing-capture',
    moves: [{ fromQ: 3, fromR: 3, overQ: 3, overR: 2, landQ: 3, landR: 1 }],
  });
});

test('a placement-triggered capture does not require that placement', () => {
  const board = rules.createBoard();
  board[2][3] = 2;
  const legal = rules.legalMoves(board, 1);
  assert.equal(legal.type, 'place');
  assert.ok(legal.moves.some(([q, r]) => q === 3 && r === 3));
  assert.ok(legal.moves.some(([q, r]) => q === 0 && r === 0));
  assert.ok(rules.placementCaptures(board, 1).some(([q, r]) => q === 3 && r === 3));
});

test('existing-piece multi-jump captures both enemies without changing the input', () => {
  const board = rules.createBoard();
  board[6][3] = 1;
  board[5][3] = 2;
  board[3][3] = 2;
  const before = rules.copyBoard(board);
  const capture = rules.legalMoves(board, 1).moves[0];
  const result = rules.applyCapture(board, 1, capture);
  assert.deepEqual(result.captured, [[3, 5], [3, 3]]);
  assert.deepEqual(result.finalPos, [3, 2]);
  assert.equal(result.board[2][3], 1);
  assert.equal(result.board[6][3], null);
  assert.equal(result.board[5][3], null);
  assert.equal(result.board[3][3], null);
  assert.deepEqual(board, before);
});

test('placement can start a multi-jump capture chain', () => {
  const board = rules.createBoard();
  board[5][3] = 2;
  board[3][3] = 2;
  const before = rules.copyBoard(board);
  const result = rules.applyTurn(board, 1, 3, 6);
  assert.deepEqual(result.captured, [[3, 5], [3, 3]]);
  assert.deepEqual(result.finalPos, [3, 2]);
  assert.deepEqual(board, before);
});

test('east-west neighbors connect but cannot be jumped', () => {
  const board = rules.createBoard();
  board[3][3] = 1;
  board[3][4] = 2;
  assert.deepEqual(rules.jumpsFrom(board, 3, 3, 1), []);
});

for (const player of [1, 2]) {
  for (const axis of ['tb', 'lr']) {
    test(`player ${player} can win on the ${axis} axis`, () => {
      const board = rules.createBoard();
      for (let index = 0; index < 8; index++) {
        board[axis === 'tb' ? index : 3][axis === 'tb' ? 3 : index] = player;
      }
      assert.equal(rules.hasConnectionAxis(board, player, axis), true);
      assert.equal(rules.hasConnection(board, player), true);
      assert.equal(rules.hasConnection(board, 3 - player), false);
      assert.equal(rules.findWinPathAxis(board, player, axis).length, 8);
      board[3][3] = null;
      assert.equal(rules.hasConnection(board, player), false);
      assert.deepEqual(rules.findWinPath(board, player), []);
    });
  }
}

test('capture cannot jump off the board or onto an occupied landing cell', () => {
  const board = rules.createBoard();
  board[1][3] = 1;
  board[0][3] = 2;
  assert.deepEqual(rules.jumpsFrom(board, 3, 1, 1), []);
  board[3][3] = 1;
  board[2][3] = 2;
  assert.deepEqual(rules.jumpsFrom(board, 3, 3, 1), []);
});
