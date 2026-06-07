// js/main.js
import { render } from './canvasDraw.js';
import { updateDefensePositions, updateZoneDefense23 } from './defenseLogic.js';

const canvas = document.getElementById('courtCanvas');
const ctx = canvas.getContext('2d');
const controlPanel = document.getElementById('controlPanel');
const drawPanel = document.getElementById('drawPanel');
const courtSettings = document.getElementById('courtSettings');
const courtLogoSelect = document.getElementById('courtLogoSelect');

// ==========================================
// 0. 全自動化動態資料庫
// ==========================================
let TEAM_DB = {};
let ALL_STAR_DB = { 1: [], 2: [], 3: [], 4: [], 5: [] };

const teamNameMap = { 'okc': '奧克拉荷馬雷霆', 'lakers': '洛杉磯湖人', 'warriors': '金州勇士', 'boston_celtics': '波士頓塞爾提克','pacers': '印第安納溜馬', 'denver_nuggets': '丹佛金塊','bulls': '芝加哥公牛','spurs': '聖安東尼奧馬刺', 'bucks': '密爾瓦基公鹿', 'orlando_magic': '奧蘭多魔術', 'timberwolves': '明尼蘇達灰狼','miami_heat':'邁阿密熱火','clippers':'洛杉磯快船','rockets':'休斯敦火箭','knicks':'紐約尼克','pelicans':'新奧爾良鵜鶘','mavericks':'達拉斯獨行俠','suns':'鳳凰城太陽','memphis':'孟菲斯灰熊','cavs':'克里夫蘭騎士','csie':'中正資工'};
const positionNames = { 1: "1 號位 (控球後衛)", 2: "2 號位 (得分後衛)", 3: "3 號位 (小前鋒)", 4: "4 號位 (大前鋒)", 5: "5 號位 (中鋒)" };

async function loadJsonDatabase() {
    try {
        const response = await fetch('img/players_db.json');
        const data = await response.json();
        
        const posToRole = { 'pg': 1, 'sg': 2, 'sf': 3, 'pf': 4, 'c': 5 };

        data.TEAM_DB.forEach(player => {
            const teamKey = player.team.toLowerCase();
            const pos = player.position.toLowerCase();
            const playerImgPath = `img/teams/${player.fileName}`;
            const role = posToRole[pos];
            
            // 結構進化：每個位置都是一個陣列，用來裝複數球員
            if (!TEAM_DB[teamKey]) {
                TEAM_DB[teamKey] = {
                    name: teamNameMap[teamKey] || teamKey.toUpperCase(), 
                    logo: `img/logos/${teamKey}_logo.png`,
                    players: { 1:[], 2:[], 3:[], 4:[], 5:[] } 
                };
            }
            
            if (role) {
                TEAM_DB[teamKey].players[role].push({
                    id: player.fileName.split('.')[0],
                    name: player.name,
                    img: playerImgPath
                });
            }
            
            if (player.isStar && role) {
                ALL_STAR_DB[role].push({
                    id: player.fileName.split('.')[0], name: player.name, img: playerImgPath
                });
            }
        });
        
        if (courtLogoSelect) {
            Object.keys(TEAM_DB).forEach(key => {
                let team = TEAM_DB[key];
                let option = document.createElement('option');
                option.value = team.logo; option.textContent = team.name;
                courtLogoSelect.appendChild(option);
            });
        }
        
        initMenuSystem();
    } catch (error) {
        console.error("資料庫載入失敗:", error);
        initMenuSystem();
    }
}

// 畫布與狀態變數
let currentMode = ''; 
let activeCourtLogo = ''; 
let isDrawingMode = false;
let currentDrawColor = '#f1c40f'; 
let drawingLines = []; 
let currentLine = null; 

