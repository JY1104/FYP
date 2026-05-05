import { ctx, game } from '../core/context.js';
import { CONFIG } from '../core/constants.js';
import { ASSETS } from '../core/assets.js';

// MapSystem.js
export const MapSystem = {
    // 🌟 不再需要 tiles 数组
    init() {
        // init 可以留空，或者用来预加载资源
    },

    draw() {
        // 🌟 核心修复：根据当前的 game.width/height 实时计算循环次数
        const cols = Math.ceil(game.width / CONFIG.TILE_SIZE);
        const rows = Math.ceil(game.height / CONFIG.TILE_SIZE);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const posX = x * CONFIG.TILE_SIZE;
                const posY = y * CONFIG.TILE_SIZE;

                // 画地砖
                ctx.drawImage(ASSETS.floor, posX, posY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);

                // 阴影缝隙
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(posX, posY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
            }
        }
        
        // --- 保持你原本的暗角逻辑 ---
        const gradient = ctx.createRadialGradient(
            game.width/2, game.height/2, game.width/3, 
            game.width/2, game.height/2, game.width
        );
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, game.width, game.height);
    }
};