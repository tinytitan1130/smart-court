// 這是我們 Vibe Coding 的「合約」，叫 AI 寫扣時都要參考這個結構
const APP_CONFIG = {
    canvasWidth: 800,
    canvasHeight: 600,
    fps: 60
};

// 球員的標準資料格式
const playerSchema = {
    id: "O1",          // O1~O5(進攻), X1~X5(防守)
    role: 1,           // 1~5號位
    x: 0, y: 0,        // 當前座標
    targetX: 0, targetY: 0, // 目標座標 (移動目的地)
    hasBall: false,    // 是否持球
    team: "offense",   // "offense" 或 "defense"
    defensiveLine: 0   // 防守線別：1(一線), 2(二線), 3(三線)
};

// 測試用的初始球員陣列 (先留空，等等叫 AI 產生)
let players = [];
let ball = { x: 400, y: 300, isPassed: false, targetId: null };
