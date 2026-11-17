import {
  GameCore,
  classifyRecord,
  createBestScoreStore,
} from './game-core.js';

const elements = {
  shell: document.querySelector('#game-shell'),
  canvas: document.querySelector('#board'),
  boardWrap: document.querySelector('#board-wrap'),
  controls: document.querySelector('#controls-panel'),
  pauseButton: document.querySelector('#pause-button'),
  startButton: document.querySelector('#start-button'),
  resumeButton: document.querySelector('#resume-button'),
  restartButton: document.querySelector('#restart-button'),
  againButton: document.querySelector('#again-button'),
  idleOverlay: document.querySelector('#idle-overlay'),
  pauseOverlay: document.querySelector('#pause-overlay'),
  gameoverOverlay: document.querySelector('#gameover-overlay'),
  scoreValue: document.querySelector('#score-value'),
  bestValue: document.querySelector('#best-value'),
  idleBestValue: document.querySelector('#idle-best-value'),
  finalScore: document.querySelector('#final-score'),
  finalBest: document.querySelector('#final-best'),
  recordText: document.querySelector('#record-text'),
  announcer: document.querySelector('#announcer'),
  stats: document.querySelector('#stats'),
  dpad: document.querySelector('#dpad'),
};

const DIRECTION_KEYS = new Map([
  ['ArrowUp', { x: 0, y: -1 }],
  ['ArrowDown', { x: 0, y: 1 }],
  ['ArrowLeft', { x: -1, y: 0 }],
  ['ArrowRight', { x: 1, y: 0 }],
  ['w', { x: 0, y: -1 }],
  ['s', { x: 0, y: 1 }],
  ['a', { x: -1, y: 0 }],
  ['d', { x: 1, y: 0 }],
]);

const DPAD_DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
].join(',');

function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const game = new GameCore();
const bestStore = createBestScoreStore(getBrowserStorage());
let best = bestStore.get();
let bestAtRoundStart = best;
let animationFrameId = null;
let lastFrameTime = null;
let accumulator = 0;
let autoPaused = false;

const context = elements.canvas.getContext('2d');
const dpadButtons = [...elements.dpad.querySelectorAll('button[data-direction]')];

function updateText(element, text) {
  const next = String(text);
  if (element.textContent !== next) element.textContent = next;
}

function announce(message) {
  elements.announcer.textContent = '';
  window.setTimeout(() => {
    elements.announcer.textContent = message;
  }, 20);
}

function updateHud() {
  updateText(elements.scoreValue, game.score);
  updateText(elements.bestValue, best);
  updateText(elements.idleBestValue, best);
  elements.stats.setAttribute('aria-label', `得分 ${game.score}，最高分 ${best}`);
  elements.canvas.setAttribute(
    'aria-label',
    `20乘20贪吃蛇棋盘，蛇长 ${game.snake.length}，本局得分 ${game.score}`,
  );
}

function setBackgroundInert(inert) {
  for (const element of [elements.canvas, elements.controls]) {
    if ('inert' in element) element.inert = inert;
    if (inert) element.setAttribute('aria-hidden', 'true');
    else element.removeAttribute('aria-hidden');
  }
}

function syncUi() {
  const state = game.state;
  elements.shell.dataset.state = state;

  elements.idleOverlay.hidden = state !== 'idle';
  elements.pauseOverlay.hidden = state !== 'paused';
  elements.gameoverOverlay.hidden = state !== 'gameover';
  elements.controls.hidden = state === 'idle';
  elements.pauseButton.hidden = state !== 'running';

  const controlsEnabled = state === 'running';
  elements.canvas.tabIndex = controlsEnabled ? 0 : -1;
  for (const button of dpadButtons) button.disabled = !controlsEnabled;
  setBackgroundInert(!controlsEnabled);
  updateHud();
}

function resetLoopClock() {
  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  lastFrameTime = null;
  accumulator = 0;
}

