// defenseLogic.js

const BASKET_X = 400; 
const BASKET_Y = 550; 
const PAINT_CENTER_X = 400;
const PAINT_CENTER_Y = 480;

/**
 * 戰術一：進階盯人防守 (Man-to-Man)
 * 包含：一線壓迫、外線阻絕、三線沉退、低位繞前、高位防守(Play behind)
 */
export function updateDefensePositions(offensePlayers, defensePlayers, ball) {
    const BASKET_X = 400; 
    const BASKET_Y = 550; 

    for (let i = 0; i < defensePlayers.length; i++) {
        let def = defensePlayers[i];
        let off = offensePlayers[i]; 

        // 1. 計算進攻者到籃框的向量與距離
        let dxToBasket = BASKET_X - off.x;
        let dyToBasket = BASKET_Y - off.y;
        let distToBasket = Math.sqrt(dxToBasket * dxToBasket + dyToBasket * dyToBasket);

        if (off.hasBall || ball.targetId === off.id) {
            // 【一線防守】：持球貼身壓迫 (站在人與籃框之間)
            def.defensiveLine = 1;
            let pressureDist = 40;
            def.targetX = off.x + (dxToBasket / distToBasket) * pressureDist;
            def.targetY = off.y + (dyToBasket / distToBasket) * pressureDist;
        } else {
            // 2. 計算進攻者到球的向量與距離
            let dxToBall = ball.x - off.x;
            let dyToBall = ball.y - off.y;
            let distToBall = Math.sqrt(dxToBall * dxToBall + dyToBall * dyToBall);

            // ★ 重新定義禁區熱區
            // 低位：離籃框很近 (小於 180 像素)
            let isLowPostAttacker = distToBasket <= 180; 
            // 高位/上中：在禁區寬度內 (X: 250~550)，且離籃框有一段距離 (罰球線附近)
            let isHighPostAttacker = distToBasket > 180 && distToBasket < 320 && off.x >= 250 && off.x <= 550;

            if (isLowPostAttacker) {
                // 【低位防守 (Low Post)】：半繞前卡位，面向球
                def.defensiveLine = 2;
                def.targetX = off.x + (dxToBall / distToBall) * 25; 
                def.targetY = off.y + (dyToBall / distToBall) * 25; 

            } else if (isHighPostAttacker) {
                // 【高位防守 (High Post)】：不准跑上去阻絕！要站在「進攻者與籃框之間」
                def.defensiveLine = 2;
                let defenseDist = 25; // 卡在進攻者背後 25 像素的位置
                def.targetX = off.x + (dxToBasket / distToBasket) * defenseDist;
                def.targetY = off.y + (dyToBasket / distToBasket) * defenseDist;

            } else if (distToBall < 200) {
                // 【外線二線阻絕 (Deny)】：一般外線球員，踩在傳球路線上
                def.defensiveLine = 2;
                def.targetX = off.x + dxToBall * 0.35;
                def.targetY = off.y + dyToBall * 0.35 + 10; 

            } else {
                // 【三線協防 (Help Side)】：弱邊外線沉退
                def.defensiveLine = 3;
                let sagDist = (distToBall / 100) * 35;
                let baseTargetX = off.x + (dxToBasket / distToBasket) * sagDist;
                let baseTargetY = off.y + (dyToBasket / distToBasket) * sagDist;

                // 轉頭看球：保持 Ball-You-Man 視野
                def.targetX = baseTargetX * 0.75 + ball.x * 0.25;
                def.targetY = baseTargetY * 0.75 + ball.y * 0.25;
            }
        }

        // 邊界防呆限制
        def.targetX = Math.max(20, Math.min(780, def.targetX));
        def.targetY = Math.max(20, Math.min(580, def.targetY));
    }
}

/**
 * 戰術二：2-3 區域聯防 (系隊精確版：修復後衛不當沉退問題)
 */