let offensePlayers = [
    { id: "O1", role: 1, x: 400, y: 200, targetX: 400, targetY: 200, hasBall: true, team: "offense", avatarImgSrc: null },  
    { id: "O2", role: 2, x: 150, y: 350, targetX: 150, targetY: 350, hasBall: false, team: "offense", avatarImgSrc: null }, 
    { id: "O3", role: 3, x: 650, y: 350, targetX: 650, targetY: 350, hasBall: false, team: "offense", avatarImgSrc: null }, 
    { id: "O4", role: 4, x: 300, y: 550, targetX: 300, targetY: 550, hasBall: false, team: "offense", avatarImgSrc: null }, 
    { id: "O5", role: 5, x: 500, y: 550, targetX: 500, targetY: 550, hasBall: false, team: "offense", avatarImgSrc: null }  
];

let defensePlayers = [
    { id: "X1", role: 1, x: 400, y: 350, targetX: 400, targetY: 350, team: "defense", avatarImgSrc: null },
    { id: "X2", role: 2, x: 250, y: 250, targetX: 250, targetY: 250, team: "defense", avatarImgSrc: null },
    { id: "X3", role: 3, x: 550, y: 250, targetX: 550, targetY: 250, team: "defense", avatarImgSrc: null },
    { id: "X4", role: 4, x: 150, y: 120, targetX: 150, targetY: 120, team: "defense", avatarImgSrc: null },
    { id: "X5", role: 5, x: 650, y: 120, targetX: 650, targetY: 120, team: "defense", avatarImgSrc: null }
];
let ball = { x: 400, y: 450, targetId: "O1", isIndependent: false, isPassing: false, passTarget: null }; 

// ==========================================
// 2. 智慧選秀邏輯 (Smart Draft Logic) + 歷史堆疊
// ==========================================
let globalDraftMode = ''; 
let draftSide = 'offense'; 
let draftRole = 1;         
let currentDraftPool = null; 

// 🔴 新增：用來記錄玩家選擇路徑的堆疊 (History Stack)
let decisionHistory = []; 

function initMenuSystem() {
    document.getElementById('modeNormalBtn').onclick = () => startGame('normal');
    
    document.getElementById('modeTeamBtn').onclick = () => {
        globalDraftMode = 'team'; draftSide = 'offense'; draftRole = 1; decisionHistory = [];
        startTeamSelection();
    };
    
    document.getElementById('modeAllStarBtn').onclick = () => {
        globalDraftMode = 'allstar'; draftSide = 'offense'; draftRole = 1; decisionHistory = [];
        currentDraftPool = ALL_STAR_DB;
        processDraft();
    };

    // 🔴 綁定選秀介面的「上一步」按鈕
    const prevDraftBtn = document.getElementById('prevDraftBtn');
    if (prevDraftBtn) {
        prevDraftBtn.onclick = () => {
            if (decisionHistory.length > 0) {
                // 從歷史紀錄中取出上一次的狀態 (Pop)
                let lastState = decisionHistory.pop();
                draftSide = lastState.side;
                draftRole = lastState.role;
                currentDraftPool = lastState.pool;
                processDraft(); // 重新載入該進度
            } else {
                // 已經退到最底了，回歸原點
                if (globalDraftMode === 'team') startTeamSelection();
                else location.reload();
            }
        };
    }
}

// 階段一：選擇球隊
function startTeamSelection() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    const modal = document.getElementById('teamSelectModal');
    const title = document.getElementById('teamSelectTitle');
    const grid = document.getElementById('teamGrid');
    const prevTeamBtn = document.getElementById('prevTeamBtn'); 
    
    modal.style.display = 'flex';
    title.textContent = draftSide === 'offense' ? '請選擇【進攻】球隊' : '請選擇【防守】球隊';
    title.style.color = draftSide === 'offense' ? '#3498db' : '#e74c3c';

    // 🔴 如果是在選防守球隊，允許退回到進攻選秀的最後一步
    if (draftSide === 'defense') {
        prevTeamBtn.style.display = 'block';
        prevTeamBtn.onclick = () => {
            if (decisionHistory.length > 0) {
                let lastState = decisionHistory.pop();
                draftSide = lastState.side; draftRole = lastState.role; currentDraftPool = lastState.pool;
                processDraft();
            } else {
                draftSide = 'offense'; startTeamSelection();
            }
        };
    } else {
        prevTeamBtn.style.display = 'none';
    }

    grid.innerHTML = '';
    Object.keys(TEAM_DB).forEach(key => {
        let team = TEAM_DB[key];
        let card = document.createElement('div');
        card.className = 'select-card';
        card.innerHTML = `<img src="${team.logo}" alt="${team.name}" onerror="this.style.opacity='0'"><h3>${team.name}</h3>`;
        
        card.onclick = () => {
            if (draftSide === 'offense') activeCourtLogo = team.logo; 
            currentDraftPool = team.players; 
            modal.style.display = 'none';
            processDraft(); 
        };
        grid.appendChild(card);
    });
}