function startLoop() {
  resetLoopClock();
  animationFrameId = window.requestAnimationFrame(runFrame);
}

function runFrame(timestamp) {
  if (game.state !== 'running') {
    animationFrameId = null;
    return;
  }

  if (lastFrameTime === null) lastFrameTime = timestamp;
  const elapsed = Math.max(0, timestamp - lastFrameTime);
  lastFrameTime = timestamp;
  accumulator += elapsed;

  const interval = game.stepMs;
  if (accumulator >= interval) {
    const result = game.step();
    accumulator -= interval;
    if (accumulator >= game.stepMs) accumulator = 0;
    updateHud();
    drawBoard();

    if (result === 'gameover') {
      handleGameOver();
      return;
    }
  } else {
    drawBoard();
  }

  animationFrameId = window.requestAnimationFrame(runFrame);
}

function beginRound(restart) {
  if (restart) game.restart();
  else game.start();

  best = bestStore.get();
  bestAtRoundStart = best;
  autoPaused = false;
  resetLoopClock();
  syncUi();
  drawBoard();
  elements.canvas.focus({ preventScroll: true });
  startLoop();
  announce(`游戏开始。最高分 ${best}`);
}

function pauseGame({ automatic = false, moveFocus = true } = {}) {
  if (!game.pause()) return;
  if (!automatic) autoPaused = false;
  resetLoopClock();
  syncUi();
  drawBoard();
  announce(automatic ? '页面进入后台，游戏已自动暂停' : '游戏已暂停');
  if (moveFocus) elements.resumeButton.focus({ preventScroll: true });
}

function resumeGame() {
  if (!game.resume()) return;
  autoPaused = false;
  resetLoopClock();
  syncUi();
  drawBoard();
  elements.canvas.focus({ preventScroll: true });
  startLoop();
  announce('继续游戏');
}

function togglePause() {
  if (game.state === 'running') pauseGame();
  else if (game.state === 'paused') resumeGame();
}

function handleGameOver() {
  resetLoopClock();
  const record = classifyRecord(game.score, bestAtRoundStart);
  if (game.score > bestAtRoundStart) {
    best = bestStore.record(game.score);
  } else {
    best = bestStore.get();
  }

  updateText(elements.finalScore, game.score);
  updateText(elements.finalBest, best);
  updateText(elements.recordText, record);
  syncUi();
  drawBoard();
  elements.againButton.focus({ preventScroll: true });
  announce(`游戏结束。本局得分 ${game.score}，最高分 ${best}。${record}`);
}

