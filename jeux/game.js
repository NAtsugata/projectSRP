// Game Constants
const GRAVITY = 0.5;
const FRICTION = 0.8;
const JUMP_FORCE = -12;
const SPEED = 5;

// Game State
let canvas, ctx;
let currentLevelIndex = 0;
let currentLevel = null;
let gameLoopId;
let isGameRunning = false;
let score = 0;

// Assets
const assets = {
    playerSheet: new Image(),
    ground: new Image(),
    brick: new Image(),
    coin: new Image(),
    enemy: new Image()
};
let assetsLoaded = 0;

// Input State
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    w: false,
    a: false,
    constructor(x, y, w, h, color) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        this.isGrounded = false;
        this.facingRight = true;
    }

    draw(ctx, cameraX) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
    }

    update() {
        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 60, 90, '#ff4757'); // Adjusted size for tall character
        this.speed = SPEED;
        this.jumpForce = JUMP_FORCE;

        // Assuming 5 cols, 4 rows based on typical sprite sheet layout
        this.anim = new SpriteAnimation(assets.playerSheet, 5, 4, {
            idle: { row: 0, frames: 4 },
            run: { row: 1, frames: 5 },
            jump: { row: 2, frames: 2 },
            climb: { row: 3, frames: 1 }, // Using climb frame from row 3
            die: { row: 3, frames: 1 }   // Using die frame from row 3
        });
    }

    draw(ctx, cameraX) {
        this.anim.update();
        this.anim.draw(ctx, this.x - cameraX, this.y, this.w, this.h, this.facingRight);
    }

    update(platforms) {
        // Input handling
        if (keys.ArrowLeft || keys.a) {
            this.vx = -this.speed;
            this.facingRight = false;
        } else if (keys.ArrowRight || keys.d) {
            this.vx = this.speed;
            this.facingRight = true;
        } else {
            this.vx *= FRICTION;
        }

        if ((keys.Space || keys.ArrowUp || keys.w) && this.isGrounded) {
            this.vy = this.jumpForce;
            this.isGrounded = false;
        }

        // Apply Gravity
        this.vy += GRAVITY;

        // Move X
        this.x += this.vx;

        // Check X Collisions
        for (const platform of platforms) {
            if (this.checkCollision(platform)) {
                if (this.vx > 0) { // Moving right
                    this.x = platform.x - this.w;
                } else if (this.vx < 0) { // Moving left
                    this.x = platform.x + platform.w;
                }
                this.vx = 0;
            }
        }

        // Move Y
        this.y += this.vy;
        this.isGrounded = false;

        // Check Y Collisions
        for (const platform of platforms) {
            if (this.checkCollision(platform)) {
                if (this.vy > 0) { // Falling
                    this.y = platform.y - this.h;
                    this.isGrounded = true;
                    this.vy = 0;
                } else if (this.vy < 0) { // Jumping up
                    this.y = platform.y + platform.h;
                    this.vy = 0;
                }
            }
        }

        // Death check
        if (this.y > 800) {
            gameOver();
        }

        // Update Animation State
        if (!this.isGrounded) {
            this.anim.setAnimation('jump');
        } else if (Math.abs(this.vx) > 0.1) {
            this.anim.setAnimation('run');
        } else {
            this.anim.setAnimation('idle');
        }
    }

    checkCollision(rect) {
        return (
            this.x < rect.x + rect.w &&
            this.x + this.w > rect.x &&
            this.y < rect.y + rect.h &&
            this.y + this.h > rect.y
        );
    }
    // resolveCollision is no longer needed with split-axis update
}

class Enemy extends Entity {
    constructor(x, y, range) {
        super(x, y, 40, 40, '#5352ed');
        this.startX = x;
        this.range = range;
        this.speed = 2;
        this.direction = 1;
    }

    draw(ctx, cameraX) {
        ctx.drawImage(assets.enemy, this.x - cameraX, this.y, this.w, this.h);
    }

    update() {
        this.x += this.speed * this.direction;
        if (this.x > this.startX + this.range) {
            this.direction = -1;
        } else if (this.x < this.startX) {
            this.direction = 1;
        }
    }
}

class Coin extends Entity {
    constructor(x, y) {
        super(x, y, 30, 30, '#FFD700');
        this.collected = false;
        this.floatOffset = 0;
    }

    draw(ctx, cameraX) {
        if (this.collected) return;
        this.floatOffset += 0.1;
        const y = this.y + Math.sin(this.floatOffset) * 5;
        ctx.drawImage(assets.coin, this.x - cameraX, y, this.w, this.h);
    }
}