// 階段二：解析陣容與選秀分流
function processDraft() {
    if (draftRole > 5) {
        if (draftSide === 'offense') {
            draftSide = 'defense';
            draftRole = 1;
            if (globalDraftMode === 'team') startTeamSelection();
            else processDraft(); 
        } else {
            document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
            startGame(globalDraftMode);
        }
        return;
    }

    let available = currentDraftPool[draftRole] || [];

    if (available.length === 0) {
        assignPlayer(null);
        draftRole++;
        processDraft();
    } else if (available.length === 1 && globalDraftMode === 'team') {
        assignPlayer(available[0].img);
        draftRole++;
        processDraft();
    } else {
        showDraftUI(available);
    }
}

// 階段三：渲染選秀 UI
function showDraftUI(availablePlayers) {
    const modal = document.getElementById('draftModal');
    const title = document.getElementById('draftTitle');
    const subtitle = document.getElementById('draftSubtitle');
    const grid = document.getElementById('draftGrid');
    
    modal.style.display = 'flex';
    let modeText = globalDraftMode === 'team' ? '球隊陣容選擇' : '全明星選秀';
    let sideText = draftSide === 'offense' ? '進攻' : '防守';
    
    title.textContent = `${modeText} - 【${sideText}】`;
    title.style.color = draftSide === 'offense' ? '#3498db' : '#e74c3c';
    subtitle.textContent = `請選擇 ${positionNames[draftRole]}`;

    grid.innerHTML = '';
    availablePlayers.forEach(player => {
        let card = document.createElement('div');
        card.className = 'select-card';
        card.innerHTML = `<img src="${player.img}" alt="${player.name}" onerror="this.style.opacity='0'"><h3>${player.name}</h3>`;
        
        card.onclick = () => {
            // 🔴 關鍵邏輯：在點擊做決定前，把「當前狀態」推入歷史堆疊中
            decisionHistory.push({
                side: draftSide,
                role: draftRole,
                pool: currentDraftPool
            });

            assignPlayer(player.img);
            modal.style.display = 'none';
            draftRole++;
            processDraft(); 
        };
        grid.appendChild(card);
    });
}

function assignPlayer(imgSrc) {
    if (draftSide === 'offense') offensePlayers[draftRole - 1].avatarImgSrc = imgSrc;
    else defensePlayers[draftRole - 1].avatarImgSrc = imgSrc;
}

// ==========================================
// 3. 遊戲啟動與 UI 面板初始化
// ==========================================
function startGame(mode) {
    currentMode = mode;
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    
    canvas.style.display = 'block'; 
    // 【修復 Bug】：將 display 改回 block，確保 absolute 的戰術面板不會高度坍塌隱形！
    if(controlPanel) controlPanel.style.display = 'block'; 
    if(drawPanel) drawPanel.style.display = 'flex'; 

    if (mode === 'normal') {
        if(courtSettings) courtSettings.style.display = 'none';
        activeCourtLogo = '';
    } else {
        if(courtSettings) courtSettings.style.display = 'block';
        if (activeCourtLogo && courtLogoSelect) courtLogoSelect.value = activeCourtLogo;
        
        if (courtLogoSelect) {
            courtLogoSelect.addEventListener('change', (e) => {
                activeCourtLogo = e.target.value;
            });
        }
    }
    gameLoop();
}

