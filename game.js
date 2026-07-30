(() => {
  const board = document.querySelector('#game-board');
  if (!board) return;

  const size = 20;
  const cells = [];
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const scoreElement = document.querySelector('#score');
  const highScoreElement = document.querySelector('#high-score');
  const statusElement = document.querySelector('#game-status');
  const startButton = document.querySelector('#start-game');
  const pauseButton = document.querySelector('#pause-game');
  const restartButton = document.querySelector('#restart-game');
  const autoButton = document.querySelector('#auto-mode');
  const randomFoodButton = document.querySelector('#random-food');
  let worm;
  let food;
  let direction;
  let nextDirection;
  let score = 0;
  let highScore = Number(localStorage.getItem('worm-high-score') || 0);
  let timerId = null;
  let running = false;
  let paused = false;
  let autoMode = false;
  let randomFood = false;

  for (let index = 0; index < size * size; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'game-cell';
    cell.setAttribute('role', 'gridcell');
    cells.push(cell);
    board.appendChild(cell);
  }

  const keyFor = (point) => `${point.x},${point.y}`;
  const isInside = (point) => point.x >= 0 && point.x < size && point.y >= 0 && point.y < size;
  const isOccupied = (point, includeTail = true) => worm.some((part, index) => (includeTail || index < worm.length - 1) && part.x === point.x && part.y === point.y);
  const cellAt = (point) => cells[point.y * size + point.x];

  function setStatus(message) {
    statusElement.textContent = message;
  }

  function render() {
    cells.forEach((cell) => cell.classList.remove('worm', 'worm-head', 'food'));
    worm.forEach((part, index) => cellAt(part).classList.add(index === 0 ? 'worm-head' : 'worm'));
    if (food) cellAt(food).classList.add('food');
    scoreElement.textContent = String(score);
    highScoreElement.textContent = String(highScore);
  }

  function randomEmptyPoint() {
    const available = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const point = { x, y };
        if (!isOccupied(point)) available.push(point);
      }
    }
    return available[Math.floor(Math.random() * available.length)] || { x: 0, y: 0 };
  }

  function moveFoodOneCell() {
    if (!randomFood || !food) return;
    const choices = Object.values(directions)
      .map((step) => ({ x: food.x + step.x, y: food.y + step.y }))
      .filter((point) => isInside(point) && !isOccupied(point));
    if (choices.length) food = choices[Math.floor(Math.random() * choices.length)];
  }

  function chooseAutoDirection() {
    if (!food) return direction;
    const options = Object.entries(directions)
      .filter(([name]) => name !== reverse[direction])
      .map(([name, step]) => ({ name, point: { x: worm[0].x + step.x, y: worm[0].y + step.y } }))
      .filter(({ point }) => isInside(point) && !isOccupied(point, false));
    options.sort((a, b) => Math.abs(a.point.x - food.x) + Math.abs(a.point.y - food.y) - (Math.abs(b.point.x - food.x) + Math.abs(b.point.y - food.y)));
    return options[0]?.name || direction;
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function gameOver(message) {
    running = false;
    paused = false;
    stopTimer();
    pauseButton.disabled = true;
    startButton.disabled = false;
    setStatus(message);
  }

  function tick() {
    if (!running || paused) return;
    if (autoMode) nextDirection = chooseAutoDirection();
    direction = nextDirection;
    const step = directions[direction];
    const head = { x: worm[0].x + step.x, y: worm[0].y + step.y };
    const ateFood = food && head.x === food.x && head.y === food.y;
    if (!isInside(head) || isOccupied(head, ateFood)) {
      gameOver('Game over. Press Restart to try again.');
      return;
    }
    worm.unshift(head);
    if (ateFood) {
      score += 1;
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('worm-high-score', String(highScore));
      }
      food = randomEmptyPoint();
    } else {
      worm.pop();
    }
    moveFoodOneCell();
    render();
  }

  function reset() {
    stopTimer();
    worm = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    food = { x: 14, y: 10 };
    direction = 'right';
    nextDirection = 'right';
    score = 0;
    running = false;
    paused = false;
    pauseButton.disabled = true;
    startButton.disabled = false;
    render();
    setStatus('Press Start to play.');
  }

  function start() {
    if (running && paused) {
      paused = false;
      pauseButton.textContent = 'Pause';
      setStatus('Game resumed.');
      return;
    }
    if (running) return;
    running = true;
    paused = false;
    startButton.disabled = true;
    pauseButton.disabled = false;
    pauseButton.textContent = 'Pause';
    setStatus('Game running.');
    stopTimer();
    timerId = setInterval(tick, 180);
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    setStatus(paused ? 'Game paused.' : 'Game resumed.');
  }

  function setDirection(name) {
    if (!directions[name] || name === reverse[direction]) return;
    nextDirection = name;
  }

  function toggleOption(button, value, label) {
    button.setAttribute('aria-pressed', String(value));
    button.textContent = `${label}: ${value ? 'On' : 'Off'}`;
  }

  startButton.addEventListener('click', start);
  pauseButton.addEventListener('click', togglePause);
  restartButton.addEventListener('click', reset);
  autoButton.addEventListener('click', () => {
    autoMode = !autoMode;
    toggleOption(autoButton, autoMode, 'Auto mode');
  });
  randomFoodButton.addEventListener('click', () => {
    randomFood = !randomFood;
    toggleOption(randomFoodButton, randomFood, 'Random food');
  });
  document.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', () => setDirection(button.dataset.direction)));
  document.addEventListener('keydown', (event) => {
    const keyMap = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
    const name = keyMap[event.key] || keyMap[event.key.toLowerCase()];
    if (name) {
      event.preventDefault();
      setDirection(name);
    }
  });

  reset();
})();
