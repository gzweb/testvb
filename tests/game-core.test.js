import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BEST_SCORE_KEY,
  GameCore,
  classifyRecord,
  createBestScoreStore,
} from '../game-core.js';

const RIGHT = { x: 1, y: 0 };

function cellKey(cell) {
  return `${cell.x},${cell.y}`;
}

function makeGame(overrides = {}) {
  return new GameCore({
    initialSnake: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ],
    initialFood: { x: 10, y: 10 },
    random: () => 0,
    ...overrides,
  });
}

test('initial state is a 20x20 board with a length-3 snake facing right', () => {
  const game = new GameCore({ random: () => 0 });

  assert.equal(game.cols, 20);
  assert.equal(game.rows, 20);
  assert.equal(game.state, 'idle');
  assert.equal(game.snake.length, 3);
  assert.deepEqual(game.direction, RIGHT);
  assert.equal(game.score, 0);
  assert.equal(game.stepMs, 150);
  assert.ok(game.food);
  assert.equal(game.snake.some((segment) => cellKey(segment) === cellKey(game.food)), false);
});

test('valid turns are accepted and a 180-degree reverse is rejected without queueing', () => {
  const game = makeGame();
  game.start();

  assert.equal(game.turn(0, -1), true);
  assert.equal(game.turn(0, 0), false);
  assert.equal(game.step(), 'moved');
  assert.deepEqual(game.direction, { x: 0, y: -1 });

  assert.equal(game.turn(0, 1), false);
  assert.equal(game.step(), 'moved');
  assert.deepEqual(game.direction, { x: 0, y: -1 });

  assert.equal(game.turn(1, 0), true);
  assert.equal(game.step(), 'moved');
  assert.deepEqual(game.direction, RIGHT);
});

test('a rejected reverse never becomes effective on a later step', () => {
  const game = makeGame();
  game.start();

  assert.equal(game.turn(-1, 0), false);
  assert.equal(game.step(), 'moved');
  assert.equal(game.step(), 'moved');
  assert.deepEqual(game.direction, RIGHT);
  assert.equal(game.state, 'running');
});

test('turns are ignored outside the running state', () => {
  const game = makeGame();
  assert.equal(game.turn(0, -1), false);
  game.start();
  game.pause();
  assert.equal(game.turn(0, -1), false);
  game.resume();
  game.turn(0, -1);
  game.step();
  game.restart();
  assert.equal(game.turn(0, -1), true);
  assert.equal(game.turn(0, 1), true);
});

test('eating scores 10, grows by one, speeds up and places food on an empty cell', () => {
  const game = makeGame({ initialFood: { x: 6, y: 5 } });
  game.start();

  assert.equal(game.step(), 'ate');
  assert.equal(game.score, 10);
  assert.equal(game.snake.length, 4);
  assert.equal(game.stepMs, 144);
  assert.equal(game.snake.some((segment) => cellKey(segment) === cellKey(game.food)), false);
});

test('three foods reduce the step to 132ms and each step advances exactly one cell', () => {
  const game = makeGame({ initialFood: { x: 6, y: 5 } });
  game.start();

  for (let index = 0; index < 3; index += 1) {
    game.food = { x: game.snake[0].x + 1, y: game.snake[0].y };
    const previousLength = game.snake.length;
    assert.equal(game.step(), 'ate');
    assert.equal(game.snake.length, previousLength + 1);
  }

  assert.equal(game.score, 30);
  assert.equal(game.stepMs, 132);
});

test('speed never drops below the configured 70ms floor', () => {
  const game = makeGame({ initialStepMs: 76 });
  game.start();

  game.food = { x: 6, y: 5 };
  assert.equal(game.step(), 'ate');
  assert.equal(game.stepMs, 70);
});

