import { ctx, game, input, entities } from '../core/context.js';
import { STATE } from '../core/constants.js';
import { Bullet } from './Objects.js';
import { ASSETS } from '../core/assets.js';
import { playSFX } from '../core/audio.js';

export class Player {
    constructor() {
        this.x = game.width / 2;
        this.y = game.height / 2;
        this.radius = 20;
        this.speed = 5;
        this.maxHp = 100;
        this.hp = 100;
        this.coins = 0;
        this.damage = 25;
        this.lastShot = 0;
        this.shootDelay = 150;
        this.iframes = 0;

        // 👇 记录最后的面朝方向 (默认 0 度，朝右)
        this.lastAngle = 0;

        // === 动画控制属性 ===
        this.frameW = 313; 
        this.frameH = 206; 
        this.cols = 20;     
        this.frameIndex = 0; 
        this.frameTimer = 0; 
        this.frameSpeed = 3; 
    }

update(dt = 1) {
    if (game.state !== STATE.PLAYING) return;

    let isMoving = false;
    let dx = 0;
    let dy = 0;

    // === 1. 移动逻辑 (左摇杆 moveVector) ===
    // 统一变量名，使用 moveVector 控制移动
    if (input.moveVector && input.moveVector.active) {
        dx = input.moveVector.x;
        dy = input.moveVector.y;
    } else {
        // 键盘逻辑
        if (input.keys.w) dy -= 1;
        if (input.keys.s) dy += 1;
        if (input.keys.a) dx -= 1;
        if (input.keys.d) dx += 1;
        
        if (dx !== 0 && dy !== 0) {
            const len = Math.hypot(dx, dy);
            dx /= len; dy /= len;
        }
    }

    // 应用移动
    if (dx !== 0 || dy !== 0) {
        this.x += dx * this.speed * dt;
        this.y += dy * this.speed * dt;
        isMoving = true;
        // 如果没有射击，角色默认看向移动方向
        if (!input.fireVector.active && !input.mouse.down) {
            this.lastAngle = Math.atan2(dy, dx);
        }
    }

    // 限制出界... (保持原样)
    this.x = Math.max(this.radius, Math.min(game.width - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(game.height - this.radius, this.y));

    // === 2. 动画更新... (保持原样) ===
    if (isMoving) {
        this.frameTimer += dt;
        if (this.frameTimer > this.frameSpeed) {
            this.frameIndex = (this.frameIndex + 1) % 20;
            this.frameTimer = 0;
        }
    } else {
        this.frameIndex = 0;
    }

    // === 3. 射击逻辑 (双摇杆核心升级) ===
    // 判定条件：要么拉动了右摇杆，要么按下了鼠标
    const isFiring = input.fireVector.active || input.mouse.down;

    if (isFiring) {
        const now = Date.now();
        if (now - this.lastShot > this.shootDelay) {
            let shootAngle = this.lastAngle;

            // 优先级 1：右摇杆瞄准 (手机端)
            if (input.fireVector.active) {
                shootAngle = Math.atan2(input.fireVector.y, input.fireVector.x);
            } 
            // 优先级 2：鼠标瞄准 (电脑端)
            else if (input.mouse.down && input.mouse.x !== 0) {
                shootAngle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
            }

            // 更新面朝方向，确保子弹射出时，人物也看向那边
            this.lastAngle = shootAngle;

            entities.bullets.push(new Bullet(this.x, this.y, shootAngle, this.damage));
            playSFX('shoot');
            this.lastShot = now;
        }
    }

    // === 4. 无敌帧... (保持原样) ===
    if (this.iframes > 0) this.iframes -= dt;
}

    draw() {
    if (this.iframes > 0 && Math.floor(Date.now() / 50) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    
    // 直接使用 update 中计算好的最后角度
    ctx.rotate(this.lastAngle);

    const sx = this.frameIndex * this.frameW;
    const sy = 0;
    const drawW = this.frameW * 0.4;
    const drawH = this.frameH * 0.4;

    ctx.drawImage(
        ASSETS.player, 
        sx, sy, this.frameW, this.frameH, 
        -drawW / 2 + 10, -drawH / 2, drawW, drawH 
    );

    ctx.restore();
}
}