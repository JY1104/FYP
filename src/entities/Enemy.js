import { ctx, game, input, entities } from '../core/context.js';
import { STATE } from '../core/constants.js';
import { ASSETS } from '../core/assets.js';
import { FloatingText } from './Objects.js';

export class Enemy {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = 20;
        
        // AI 状态机属性
        this.baseSpeed = 2 + Math.random(); // 基础移动速度
        this.speed = this.baseSpeed;
        this.hp = 50 + (game.wave * 10);
        this.maxHp = this.hp;
        this.color = '#ff4444';

        // === 新增：AI 状态机 (State Machine) ===
        this.state = 'CHASE'; // 初始状态：追击 (CHASE, CHARGE, DASH, COOLDOWN)
        this.stateTimer = 0;  // 状态计时器
        this.dashAngle = 0;   // 冲刺锁定的方向

        // === 切图属性 ===
        this.frameW = 64; 
        this.frameH = 64; 
        this.frameIndex = 0; 
        this.frameTimer = 0; 
        this.frameSpeed = 5; 
    }

    update(dt = 1) {
        if (game.state !== STATE.PLAYING) return;
        
        const p = entities.player;
        if (!p) return;

        // ==========================================
        // 🧠 1. 碰撞分离系统 (Separation AI) - 防止怪物挤成一坨
        // ==========================================
        let repulseX = 0;
        let repulseY = 0;
        
        entities.enemies.forEach(other => {
            if (other !== this) { // 不和自己比
                const dx = this.x - other.x;
                const dy = this.y - other.y;
                const dist = Math.hypot(dx, dy);
                const minDist = this.radius * 2.5; // 怪物之间保持的距离
                
                // 如果两只怪物靠得太近，产生互相排斥的力
                if (dist > 0 && dist < minDist) {
                    const force = (minDist - dist) / dist; 
                    repulseX += dx * force * 0.1;
                    repulseY += dy * force * 0.1;
                }
            }
        });

        // 运用排斥力 (被推开)
        this.x += repulseX * dt;
        this.y += repulseY * dt;

        // ==========================================
        // 🤖 2. 状态机行为逻辑 (State Machine AI)
        // ==========================================
        const angleToPlayer = Math.atan2(p.y - this.y, p.x - this.x);
        const distToPlayer = Math.hypot(p.x - this.x, p.y - this.y);

        if (this.state === 'CHASE') {
            // 【追击状态】正常朝玩家移动
            this.speed = this.baseSpeed;
            this.x += Math.cos(angleToPlayer) * this.speed * dt; 
            this.y += Math.sin(angleToPlayer) * this.speed * dt; 

            // 如果离玩家足够近，有 2% 的概率突然开始蓄力准备冲刺
            if (distToPlayer < 180 && Math.random() < 0.02) {
                this.state = 'CHARGE';
                this.stateTimer = 30; // 蓄力 0.5 秒 (假设 60fps)
            }
        } 
        else if (this.state === 'CHARGE') {
            // 【蓄力状态】停在原地不动，锁定玩家现在的方向
            this.speed = 0; 
            this.dashAngle = angleToPlayer; // 锁定方向，如果你在这个时候走位可以躲开！
            
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'DASH';
                this.stateTimer = 20; // 冲刺持续约 0.3 秒
            }
        } 
        else if (this.state === 'DASH') {
            // 【冲刺状态】以 4 倍速度像疯狗一样冲锋！
            this.speed = this.baseSpeed * 4;
            this.x += Math.cos(this.dashAngle) * this.speed * dt; 
            this.y += Math.sin(this.dashAngle) * this.speed * dt; 
            
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'COOLDOWN';
                this.stateTimer = 60; // 冲刺完疲劳 1 秒
            }
        } 
        else if (this.state === 'COOLDOWN') {
            // 【疲劳状态】移动速度变得极其缓慢，大喘气
            this.speed = this.baseSpeed * 0.2; 
            this.x += Math.cos(angleToPlayer) * this.speed * dt; 
            this.y += Math.sin(angleToPlayer) * this.speed * dt; 
            
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'CHASE'; // 休息够了，继续追！
            }
        }

        // ==========================================
        // 🏃 3. 动画切图逻辑 (配合 AI 状态改变速度)
        // ==========================================
        // 如果正在蓄力(速度为0)，腿就别动了；如果是冲刺，腿倒腾得极快！
        if (this.speed > 0) {
            // 速度越快，动画播放速度也按比例加快
            const currentAnimSpeed = Math.max(1, this.frameSpeed / (this.speed / this.baseSpeed));
            
            this.frameTimer += dt;
            if (this.frameTimer > currentAnimSpeed) {
                this.frameIndex++;
                if (this.frameIndex > 5) this.frameIndex = 0;
                this.frameTimer = 0;
            }
        } else {
            this.frameIndex = 0; // 蓄力时定在第一帧
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        const p = entities.player;

        // 如果哥布林处于蓄力(CHARGE)状态，让它疯狂闪烁警告玩家！
        if (this.state === 'CHARGE') {
            if (Math.floor(Date.now() / 50) % 2 === 0) {
                ctx.globalAlpha = 0.5; // 半透明闪烁效果
                // 可选：画一个感叹号
                ctx.fillStyle = 'red';
                ctx.font = 'bold 24px Arial';
                ctx.fillText("!", -5, -40);
            }
        }

        if (ASSETS.enemy && ASSETS.enemy.complete && ASSETS.enemy.naturalHeight !== 0) {
            let rowIndex = 0; 
            
            // 面朝方向的判断：如果是冲刺状态，就要看锁定的方向，否则看玩家在哪
            const faceAngle = (this.state === 'DASH' || this.state === 'CHARGE') ? this.dashAngle : (p ? Math.atan2(p.y - this.y, p.x - this.x) : 0);

            if (faceAngle > -Math.PI/4 && faceAngle <= Math.PI/4) rowIndex = 1; 
            else if (faceAngle > Math.PI/4 && faceAngle <= 3*Math.PI/4) rowIndex = 0; 
            else if (faceAngle > -3*Math.PI/4 && faceAngle <= -Math.PI/4) rowIndex = 2; 
            else rowIndex = 3; 

            const sx = this.frameIndex * this.frameW;
            const sy = rowIndex * this.frameH; 

            const drawSize = 64; 
            
            ctx.drawImage(
                ASSETS.enemy, 
                sx, sy, this.frameW, this.frameH, 
                -drawSize/2, -drawSize/2, drawSize, drawSize 
            );
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }

        // 恢复透明度画血条
        ctx.globalAlpha = 1;
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'red';
            ctx.fillRect(-15, -30, 30, 5);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(-15, -30, 30 * (this.hp / this.maxHp), 5);
        }

        ctx.restore();
    }
}

