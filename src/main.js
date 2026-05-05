// src/main.js
console.log("💡 主程序已经成功加载！");
let settingFocusIndex = 0; // 0: BGM, 1: SFX


import { ctx, game, entities, input } from './core/context.js';
import { STATE, CONFIG } from './core/constants.js';
import { MapSystem } from './systems/Map.js';
import { drawUI } from './systems/UI.js';
import { Player } from './entities/Player.js';
import { Enemy, SpiderEnemy, GolemEnemy } from './entities/Enemy.js';
import { Portal, FloatingText, HealthDrop } from './entities/Objects.js';
import { DataSystem } from './systems/Data.js'; 
import { loadAssets } from './core/assets.js'; 
import { playBGM, updateBGMVolume,stopBGM } from './core/audio.js'; 



// ==========================================
// 🖥️ 1. HTML UI 控制系统 (接管所有菜单)
// ==========================================
const uiMainMenu = document.getElementById('ui-main-menu');
const uiSettings = document.getElementById('ui-settings');
const uiShop = document.getElementById('ui-shop');
const uiPause = document.getElementById('ui-pause'); 
const uiMobile = document.getElementById('ui-mobile-controls');
const uiGameOver = document.getElementById('ui-game-over'); 
const finalScoreVal = document.getElementById('final-score');
const btnRestart = document.getElementById('btn-restart');
const btnFullscreen = document.getElementById('btn-fullscreen');
const fsPrompt = document.getElementById('ui-fullscreen-prompt');
const mainMenu = document.getElementById('ui-main-menu');
const fsBtn = document.getElementById('btn-enter-fullscreen');


// 📱 探测器逻辑
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window);