// 畫筆系統按鈕綁定
const toggleDrawBtn = document.getElementById('toggleDrawBtn');
if (toggleDrawBtn) {
    toggleDrawBtn.addEventListener('click', () => {
        isDrawingMode = !isDrawingMode;
        if (isDrawingMode) {
            toggleDrawBtn.textContent = '🖍️ 畫筆模式: 開';
            toggleDrawBtn.classList.add('active');
            canvas.style.cursor = 'crosshair'; 
        } else {
            toggleDrawBtn.textContent = '🖍️ 畫筆模式: 關';
            toggleDrawBtn.classList.remove('active');
            canvas.style.cursor = 'default';
        }
    });
}

document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentDrawColor = e.target.getAttribute('data-color');
    });
});
document.getElementById('clearDrawBtn').addEventListener('click', () => { drawingLines = []; });

// ==========================================
// 4. 戰術狀態與控制面板 (完全保留)
// ==========================================
let isDefensePaused = false;
let currentStrategy = 'zone23'; 
let currentOffenseStrategy = ''; 

let playTimers = [];
let tacticVariations = { spanish: 0, horns: 0, triangle: 0, fourCorner: 0 }; 
const variationTexts = {
    'spanish': ['變化一：防守者被擋住，傳給順下的中鋒', '變化二：防守收縮禁區，大前鋒外拆空檔'],
    'horns': ['變化一：側翼過度協防，控衛分球給底角', '變化二：內線防守者被帶走，大前鋒外拆'],
    'triangle': ['變化一：防守者看球不看人，側翼空切吃餅', '變化二：防守者過度趨前，控衛溜底線'],
    'fourCorner': ['變化一：防守者被擋拆卡住，外線射手接球', '變化二：防守者提早上搶，內線假擋真切偷襲']
};

function clearPlayTimers() {
    playTimers.forEach(timer => clearTimeout(timer));
    playTimers = [];
    defensePlayers.forEach(def => def.isTricked = false);
    drawingLines = []; 
}

function autoPassBall(targetIndex) {
    let targetPlayer = offensePlayers[targetIndex];
    if (targetPlayer) {
        offensePlayers.forEach(off => off.hasBall = false);
        ball.isPassing = true;
        ball.passTarget = targetPlayer;
    }
}

function trickDefender(defIndex, targetX, targetY, duration) {
    let def = defensePlayers[defIndex];
    if (def) {
        def.isTricked = true; def.trickX = targetX; def.trickY = targetY;
        playTimers.push(setTimeout(() => { def.isTricked = false; }, duration));
    }
}

const variationDisplay = document.createElement('div');
variationDisplay.style.color = '#3498db';
variationDisplay.style.fontSize = '18px';
variationDisplay.style.fontWeight = 'bold';
variationDisplay.style.textAlign = 'center';
variationDisplay.style.margin = '10px 0';
variationDisplay.textContent = '💡 點擊進攻戰術按鈕開始展示，連點可切換變化';

let offBtns = {};