// Game Logic
let player;
let enemies = [];
let coins = [];
let platforms = [];
let goal;
let cameraX = 0;

function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Load assets
    let loaded = 0;
    const total = Object.keys(assets).length;

    const onAssetLoad = () => {
        loaded++;
        if (loaded === total) {
            setupUI();
        }
    };

    assets.playerSheet.src = 'assets/player_sheet_custom.jpg';
    assets.ground.src = 'assets/mario/ground.svg';
    assets.brick.src = 'assets/mario/brick.svg';
    assets.coin.src = 'assets/mario/coin.svg';
    assets.enemy.src = 'assets/mario/enemy.svg';

    for (const key in assets) {
        assets[key].onload = onAssetLoad;
        assets[key].onerror = (e) => {
            console.error(`Failed to load asset: ${key}`, e);
            onAssetLoad();
        };
    }
}

function setupUI() {
    // Event Listeners
    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.key) || keys.hasOwnProperty(e.code)) {
            keys[e.key] = true;
            if (e.code === 'Space') keys.Space = true;
        }
    });

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key) || keys.hasOwnProperty(e.code)) {
            keys[e.key] = false;
            if (e.code === 'Space') keys.Space = false;
        }
    });

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('retry-btn').addEventListener('click', restartLevel);
    document.getElementById('next-level-btn').addEventListener('click', nextLevel);
    document.getElementById('restart-btn').addEventListener('click', () => {
        currentLevelIndex = 0;
        score = 0;
        startGame();
    });

}

function resetKeys() {
    for (let key in keys) {
        keys[key] = false;
    }
}

function loadLevel(levelIndex) {
    if (levelIndex >= LEVELS.length) {
        showScreen('victory-screen');
        isGameRunning = false;
        return;
    }

    currentLevel = LEVELS[levelIndex];
    platforms = currentLevel.platforms;

    player = new Player(50, 400);
    enemies = currentLevel.enemies.map(e => new Enemy(e.x, e.y, e.range));
    coins = currentLevel.coins.map(c => new Coin(c.x, c.y));
    goal = currentLevel.goal;

    document.getElementById('level').textContent = levelIndex + 1;
    cameraX = 0;
    resetKeys();
}

function startGame() {
    hideAllScreens();
    loadLevel(currentLevelIndex);
    isGameRunning = true;
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoop();
}

function restartLevel() {
    hideAllScreens();
    loadLevel(currentLevelIndex);
    isGameRunning = true;
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoop();
}

function nextLevel() {
    currentLevelIndex++;
    hideAllScreens();
    loadLevel(currentLevelIndex);
    isGameRunning = true;
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoop();
}

function gameOver() {
    isGameRunning = false;
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    showScreen('game-over-screen');
}

function levelComplete() {
    isGameRunning = false;
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    showScreen('level-complete-screen');
}

function update() {
    if (!isGameRunning) return;

    player.update(platforms);

    cameraX = player.x - canvas.width / 3;
    cameraX = Math.max(0, Math.min(cameraX, currentLevel.width - canvas.width));

    enemies.forEach(enemy => {
        enemy.update();
        if (player.checkCollision(enemy)) {
            if (player.vy > 0 && player.y + player.h < enemy.y + enemy.h / 2 + 10) {
                enemies = enemies.filter(e => e !== enemy);
                player.vy = -8;
                score += 100;
            } else {
                gameOver();
            }
        }
    });

    coins.forEach(coin => {
        if (!coin.collected && player.checkCollision(coin)) {
            coin.collected = true;
            score += 10;
            document.getElementById('score').textContent = score;
        }
    });

    if (player.checkCollision(goal)) {
        levelComplete();
    }
}

function draw() {
    ctx.fillStyle = currentLevel.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw platforms with textures
    // Draw platforms with textures from tiles sheet
    platforms.forEach(p => {
        const img = p.type === 'ground' ? assets.ground : assets.brick;

        ctx.save();
        ctx.translate(p.x - cameraX, p.y);

        // Simple tiling
        const ptrn = ctx.createPattern(img, 'repeat');
        ctx.fillStyle = ptrn;
        ctx.fillRect(0, 0, p.w, p.h);

        ctx.restore();
    });

    player.draw(ctx, cameraX);
    enemies.forEach(e => e.draw(ctx, cameraX));
    coins.forEach(c => c.draw(ctx, cameraX));

    // Goal
    ctx.fillStyle = '#00b894';
    ctx.fillRect(goal.x - cameraX, goal.y, goal.w, goal.h);
}

function gameLoop() {
    if (!isGameRunning) return;
    update();
    draw();
    gameLoopId = requestAnimationFrame(gameLoop);
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
}

window.onload = initGame;
