export const BEST_SCORE_KEY = 'snake-h5.best-score';

export const DEFAULT_CONFIG = Object.freeze({
  cols: 20,
  rows: 20,
  initialStepMs: 150,
  speedUpMs: 6,
  minStepMs: 70,
  foodPoints: 10,
});

const INITIAL_SNAKE = Object.freeze([
  Object.freeze({ x: 10, y: 10 }),
  Object.freeze({ x: 9, y: 10 }),
  Object.freeze({ x: 8, y: 10 }),
]);

const CARDINAL_DIRECTIONS = new Set(['1,0', '-1,0', '0,1', '0,-1']);

function copyCell(cell) {
  return { x: cell.x, y: cell.y };
}

function sameCell(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

function isCardinal(dx, dy) {
  return CARDINAL_DIRECTIONS.has(`${dx},${dy}`);
}

function inferDirection(snake) {
  if (!snake || snake.length < 2) return { x: 1, y: 0 };
  const dx = snake[0].x - snake[1].x;
  const dy = snake[0].y - snake[1].y;
  return isCardinal(dx, dy) ? { x: dx, y: dy } : { x: 1, y: 0 };
}

/**
 * DOM-free state machine. Callers treat properties as read-only and drive it
 * through start/turn/step/pause/resume/restart.
 */
export class GameCore {
  constructor(options = {}) {
    this.cols = options.cols ?? DEFAULT_CONFIG.cols;
    this.rows = options.rows ?? DEFAULT_CONFIG.rows;
    this.initialStepMs = options.initialStepMs ?? DEFAULT_CONFIG.initialStepMs;
    this.speedUpMs = options.speedUpMs ?? DEFAULT_CONFIG.speedUpMs;
    this.minStepMs = options.minStepMs ?? DEFAULT_CONFIG.minStepMs;
    this.foodPoints = options.foodPoints ?? DEFAULT_CONFIG.foodPoints;
    this.random = typeof options.random === 'function' ? options.random : Math.random;

    const snakeSource = options.initialSnake ?? INITIAL_SNAKE;
    this.initialSnake = snakeSource.map(copyCell);
    this.initialDirection = options.direction
      ? copyCell(options.direction)
      : inferDirection(this.initialSnake);
    this.fixedInitialFood = options.initialFood ? copyCell(options.initialFood) : null;

    this.state = 'idle';
    this.snake = [];
    this.direction = { x: 1, y: 0 };
    this.pendingDirection = null;
    this.food = null;
    this.score = 0;
    this.stepMs = this.initialStepMs;
    this.#resetBoard('idle');
  }

  start() {
    if (this.state !== 'idle') return false;
    this.state = 'running';
    return true;
  }

  turn(dx, dy) {
    if (this.state !== 'running' || !isCardinal(dx, dy)) return false;
    const isSame = dx === this.direction.x && dy === this.direction.y;
    const isReverse = dx === -this.direction.x && dy === -this.direction.y;
    if (isSame || isReverse) return false;

    this.pendingDirection = { x: dx, y: dy };
    return true;
  }

  step() {
    if (this.state !== 'running') return 'ignored';

    const nextDirection = this.pendingDirection ?? this.direction;
    this.pendingDirection = null;
    this.direction = nextDirection;
    const nextHead = {
      x: this.snake[0].x + nextDirection.x,
      y: this.snake[0].y + nextDirection.y,
    };

    if (this.#isOutside(nextHead)) {
      this.state = 'gameover';
      return 'gameover';
    }

    const ate = sameCell(nextHead, this.food);
    const collisionBody = ate ? this.snake : this.snake.slice(0, -1);
    if (collisionBody.some((segment) => sameCell(segment, nextHead))) {
      this.state = 'gameover';
      return 'gameover';
    }

    this.snake.unshift(nextHead);
    if (!ate) {
      this.snake.pop();
      return 'moved';
    }

    this.score += this.foodPoints;
    this.stepMs = Math.max(this.minStepMs, this.stepMs - this.speedUpMs);
    this.food = this.#pickFoodCell();
    return 'ate';
  }

  pause() {
    if (this.state !== 'running') return false;
    this.state = 'paused';
    this.pendingDirection = null;
    return true;
  }

  resume() {
    if (this.state !== 'paused') return false;
    this.state = 'running';
    return true;
  }

  restart() {
    this.#resetBoard('running');
    return true;
  }

  #resetBoard(state) {
    this.snake = this.initialSnake.map(copyCell);
    this.direction = copyCell(this.initialDirection);
    this.pendingDirection = null;
    this.score = 0;
    this.stepMs = this.initialStepMs;
    this.food = this.#validInitialFood() ?? this.#pickFoodCell();
    this.state = state;
  }

  #validInitialFood() {
    if (!this.fixedInitialFood) return null;
    if (this.#isOutside(this.fixedInitialFood)) return null;
    if (this.snake.some((segment) => sameCell(segment, this.fixedInitialFood))) return null;
    return copyCell(this.fixedInitialFood);
  }

  #pickFoodCell() {
    const occupied = new Set(this.snake.map((segment) => `${segment.x},${segment.y}`));
    const candidates = [];
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        if (!occupied.has(`${x},${y}`)) candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) return null;

    const randomValue = Number(this.random());
    const normalized = Number.isFinite(randomValue)
      ? Math.min(0.999999999, Math.max(0, randomValue))
      : 0;
    return candidates[Math.floor(normalized * candidates.length)];
  }

  #isOutside(cell) {
    return cell.x < 0 || cell.x >= this.cols || cell.y < 0 || cell.y >= this.rows;
  }
}

export function classifyRecord(score, bestAtRoundStart) {
  if (score > bestAtRoundStart) return '新纪录！';
  if (score === bestAtRoundStart && score > 0) return '追平最高分（未破纪录）';
  return '未破纪录';
}

export function createBestScoreStore(storage = null) {
  let best = readStoredBest(storage);

  return {
    get() {
      return best;
    },
    record(score) {
      if (!Number.isSafeInteger(score) || score < 0 || score <= best) return best;
      best = score;
      try {
        storage?.setItem(BEST_SCORE_KEY, String(best));
      } catch {
        // Keep the in-memory value when browser storage is unavailable.
      }
      return best;
    },
  };
}

function readStoredBest(storage) {
  try {
    const raw = storage?.getItem(BEST_SCORE_KEY);
    if (typeof raw !== 'string' || !/^(0|[1-9]\d*)$/.test(raw)) return 0;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}