function drawBoard() {
  if (!context) return;
  const width = elements.canvas.clientWidth;
  const height = elements.canvas.clientHeight;
  if (width <= 0 || height <= 0) return;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (elements.canvas.width !== pixelWidth || elements.canvas.height !== pixelHeight) {
    elements.canvas.width = pixelWidth;
    elements.canvas.height = pixelHeight;
  }

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const size = Math.min(width, height);
  const cellSize = size / game.cols;
  context.fillStyle = '#07101d';
  context.fillRect(0, 0, size, size);

  for (let y = 0; y < game.rows; y += 1) {
    for (let x = 0; x < game.cols; x += 1) {
      if ((x + y) % 2 === 0) {
        context.fillStyle = 'rgba(148, 163, 184, 0.035)';
        context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  context.strokeStyle = 'rgba(148, 163, 184, 0.055)';
  context.lineWidth = 1;
  for (let index = 1; index < game.cols; index += 1) {
    const position = Math.round(index * cellSize) + 0.5;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, size);
    context.stroke();
    context.beginPath();
    context.moveTo(0, position);
    context.lineTo(size, position);
    context.stroke();
  }

  if (game.food) {
    const centerX = (game.food.x + 0.5) * cellSize;
    const centerY = (game.food.y + 0.5) * cellSize;
    context.beginPath();
    context.fillStyle = 'rgba(251, 146, 60, 0.18)';
    context.arc(centerX, centerY, cellSize * 0.43, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.fillStyle = '#fb923c';
    context.arc(centerX, centerY, cellSize * 0.3, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.fillStyle = '#ffedd5';
    context.arc(centerX - cellSize * 0.08, centerY - cellSize * 0.09, cellSize * 0.075, 0, Math.PI * 2);
    context.fill();
  }

  for (let index = game.snake.length - 1; index >= 0; index -= 1) {
    const segment = game.snake[index];
    const inset = Math.max(1.1, cellSize * 0.075);
    const radius = Math.max(2, cellSize * 0.26);
    context.fillStyle = index === 0 ? '#5eead4' : index % 2 === 0 ? '#2dd4bf' : '#34d399';
    roundedRect(
      context,
      segment.x * cellSize + inset,
      segment.y * cellSize + inset,
      cellSize - inset * 2,
      cellSize - inset * 2,
      radius,
    );
    context.fill();
  }

  drawHeadEyes(cellSize);
}

function roundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function drawHeadEyes(cellSize) {
  const head = game.snake[0];
  if (!head) return;
  const centerX = (head.x + 0.5) * cellSize;
  const centerY = (head.y + 0.5) * cellSize;
  const forwardX = game.direction.x * cellSize * 0.16;
  const forwardY = game.direction.y * cellSize * 0.16;
  const sideX = game.direction.y * cellSize * 0.14;
  const sideY = -game.direction.x * cellSize * 0.14;
  const radius = Math.max(1.2, cellSize * 0.055);

  context.fillStyle = '#052e16';
  for (const sign of [-1, 1]) {
    context.beginPath();
    context.arc(
      centerX + forwardX + sideX * sign,
      centerY + forwardY + sideY * sign,
      radius,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

function handleDirection(direction) {
  if (game.state === 'running') game.turn(direction.x, direction.y);
}

elements.startButton.addEventListener('click', () => beginRound(false));
elements.restartButton.addEventListener('click', () => beginRound(true));
elements.againButton.addEventListener('click', () => beginRound(true));
elements.resumeButton.addEventListener('click', resumeGame);
elements.pauseButton.addEventListener('click', () => pauseGame());

elements.dpad.addEventListener('pointerdown', (event) => {
  const button = event.target.closest('button[data-direction]');
  if (!button || button.disabled) return;
  const direction = DPAD_DIRECTIONS[button.dataset.direction];
  if (direction) handleDirection(direction);
});

elements.dpad.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-direction]');
  if (!button || button.disabled) return;
  const direction = DPAD_DIRECTIONS[button.dataset.direction];
  if (direction) handleDirection(direction);
});

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const direction = DIRECTION_KEYS.get(key);

  if (direction) {
    if (key.startsWith('Arrow')) event.preventDefault();
    if (!event.repeat) handleDirection(direction);
    return;
  }

  if (key === 'p' || key === 'Escape') {
    if (game.state === 'running' || game.state === 'paused') {
      event.preventDefault();
      if (!event.repeat) togglePause();
    }
    return;
  }

  if ((key === 'Enter' || key === ' ') && game.state === 'idle') {
    if (!isInteractiveTarget(event.target)) {
      event.preventDefault();
      if (!event.repeat) beginRound(false);
    }
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'running') {
    autoPaused = true;
    pauseGame({ automatic: true, moveFocus: false });
  } else if (!document.hidden && game.state === 'paused' && autoPaused) {
    autoPaused = false;
    elements.resumeButton.focus({ preventScroll: true });
  }
});

if (typeof ResizeObserver === 'function') {
  const resizeObserver = new ResizeObserver(drawBoard);
  resizeObserver.observe(elements.boardWrap);
} else {
  window.addEventListener('resize', drawBoard);
}

syncUi();
drawBoard();
elements.startButton.focus({ preventScroll: true });