export class SpiderEnemy {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = 15;
        this.speed = 3.5; // 蜘蛛稍微快一点
        this.hp = 40;
        this.maxHp = 40;

        // 🛠️ 关键参数校对
        this.frameW = 64; 
        this.frameH = 64; 
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.frameSpeed = 4; // 10帧比较多，播快一点才丝滑
        
        this.time = Math.random() * 100; // S型走位计时
    }

    update(dt = 1) {
        if (game.state !== STATE.PLAYING) return;
        const p = entities.player;
        
        // 🧠 S型走位 AI
        this.time += dt * 0.15;
        const angle = Math.atan2(p.y - this.y, p.x - this.x);
        const wobble = Math.sin(this.time) * 6;
        
        this.x += (Math.cos(angle) * this.speed + Math.cos(angle + Math.PI/2) * wobble) * dt;
        this.y += (Math.sin(angle) * this.speed + Math.sin(angle + Math.PI/2) * wobble) * dt;

        // 📈 动画更新：每行有 10 帧
        this.frameTimer += dt;
        if (this.frameTimer > this.frameSpeed) {
            this.frameIndex = (this.frameIndex + 1) % 10; // 👈 这里必须是 10
            this.frameTimer = 0;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // 🛡️ 防崩检查
        const isReady = ASSETS.spider_enemy_pure && 
                        ASSETS.spider_enemy_pure.complete && 
                        ASSETS.spider_enemy_pure.naturalWidth !== 0;

        if (isReady) {
            // 🎯 根据玩家位置计算 4 个方向的 Row Index
            const p = entities.player;
            const angle = Math.atan2(p.y - this.y, p.x - this.x);
            let degrees = angle * (180 / Math.PI);
            degrees = (degrees + 360) % 360;

            let rowIndex = 0; // 默认向下 (Row 0)
            if (degrees >= 45 && degrees < 135) rowIndex = 0;      // 下 (Row 0)
            else if (degrees >= 135 && degrees < 225) rowIndex = 1; // 左 (Row 3)
            else if (degrees >= 225 && degrees < 315) rowIndex = 2; // 上 (Row 2)
            else rowIndex = 3;                                     // 右 (Row 1)

            const sx = this.frameIndex * this.frameW;
            const sy = rowIndex * this.frameH;

            ctx.drawImage(
                ASSETS.spider_enemy_pure,
                sx, sy, 64, 64,
                -32, -32, 64, 64
            );
        } else {
            // 占位圆圈
            ctx.fillStyle = '#00ff44';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// src/entities/Enemy.js

// src/entities/Enemy.js 里的 GolemEnemy 类

export class GolemEnemy extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 35; 
        this.speed = 1.0; 
        this.hp = 300; 
        this.maxHp = this.hp;
        this.damage = 30;

        this.state = 'MOVE'; 
        this.attackCooldown = 0;
        
        // 🌟 核心调整：根据新图设置
        this.frameW = 64;  // 单帧宽度
        this.frameH = 64;  // 单帧高度
        this.totalFrames = 7; // 你的新图横向有 7 张小图
        
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.frameSpeed = 8; 
    }

    update(dt = 1) {
        if (game.state !== STATE.PLAYING) return;
        const p = entities.player;
        if (!p) return;

        const dist = Math.hypot(p.x - this.x, p.y - this.y);
        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        if (this.state === 'MOVE') {
            // 1. 移动逻辑
            const angle = Math.atan2(p.y - this.y, p.x - this.x);
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;

            // 2. 走路动画循环 (0 到 6)
            this.frameTimer += dt;
            if (this.frameTimer > this.frameSpeed) {
                this.frameIndex = (this.frameIndex + 1) % this.totalFrames;
                this.frameTimer = 0;
            }

            // 3. 进入攻击判定
            if (dist < 100 && this.attackCooldown <= 0) {
                this.state = 'ATTACK';
                this.frameIndex = 0;
                this.frameTimer = 0;
            }
        } 
        else if (this.state === 'ATTACK') {
            // 4. 攻击动画播放
            this.frameTimer += dt;
            if (this.frameTimer > 7) { 
                this.frameIndex++;
                this.frameTimer = 0;

                // 攻击打击点 (通常在第 4-5 帧)
                if (this.frameIndex === 4 && dist < 120) {
                    this.performSlam();
                }

                // 动画播放结束回到移动状态
                if (this.frameIndex >= this.totalFrames) {
                    this.state = 'MOVE';
                    this.attackCooldown = 120; // 冷却 2 秒
                    this.frameIndex = 0;
                }
            }
        }
    }

    performSlam() {
        const p = entities.player;
        if (p && p.iframes <= 0) {
            p.hp -= this.damage;
            p.iframes = 30;
            // 这里的 FloatingText 必须在顶部正确 import！
            entities.texts.push(new FloatingText(p.x, p.y, `SLAM! -${this.damage}`, "#ff0000"));
        }
    }

draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    const p = entities.player;
    // 🌟 按照你确认的：0:上, 1:左, 2:下, 3:右
    let rowIndex = 2; 
    if (p) {
        const angle = Math.atan2(p.y - this.y, p.x - this.x);
        if (angle > -Math.PI/4 && angle <= Math.PI/4) rowIndex = 3;      // 右
        else if (angle > Math.PI/4 && angle <= 3*Math.PI/4) rowIndex = 2; // 下
        else if (angle > -3*Math.PI/4 && angle <= -Math.PI/4) rowIndex = 0; // 上
        else rowIndex = 1; // 左
    }

    const isAttacking = (this.state === 'ATTACK');
    const sheet = isAttacking ? ASSETS.golem_attack : ASSETS.golem_walk;

    if (!sheet || !sheet.complete) {
        ctx.fillStyle = "purple"; ctx.fillRect(-20, -20, 40, 40); ctx.restore();
        return;
    }

    // 🌟 核心修复：动态设置单帧尺寸
    const fw = 64; 
    const fh = isAttacking ? 96 : 64; // 攻击时切 96 高，走路时切 64 高

    const sx = this.frameIndex * fw;
    const sy = rowIndex * fh; 
    
    // 🌟 动态设置渲染尺寸
    const drawW = 128; 
    const drawH = isAttacking ? 192 : 128; // 攻击时画 192 高，走路时画 128 高
    
    // 🌟 动态设置垂直偏移（脚部对齐）
    // 走路时的 yOffset 通常是 -drawH 加上一点余量
    const yOffset = isAttacking ? -180 : -120; 

    // 绘制逻辑
    ctx.drawImage(
        sheet, 
        sx, sy, fw, fh, 
        -drawW / 2, yOffset, drawW, drawH
    );

    // 血条位置自适应 (始终在头顶上方 10px)
    if (this.hp < this.maxHp) {
        ctx.fillStyle = 'red';
        ctx.fillRect(-25, yOffset - 15, 50, 6);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(-25, yOffset - 15, 50 * (this.hp / this.maxHp), 6);
    }

    // 调试点：看巨人的脚是否踩在 (0,0)
    // ctx.fillStyle = "white"; ctx.fillRect(-2, -2, 4, 4);

    ctx.restore();
}
}