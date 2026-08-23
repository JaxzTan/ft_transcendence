/* ==========================================================================
   RETRO WAVE ARCADE - MINI GAMES ENGINE (Canvas 2D)
   ========================================================================== */

class ArcadeEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.currentGame = 'space'; // 'space' or 'snake'
    this.animationId = null;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('retro_arcade_highscore') || '0', 10);
    this.isGameOver = false;

    // Keys State
    this.keys = {};
    window.addEventListener('keydown', (e) => this.keys[e.code] = true);
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);

    // Initial game state setups
    this.initSpaceDefender();
    this.initSnakeGame();
  }

  // Set Active Game
  setGame(gameName) {
    this.currentGame = gameName;
    this.restartGame();
  }

  restartGame() {
    this.score = 0;
    this.isGameOver = false;
    if (this.currentGame === 'space') {
      this.initSpaceDefender();
    } else {
      this.initSnakeGame();
    }
    this.updateScoreDisplay();
  }

  updateScoreDisplay() {
    const scoreEl = document.getElementById('currentScore');
    const highScoreEl = document.getElementById('highScore');
    if (scoreEl) scoreEl.innerText = this.score;
    if (highScoreEl) highScoreEl.innerText = this.highScore;
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('retro_arcade_highscore', this.highScore);
      this.updateScoreDisplay();
    }
  }

  /* ------------------------------------------------------------------------
     1. SPACE DEFENDER GAME LOGIC
     ------------------------------------------------------------------------ */
  initSpaceDefender() {
    this.player = {
      x: this.canvas.width / 2 - 15,
      y: this.canvas.height - 40,
      w: 30,
      h: 20,
      speed: 5
    };
    this.lasers = [];
    this.enemies = [];
    this.particles = [];
    this.enemySpawnTimer = 0;
    this.shootCooldown = 0;
  }

  updateSpaceDefender() {
    if (this.isGameOver) return;

    // Player Move
    if ((this.keys['ArrowLeft'] || this.keys['KeyA']) && this.player.x > 0) {
      this.player.x -= this.player.speed;
    }
    if ((this.keys['ArrowRight'] || this.keys['KeyD']) && this.player.x + this.player.w < this.canvas.width) {
      this.player.x += this.player.speed;
    }

    // Shoot Laser
    if (this.shootCooldown > 0) this.shootCooldown--;
    if ((this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW']) && this.shootCooldown === 0) {
      this.lasers.push({ x: this.player.x + this.player.w / 2 - 2, y: this.player.y, w: 4, h: 10, speed: 7 });
      this.shootCooldown = 12;
      if (window.retroAudio) window.retroAudio.playLaserSound();
    }

    // Move Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].y -= this.lasers[i].speed;
      if (this.lasers[i].y < 0) this.lasers.splice(i, 1);
    }

    // Spawn Enemies
    this.enemySpawnTimer++;
    if (this.enemySpawnTimer > 40) {
      this.enemySpawnTimer = 0;
      this.enemies.push({
        x: Math.random() * (this.canvas.width - 24),
        y: -20,
        w: 24,
        h: 20,
        speed: 1.8 + Math.random() * 1.5,
        color: ['#ff007f', '#00f0ff', '#ffe600'][Math.floor(Math.random() * 3)]
      });
    }

    // Move Enemies & Collisions
    for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
      const enemy = this.enemies[eIdx];
      enemy.y += enemy.speed;

      // Enemy past screen bottom -> Game Over
      if (enemy.y > this.canvas.height) {
        this.triggerGameOver();
        return;
      }

      // Enemy hit by laser
      for (let lIdx = this.lasers.length - 1; lIdx >= 0; lIdx--) {
        const laser = this.lasers[lIdx];
        if (
          laser.x < enemy.x + enemy.w &&
          laser.x + laser.w > enemy.x &&
          laser.y < enemy.y + enemy.h &&
          laser.y + laser.h > enemy.y
        ) {
          // Create Particles
          for (let p = 0; p < 8; p++) {
            this.particles.push({
              x: enemy.x + enemy.w / 2,
              y: enemy.y + enemy.h / 2,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              life: 15,
              color: enemy.color
            });
          }
          this.enemies.splice(eIdx, 1);
          this.lasers.splice(lIdx, 1);
          this.score += 100;
          this.saveHighScore();
          if (window.retroAudio) window.retroAudio.playExplosionSound();
          break;
        }
      }
    }

    // Update Particles
    for (let pIdx = this.particles.length - 1; pIdx >= 0; pIdx--) {
      const part = this.particles[pIdx];
      part.x += part.vx;
      part.y += part.vy;
      part.life--;
      if (part.life <= 0) this.particles.splice(pIdx, 1);
    }
  }

  drawSpaceDefender() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Starfield Background
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 20; i++) {
      const sx = (Math.sin(i * 99 + Date.now() * 0.001) * 0.5 + 0.5) * this.canvas.width;
      const sy = (Math.cos(i * 33 + Date.now() * 0.0005) * 0.5 + 0.5) * this.canvas.height;
      this.ctx.fillRect(sx, sy, 2, 2);
    }

    // Draw Player Ship (Pixel Tri-wing)
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.beginPath();
    this.ctx.moveTo(this.player.x + this.player.w / 2, this.player.y);
    this.ctx.lineTo(this.player.x + this.player.w, this.player.y + this.player.h);
    this.ctx.lineTo(this.player.x, this.player.y + this.player.h);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw Lasers
    this.ctx.fillStyle = '#ffe600';
    this.ctx.shadowColor = '#ffe600';
    this.lasers.forEach(l => this.ctx.fillRect(l.x, l.y, l.w, l.h));

    // Draw Enemies (Pixel Alien Invaders)
    this.enemies.forEach(e => {
      this.ctx.fillStyle = e.color;
      this.ctx.shadowColor = e.color;
      this.ctx.fillRect(e.x, e.y, e.w, e.h);
    });

    // Draw Explosion Particles
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.fillRect(p.x, p.y, 3, 3);
    });

    this.ctx.shadowBlur = 0;

    // Draw Game Over Screen
    if (this.isGameOver) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = '#ff007f';
      this.ctx.font = '20px "Press Start 2P"';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 10);
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.font = '10px "Press Start 2P"';
      this.ctx.fillText('CLICK OR PRESS R TO RESTART', this.canvas.width / 2, this.canvas.height / 2 + 25);
    }
  }

  /* ------------------------------------------------------------------------
     2. RETRO SNAKE GAME LOGIC
     ------------------------------------------------------------------------ */
  initSnakeGame() {
    this.gridSize = 16;
    this.snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.spawnSnakeFood();
    this.snakeTick = 0;
  }

  spawnSnakeFood() {
    const cols = Math.floor(this.canvas.width / this.gridSize);
    const rows = Math.floor(this.canvas.height / this.gridSize);
    this.food = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows)
    };
  }

  updateSnakeGame() {
    if (this.isGameOver) return;

    if ((this.keys['ArrowUp'] || this.keys['KeyW']) && this.dir.y === 0) this.nextDir = { x: 0, y: -1 };
    if ((this.keys['ArrowDown'] || this.keys['KeyS']) && this.dir.y === 0) this.nextDir = { x: 0, y: 1 };
    if ((this.keys['ArrowLeft'] || this.keys['KeyA']) && this.dir.x === 0) this.nextDir = { x: -1, y: 0 };
    if ((this.keys['ArrowRight'] || this.keys['KeyD']) && this.dir.x === 0) this.nextDir = { x: 1, y: 0 };

    this.snakeTick++;
    if (this.snakeTick < 6) return; // Control speed
    this.snakeTick = 0;

    this.dir = this.nextDir;
    const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };

    const cols = Math.floor(this.canvas.width / this.gridSize);
    const rows = Math.floor(this.canvas.height / this.gridSize);

    // Wall collision -> Game over
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
      this.triggerGameOver();
      return;
    }

    // Self collision -> Game over
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
      this.saveHighScore();
      this.spawnSnakeFood();
      if (window.retroAudio) window.retroAudio.playUiBeep(660, 0.1, 'square');
    } else {
      this.snake.pop();
    }
  }

  drawSnakeGame() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Grid Lines
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
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

    // Draw Game Over
    if (this.isGameOver) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = '#ff007f';
      this.ctx.font = '20px "Press Start 2P"';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 10);
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.font = '10px "Press Start 2P"';
      this.ctx.fillText('CLICK OR PRESS R TO RESTART', this.canvas.width / 2, this.canvas.height / 2 + 25);
    }
  }

  triggerGameOver() {
    this.isGameOver = true;
    if (window.retroAudio) window.retroAudio.playExplosionSound();
  }

  startLoop() {
    const loop = () => {
      if (this.currentGame === 'space') {
        this.updateSpaceDefender();
        this.drawSpaceDefender();
      } else {
        this.updateSnakeGame();
        this.drawSnakeGame();
      }
      this.animationId = requestAnimationFrame(loop);
    };
    loop();
  }
}

// Global Arcade Instance Init when DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('arcadeCanvas')) {
    window.arcadeInstance = new ArcadeEngine('arcadeCanvas');
    window.arcadeInstance.startLoop();

    // Restart key shortcut
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && window.arcadeInstance.isGameOver) {
        window.arcadeInstance.restartGame();
      }
    });

    // Canvas Click Restart
    document.getElementById('arcadeCanvas').addEventListener('click', () => {
      if (window.arcadeInstance && window.arcadeInstance.isGameOver) {
        window.arcadeInstance.restartGame();
      }
    });
  }
});