if (controlPanel) {
    controlPanel.insertAdjacentElement('beforebegin', variationDisplay); 
    controlPanel.innerHTML = '';
    controlPanel.style.position = 'relative';
    controlPanel.style.width = '700px';
    controlPanel.style.height = '45px';
    controlPanel.style.overflow = 'hidden'; 

    const defPanel = document.createElement('div');
    defPanel.style.position = 'absolute';
    defPanel.style.width = '100%';
    defPanel.style.height = '100%';
    defPanel.style.display = 'flex';
    defPanel.style.justifyContent = 'center';
    defPanel.style.alignItems = 'center';
    defPanel.style.gap = '10px';
    defPanel.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    defPanel.style.transform = 'translateX(0%)';

    defPanel.innerHTML = `
        <button id="manToManBtn" class="tactics-btn">盯人防守</button>
        <button id="zone23Btn" class="tactics-btn active">2-3 區域聯防</button>
        <button id="toOffenseBtn" class="tactics-btn" style="border: none; padding: 5px 15px; font-size: 18px;" title="切換進攻戰術">▶</button>
    `;

    const offPanel = document.createElement('div');
    offPanel.style.position = 'absolute';
    offPanel.style.width = '100%';
    offPanel.style.height = '100%';
    offPanel.style.display = 'flex';
    offPanel.style.justifyContent = 'center';
    offPanel.style.alignItems = 'center';
    offPanel.style.gap = '10px';
    offPanel.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    offPanel.style.transform = 'translateX(-100%)';

    offPanel.innerHTML = `
        <button id="toDefenseBtn" class="tactics-btn" style="border: none; padding: 5px 15px; font-size: 18px;" title="切換防守戰術">◀</button>
        <button id="hornsBtn" class="tactics-btn">牛角</button>
        <button id="spanishBtn" class="tactics-btn">西班牙擋拆</button>
        <button id="triangleBtn" class="tactics-btn">三角</button>
        <button id="fourCornerBtn" class="tactics-btn">四角進攻</button>
    `;

    controlPanel.appendChild(offPanel);
    controlPanel.appendChild(defPanel);

    document.getElementById('toOffenseBtn').addEventListener('click', () => {
        defPanel.style.transform = 'translateX(100%)'; offPanel.style.transform = 'translateX(0%)';  
    });
    document.getElementById('toDefenseBtn').addEventListener('click', () => {
        offPanel.style.transform = 'translateX(-100%)'; defPanel.style.transform = 'translateX(0%)';    
    });

    const manToManBtn = document.getElementById('manToManBtn');
    const zone23Btn = document.getElementById('zone23Btn');
    manToManBtn.addEventListener('click', () => {
        currentStrategy = 'manToMan';
        manToManBtn.classList.add('active'); zone23Btn.classList.remove('active');
    });
    zone23Btn.addEventListener('click', () => {
        currentStrategy = 'zone23';
        zone23Btn.classList.add('active'); manToManBtn.classList.remove('active');
    });

    offBtns['horns'] = document.getElementById('hornsBtn');
    offBtns['spanish'] = document.getElementById('spanishBtn');
    offBtns['triangle'] = document.getElementById('triangleBtn');
    offBtns['fourCorner'] = document.getElementById('fourCornerBtn');
}

