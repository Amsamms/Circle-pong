class OrbitPong {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('game-overlay');
        this.startBtn = document.getElementById('start-btn');
        
        // Audio elements
        this.sounds = {
            paddleHit: document.getElementById('paddleHitSound'),
            wallHit: document.getElementById('wallHitSound'),
            gameOver: document.getElementById('gameOverSound')
        };
        
        // Initialize audio context for better browser support
        this.audioContext = null;
        this.initAudio();
        
        // Game state
        this.isPlaying = false;
        this.isPaused = false;
        this.gameEnded = false;
        
        // Canvas properties
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.arenaRadius = 280;
        
        // Funnel properties
        this.funnels = [
            {
                angle: Math.PI / 2, // Bottom funnel (90 degrees)
                width: Math.PI / 6, // 30 degrees wide
                depth: 40,
                color: '#ff006e',
                glowColor: 'rgba(255, 0, 110, 0.6)'
            },
            {
                angle: -Math.PI / 2, // Top funnel (270 degrees)
                width: Math.PI / 6, // 30 degrees wide  
                depth: 40,
                color: '#ff006e',
                glowColor: 'rgba(255, 0, 110, 0.6)'
            }
        ];
        
        // Paddle properties
        this.paddle = {
            angle: 0,
            width: 80,
            height: 15,
            radius: this.arenaRadius - 25,
            color: '#00f5ff',
            glowColor: 'rgba(0, 245, 255, 0.8)'
        };
        
        // Ball properties
        this.ball = {
            x: this.centerX,
            y: this.centerY - 100,
            radius: 8,
            speed: 4,
            baseSpeed: 4,
            vx: 2,
            vy: 3,
            color: '#ff006e',
            glowColor: 'rgba(255, 0, 110, 0.8)',
            trail: []
        };
        
        // Game statistics
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.speedLevel = 1;
        this.hitCount = 0;
        
        // Controls
        this.mouseAngle = 0;
        this.keys = {};
        this.touchStartAngle = 0;
        this.lastTouchAngle = 0;
        
        // Visual effects
        this.particles = [];
        this.hitEffect = null;
        
        // Sound settings
        this.soundEnabled = true;
        
        // Performance optimization
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.prerenderedArena = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateUI();
        this.createSynthSounds();
        this.setupResponsiveCanvas();
        this.animate();
    }
    
    setupResponsiveCanvas() {
        const updateCanvasSize = () => {
            const canvas = this.canvas;
            const computedStyle = window.getComputedStyle(canvas);
            
            // Get the actual displayed size
            const displayWidth = parseInt(computedStyle.width);
            const displayHeight = parseInt(computedStyle.height);
            
            // Update canvas internal dimensions to match display size
            if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
                canvas.width = displayWidth;
                canvas.height = displayHeight;
                
                // Update game dimensions
                this.centerX = canvas.width / 2;
                this.centerY = canvas.height / 2;
                this.arenaRadius = Math.min(canvas.width, canvas.height) * 0.45;
                this.paddle.radius = this.arenaRadius - 25;
                
                // Invalidate prerendered arena
                this.prerenderedArena = null;
            }
        };
        
        // Update on load and resize (with debouncing)
        updateCanvasSize();
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(updateCanvasSize, 100);
        });
        
        // Handle orientation changes on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(updateCanvasSize, 200);
        });
    }
    
    initAudio() {
        // Initialize audio context on first user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
    }
    
    createSynthSounds() {
        // Create synthetic sounds using Web Audio API for better browser compatibility
        this.synthSounds = {
            paddleHit: () => this.playTone(800, 0.1, 'square'),
            wallHit: () => this.playTone(400, 0.15, 'sawtooth'),
            gameOver: () => this.playGameOverSound(),
            speedUp: () => this.playTone(1200, 0.2, 'sine')
        };
    }
    
    playTone(frequency, duration, type = 'sine') {
        if (!this.audioContext || !this.soundEnabled) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    playGameOverSound() {
        if (!this.audioContext || !this.soundEnabled) return;
        
        // Play a descending tone sequence for game over
        const frequencies = [800, 600, 400, 200];
        frequencies.forEach((freq, index) => {
            setTimeout(() => this.playTone(freq, 0.3, 'triangle'), index * 150);
        });
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const soundStatus = document.getElementById('sound-status');
        soundStatus.textContent = this.soundEnabled ? '🔊' : '🔇';
        
        // Play a test sound when enabling
        if (this.soundEnabled) {
            this.playTone(600, 0.1, 'sine');
        }
    }
    
    setupEventListeners() {
        // Start button
        this.startBtn.addEventListener('click', () => this.startGame());
        
        // Sound toggle
        document.getElementById('sound-toggle').addEventListener('click', () => this.toggleSound());
        
        // Mouse controls
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Touch controls
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    handleMouseMove(e) {
        if (!this.isPlaying) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - this.centerX;
        const mouseY = e.clientY - rect.top - this.centerY;
        this.mouseAngle = Math.atan2(mouseY, mouseX);
        this.paddle.angle = this.mouseAngle;
    }
    
    handleKeyDown(e) {
        this.keys[e.key.toLowerCase()] = true;
        
        if (e.key === ' ' && this.gameEnded) {
            e.preventDefault();
            this.startGame();
        }
    }
    
    handleKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        if (!this.isPlaying) return;
        
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left - this.centerX;
        const touchY = touch.clientY - rect.top - this.centerY;
        this.touchStartAngle = Math.atan2(touchY, touchX);
        this.lastTouchAngle = this.touchStartAngle;
        this.paddle.angle = this.touchStartAngle;
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (!this.isPlaying) return;
        
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left - this.centerX;
        const touchY = touch.clientY - rect.top - this.centerY;
        const currentAngle = Math.atan2(touchY, touchX);
        
        this.paddle.angle = currentAngle;
        this.lastTouchAngle = currentAngle;
    }
    
    handleResize() {
        // Maintain aspect ratio and center the game
        // This could be enhanced for better responsive behavior
    }
    
    startGame() {
        this.isPlaying = true;
        this.gameEnded = false;
        this.score = 0;
        this.hitCount = 0;
        this.speedLevel = 1;
        
        // Reset ball
        this.ball.x = this.centerX;
        this.ball.y = this.centerY - 100;
        this.ball.speed = this.ball.baseSpeed;
        this.ball.vx = (Math.random() - 0.5) * 4;
        this.ball.vy = Math.random() * 2 + 2;
        this.ball.trail = [];
        
        // Reset paddle
        this.paddle.angle = 0;
        
        // Clear effects
        this.particles = [];
        this.hitEffect = null;
        
        this.hideOverlay();
        this.updateUI();
    }
    
    update() {
        if (!this.isPlaying || this.isPaused) return;
        
        this.updatePaddle();
        this.updateBall();
        this.updateParticles();
        this.updateHitEffect();
        this.checkCollisions();
    }
    
    updatePaddle() {
        // Keyboard controls
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.paddle.angle -= 0.08;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            this.paddle.angle += 0.08;
        }
    }
    
    updateBall() {
        // Add to trail (reduce trail length for performance)
        this.ball.trail.push({ x: this.ball.x, y: this.ball.y });
        if (this.ball.trail.length > 10) {
            this.ball.trail.shift();
        }
        
        // Update position
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;
        
        // Check arena boundary collision
        const distanceFromCenter = Math.sqrt(
            Math.pow(this.ball.x - this.centerX, 2) + 
            Math.pow(this.ball.y - this.centerY, 2)
        );
        
        // Check if ball is in funnel zone
        if (distanceFromCenter >= this.arenaRadius - this.ball.radius) {
            const ballAngle = Math.atan2(this.ball.y - this.centerY, this.ball.x - this.centerX);
            
            // Simplified funnel check
            let inFunnel = false;
            for (let funnel of this.funnels) {
                // Simplified angle comparison
                let angleDiff = Math.abs(ballAngle - funnel.angle);
                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                
                if (angleDiff <= funnel.width / 2) {
                    // Ball is in funnel - check if it escaped
                    if (distanceFromCenter > this.arenaRadius + funnel.depth) {
                        this.gameOver();
                        return;
                    }
                    inFunnel = true;
                    break;
                }
            }
            
            if (!inFunnel) {
                // Ball hit solid wall - reflect
                const normal = this.getNormalVector(this.ball.x, this.ball.y);
                this.reflectBall(normal);
                
                // Keep ball inside arena
                const angle = Math.atan2(this.ball.y - this.centerY, this.ball.x - this.centerX);
                const maxDistance = this.arenaRadius - this.ball.radius;
                this.ball.x = this.centerX + Math.cos(angle) * maxDistance;
                this.ball.y = this.centerY + Math.sin(angle) * maxDistance;
                
                this.createWallHitEffect();
                this.synthSounds.wallHit();
            }
        }
    }
    
    isInFunnel(ballAngle, funnel) {
        // Normalize angles to [0, 2π]
        let normalizedBallAngle = ballAngle;
        let normalizedFunnelAngle = funnel.angle;
        
        if (normalizedBallAngle < 0) normalizedBallAngle += 2 * Math.PI;
        if (normalizedFunnelAngle < 0) normalizedFunnelAngle += 2 * Math.PI;
        
        // Calculate angle difference
        let angleDiff = Math.abs(normalizedBallAngle - normalizedFunnelAngle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        
        return angleDiff <= funnel.width / 2;
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= 0.02;
            particle.size *= 0.98;
            return particle.life > 0 && particle.size > 0.5;
        });
    }
    
    updateHitEffect() {
        if (this.hitEffect) {
            this.hitEffect.radius += 3;
            this.hitEffect.opacity -= 0.05;
            if (this.hitEffect.opacity <= 0) {
                this.hitEffect = null;
            }
        }
    }
    
    checkCollisions() {
        // Check paddle collision
        const paddleX = this.centerX + Math.cos(this.paddle.angle) * this.paddle.radius;
        const paddleY = this.centerY + Math.sin(this.paddle.angle) * this.paddle.radius;
        
        const ballToPaddle = Math.sqrt(
            Math.pow(this.ball.x - paddleX, 2) + 
            Math.pow(this.ball.y - paddleY, 2)
        );
        
        if (ballToPaddle <= this.ball.radius + this.paddle.height / 2) {
            // Ball hit paddle
            this.handlePaddleHit(paddleX, paddleY);
        }
    }
    
    handlePaddleHit(paddleX, paddleY) {
        // Calculate reflection
        const dx = this.ball.x - paddleX;
        const dy = this.ball.y - paddleY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const normalX = dx / distance;
            const normalY = dy / distance;
            
            // Reflect velocity
            const dotProduct = this.ball.vx * normalX + this.ball.vy * normalY;
            this.ball.vx -= 2 * dotProduct * normalX;
            this.ball.vy -= 2 * dotProduct * normalY;
            
            // Add some randomness and energy
            this.ball.vx += (Math.random() - 0.5) * 0.5;
            this.ball.vy += (Math.random() - 0.5) * 0.5;
            
            // Ensure minimum speed
            const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
            if (speed < this.ball.speed) {
                this.ball.vx = (this.ball.vx / speed) * this.ball.speed;
                this.ball.vy = (this.ball.vy / speed) * this.ball.speed;
            }
        }
        
        // Move ball away from paddle
        this.ball.x = paddleX + (this.ball.x - paddleX) * 1.1;
        this.ball.y = paddleY + (this.ball.y - paddleY) * 1.1;
        
        this.incrementScore();
        this.createPaddleHitEffect(paddleX, paddleY);
        this.synthSounds.paddleHit();
    }
    
    incrementScore() {
        this.score++;
        this.hitCount++;
        
        // Increase speed every 5 hits
        if (this.hitCount % 5 === 0) {
            this.speedLevel++;
            this.ball.speed = this.ball.baseSpeed + (this.speedLevel - 1) * 0.5;
            
            // Update ball velocity to maintain new speed
            const currentSpeed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
            this.ball.vx = (this.ball.vx / currentSpeed) * this.ball.speed;
            this.ball.vy = (this.ball.vy / currentSpeed) * this.ball.speed;
            
            // Play speed up sound
            this.synthSounds.speedUp();
        }
        
        this.updateUI();
        this.animateScoreUpdate();
    }
    
    gameOver() {
        this.isPlaying = false;
        this.gameEnded = true;
        
        // Play game over sound
        this.synthSounds.gameOver();
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }
        
        // Add a small delay before showing game over screen for dramatic effect
        setTimeout(() => {
            this.showGameOverScreen();
        }, 1000);
    }
    
    getNormalVector(x, y) {
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const length = Math.sqrt(dx * dx + dy * dy);
        return { x: dx / length, y: dy / length };
    }
    
    reflectBall(normal) {
        const dotProduct = this.ball.vx * normal.x + this.ball.vy * normal.y;
        this.ball.vx -= 2 * dotProduct * normal.x;
        this.ball.vy -= 2 * dotProduct * normal.y;
    }
    
    createPaddleHitEffect(x, y) {
        this.hitEffect = {
            x: x,
            y: y,
            radius: 0,
            opacity: 1,
            color: '#00f5ff'
        };
        
        // Reduce particle count for performance
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 * i) / 4;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * 2,
                vy: Math.sin(angle) * 2,
                size: Math.random() * 3 + 1,
                life: 1,
                color: '#00f5ff'
            });
        }
    }
    
    createWallHitEffect() {
        // Reduce particles for better performance
        for (let i = 0; i < 3; i++) {
            this.particles.push({
                x: this.ball.x,
                y: this.ball.y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                size: Math.random() * 2 + 1,
                life: 1,
                color: '#ff006e'
            });
        }
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawArena();
        this.drawFunnels();
        this.drawBallTrail();
        this.drawBall();
        this.drawPaddle();
        this.drawParticles();
        this.drawHitEffect();
    }
    
    drawArena() {
        // Use prerendered arena if available
        if (this.prerenderedArena) {
            this.ctx.drawImage(this.prerenderedArena, 0, 0);
            return;
        }
        
        // Create prerendered arena
        this.prerenderedArena = document.createElement('canvas');
        this.prerenderedArena.width = this.canvas.width;
        this.prerenderedArena.height = this.canvas.height;
        const preCtx = this.prerenderedArena.getContext('2d');
        
        // Outer glow
        preCtx.beginPath();
        preCtx.arc(this.centerX, this.centerY, this.arenaRadius + 5, 0, Math.PI * 2);
        preCtx.strokeStyle = 'rgba(0, 245, 255, 0.2)';
        preCtx.lineWidth = 10;
        preCtx.stroke();
        
        // Main arena border (simplified - draw full circle then overlay funnels)
        preCtx.beginPath();
        preCtx.arc(this.centerX, this.centerY, this.arenaRadius, 0, Math.PI * 2);
        preCtx.strokeStyle = 'rgba(0, 245, 255, 0.6)';
        preCtx.lineWidth = 3;
        preCtx.stroke();
        
        // Inner decorative rings
        for (let i = 1; i <= 3; i++) {
            preCtx.beginPath();
            preCtx.arc(this.centerX, this.centerY, this.arenaRadius - i * 60, 0, Math.PI * 2);
            preCtx.strokeStyle = `rgba(0, 245, 255, ${0.1 - i * 0.02})`;
            preCtx.lineWidth = 1;
            preCtx.stroke();
        }
        
        // Draw the prerendered arena
        this.ctx.drawImage(this.prerenderedArena, 0, 0);
    }
    
    drawFunnels() {
        // Simplified funnel rendering - only animate every 3rd frame for performance
        this.frameCount++;
        const shouldAnimate = this.frameCount % 3 === 0;
        const time = shouldAnimate ? Date.now() * 0.003 : this.lastFrameTime;
        if (shouldAnimate) this.lastFrameTime = time;
        
        this.funnels.forEach((funnel, index) => {
            // Draw funnel walls (static)
            const startAngle = funnel.angle - funnel.width / 2;
            const endAngle = funnel.angle + funnel.width / 2;
            
            this.ctx.strokeStyle = funnel.color;
            this.ctx.lineWidth = 3;
            
            // Left wall
            this.ctx.beginPath();
            const leftStartX = this.centerX + Math.cos(startAngle) * this.arenaRadius;
            const leftStartY = this.centerY + Math.sin(startAngle) * this.arenaRadius;
            const leftEndX = this.centerX + Math.cos(startAngle) * (this.arenaRadius + funnel.depth);
            const leftEndY = this.centerY + Math.sin(startAngle) * (this.arenaRadius + funnel.depth);
            this.ctx.moveTo(leftStartX, leftStartY);
            this.ctx.lineTo(leftEndX, leftEndY);
            this.ctx.stroke();
            
            // Right wall
            this.ctx.beginPath();
            const rightStartX = this.centerX + Math.cos(endAngle) * this.arenaRadius;
            const rightStartY = this.centerY + Math.sin(endAngle) * this.arenaRadius;
            const rightEndX = this.centerX + Math.cos(endAngle) * (this.arenaRadius + funnel.depth);
            const rightEndY = this.centerY + Math.sin(endAngle) * (this.arenaRadius + funnel.depth);
            this.ctx.moveTo(rightStartX, rightStartY);
            this.ctx.lineTo(rightEndX, rightEndY);
            this.ctx.stroke();
            
            // Simplified glow (reduce animation frequency)
            if (shouldAnimate) {
                const glowIntensity = 0.6 + 0.3 * Math.sin(time + index * Math.PI);
                this.ctx.strokeStyle = `rgba(255, 0, 110, ${glowIntensity})`;
                this.ctx.lineWidth = 6;
                this.ctx.beginPath();
                this.ctx.arc(this.centerX, this.centerY, this.arenaRadius + funnel.depth / 2, startAngle, endAngle);
                this.ctx.stroke();
            }
            
            // Simple danger indicator (no scaling animation)
            const indicatorX = this.centerX + Math.cos(funnel.angle) * (this.arenaRadius + funnel.depth / 2);
            const indicatorY = this.centerY + Math.sin(funnel.angle) * (this.arenaRadius + funnel.depth / 2);
            
            this.ctx.fillStyle = funnel.color;
            this.ctx.font = '16px Arial'; // Use system font for better performance
            this.ctx.textAlign = 'center';
            this.ctx.fillText('⚠', indicatorX, indicatorY + 5);
        });
    }
    
    drawBallTrail() {
        if (this.ball.trail.length < 2) return;
        
        // Reduce trail rendering for performance - only draw every other trail point
        for (let i = 2; i < this.ball.trail.length; i += 2) {
            const alpha = i / this.ball.trail.length;
            const size = alpha * this.ball.radius * 0.8;
            
            this.ctx.beginPath();
            this.ctx.arc(this.ball.trail[i].x, this.ball.trail[i].y, size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 0, 110, ${alpha * 0.4})`;
            this.ctx.fill();
        }
    }
    
    drawBall() {
        // Glow effect
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius * 2, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 0, 110, 0.2)';
        this.ctx.fill();
        
        // Main ball
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.ball.color;
        this.ctx.fill();
        
        // Highlight
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x - 2, this.ball.y - 2, this.ball.radius * 0.4, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fill();
    }
    
    drawPaddle() {
        const paddleX = this.centerX + Math.cos(this.paddle.angle) * this.paddle.radius;
        const paddleY = this.centerY + Math.sin(this.paddle.angle) * this.paddle.radius;
        
        this.ctx.save();
        this.ctx.translate(paddleX, paddleY);
        this.ctx.rotate(this.paddle.angle + Math.PI / 2);
        
        // Glow effect
        this.ctx.shadowColor = this.paddle.glowColor;
        this.ctx.shadowBlur = 15;
        
        // Main paddle
        this.ctx.fillStyle = this.paddle.color;
        this.ctx.fillRect(-this.paddle.width / 2, -this.paddle.height / 2, this.paddle.width, this.paddle.height);
        
        // Highlight
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.fillRect(-this.paddle.width / 2, -this.paddle.height / 2, this.paddle.width, 3);
        
        this.ctx.restore();
    }
    
    drawParticles() {
        this.particles.forEach(particle => {
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color + Math.floor(particle.life * 255).toString(16).padStart(2, '0');
            this.ctx.fill();
        });
    }
    
    drawHitEffect() {
        if (!this.hitEffect) return;
        
        this.ctx.beginPath();
        this.ctx.arc(this.hitEffect.x, this.hitEffect.y, this.hitEffect.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hitEffect.color + Math.floor(this.hitEffect.opacity * 255).toString(16).padStart(2, '0');
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
    }
    
    updateUI() {
        document.getElementById('current-score').textContent = this.score;
        document.getElementById('high-score').textContent = this.highScore;
        document.getElementById('speed-level').textContent = this.speedLevel + 'x';
    }
    
    animateScoreUpdate() {
        const scoreElement = document.getElementById('current-score');
        scoreElement.classList.add('score-pulse');
        setTimeout(() => scoreElement.classList.remove('score-pulse'), 500);
    }
    
    hideOverlay() {
        this.overlay.classList.add('hidden');
    }
    
    showGameOverScreen() {
        document.getElementById('game-status').textContent = 'Game Over!';
        document.getElementById('game-instructions').innerHTML = 
            `Final Score: <strong>${this.score}</strong><br>` +
            `Speed Level: <strong>${this.speedLevel}x</strong><br>` +
            (this.score === this.highScore ? '<strong style="color: #00f5ff;">NEW HIGH SCORE!</strong><br>' : '') +
            'Click START GAME or press SPACE to play again';
        this.startBtn.textContent = 'PLAY AGAIN';
        this.overlay.classList.remove('hidden');
    }
    
    loadHighScore() {
        return parseInt(localStorage.getItem('orbitPongHighScore')) || 0;
    }
    
    saveHighScore() {
        localStorage.setItem('orbitPongHighScore', this.highScore.toString());
    }
    
    animate() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new OrbitPong();
});