function switchUI(newState) {
    if (game.state !== newState) game.previousState = game.state;
    game.state = newState;

    // 隐藏所有层
    [uiMainMenu, uiSettings, uiShop, uiPause, uiMobile, uiGameOver].forEach(el => {
        if (el) el.classList.add('hidden');
    });

    // 显现对应层
    if (newState === STATE.START) uiMainMenu.classList.remove('hidden');
    else if (newState === STATE.SETTINGS) uiSettings.classList.remove('hidden');
    else if (newState === STATE.SHOP) uiShop.classList.remove('hidden');
    else if (newState === STATE.PAUSED) uiPause.classList.remove('hidden');
    else if (newState === STATE.GAME_OVER) {
        uiGameOver.classList.remove('hidden'); // 👈 修复：确保这里能解冻
        finalScoreVal.innerText = game.score;
    }

    if (newState === STATE.PLAYING) {
        playBGM(); // 恢复音乐
        if (isMobile) uiMobile.classList.remove('hidden'); // 游戏中且手机则显现摇杆[cite: 1]
    } else {
        // 如果不是在玩，停止 BGM
        if (newState === STATE.START) stopBGM();
    }
}
// 2. 全屏切换函数 (手机适配核心)
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn(`全屏请求失败: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}
// 3. 绑定按钮监听 (Restart + Fullscreen)
btnRestart.addEventListener('click', () => {
    resetGame();
    switchUI(STATE.PLAYING);
});

btnFullscreen.addEventListener('click', () => {
    toggleFullScreen();
    // 切换完全屏后通常回到暂停界面
});
// === 按钮事件绑定 ===
document.getElementById('btn-start').addEventListener('click', () => {
    resetGame();
    switchUI(STATE.PLAYING);
    playBGM(); 
});

// 死亡后回主菜单按钮
document.getElementById('btn-over-main').addEventListener('click', () => {
    switchUI(STATE.START);
});

document.getElementById('btn-settings').addEventListener('click', () => switchUI(STATE.SETTINGS));
document.getElementById('btn-settings-back').addEventListener('click', () => switchUI(game.previousState || STATE.START));
document.getElementById('btn-shop-back').addEventListener('click', () => switchUI(STATE.PLAYING));
// --- 暂停菜单按钮 ---
document.getElementById('btn-resume').addEventListener('click', () => {
    switchUI(STATE.PLAYING);
});
document.getElementById('btn-pause-settings').addEventListener('click', () => {
    switchUI(STATE.SETTINGS);
});
document.getElementById('btn-pause-main').addEventListener('click', () => {
    switchUI(STATE.START);
});

// === 设置菜单：音量滑块 ===
const sliderBgm = document.getElementById('slider-bgm');
const sliderSfx = document.getElementById('slider-sfx');
const valBgm = document.getElementById('bgm-val');
const valSfx = document.getElementById('sfx-val');

sliderBgm.addEventListener('input', (e) => {
    game.bgmVolume = e.target.value;
    valBgm.innerText = game.bgmVolume;
    updateBGMVolume(); // 实时更新
});
sliderSfx.addEventListener('input', (e) => {
    game.sfxVolume = e.target.value;
    valSfx.innerText = game.sfxVolume;
});
document.getElementById('btn-mute').addEventListener('click', () => {
    game.bgmVolume = 0; game.sfxVolume = 0;
    sliderBgm.value = 0; sliderSfx.value = 0;
    valBgm.innerText = '0'; valSfx.innerText = '0';
    updateBGMVolume();
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // 当用户切到别的 Tab 或者最小化窗口时
        stopBGM();
        // 如果是在游戏中，顺便自动暂停
        if (game.state === STATE.PLAYING) {
            switchUI(STATE.PAUSED);
        }
    } else {
        // 当用户切回游戏时
        // 这里通常不自动播放 BGM，让玩家点 RESUME 或者重新开始时再响，比较有礼貌
    }
});

// ==========================================
// 💰 2. 商店与经济系统 
// ==========================================
game.upgrades = game.upgrades || {
    dmg: { level: 1, basePrice: 50 },
    hp: { level: 1, basePrice: 50 },
};

// 2. 使用你的新公式计算物价
function getPrice(type) {
    let item = game.upgrades[type];
    return item.basePrice + (10 * item.level);
}

function updateShopUI() {
    document.getElementById('shop-wallet').innerText = (game.coins || 0);
    document.getElementById('lvl-dmg').innerText = game.upgrades.dmg.level;
    document.getElementById('lvl-hp').innerText = game.upgrades.hp.level;
    document.getElementById('btn-buy-dmg').innerText = getPrice('dmg');
    document.getElementById('btn-buy-hp').innerText = getPrice('hp');
    
}

function buyUpgrade(type) {
    let price = getPrice(type);
    
    if (game.coins >= price) {
        // 1. 扣除全局钱包的 RM
        game.coins -= price;
        
        // 2. 暴力同步给玩家实体（防止 UI 显示错误或杀怪时拿错旧钱）
        if (entities.player) {
            entities.player.coins = game.coins;
        }

        // 3. 强制把扣完的余额写入存档对象（防止 save 的时候存进旧的 300 RM！）
        if (DataSystem && DataSystem.data) {
            DataSystem.data.coins = game.coins;
        }

        // 4. 玩家加强逻辑
        if (type === 'dmg' && entities.player) {
            entities.player.damage = (entities.player.damage || 10) + 5; 
        } else if (type === 'hp' && entities.player) {
            entities.player.maxHp = (entities.player.maxHp || 100) + 20;
            entities.player.hp = entities.player.maxHp; 
        }

        // 5. 物价上涨机制
        game.upgrades[type].level++;
        
        // 6. 更新商店 UI 并执行存档
        updateShopUI();
        DataSystem.save(); 
        
        console.log("🛒 购买成功！三方数据已同步，当前剩余 RM:", game.coins);
    }
}
// 绑定按钮事件
document.getElementById('btn-buy-dmg').addEventListener('click', () => buyUpgrade('dmg'));
document.getElementById('btn-buy-hp').addEventListener('click', () => buyUpgrade('hp'));


// ==========================================
// 📱 3. 手机虚拟摇杆系统
// ==========================================
// 获取 DOM 元素
const moveBase = document.getElementById('move-joystick-base');
const moveKnob = document.getElementById('move-joystick-knob');
const fireBase = document.getElementById('fire-joystick-base');
const fireKnob = document.getElementById('fire-joystick-knob');

// 通用摇杆处理逻辑
// 通用摇杆处理逻辑 (支持多点触控)
function setupJoystick(base, knob, inputTarget) {
    let activeTouchId = null; // 🌟 记录当前摇杆绑定的手指 ID

    function handleMove(e) {
        if (activeTouchId === null) return;
        e.preventDefault();

        // 🌟 核心：从所有触摸点中找到跟当前摇杆绑定的那一根
        const touch = Array.from(e.touches).find(t => t.identifier === activeTouchId);
        if (!touch) return;

        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;

        const distance = Math.hypot(dx, dy);
        const maxDist = rect.width / 2;

        if (distance > maxDist) {
            dx = (dx / distance) * maxDist;
            dy = (dy / distance) * maxDist;
        }

        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        inputTarget.x = dx / maxDist;
        inputTarget.y = dy / maxDist;
        inputTarget.active = true;
    }

    base.addEventListener('touchstart', (e) => {
        e.preventDefault();
        // 🌟 记录第一根碰到这个摇杆的手指 ID
        if (activeTouchId === null) {
            activeTouchId = e.changedTouches[0].identifier;
            inputTarget.active = true;
            handleMove(e);
        }
    }, { passive: false });

    base.addEventListener('touchmove', handleMove, { passive: false });

    const handleEnd = (e) => {
        // 🌟 检查离开的是不是绑定的那根手指
        const touch = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId);
        if (touch) {
            activeTouchId = null;
            inputTarget.active = false;
            inputTarget.x = 0;
            inputTarget.y = 0;
            knob.style.transform = `translate(-50%, -50%)`;
        }
    };

    ['touchend', 'touchcancel'].forEach(evt => base.addEventListener(evt, handleEnd));
}

// 依然是这样调用
setupJoystick(moveBase, moveKnob, input.moveVector);
setupJoystick(fireBase, fireKnob, input.fireVector);

// ==========================================
// 🎮 4. 初始化与核心流程
// ==========================================
function init() {
    // 1. 强制先获取正确的全屏尺寸
    const canvasObj = document.getElementById('gameCanvas');
    canvasObj.width = window.innerWidth;
    canvasObj.height = window.innerHeight;
    game.width = canvasObj.width;
    game.height = canvasObj.height;

    // 2. 尺寸对了之后，再初始化地图和 UI
    MapSystem.init();
    switchUI(STATE.START); 
    loop();
}

export function resetGame() {
    game.score = 0;
    game.wave = 1;
    game.playTime = 0;
    game.enemyHpMulti = 1;
    game.coins = 0;

    game.shopTimer = 10;

    entities.player = new Player();
    entities.bullets = [];
    entities.enemies = [];
    entities.portals = [];
    entities.texts = [];
    entities.drops = [];

    DataSystem.reset();
    const hasSave = DataSystem.load();
    if (hasSave) {
        entities.texts.push(new FloatingText(entities.player.x, entities.player.y, "WELCOME BACK!", "#fff"));
        // 确保进游戏时能拿到最新的币数
        game.coins = DataSystem.data.coins || 0; 

        entities.player.coins = game.coins;
    }
}

let lastTime = 0;
function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / (1000 / 60);
    if (dt > 3) dt = 3; 
    lastTime = timestamp;

    update(dt); 
    draw();
    input.mouse.clicked = false;
    requestAnimationFrame(loop); 
}

loadAssets(() => {
    init();
});

// ==========================================
// 5. 实体生成逻辑 (Spawners)
// ==========================================
function spawnPortal() {
    let x = Math.random() * game.width;
    let y = Math.random() * game.height;
    entities.portals.push(new Portal(x, y));
    console.log("🏪 商店已在地图刷新！");
}

function spawnEnemy() {
    if (game.state !== STATE.PLAYING) return;
    const side = Math.random() < 0.5 ? 'h' : 'v';
    let x, y;
    if (side === 'h') {
        x = Math.random() < 0.5 ? -50 : game.width + 50;
        y = Math.random() * game.height;
    } else {
        x = Math.random() * game.width;
        y = Math.random() < 0.5 ? -50 : game.height + 50;
    }
    
    const rand = Math.random();
    let enemy;

    // 🎲 重新分配概率 (确保加起来是 100%)
    if (rand < 0.60) {
        enemy = new Enemy(x, y);       // 60% 基础哥布林
    } else if (rand < 0.90) {
        enemy = new SpiderEnemy(x, y); // 30% 霓虹蜘蛛
    } else {
        enemy = new GolemEnemy(x, y);  // 10% 巨人坦克 (精英怪要少一点才刺激)
    }

    // 应用难度加成
    enemy.hp = enemy.hp * game.enemyHpMulti; 
    enemy.maxHp = enemy.hp; 
    entities.enemies.push(enemy);
}
setInterval(spawnEnemy, CONFIG.SPAWN_RATE);

// ==========================================
// 6. 游戏逻辑更新 (Update)
// ==========================================
function update(dt) {
    // 🌟 第一步：先读取手柄输入 (无论是否在玩，手柄状态都要更新)
    handleGamepadInput();
    

    if (game.state !== STATE.PLAYING) {
        // 非战斗状态下，也要更新飘字（比如商店提示）
        updateTexts(dt);
        return;
    }

    game.frame++;

    // 📈 1. 动态难度 (DDA)
    game.playTime += dt * (1/60);
    if (game.playTime >= 300) {
        game.enemyHpMulti += 0.5;
        game.playTime = 0;
        console.log("DDA: 敌人进化！倍率: " + game.enemyHpMulti);
    }

    // 🏃‍♂️ 2. 更新玩家
    if (entities.player) {
        entities.player.update(dt);
    }
    
    // ⏳ 3. 商店刷新逻辑
    handleShopLogic(dt);

    // 🔫 4. 实体更新 (子弹、敌人、掉落物)
    updateEntities(dt);

    // 💬 5. 飘字更新
    updateTexts(dt);
}

// === 辅助逻辑 A：更新飘字 (Floating Texts) ===
function updateTexts(dt) {
    for (let i = entities.texts.length - 1; i >= 0; i--) {
        let t = entities.texts[i];
        t.update(dt); 
        if (t.life <= 0) entities.texts.splice(i, 1);
    }
}

// === 辅助逻辑 B：商店刷新与碰撞逻辑 ===
function handleShopLogic(dt) {
    if (game.shopTimer !== undefined) {
        game.shopTimer -= dt * (1/60); 
        if (game.shopTimer <= 0) {
            spawnPortal(); 
            game.shopTimer = 10; 
        }
    }

    for (let i = entities.portals.length - 1; i >= 0; i--) {
        let p = entities.portals[i];
        p.update(); 
        if (p.life <= 0) {
            entities.portals.splice(i, 1);
            continue; 
        }
        const dist = Math.hypot(p.x - entities.player.x, p.y - entities.player.y);
        if (dist < p.radius + entities.player.radius) {
            switchUI(STATE.SHOP);   
            updateShopUI();         
            entities.portals.splice(i, 1); 
        }
    }
}

// === 辅助逻辑 C：更新所有实体 (子弹、敌人、掉落物) ===
function updateEntities(dt) {
    // 1. 玩家子弹
    for (let i = entities.bullets.length - 1; i >= 0; i--) {
        let b = entities.bullets[i];
        b.update(dt);
        if (b.x < 0 || b.x > game.width || b.y < 0 || b.y > game.height) {
            entities.bullets.splice(i, 1);
        }
    }

    // 2. 敌人子弹
    if (!entities.enemyBullets) entities.enemyBullets = [];
    for (let i = entities.enemyBullets.length - 1; i >= 0; i--) {
        let eb = entities.enemyBullets[i];
        eb.update(dt);
        if (eb.x < 0 || eb.x > game.width || eb.y < 0 || eb.y > game.height) {
            entities.enemyBullets.splice(i, 1);
            continue;
        }
        const dist = Math.hypot(eb.x - entities.player.x, eb.y - entities.player.y);
        if (dist < eb.radius + entities.player.radius) {
            if (entities.player.iframes <= 0) {
                entities.player.hp -= eb.damage;
                entities.player.iframes = 30;
                shakeController(); // 震动！
                entities.texts.push(new FloatingText(entities.player.x, entities.player.y, `-${eb.damage}`, "#f00"));
                if (entities.player.hp <= 0) game.state = STATE.GAME_OVER;
            }
            entities.enemyBullets.splice(i, 1);
        }
    }

    // 3. 敌人处理
    for (let i = entities.enemies.length - 1; i >= 0; i--) {
        let e = entities.enemies[i];
        e.update(dt);
        
        // 敌人撞击玩家
        const distToPlayer = Math.hypot(e.x - entities.player.x, e.y - entities.player.y);
        if (distToPlayer < e.radius + entities.player.radius) {
            if (entities.player.iframes <= 0) {
                entities.player.hp -= e.damage || 10;
                entities.player.iframes = 30;
                shakeController(); // 震动！
                entities.texts.push(new FloatingText(entities.player.x, entities.player.y, `-${e.damage || 10}`, "#f00"));
                if (entities.player.hp <= 0) switchUI(STATE.GAME_OVER);
            }
        }
        
        // 玩家子弹打敌人
        for (let j = entities.bullets.length - 1; j >= 0; j--) {
            let b = entities.bullets[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + b.radius) {
                e.hp -= b.damage;
                entities.bullets.splice(j, 1);
                entities.texts.push(new FloatingText(e.x, e.y, Math.floor(b.damage), "#fff"));
                if (e.hp <= 0) {
                    handleEnemyDeath(e, i); // 抽取出来的死亡处理
                    break;
                }
            }
        }
    }

    // 4. 掉落物
    for (let i = entities.drops.length - 1; i >= 0; i--) {
        let drop = entities.drops[i];
        drop.update(dt);
        if (drop.life <= 0) { entities.drops.splice(i, 1); continue; }
        if (Math.hypot(entities.player.x - drop.x, entities.player.y - drop.y) < entities.player.radius + drop.radius) {
            const heal = Math.min(drop.healAmount, entities.player.maxHp - entities.player.hp);
            if (heal > 0) entities.player.hp += heal;
            entities.texts.push(new FloatingText(entities.player.x, entities.player.y, heal > 0 ? `+${heal} HP` : "MAX HP", "#00ff44"));
            entities.drops.splice(i, 1);
        }
    }
}

// === 辅助逻辑 D：敌人死亡处理 ===
function handleEnemyDeath(e, index) {
    entities.enemies.splice(index, 1);
    game.score += 100;
    let moneyGained = 20 + Math.floor(Math.random() * 10);
    game.coins = (game.coins || 0) + moneyGained;
    entities.player.coins = game.coins;
    entities.texts.push(new FloatingText(e.x, e.y, "+" + moneyGained, "#ffd700"));
    if (Math.random() < 0.20) entities.drops.push(new HealthDrop(e.x, e.y));
}

// ==========================================
// 7. 游戏画面渲染 (Draw) - 完美修复版
// ==========================================
function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, game.width, game.height);

    if (game.state === STATE.PLAYING || game.state === STATE.GAME_OVER || game.state === STATE.SHOP || game.state === STATE.PAUSED) {
        
        MapSystem.draw();
        entities.portals.forEach(p => p.draw());
        entities.drops.forEach(d => d.draw());
        entities.enemies.forEach(e => e.draw());
        entities.bullets.forEach(b => b.draw());
        entities.enemyBullets.forEach(b => b.draw());
        const p = entities.player;
        if (p) p.draw();
        entities.texts.forEach(t => t.draw());
        
        if (p && p.iframes > 0) {
            const alpha = (p.iframes / 30) * 0.5; 
            const gradient = ctx.createRadialGradient(
                game.width/2, game.height/2, game.height/4, 
                game.width/2, game.height/2, game.width/1.5
            );
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
            gradient.addColorStop(1, `rgba(255, 0, 0, ${alpha * 1.5})`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, game.width, game.height);
        }

        // 全权交给你的 UI.js 负责，main.js 绝对不插手画字！
        drawUI(); 
        // === 屏幕调试器：放在 draw() 最后 ===
if (game.state === STATE.PAUSED) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(10, 10, 250, 150);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];
    
    ctx.fillText(`State: ${game.state}`, 20, 35);
    if (!gp) {
        ctx.fillText("Gamepad: NOT FOUND", 20, 60);
    } else {
        ctx.fillText(`ID: ${gp.id.substring(0, 15)}...`, 20, 60);
        // 显示当前按下的按键索引
        let pressedBtn = gp.buttons.findIndex(b => b.pressed);
        ctx.fillText(`Pressed Button Index: ${pressedBtn}`, 20, 85);
        ctx.fillText(`Axis 0: ${gp.axes[0].toFixed(2)}`, 20, 110);
    }
}
    }
}

// ==========================================
// 8. 输入监听 (只保留游戏中需要的)
// ==========================================
window.addEventListener('keydown', e => {
    // ESC 键用于死亡后返回主菜单
    if (e.key === 'Escape') {
        if (game.state === STATE.PLAYING) {
            switchUI(STATE.PAUSED); // 触发暂停，HTML 隐藏，露出底层的 Canvas 暂停画面
        } else if (game.state === STATE.PAUSED) {
            switchUI(STATE.PLAYING); // 再次按 ESC 恢复游戏
        } else if (game.state === STATE.GAME_OVER) {
            switchUI(STATE.START);
        }
    }
    // R键重启
    if (e.key.toLowerCase() === 'r' && game.state === STATE.GAME_OVER) {
        resetGame(); 
        switchUI(STATE.PLAYING);
    }
    
    // 录入 WASD
    if (e.key === 'w' || e.key === 'W') input.keys.w = true;
    if (e.key === 'a' || e.key === 'A') input.keys.a = true;
    if (e.key === 's' || e.key === 'S') input.keys.s = true;
    if (e.key === 'd' || e.key === 'D') input.keys.d = true;
});

window.addEventListener('keyup', e => {
    if (e.key === 'w' || e.key === 'W') input.keys.w = false;
    if (e.key === 'a' || e.key === 'A') input.keys.a = false;
    if (e.key === 's' || e.key === 'S') input.keys.s = false;
    if (e.key === 'd' || e.key === 'D') input.keys.d = false;
});

const canvasObj = document.getElementById('gameCanvas');
canvasObj.addEventListener('mousemove', (e) => { 
    const rect = canvasObj.getBoundingClientRect();
    input.mouse.x = e.clientX - rect.left; 
    input.mouse.y = e.clientY - rect.top; 
});
canvasObj.addEventListener('mousedown', () => { 
    if(game.state === STATE.PLAYING) {
        input.mouse.down = true; 
        input.mouse.clicked = true; 
    }
});
window.addEventListener('mouseup', () => { input.mouse.down = false; });

window.addEventListener('resize', () => {
    const canvasObj = document.getElementById('gameCanvas');
    if (canvasObj) {
        // 1. 更新画布物理尺寸
        canvasObj.width = window.innerWidth;
        canvasObj.height = window.innerHeight;
        
        // 2. 同步游戏逻辑尺寸
        game.width = canvasObj.width;
        game.height = canvasObj.height;

        // 🌟 3. 核心修复：如果你有背景层或 UI 缓存，需要重置它们
        // 强制立即画一帧，否则在暂停状态下缩放，右边就是黑的
        if (typeof draw === 'function') {
            draw(); 
        }
    }
});

window.addEventListener('blur', () => {
    if (game.state === STATE.PLAYING) {
        switchUI(STATE.PAUSED);
        if (input && input.mouse) input.mouse.down = false; 
    }
});

fsBtn.addEventListener('click', () => {
    enterFullscreen(document.documentElement);
    
    // 切换 UI 层
    fsPrompt.classList.add('hidden');
    mainMenu.classList.remove('hidden');
});

// 兼容各浏览器的全屏函数
function enterFullscreen(element) {
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
}
function updateGamepadHints(isActive) {
    if (isActive) {
        document.body.classList.add('gamepad-active');
    } else {
        document.body.classList.remove('gamepad-active');
    }
}

// ==========================================
// 🎮 8. 手柄与反馈系统 (全局唯一副本)
// ==========================================

// 核心输入处理：每帧在 update 里调用一次
// 🌟 记录上一次按键的时间，防止菜单操作太快 (全局变量)
let lastInputTick = 0; 

function handleGamepadInput() {
    const gamepads = navigator.getGamepads();
    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) { gp = gamepads[i]; break; }
    }
    updateGamepadHints(!!gp);
    if (!gp) return;

    const now = Date.now();
    const deadzone = 0.15;

    if (!document.getElementById('ui-fullscreen-prompt').classList.contains('hidden')) {
        if (gp.buttons[0]?.pressed && now - lastInputTick > 500) {
            enterFullscreen(document.documentElement);
            document.getElementById('ui-fullscreen-prompt').classList.add('hidden');
            document.getElementById('ui-main-menu').classList.remove('hidden');
            lastInputTick = now;
        }
        return;
    }

    // === 场景 A：主菜单 (STATE.START) 或 死亡页面 (STATE.GAME_OVER) ===
    if (game.state === STATE.START) {
            if (now - lastInputTick > 500) {
                if (gp.buttons[0]?.pressed) { // A: Start Game[cite: 1]
                    resetGame(); switchUI(STATE.PLAYING); lastInputTick = now;
                } else if (gp.buttons[1]?.pressed) { // B: Settings[cite: 1]
                    switchUI(STATE.SETTINGS); lastInputTick = now;
                }
            }
            return;
        }

    if (game.state === STATE.SETTINGS) {
        handleSettingsGamepad(gp, now, deadzone);
        return;
    }

    // === 场景 B：暂停界面 (STATE.PAUSED) - 重点修复区 ===
    if (game.state === STATE.PAUSED) {
        if (now - lastInputTick > 500) {
            // 1. Resume (返回游戏) - 设定为 Start(+) 或 B
            if (gp.buttons[9]?.pressed || gp.buttons[1]?.pressed) {
                console.log("🎮 恢复游戏");
                switchUI(STATE.PLAYING);
                lastInputTick = now;
            }
            // 2. Full Screen (全屏) - 设定为 Y (3)
            else if (gp.buttons[3]?.pressed) {
                toggleFullScreen();
                lastInputTick = now;
            }
            // 3. Settings (设置) - 设定为 X (2)
            else if (gp.buttons[2]?.pressed) {
                switchUI(STATE.SETTINGS);
                lastInputTick = now;
            }
            // 4. Main Menu (回到主菜单) - 设定为 Select(-)
            else if (gp.buttons[8]?.pressed) {
                switchUI(STATE.START);
                lastInputTick = now;
            }
        }
        return; 
    }

    // === 场景 C：商店 (STATE.SHOP) ===
    if (game.state === STATE.SHOP) {
        if (now - lastInputTick > 300) {
            if (gp.buttons[0]?.pressed) { buyUpgrade('dmg'); lastInputTick = now; shakeController(); }
            if (gp.buttons[1]?.pressed) { buyUpgrade('hp'); lastInputTick = now; shakeController(); }
            if (gp.buttons[9]?.pressed || gp.buttons[8]?.pressed) { switchUI(STATE.PLAYING); lastInputTick = now; }
        }
        return;
    }

    // === 场景 D：正常战斗 (STATE.PLAYING) ===
    if (game.state === STATE.PLAYING) {
        // 进入暂停：按 Start(+)
        if (gp.buttons[9]?.pressed && (now - lastInputTick > 500)) {
            switchUI(STATE.PAUSED);
            lastInputTick = now;
            return;
        }

        // 摇杆与射击逻辑 (保持原样)[cite: 1]
        if (gp.axes && gp.axes.length >= 4) {
            const mx = gp.axes[0], my = gp.axes[1];
            if (Math.hypot(mx, my) > deadzone) {
                input.moveVector.x = mx; input.moveVector.y = my;
                input.moveVector.active = true;
            } else if (!input.moveVector.activeByTouch) {
                input.moveVector.active = false;
                input.moveVector.x = 0; input.moveVector.y = 0;
            }
            const fx = gp.axes[2], fy = gp.axes[3];
            if (Math.hypot(fx, fy) > deadzone) {
                input.fireVector.x = fx; input.fireVector.y = fy;
                input.fireVector.active = true;
            } else {
                input.fireVector.active = false;
            }
        }
        const isFiring = (gp.buttons[7]?.pressed) || (gp.buttons[0]?.pressed);
        input.mouse.down = isFiring || (input.mouse.activeByTouch && input.mouse.down);
    }
}

function handleShopGamepad(gp) {
    if (game.state !== STATE.SHOP) return;

    const now = Date.now();
    if (now - lastInputTick < 300) return; // 使用统一的冷却时间

    // A 键买伤害，B 键买血量
    if (gp.buttons[0]?.pressed) {
        buyUpgrade('dmg');
        lastInputTick = now;
        shakeController(); 
    } 
    else if (gp.buttons[1]?.pressed) {
        buyUpgrade('hp');
        lastInputTick = now;
        shakeController();
    }
    
    // Start 键 或 Select 键 退出商店
    if (gp.buttons[9]?.pressed || gp.buttons[8]?.pressed) {
        switchUI(STATE.PLAYING);
        lastInputTick = now;
    }
}
// 物理震动反馈
function shakeController() {
    const gp = navigator.getGamepads()[0];
    if (gp && gp.vibrationActuator) {
        gp.vibrationActuator.playEffect("dual-rumble", {
            startDelay: 0,
            duration: 200, 
            strongMagnitude: 1.0, 
            weakMagnitude: 1.0,   
        });
    }
}

function handleSettingsGamepad(gp, now, deadzone) {
    if (now - lastInputTick < 150) return; // 稍微快一点的连发速度

    // 1. 上下切换焦点 (摇杆或 D-pad)
    const moveY = gp.axes[1];
    if (moveY < -deadzone || gp.buttons[12]?.pressed) { // Up
        settingFocusIndex = 0; // BGM
        lastInputTick = now;
    } else if (moveY > deadzone || gp.buttons[13]?.pressed) { // Down
        settingFocusIndex = 1; // SFX
        lastInputTick = now;
    }

    // 2. 左右调整数值
    const moveX = gp.axes[0];
    let change = 0;
    if (moveX < -deadzone || gp.buttons[14]?.pressed) change = -5; // Left
    else if (moveX > deadzone || gp.buttons[15]?.pressed) change = 5; // Right

    if (change !== 0) {
        if (settingFocusIndex === 0) {
            game.bgmVolume = Math.max(0, Math.min(100, parseInt(game.bgmVolume) + change));
            document.getElementById('slider-bgm').value = game.bgmVolume;
            document.getElementById('bgm-val').innerText = game.bgmVolume;
            updateBGMVolume();
        } else {
            game.sfxVolume = Math.max(0, Math.min(100, parseInt(game.sfxVolume) + change));
            document.getElementById('slider-sfx').value = game.sfxVolume;
            document.getElementById('sfx-val').innerText = game.sfxVolume;
        }
        lastInputTick = now;
    }

    // 3. 一键静音 (Y 键)[cite: 1]
    if (gp.buttons[3]?.pressed) {
        game.bgmVolume = 0; game.sfxVolume = 0;
        updateBGMVolume(); lastInputTick = now;
        shakeController();
    }

    // 4. 返回 (B 键)[cite: 1]
    if (gp.buttons[1]?.pressed) {
        switchUI(game.previousState || STATE.START);
        lastInputTick = now;
    }
}