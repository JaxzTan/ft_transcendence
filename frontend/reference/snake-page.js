/* ==========================================================================
   RETRO SNAKE PAGE & SINGLE WINDOW RECEIPT PRINTER ENGINE
   ========================================================================== */

class DedicatedSnakeGame {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('retro_snake_page_highscore') || '0', 10);
    this.isGameStarted = false;
    this.isGameOver = false;
    this.applesEaten = 0;
    this.gridSize = 20;
    this.animationId = null;

    // Keyboard controls
    this.keys = {};
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
        if (!this.isGameStarted && !this.isGameOver) {
          this.isGameStarted = true;
          this.startTime = Date.now();
        }
        e.preventDefault();
      }

      if (e.code === 'KeyR' && this.isGameOver) {
        this.restartGame();
      }
    });

    window.addEventListener('keyup', (e) => this.keys[e.code] = false);

    // Canvas Click Handler
    if (this.canvas) {
      this.canvas.addEventListener('click', () => {
        if (!this.isGameStarted && !this.isGameOver) {
          this.isGameStarted = true;
        } else if (this.isGameOver) {
          this.restartGame();
        }
      });
    }

    // Attach On-Screen D-Pad buttons
    this.bindDpadButtons();

    this.initGame();
    this.updateScoreDisplay();
  }

  bindDpadButtons() {
    const btnUp = document.getElementById('btnUp');
    const btnLeft = document.getElementById('btnLeft');
    const btnDown = document.getElementById('btnDown');
    const btnRight = document.getElementById('btnRight');
    const demoPrintBtn = document.getElementById('demoPrintBtn');

    if (btnUp) btnUp.addEventListener('click', () => { this.handleInput('up'); });
    if (btnLeft) btnLeft.addEventListener('click', () => { this.handleInput('left'); });
    if (btnDown) btnDown.addEventListener('click', () => { this.handleInput('down'); });
    if (btnRight) btnRight.addEventListener('click', () => { this.handleInput('right'); });
    if (demoPrintBtn) demoPrintBtn.addEventListener('click', () => { this.printGameReceipt(); });
  }

  handleInput(dirName) {
    if (!this.isGameStarted && !this.isGameOver) {
      this.isGameStarted = true;
    }

    if (dirName === 'up' && this.dir.y === 0) this.nextDir = { x: 0, y: -1 };
    if (dirName === 'down' && this.dir.y === 0) this.nextDir = { x: 0, y: 1 };
    if (dirName === 'left' && this.dir.x === 0) this.nextDir = { x: -1, y: 0 };
    if (dirName === 'right' && this.dir.x === 0) this.nextDir = { x: 1, y: 0 };
  }

  initGame() {
    this.score = 0;
    this.applesEaten = 0;
    this.isGameStarted = false;
    this.isGameOver = false;
    this.snake = [
      { x: 15, y: 10 },
      { x: 14, y: 10 },
      { x: 13, y: 10 }
    ];
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.snakeTick = 0;
    this.spawnFood();

    // Toggle Single Window View -> Show Gameplay View
    const gameView = document.getElementById('snakeGameView');
    const printerView = document.getElementById('printerReceiptView');
    const titleEl = document.getElementById('windowHeaderTitle');

    if (gameView) gameView.style.display = 'block';
    if (printerView) printerView.style.display = 'none';
    if (titleEl) titleEl.innerText = '🐍 RETRO SNAKE CABINET // PLAY MODE';
  }

  spawnFood() {
    const cols = Math.floor(this.canvas.width / this.gridSize);
    const rows = Math.floor(this.canvas.height / this.gridSize);
    this.food = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows)
    };
  }

  updateScoreDisplay() {
    const scoreEl = document.getElementById('snakeScore');
    const highScoreEl = document.getElementById('snakeHighScore');
    if (scoreEl) scoreEl.innerText = this.score;
    if (highScoreEl) highScoreEl.innerText = this.highScore;
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('retro_snake_page_highscore', this.highScore);
      this.updateScoreDisplay();
    }
  }

  update() {
    if (!this.isGameStarted || this.isGameOver) return;

    if ((this.keys['ArrowUp'] || this.keys['KeyW']) && this.dir.y === 0) this.nextDir = { x: 0, y: -1 };
    if ((this.keys['ArrowDown'] || this.keys['KeyS']) && this.dir.y === 0) this.nextDir = { x: 0, y: 1 };
    if ((this.keys['ArrowLeft'] || this.keys['KeyA']) && this.dir.x === 0) this.nextDir = { x: -1, y: 0 };
    if ((this.keys['ArrowRight'] || this.keys['KeyD']) && this.dir.x === 0) this.nextDir = { x: 1, y: 0 };

    this.snakeTick++;
    if (this.snakeTick < 6) return;
    this.snakeTick = 0;

    this.dir = this.nextDir;
    const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };

    const cols = Math.floor(this.canvas.width / this.gridSize);
    const rows = Math.floor(this.canvas.height / this.gridSize);

    // Wall collision
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
      this.triggerGameOver();
      return;
    }

    // Self collision
    for (let i = 0; i < this.snake.length; i++) {
      if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
        this.triggerGameOver();
        return;
      }
    }

    this.snake.unshift(head);

    // Eat food
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 50;
      this.applesEaten += 1;
      this.saveHighScore();
      this.updateScoreDisplay();
      this.spawnFood();
      if (window.retroAudio) window.retroAudio.playUiBeep(660, 0.1, 'square');
    } else {
      this.snake.pop();
    }
  }

  draw() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Grid Lines
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    for (let x = 0; x < this.canvas.width; x += this.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    // Draw Snake
    this.snake.forEach((seg, idx) => {
      this.ctx.fillStyle = idx === 0 ? '#ffe600' : '#00f0ff';
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.fillRect(
        seg.x * this.gridSize + 1,
        seg.y * this.gridSize + 1,
        this.gridSize - 2,
        this.gridSize - 2
      );
    });

    // Draw Food
    this.ctx.fillStyle = '#ff007f';
    this.ctx.shadowColor = '#ff007f';
    this.ctx.fillRect(
      this.food.x * this.gridSize + 1,
      this.food.y * this.gridSize + 1,
      this.gridSize - 2,
      this.gridSize - 2
    );

    this.ctx.shadowBlur = 0;

    // Draw Start Screen Overlay
    if (!this.isGameStarted && !this.isGameOver) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = '#ffe600';
      this.ctx.font = '16px "Press Start 2P"';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('PRESS ARROWS / W-A-S-D', this.canvas.width / 2, this.canvas.height / 2 - 15);
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.font = '10px "Press Start 2P"';
      this.ctx.fillText('OR CLICK HERE TO START', this.canvas.width / 2, this.canvas.height / 2 + 20);
    }
  }

  triggerGameOver() {
    this.isGameOver = true;
    if (window.retroAudio) window.retroAudio.playExplosionSound();
    this.printGameReceipt();
  }

  printGameReceipt() {
    const gameView = document.getElementById('snakeGameView');
    const printerView = document.getElementById('printerReceiptView');
    const invoiceCard = document.getElementById('invoiceCard');
    const titleEl = document.getElementById('windowHeaderTitle');

    // Switch Single Window View to Printer Receipt View
    if (gameView) gameView.style.display = 'none';
    if (printerView) printerView.style.display = 'block';
    if (titleEl) titleEl.innerText = '🖨️ GAME OVER // THERMAL SCORE RECEIPT PRINTED';

    // Populate Receipt Telemetry
    const scoreVal = document.getElementById('receiptScore');
    const highScoreVal = document.getElementById('receiptHighScore');
    const applesVal = document.getElementById('receiptApples');
    const lengthVal = document.getElementById('receiptSnakeLength');
    const timeVal = document.getElementById('receiptTime');
    const rankVal = document.getElementById('receiptRank');
    const dateVal = document.getElementById('receiptDate');

    if (scoreVal) scoreVal.innerText = `${this.score} PTS`;
    if (highScoreVal) highScoreVal.innerText = `${this.highScore} PTS`;
    if (applesVal) applesVal.innerText = `${this.applesEaten} APPLES`;
    if (lengthVal) lengthVal.innerText = `${this.snake ? this.snake.length : 3} UNITS`;
    if (timeVal) {
      const duration = this.startTime ? ((Date.now() - this.startTime) / 1000).toFixed(1) : '18.5';
      timeVal.innerText = `${duration} SEC`;
    }

    let rank = 'CYBER NOVICE';
    if (this.score >= 500) rank = 'LEGENDARY';
    else if (this.score >= 250) rank = 'SNAKE PRO';
    else if (this.score >= 100) rank = 'ARCADE ACE';
    if (rankVal) rankVal.innerText = rank;

    const now = new Date();
    if (dateVal) dateVal.innerText = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

    // Trigger Thermal Receipt Printing Animation
    if (invoiceCard) {
      invoiceCard.classList.remove('printing-active');
      void invoiceCard.offsetWidth; // Trigger DOM reflow
      invoiceCard.classList.add('printing-active');
    }

    // Play Authentic Thermal Mechanical Printer Audio Sequence
    if (window.retroAudio) {
      window.retroAudio.playPrinterSound();
    }
  }

  restartGame() {
    this.initGame();
  }

  startLoop() {
    const loop = () => {
      this.update();
      this.draw();
      this.animationId = requestAnimationFrame(loop);
    };
    loop();
  }
}

// Global Initialization when DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('snakeCanvas')) {
    window.snakeGameInstance = new DedicatedSnakeGame('snakeCanvas');
    window.snakeGameInstance.startLoop();

    // Retry Button Handler inside Printed Receipt
    const retryBtn = document.getElementById('retrySnakeBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        window.snakeGameInstance.restartGame();
      });
    }

    // Print Receipt Handler
    const printBtn = document.getElementById('printReceiptBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }
});
