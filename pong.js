// Get canvas and context
const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// Game objects
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    speedX: 5,
    speedY: 5,
    color: '#fff'
};

const paddleWidth = 10;
const paddleHeight = 100;

const paddle1 = {
    x: 10,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    speed: 0,
    color: '#0f0'
};

const paddle2 = {
    x: canvas.width - paddleWidth - 10,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    speed: 0,
    color: '#f00'
};

// Score
let player1Score = 0;
let player2Score = 0;
const winningScore = 5;
let gameOver = false;

// Keyboard controls
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Reset button
document.getElementById('resetButton').addEventListener('click', resetGame);

function resetGame() {
    player1Score = 0;
    player2Score = 0;
    gameOver = false;
    updateScore();
    resetBall();
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedX = -ball.speedX;
    ball.speedY = (Math.random() * 10 - 5);
}

function updateScore() {
    document.getElementById('player1Score').textContent = player1Score;
    document.getElementById('player2Score').textContent = player2Score;
}

function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

function drawCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawText(text, x, y, color, size = '30px') {
    ctx.fillStyle = color;
    ctx.font = `${size} Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
}

function drawNet() {
    const netWidth = 4;
    const netHeight = 10;
    const gap = 15;

    for (let i = 0; i < canvas.height; i += netHeight + gap) {
        drawRect(canvas.width / 2 - netWidth / 2, i, netWidth, netHeight, '#444');
    }
}

function movePaddles() {
    // Player 1 (W/S keys)
    if (keys['w'] || keys['W']) {
        paddle1.speed = -8;
    } else if (keys['s'] || keys['S']) {
        paddle1.speed = 8;
    } else {
        paddle1.speed = 0;
    }

    // Player 2 (Arrow keys)
    if (keys['ArrowUp']) {
        paddle2.speed = -8;
    } else if (keys['ArrowDown']) {
        paddle2.speed = 8;
    } else {
        paddle2.speed = 0;
    }

    // Update paddle positions
    paddle1.y += paddle1.speed;
    paddle2.y += paddle2.speed;

    // Keep paddles within canvas
    if (paddle1.y < 0) paddle1.y = 0;
    if (paddle1.y + paddle1.height > canvas.height) {
        paddle1.y = canvas.height - paddle1.height;
    }

    if (paddle2.y < 0) paddle2.y = 0;
    if (paddle2.y + paddle2.height > canvas.height) {
        paddle2.y = canvas.height - paddle2.height;
    }
}

function moveBall() {
    if (gameOver) return;

    ball.x += ball.speedX;
    ball.y += ball.speedY;

    // Top and bottom wall collision
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.speedY = -ball.speedY;
    }

    // Paddle collision
    // Left paddle
    if (ball.x - ball.radius < paddle1.x + paddle1.width &&
        ball.y > paddle1.y &&
        ball.y < paddle1.y + paddle1.height) {
        ball.speedX = Math.abs(ball.speedX);

        // Add some variation based on where the ball hits the paddle
        let deltaY = ball.y - (paddle1.y + paddle1.height / 2);
        ball.speedY = deltaY * 0.3;
    }

    // Right paddle
    if (ball.x + ball.radius > paddle2.x &&
        ball.y > paddle2.y &&
        ball.y < paddle2.y + paddle2.height) {
        ball.speedX = -Math.abs(ball.speedX);

        // Add some variation based on where the ball hits the paddle
        let deltaY = ball.y - (paddle2.y + paddle2.height / 2);
        ball.speedY = deltaY * 0.3;
    }

    // Score points
    if (ball.x - ball.radius < 0) {
        player2Score++;
        updateScore();
        checkWin();
        resetBall();
    }

    if (ball.x + ball.radius > canvas.width) {
        player1Score++;
        updateScore();
        checkWin();
        resetBall();
    }
}

function checkWin() {
    if (player1Score >= winningScore || player2Score >= winningScore) {
        gameOver = true;
    }
}

function draw() {
    // Clear canvas
    drawRect(0, 0, canvas.width, canvas.height, '#000');

    // Draw net
    drawNet();

    // Draw paddles
    drawRect(paddle1.x, paddle1.y, paddle1.width, paddle1.height, paddle1.color);
    drawRect(paddle2.x, paddle2.y, paddle2.width, paddle2.height, paddle2.color);

    // Draw ball
    drawCircle(ball.x, ball.y, ball.radius, ball.color);

    // Draw game over message
    if (gameOver) {
        const winner = player1Score >= winningScore ? 'Player 1' : 'Player 2';
        drawText(`${winner} Wins!`, canvas.width / 2, canvas.height / 2, '#fff', '50px');
        drawText('Click Reset to play again', canvas.width / 2, canvas.height / 2 + 50, '#fff', '20px');
    }
}

function update() {
    movePaddles();
    moveBall();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();
