(() => {
  const board = document.querySelector('#game-board');
  if (!board) return;

  const size = 20;
  const initialFoodCount = 5;
  const maxFoodCount = 10;
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
  let worm = [];
  let foods = [];
  let obstacles = [];
  let direction = 'right';
  let nextDirection = 'right';
  let score = 0;
  let highScore = Number(localStorage.getItem('worm-high-score') || 0);
  let timerId = null;
  let foodGrowthTimerId = null;
  let running = false;
  let paused = false;
  let autoMode = false;
  let randomFood = false;
  let audioContext = null;

  for (let index = 0; index < size * size; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'game-cell';
    cell.setAttribute('role', 'gridcell');
    cells.push(cell);
    board.appendChild(cell);
  }

  const isInside = (point) => point.x >= 0 && point.x < size && point.y >= 0 && point.y < size;
  const samePoint = (a, b) => a.x === b.x && a.y === b.y;
  const cellAt = (point) => cells[point.y * size + point.x];
  const isInList = (point, list) => list.some((item) => samePoint(item, point));
  const isWormOccupied = (point, includeTail = true) => worm.some((part, index) => (includeTail || index < worm.length - 1) && samePoint(part, point));
  const isBlocked = (point, includeTail = true) => isWormOccupied(point, includeTail) || isInList(point, obstacles);

  function setStatus(message) {
    statusElement.textContent = `${message} Food: ${foods.length}/${maxFoodCount}.`;
  }

  function render() {
    cells.forEach((cell) => cell.classList.remove('worm', 'worm-head', 'food', 'obstacle'));
    obstacles.forEach((point) => cellAt(point).classList.add('obstacle'));
    foods.forEach((point) => cellAt(point).classList.add('food'));
    worm.forEach((part, index) => cellAt(part).classList.add(index === 0 ? 'worm-head' : 'worm'));
    scoreElement.textContent = String(score);
    highScoreElement.textContent = String(highScore);
  }

  function randomEmptyPoint() {
    const available = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const point = { x, y };
        if (!isBlocked(point) && !isInList(point, foods)) available.push(point);
      }
    }
    return available[Math.floor(Math.random() * available.length)] || null;
  }

  function createObstacles() {
    obstacles = [];
    const target = 5 + Math.floor(Math.random() * 6);
    while (obstacles.length < target) {
      const point = randomEmptyPoint();
      if (!point) break;
      obstacles.push(point);
    }
  }

  function createFoods(count = initialFoodCount) {
    foods = [];
    while (foods.length < count && foods.length < maxFoodCount) {
      const point = randomEmptyPoint();
      if (!point) break;
      foods.push(point);
    }
  }

  function addFood() {
    if (!running || foods.length >= maxFoodCount) return;
    const point = randomEmptyPoint();
    if (point) foods.push(point);
    render();
    setStatus('A new food appeared.');
  }

  function moveFoodOneCell() {
    if (!randomFood) return;
    foods = foods.map((food, index) => {
      const otherFoods = foods.filter((_, otherIndex) => otherIndex !== index);
      const choices = Object.values(directions)
        .map((step) => ({ x: food.x + step.x, y: food.y + step.y }))
        .filter((point) => isInside(point) && !isBlocked(point) && !isInList(point, otherFoods));
      return choices.length ? choices[Math.floor(Math.random() * choices.length)] : food;
    });
  }

  function chooseAutoDirection() {
    if (!foods.length) return direction;
    const target = foods.reduce((closest, food) => {
      const distance = Math.abs(food.x - worm[0].x) + Math.abs(food.y - worm[0].y);
      return !closest || distance < closest.distance ? { food, distance } : closest;
    }, null).food;
    const options = Object.entries(directions)
      .filter(([name]) => name !== reverse[direction])
      .map(([name, step]) => ({ name, point: { x: worm[0].x + step.x, y: worm[0].y + step.y } }))
      .filter(({ point }) => isInside(point) && !isBlocked(point, false));
    options.sort((a, b) => Math.abs(a.point.x - target.x) + Math.abs(a.point.y - target.y) - (Math.abs(b.point.x - target.x) + Math.abs(b.point.y - target.y)));
    return options[0]?.name || direction;
  }

  function stopTimers() {
    if (timerId !== null) clearInterval(timerId);
    if (foodGrowthTimerId !== null) clearInterval(foodGrowthTimerId);
    timerId = null;
    foodGrowthTimerId = null;
  }

  function playEatSound() {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = 520;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.12);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.13);
    } catch (error) {
      // Audio is optional; the game must continue if browser audio is unavailable.
    }
  }

  function gameOver(message) {
    running = false;
    paused = false;
    stopTimers();
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
    const eatenIndex = foods.findIndex((food) => samePoint(food, head));
    const ateFood = eatenIndex >= 0;
    if (!isInside(head) || isBlocked(head, ateFood)) {
      gameOver('Game over. Press Restart to try again.');
      return;
    }
    worm.unshift(head);
    if (ateFood) {
      foods.splice(eatenIndex, 1);
      score += 1;
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('worm-high-score', String(highScore));
      }
      playEatSound();
      setStatus('뾰롱! Food collected.');
    } else {
      worm.pop();
    }
    moveFoodOneCell();
    render();
  }

  function reset() {
    stopTimers();
    worm = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    foods = [];
    obstacles = [];
    createObstacles();
    createFoods();
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
    stopTimers();
    timerId = setInterval(tick, 180);
    foodGrowthTimerId = setInterval(addFood, 30000);
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
  restartButton.addEventListener('click', () => {
    reset();
    start();
  });
  autoButton.addEventListener('click', () => {
    autoMode = !autoMode;
    toggleOption(autoButton, autoMode, 'Auto mode');
  });
  randomFoodButton.addEventListener('click', () => {
    randomFood = !randomFood;
    toggleOption(randomFoodButton, randomFood, 'Random food');
  });
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