const setOffenseFormation = (strategy) => {
    clearPlayTimers();
    if (currentOffenseStrategy !== strategy) {
        currentOffenseStrategy = strategy; tacticVariations[strategy] = 0; 
    } else {
        tacticVariations[strategy] = (tacticVariations[strategy] + 1) % variationTexts[strategy].length;
    }
    let vIndex = tacticVariations[strategy];
    variationDisplay.textContent = `🏀 當前展示：${variationTexts[strategy][vIndex]}`;
    
    if (offBtns[strategy]) {
        Object.values(offBtns).forEach(btn => { if(btn) btn.classList.remove('active'); });
        offBtns[strategy].classList.add('active');
    }

    offensePlayers.forEach(p => p.hasBall = false);
    offensePlayers[0].hasBall = true;
    ball.isPassing = false; ball.passTarget = null;
    
    if (strategy === 'spanish') { 
        offensePlayers[0].targetX = 400; offensePlayers[0].targetY = 220; 
        offensePlayers[1].targetX = 150; offensePlayers[1].targetY = 380; 
        offensePlayers[2].targetX = 650; offensePlayers[2].targetY = 380; 
        offensePlayers[3].targetX = 400; offensePlayers[3].targetY = 480; 
        offensePlayers[4].targetX = 400; offensePlayers[4].targetY = 320; 

        playTimers.push(setTimeout(() => {
            offensePlayers[0].targetX = 520; offensePlayers[0].targetY = 320; 
            offensePlayers[3].targetX = 400; offensePlayers[3].targetY = 380; 
            trickDefender(0, 420, 320, 2500); 
        }, 3000));

        playTimers.push(setTimeout(() => {
            offensePlayers[4].targetX = 400; offensePlayers[4].targetY = 480; 
            offensePlayers[3].targetX = 400; offensePlayers[3].targetY = 220; 
        }, 5500));

        if (vIndex === 0) { 
            playTimers.push(setTimeout(() => trickDefender(4, 400, 380, 2500), 4500));
            playTimers.push(setTimeout(() => autoPassBall(4), 8000));
        } else { 
            playTimers.push(setTimeout(() => { trickDefender(3, 400, 450, 3000); trickDefender(4, 400, 480, 3000); }, 5500));
            playTimers.push(setTimeout(() => autoPassBall(3), 8000));
        }
    } else if (strategy === 'horns') { 
        offensePlayers[0].targetX = 400; offensePlayers[0].targetY = 200; 
        offensePlayers[1].targetX = 100; offensePlayers[1].targetY = 450; 
        offensePlayers[2].targetX = 700; offensePlayers[2].targetY = 450; 
        offensePlayers[3].targetX = 320; offensePlayers[3].targetY = 300; 
        offensePlayers[4].targetX = 480; offensePlayers[4].targetY = 300; 

        playTimers.push(setTimeout(() => {
            offensePlayers[4].targetX = 420; offensePlayers[4].targetY = 220; 
            offensePlayers[0].targetX = 550; offensePlayers[0].targetY = 300; 
            trickDefender(0, 420, 240, 2500); 
        }, 3000));

        playTimers.push(setTimeout(() => {
            offensePlayers[4].targetX = 450; offensePlayers[4].targetY = 480; 
            offensePlayers[3].targetX = 250; offensePlayers[3].targetY = 200; 
        }, 5500));

        if (vIndex === 0) { 
            playTimers.push(setTimeout(() => {
                offensePlayers[0].targetX = 600; offensePlayers[0].targetY = 400; 
                trickDefender(2, 550, 400, 2500); 
            }, 7000));
            playTimers.push(setTimeout(() => autoPassBall(2), 8500));
        } else { 
            playTimers.push(setTimeout(() => { trickDefender(3, 350, 350, 2500); }, 6000));
            playTimers.push(setTimeout(() => autoPassBall(3), 7500));
        }
    } else if (strategy === 'triangle') { 
        offensePlayers[0].targetX = 400; offensePlayers[0].targetY = 200; 
        offensePlayers[1].targetX = 150; offensePlayers[1].targetY = 350; 
        offensePlayers[2].targetX = 650; offensePlayers[2].targetY = 350; 
        offensePlayers[3].targetX = 300; offensePlayers[3].targetY = 500; 
        offensePlayers[4].targetX = 500; offensePlayers[4].targetY = 500; 

        playTimers.push(setTimeout(() => {
            autoPassBall(2); 
            offensePlayers[0].targetX = 700; offensePlayers[0].targetY = 450; 
            offensePlayers[1].targetX = 400; offensePlayers[1].targetY = 200; 
        }, 2000));

        playTimers.push(setTimeout(() => { autoPassBall(4); }, 4500));

        if (vIndex === 0) { 
            playTimers.push(setTimeout(() => { 
                offensePlayers[2].targetX = 400; offensePlayers[2].targetY = 450; trickDefender(2, 500, 480, 2500); 
            }, 6000));
            playTimers.push(setTimeout(() => autoPassBall(2), 7500)); 
        } else { 
            playTimers.push(setTimeout(() => { 
                offensePlayers[0].targetX = 450; offensePlayers[0].targetY = 550; trickDefender(0, 600, 450, 2500); 
            }, 6000));
            playTimers.push(setTimeout(() => autoPassBall(0), 7500));
        }
    } else if (strategy === 'fourCorner') { 
        offensePlayers[0].targetX = 400; offensePlayers[0].targetY = 580; 
        offensePlayers[1].targetX = 300; offensePlayers[1].targetY = 350; 
        offensePlayers[2].targetX = 500; offensePlayers[2].targetY = 350; 
        offensePlayers[3].targetX = 300; offensePlayers[3].targetY = 480; 
        offensePlayers[4].targetX = 500; offensePlayers[4].targetY = 480; 

        trickDefender(1, 300, 380, 5000); trickDefender(2, 500, 380, 5000); 
        trickDefender(3, 300, 510, 5000); trickDefender(4, 500, 510, 5000); 

        playTimers.push(setTimeout(() => {
            offensePlayers[3].targetX = 300; offensePlayers[3].targetY = 380; 
            offensePlayers[4].targetX = 500; offensePlayers[4].targetY = 380; 
        }, 2500));

        if (vIndex === 0) { 
            playTimers.push(setTimeout(() => {
                offensePlayers[1].targetX = 100; offensePlayers[1].targetY = 500; 
                offensePlayers[2].targetX = 700; offensePlayers[2].targetY = 500; 
                offensePlayers[3].targetX = 400; offensePlayers[3].targetY = 350; 
                offensePlayers[4].targetX = 450; offensePlayers[4].targetY = 480; 
                trickDefender(1, 300, 350, 2500); 
            }, 5000));
            playTimers.push(setTimeout(() => autoPassBall(1), 8000));
        } else { 
            playTimers.push(setTimeout(() => {
                offensePlayers[1].targetX = 100; offensePlayers[1].targetY = 500; 
                offensePlayers[2].targetX = 700; offensePlayers[2].targetY = 500; 
                offensePlayers[4].targetX = 450; offensePlayers[4].targetY = 520; 
                trickDefender(4, 500, 360, 2500); 
            }, 5000));
            playTimers.push(setTimeout(() => autoPassBall(4), 7000)); 
        }
    }
};