export function updateZoneDefense23(defensePlayers, ball) {
    let x1 = defensePlayers.find(p => p.id === "X1"); 
    let x2 = defensePlayers.find(p => p.id === "X2"); 
    let x3 = defensePlayers.find(p => p.id === "X3"); 
    let x4 = defensePlayers.find(p => p.id === "X4"); 
    let x5 = defensePlayers.find(p => p.id === "X5"); 

    if (!x1 || !x2 || !x3 || !x4 || !x5) return;

    const PAINT_CENTER_X = 400;
    const PAINT_CENTER_Y = 480;

    // 【戰略熱區重新嚴格劃分】
    // 1. 上中 (High Post)：罰球線附近
    let isHighPost = ball.x > 300 && ball.x < 500 && ball.y >= 250 && ball.y <= 400;
    // 2. 內線/低位 (Low Post/Paint)：X 座標在禁區寬度內，且深度夠深
    let isLowPost = ball.x >= 250 && ball.x <= 550 && ball.y > 400; 
    // 3. 真正的外線 45度與零度角 (X 座標在禁區外)
    let isLeftWingOrCorner = ball.x < 250 && ball.y > 200;
    let isRightWingOrCorner = ball.x > 550 && ball.y > 200;

    // 輔助工具：計算防守者到球的直線距離
    const getDistanceToBall = (player) => {
        return Math.sqrt(Math.pow(player.x - ball.x, 2) + Math.pow(player.y - ball.y, 2));
    };

    if (isHighPost) {
        // 【狀況 A：球在上中】五號位出來對，三四號位極度內縮
        x5.targetX = ball.x; x5.targetY = ball.y + 35; x5.defensiveLine = 1;
        x3.targetX = PAINT_CENTER_X - 40; x3.targetY = PAINT_CENTER_Y + 20; x3.defensiveLine = 3;
        x4.targetX = PAINT_CENTER_X + 40; x4.targetY = PAINT_CENTER_Y + 20; x4.defensiveLine = 3;
        x1.targetX = 350; x1.targetY = 250; x1.defensiveLine = 2;
        x2.targetX = 450; x2.targetY = 250; x2.defensiveLine = 2;

    } else if (isLowPost) {
        // 【狀況 B：球塞到內線！】(你的修正要求)
        // 指揮官戰術：內線自己處理，後衛(X1, X2)留在上面防守傳球路線，絕對不能沉下來！
        let isLeftPost = ball.x < 400;

        // 五號位直接扛持球者
        x5.targetX = ball.x; x5.targetY = ball.y - 35; x5.defensiveLine = 1;

        // 弱邊前鋒退回籃下護框，強邊前鋒準備幫忙關門
        x3.targetX = isLeftPost ? ball.x - 40 : PAINT_CENTER_X - 40; 
        x3.targetY = isLeftPost ? ball.y : 520;
        x3.defensiveLine = isLeftPost ? 2 : 3;

        x4.targetX = !isLeftPost ? ball.x + 40 : PAINT_CENTER_X + 40; 
        x4.targetY = !isLeftPost ? ball.y : 520;
        x4.defensiveLine = !isLeftPost ? 2 : 3;

        // ★ 重點修正：後衛留在罰球線兩側，阻絕回傳球 (Kick-out)！
        x1.targetX = 320; x1.targetY = 280; x1.defensiveLine = 2;
        x2.targetX = 480; x2.targetY = 280; x2.defensiveLine = 2;

    } else if (isLeftWingOrCorner) {
        // 【狀況 C：球在左側外線 (45度或零度)】
        x1.targetX = ball.x + 30; x1.targetY = ball.y - 20; // 1號位全速往下衝
        let distanceX1 = getDistanceToBall(x1);

        if (distanceX1 > 90) {
            // 第一拍：後衛還沒趕到，三號位(X3)撲出去對球！
            x3.targetX = ball.x + 30; x3.targetY = ball.y + 20; x3.defensiveLine = 1;
        } else {
            // 第二拍：後衛(X1)到了，三號位(X3)退回禁區護框！
            x1.defensiveLine = 1;
            x3.targetX = PAINT_CENTER_X - 60; x3.targetY = 480; x3.defensiveLine = 3;
        }

        x5.targetX = PAINT_CENTER_X; x5.targetY = 480; x5.defensiveLine = 2;
        x4.targetX = PAINT_CENTER_X + 60; x4.targetY = PAINT_CENTER_Y; x4.defensiveLine = 3;
        x2.targetX = 400; x2.targetY = 280; x2.defensiveLine = 2;

    } else if (isRightWingOrCorner) {
        // 【狀況 D：球在右側外線 (45度或零度)】
        x2.targetX = ball.x - 30; x2.targetY = ball.y - 20; 
        let distanceX2 = getDistanceToBall(x2);

        if (distanceX2 > 90) {
            // 第一拍：後衛還沒趕到，四號位(X4)撲出去對球！
            x4.targetX = ball.x - 30; x4.targetY = ball.y + 20; x4.defensiveLine = 1;
        } else {
            // 第二拍：後衛(X2)到了，四號位(X4)退回禁區護框！
            x2.defensiveLine = 1;
            x4.targetX = PAINT_CENTER_X + 60; x4.targetY = 480; x4.defensiveLine = 3;
        }

        x5.targetX = PAINT_CENTER_X; x5.targetY = 480; x5.defensiveLine = 2;
        x3.targetX = PAINT_CENTER_X - 60; x3.targetY = PAINT_CENTER_Y; x3.defensiveLine = 3;
        x1.targetX = 400; x1.targetY = 280; x1.defensiveLine = 2;

    } else {
        // 【狀況 E：球在弧頂 (修復：雙衛齊平與合理壓迫)】
        
        let isBallLeft = ball.x < 400;

        // 1. 如果球在「非常正中」的區域 (例如 X: 360 ~ 440)
        // 戰術：兩個後衛平行站位，守住罰球線兩側 (牛角區)，準備關門
        if (ball.x >= 360 && ball.x <= 440) {
            x1.targetX = 340; 
            x1.targetY = 270; 
            x1.defensiveLine = 2;

            x2.targetX = 460; 
            x2.targetY = 270; 
            x2.defensiveLine = 2;
        } 
        // 2. 如果球明顯偏左 (但還沒到 45 度角)
        else if (isBallLeft) {
            // X1 上去稍微壓迫，但不要撲太遠
            x1.targetX = ball.x + 25; 
            x1.targetY = Math.max(260, ball.y + 35); 
            x1.defensiveLine = 1;

            // X2 平行移動過來，守住正中央的高位 (罰球線)
            x2.targetX = 400; 
            x2.targetY = 270; 
            x2.defensiveLine = 2;
        } 
        // 3. 如果球明顯偏右 (但還沒到 45 度角)
        else {
            // X2 上去稍微壓迫
            x2.targetX = ball.x - 25; 
            x2.targetY = Math.max(260, ball.y + 35); 
            x2.defensiveLine = 1;

            // X1 平行移動過來，守住正中央的高位 (罰球線)
            x1.targetX = 400; 
            x1.targetY = 270; 
            x1.defensiveLine = 2;
        }

        // 底線三人保持禁區縮縮
        x3.targetX = 280; x3.targetY = 480; x3.defensiveLine = 3;
        x5.targetX = PAINT_CENTER_X; x5.targetY = 480; x5.defensiveLine = 3;
        x4.targetX = 520; x4.targetY = 480; x4.defensiveLine = 3;
    }

    // 邊界限制
    defensePlayers.forEach(def => {
        def.targetX = Math.max(20, Math.min(780, def.targetX));
        def.targetY = Math.max(20, Math.min(580, def.targetY));
    });
}