// js/canvasDraw.js

let courtLogoImg = new Image();
let currentLogoSrc = '';

function drawCourt(ctx, width, height, courtLogo) {
    ctx.clearRect(0, 0, width, height);

    if (courtLogo) {
        if (currentLogoSrc !== courtLogo) {
            courtLogoImg.src = courtLogo; 
            currentLogoSrc = courtLogo;
        }
        if (courtLogoImg.complete && courtLogoImg.src) {
            let logoWidth = 600;
            let logoHeight = 600;
            ctx.save();
            ctx.globalAlpha = 1.0; 
            ctx.drawImage(courtLogoImg, (width / 2) - (logoWidth / 2), (height / 2) - (logoHeight / 2) + 20, logoWidth, logoHeight);
            ctx.restore();
        }
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;

    const padding = 20; 
    const baseY = height - padding; 
    const centerX = width / 2;

    ctx.strokeRect(padding, padding, width - padding * 2, baseY - padding);

    const scale = 12; 
    const hoopY = baseY - (5.25 * scale); 
    const paintWidth = 16 * scale;        
    const paintHeight = 19 * scale;       
    const ftRadius = 6 * scale;           
    const threePtW = 22 * scale;          
    const threePtR = 23.75 * scale;       

    const paintX = centerX - paintWidth / 2;
    const paintY = baseY - paintHeight; 
    
    ctx.fillStyle = 'rgba(183, 169, 127, 0.4)';
    ctx.fillRect(paintX, paintY, paintWidth, paintHeight);
    ctx.strokeRect(paintX, paintY, paintWidth, paintHeight);

    const marksY = [baseY - 84, baseY - 120, baseY - 168, baseY - 204]; 
    marksY.forEach((y, index) => {
        const markLength = index === 0 ? 12 : 8; 
        ctx.beginPath(); ctx.moveTo(paintX, y); ctx.lineTo(paintX - markLength, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(paintX + paintWidth, y); ctx.lineTo(paintX + paintWidth + markLength, y); ctx.stroke();
    });

    ctx.beginPath(); ctx.arc(centerX, paintY, ftRadius, Math.PI, Math.PI * 2); ctx.stroke();
    
    ctx.save();
    ctx.beginPath(); ctx.setLineDash([10, 10]); ctx.arc(centerX, paintY, ftRadius, 0, Math.PI); ctx.stroke();
    ctx.restore(); 

    const intersectYOffset = Math.sqrt(threePtR * threePtR - threePtW * threePtW); 
    const intersectY = hoopY - intersectYOffset;
    
    const startAngle = Math.atan2(-intersectYOffset, -threePtW);
    const endAngle = Math.atan2(-intersectYOffset, threePtW);
    
    ctx.beginPath();
    ctx.moveTo(centerX - threePtW, baseY); ctx.lineTo(centerX - threePtW, intersectY);
    ctx.arc(centerX, hoopY, threePtR, startAngle, endAngle);
    ctx.lineTo(centerX + threePtW, intersectY); ctx.lineTo(centerX + threePtW, baseY);
    ctx.stroke();

    ctx.beginPath(); ctx.moveTo(centerX, baseY - 20); ctx.lineTo(centerX, hoopY); ctx.stroke();

    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(centerX - 30, baseY - 20, 60, 4); 

    ctx.strokeStyle = '#E74C3C'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(centerX, hoopY, 10, 0, Math.PI * 2); ctx.stroke();
}

function drawEntities(ctx, players, ball) {
    players.forEach(p => {
        ctx.save(); 
        if (p.hasBall) { ctx.shadowBlur = 15; ctx.shadowColor = '#f1c40f'; }

        ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);

        if (p.avatarImgSrc) {
            if (!p.imgObj) { p.imgObj = new Image(); p.imgObj.src = p.avatarImgSrc; }
            if (p.imgObj.complete && p.imgObj.src) {
                ctx.save(); ctx.clip(); 
                ctx.drawImage(p.imgObj, p.x - 30, p.y - 30, 60, 60);
                ctx.restore(); 
            } else {
                ctx.fillStyle = p.team === 'offense' ? '#3498db' : '#e74c3c'; ctx.fill();
            }
            ctx.lineWidth = 4;
            ctx.strokeStyle = p.hasBall ? '#f1c40f' : (p.team === 'offense' ? '#2980b9' : '#c0392b');
            ctx.stroke();
        } else {
            ctx.fillStyle = p.team === 'offense' ? '#3498db' : '#e74c3c'; ctx.fill();
            ctx.strokeStyle = p.hasBall ? '#f1c40f' : '#1a252f';
            ctx.lineWidth = p.hasBall ? 3 : 2; ctx.stroke();
            ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(p.id, p.x, p.y);
        }
        ctx.restore(); 
    });

    if (ball) {
        ctx.beginPath(); ctx.arc(ball.x, ball.y, 16, 0, Math.PI * 2); 
        ctx.fillStyle = '#d35400'; ctx.fill();
        ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1; ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(ball.x - 16, ball.y); ctx.lineTo(ball.x + 16, ball.y);
        ctx.moveTo(ball.x, ball.y - 16); ctx.lineTo(ball.x, ball.y + 16); ctx.stroke();
    }
}

// ==========================================
// 【新增】畫筆圖層渲染
// ==========================================
function drawTacticsLines(ctx, lines) {
    ctx.save();
    ctx.lineCap = 'round'; // 讓線條轉折處圓滑
    ctx.lineJoin = 'round';

    lines.forEach(line => {
        if (line.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 4; // 畫筆粗細
        
        ctx.moveTo(line.points[0].x, line.points[0].y);
        for (let i = 1; i < line.points.length; i++) {
            ctx.lineTo(line.points[i].x, line.points[i].y);
        }
        ctx.stroke();
    });
    ctx.restore();
}

export function render(ctx, canvas, gameState) {
    const courtLogo = gameState ? gameState.courtLogo : null;
    drawCourt(ctx, canvas.width, canvas.height, courtLogo);
    
    if (gameState && gameState.players) {
        drawEntities(ctx, gameState.players, gameState.ball);
    }

    // 將畫筆畫在最上層
    if (gameState && gameState.lines) {
        drawTacticsLines(ctx, gameState.lines);
    }
}