if (controlPanel) {
    Object.keys(offBtns).forEach(strategy => {
        if (offBtns[strategy]) offBtns[strategy].addEventListener('click', () => setOffenseFormation(strategy));
    });
}

const pauseIndicator = document.createElement('div');
pauseIndicator.textContent = '⏸ 防守移動暫停中 (按空白鍵繼續)';
pauseIndicator.style.cssText = 'color:#f1c40f; font-size:16px; font-weight:bold; margin-bottom:10px; display:none; text-align:center;';
const blinkStyle = document.createElement('style');
blinkStyle.innerHTML = `@keyframes blinkEffect { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } } .blinking { animation: blinkEffect 1.5s infinite; }`;
document.head.appendChild(blinkStyle);
if (controlPanel) controlPanel.insertAdjacentElement('afterend', pauseIndicator);

window.addEventListener('keydown', (evt) => {
    if (evt.code === 'Space') {
        evt.preventDefault(); 
        isDefensePaused = !isDefensePaused;
        pauseIndicator.style.display = isDefensePaused ? 'block' : 'none';
    }
});

let isDragging = false;
let dragTarget = null;

function applyCollisions(allPlayers, dragTarget) {
    const PLAYER_RADIUS = 30;
    const MIN_DIST = PLAYER_RADIUS * 2; 
    
    // 🔴 這裡就是控制彈開幅度的關鍵！數值在 0.1 到 0.3 之間最合適
    // 0.1 代表每影格只緩衝推開 10% 的重疊距離，動作會非常平滑柔軟
    const ELASTICITY = 0.25; 

    for (let i = 0; i < allPlayers.length; i++) {
        for (let j = i + 1; j < allPlayers.length; j++) {
            let p1 = allPlayers[i], p2 = allPlayers[j];
            let dx = p1.x - p2.x, dy = p1.y - p2.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < MIN_DIST && dist > 0) { 
                let overlap = MIN_DIST - dist, nx = dx / dist, ny = dy / dist; 
                let p1Movable = (p1 !== dragTarget), p2Movable = (p2 !== dragTarget);

                // 🔴 計算乘上緩衝係數後的實際推開量
                let pushAmount = overlap * ELASTICITY;

                if (p1Movable && p2Movable) {
                    // 兩人都可移動，各分攤一半的緩衝推開量
                    p1.x += nx * (pushAmount / 2); p1.y += ny * (pushAmount / 2);
                    p2.x -= nx * (pushAmount / 2); p2.y -= ny * (pushAmount / 2);
                } else if (p1Movable && !p2Movable) {
                    // 只有 p1 能動（例如 p2 是被拖曳的對象）
                    p1.x += nx * pushAmount; p1.y += ny * pushAmount;
                } else if (!p1Movable && p2Movable) {
                    // 只有 p2 能動
                    p2.x -= nx * pushAmount; p2.y -= ny * pushAmount;
                }
            }
        }
    }
}