test('crossing a wall ends the game and preserves the score', () => {
  const game = makeGame({
    initialSnake: [
      { x: 19, y: 5 },
      { x: 18, y: 5 },
      { x: 17, y: 5 },
    ],
    initialFood: { x: 1, y: 1 },
  });
  game.start();

  assert.equal(game.step(), 'gameover');
  assert.equal(game.state, 'gameover');
  assert.equal(game.score, 0);
  assert.equal(game.step(), 'ignored');
});

test('entering a non-tail body cell ends the game', () => {
  const game = makeGame({
    initialSnake: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
    ],
    direction: RIGHT,
    initialFood: { x: 10, y: 10 },
  });
  game.start();

  assert.equal(game.step(), 'gameover');
  assert.equal(game.state, 'gameover');
});

test('moving into the tail cell is legal when the tail moves away on that step', () => {
  const game = makeGame({
    initialSnake: [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 2 },
    ],
    direction: RIGHT,
    initialFood: { x: 10, y: 10 },
  });
  game.start();

  assert.equal(game.step(), 'moved');
  assert.equal(game.state, 'running');
  assert.deepEqual(game.snake[0], { x: 3, y: 2 });
});

test('pause stops turns and steps until resume', () => {
  const game = makeGame();
  game.start();
  game.turn(0, -1);
  assert.equal(game.pause(), true);
  assert.equal(game.state, 'paused');
  assert.equal(game.step(), 'ignored');
  assert.equal(game.turn(1, 0), false);
  assert.equal(game.resume(), true);
  assert.equal(game.step(), 'moved');
  assert.deepEqual(game.direction, RIGHT);
});

test('a turn already applied before pause is kept after resume', () => {
  const game = makeGame();
  game.start();
  game.turn(0, -1);
  game.step();
  game.pause();
  game.resume();
  game.step();

  assert.deepEqual(game.direction, { x: 0, y: -1 });
});

test('restart resets the snake, score, direction, speed, board and state', () => {
  const game = makeGame({ initialFood: { x: 6, y: 5 } });
  game.start();
  game.step();
  game.step();
  game.pause();

  assert.equal(game.restart(), true);
  assert.equal(game.state, 'running');
  assert.equal(game.snake.length, 3);
  assert.equal(game.score, 0);
  assert.deepEqual(game.direction, RIGHT);
  assert.equal(game.stepMs, 150);
  assert.deepEqual(game.snake[0], { x: 5, y: 5 });
  assert.equal(game.snake.some((segment) => cellKey(segment) === cellKey(game.food)), false);
});

test('record text covers new record, positive tie, lower score and first 0/0', () => {
  assert.equal(classifyRecord(30, 20), '新纪录！');
  assert.equal(classifyRecord(20, 20), '追平最高分（未破纪录）');
  assert.equal(classifyRecord(10, 20), '未破纪录');
  assert.equal(classifyRecord(0, 0), '未破纪录');
});

test('best-score store reads valid values and ignores malformed values', () => {
  const storage = {
    value: '30',
    getItem(key) {
      assert.equal(key, BEST_SCORE_KEY);
      return this.value;
    },
    setItem(key, value) {
      assert.equal(key, BEST_SCORE_KEY);
      this.value = value;
    },
  };

  assert.equal(createBestScoreStore(storage).get(), 30);
  storage.value = '30abc';
  assert.equal(createBestScoreStore(storage).get(), 0);
  storage.value = '-10';
  assert.equal(createBestScoreStore(storage).get(), 0);
});

test('best-score store persists a new maximum and keeps an in-memory fallback', () => {
  const storage = {
    value: '10',
    getItem() {
      return this.value;
    },
    setItem(_key, value) {
      this.value = value;
    },
  };
  const store = createBestScoreStore(storage);
  assert.equal(store.record(20), 20);
  assert.equal(storage.value, '20');
  assert.equal(store.record(10), 20);

  const failingStorage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  const fallbackStore = createBestScoreStore(failingStorage);
  assert.equal(fallbackStore.get(), 0);
  assert.equal(fallbackStore.record(40), 40);
  assert.equal(fallbackStore.get(), 40);
});