function gameLoop() {
    const isDraggingBall = (isDragging && dragTarget === ball);
    let allPlayers = [...offensePlayers, ...defensePlayers];
    applyCollisions(allPlayers, dragTarget);
    
    offensePlayers.forEach(off => {
        if (off !== dragTarget) { off.x += (off.targetX - off.x) * 0.012; off.y += (off.targetY - off.y) * 0.012; }
    });

    if (!isDefensePaused && !isDraggingBall) {
        if (currentStrategy === 'manToMan') updateDefensePositions(offensePlayers, defensePlayers, ball);
        else if (currentStrategy === 'zone23') updateZoneDefense23(defensePlayers, ball);

        defensePlayers.forEach(def => {
            if (def.isTricked) { def.targetX = def.trickX; def.targetY = def.trickY; }
            def.x += (def.targetX - def.x) * 0.020; def.y += (def.targetY - def.y) * 0.020;
        });
    }

    if (ball.isPassing && ball.passTarget) {
        let targetX = ball.passTarget.x + 12, targetY = ball.passTarget.y + 12;
        let dx = targetX - ball.x, dy = targetY - ball.y, dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) { ball.x = targetX; ball.y = targetY; ball.isPassing = false; ball.passTarget.hasBall = true; ball.passTarget = null; }
        else { ball.x += dx * 0.05; ball.y += dy * 0.05; }
    } else {
        let ballCarrier = offensePlayers.find(p => p.hasBall);
        if (ballCarrier) { ball.x = ballCarrier.x + 12; ball.y = ballCarrier.y + 12; ball.isIndependent = false; }
        else { ball.isIndependent = true; }
    }

    render(ctx, canvas, { players: [...offensePlayers, ...defensePlayers], ball: ball, courtLogo: activeCourtLogo, lines: drawingLines });
    requestAnimationFrame(gameLoop);
}

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect(); return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

canvas.addEventListener('mousedown', function(evt) {
    const mousePos = getMousePos(canvas, evt);
    if (isDrawingMode) { currentLine = { color: currentDrawColor, points: [mousePos] }; drawingLines.push(currentLine); return; }
    let dxBall = mousePos.x - ball.x, dyBall = mousePos.y - ball.y;
    if (Math.sqrt(dxBall * dxBall + dyBall * dyBall) <= 12) {
        isDragging = true; dragTarget = ball; offensePlayers.forEach(off => off.hasBall = false);
        ball.targetId = null; ball.isPassing = false; ball.passTarget = null; return; 
    }
    for (let p of offensePlayers) {
        let dx = mousePos.x - p.x, dy = mousePos.y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) <= 16) { isDragging = true; dragTarget = p; break; }
    }
});

canvas.addEventListener('dblclick', function(evt) {
    if (isDrawingMode) return;
    const mousePos = getMousePos(canvas, evt);
    for (let p of offensePlayers) {
        let dx = mousePos.x - p.x, dy = mousePos.y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) <= 16) {
            if (!p.hasBall) { offensePlayers.forEach(off => off.hasBall = false); ball.isPassing = true; ball.passTarget = p; }
            break;
        }
    }
});

canvas.addEventListener('mousemove', function(evt) {
    const mousePos = getMousePos(canvas, evt);
    if (isDrawingMode && currentLine) { currentLine.points.push(mousePos); return; }
    if (isDragging && dragTarget) {
        dragTarget.x = mousePos.x; dragTarget.y = mousePos.y;
        if (dragTarget.targetX !== undefined) { dragTarget.targetX = mousePos.x; dragTarget.targetY = mousePos.y; }
    }
});

canvas.addEventListener('mouseup', () => { if (isDrawingMode) { currentLine = null; return; } isDragging = false; dragTarget = null; });
canvas.addEventListener('mouseleave', () => { if (isDrawingMode) { currentLine = null; return; } isDragging = false; dragTarget = null; });

loadJsonDatabase();