// 純前端版本 - 直接連接Supabase
// 可部署到任何靜態託管平台（GitHub Pages, Netlify等）

// 全域水流和風動系統
let environmentSystem = {
    windStrength: 0.5,        // 風力強度
    windDirection: Math.PI / 4, // 風向（角度）
    windChangeTime: 0,        // 風向變化計時器
    waterCurrentX: 0.02,      // 水流 X 方向
    waterCurrentY: 0.01,      // 水流 Y 方向
    turbulenceStrength: 0.3,  // 湍流強度
    time: 0
};

// 更新環境參數
function updateEnvironment() {
    environmentSystem.time += 1;
    
    // 每 5-10 秒隨機改變風向和強度
    if (environmentSystem.time % (300 + Math.random() * 300) === 0) {
        environmentSystem.windDirection += (Math.random() - 0.5) * Math.PI / 2;
        environmentSystem.windStrength = 0.3 + Math.random() * 0.7;
    }
    
    // 水流方向緩慢變化
    environmentSystem.waterCurrentX = Math.sin(environmentSystem.time * 0.001) * 0.03;
    environmentSystem.waterCurrentY = Math.cos(environmentSystem.time * 0.0008) * 0.02;
    
    // 湍流效果
    environmentSystem.turbulenceStrength = 0.2 + Math.sin(environmentSystem.time * 0.002) * 0.2;
}

// 時間光照系統
let timeSystem2D = {
    currentHour: 0,
    isNight: false,
    lastUpdateTime: 0,
    skyColors: { top: '#1a1a3e', middle: '#2c3e60', bottom: '#34495e' },
    mountainColor: '#1a252f',
    waterColor: 'rgba(52, 152, 219, 0.4)'
};

// 2D 時間計算函數
function calculateTimeBasedColors() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    timeSystem2D.currentHour = hour + minute / 60;
    
    // 定義時間段
    const dawn = 5, sunrise = 6, noon = 12, sunset = 18, dusk = 19, night = 21;
    
    let skyColors, mountainColor, waterColor, isNight;
    
    if (timeSystem2D.currentHour >= dawn && timeSystem2D.currentHour < sunrise) {
        // 黎明 5:00-6:00
        const progress = (timeSystem2D.currentHour - dawn) / (sunrise - dawn);
        skyColors = {
            top: `rgb(${Math.floor(30 + progress * 40)}, ${Math.floor(30 + progress * 50)}, ${Math.floor(80 + progress * 60)})`,
            middle: `rgb(${Math.floor(50 + progress * 60)}, ${Math.floor(70 + progress * 80)}, ${Math.floor(120 + progress * 80)})`,
            bottom: `rgb(${Math.floor(70 + progress * 80)}, ${Math.floor(90 + progress * 100)}, ${Math.floor(140 + progress * 80)})`
        };
        mountainColor = `rgb(${Math.floor(40 + progress * 30)}, ${Math.floor(50 + progress * 40)}, ${Math.floor(70 + progress * 50)})`;
        waterColor = `rgba(52, 152, 219, ${0.3 + progress * 0.2})`;
        isNight = false;
    } else if (timeSystem2D.currentHour >= sunrise && timeSystem2D.currentHour < noon) {
        // 上午 6:00-12:00
        const progress = (timeSystem2D.currentHour - sunrise) / (noon - sunrise);
        skyColors = {
            top: `rgb(${Math.floor(70 + progress * 80)}, ${Math.floor(80 + progress * 100)}, ${Math.floor(140 + progress * 100)})`,
            middle: `rgb(${Math.floor(130 + progress * 100)}, ${Math.floor(150 + progress * 80)}, ${Math.floor(200 + progress * 50)})`,
            bottom: `rgb(${Math.floor(150 + progress * 80)}, ${Math.floor(190 + progress * 50)}, ${Math.floor(220 + progress * 30)})`
        };
        mountainColor = `rgb(${Math.floor(70 + progress * 50)}, ${Math.floor(90 + progress * 60)}, ${Math.floor(120 + progress * 70)})`;
        waterColor = `rgba(52, 152, 219, ${0.5 + progress * 0.2})`;
        isNight = false;
    } else if (timeSystem2D.currentHour >= noon && timeSystem2D.currentHour < sunset) {
        // 下午 12:00-18:00
        const progress = (timeSystem2D.currentHour - noon) / (sunset - noon);
        skyColors = {
            top: `rgb(${Math.floor(150 - progress * 50)}, ${Math.floor(180 - progress * 60)}, ${Math.floor(240 - progress * 80)})`,
            middle: `rgb(${Math.floor(230 - progress * 60)}, ${Math.floor(230 - progress * 80)}, ${Math.floor(250 - progress * 100)})`,
            bottom: `rgb(${Math.floor(230 - progress * 50)}, ${Math.floor(240 - progress * 60)}, ${Math.floor(250 - progress * 80)})`
        };
        mountainColor = `rgb(${Math.floor(120 - progress * 30)}, ${Math.floor(150 - progress * 40)}, ${Math.floor(190 - progress * 50)})`;
        waterColor = `rgba(52, 152, 219, ${0.7 - progress * 0.2})`;
        isNight = false;
    } else if (timeSystem2D.currentHour >= sunset && timeSystem2D.currentHour < dusk) {
        // 日落 18:00-19:00
        const progress = (timeSystem2D.currentHour - sunset) / (dusk - sunset);
        skyColors = {
            top: `rgb(${Math.floor(100 + progress * 120)}, ${Math.floor(60 + progress * 80)}, ${Math.floor(160 - progress * 60)})`,
            middle: `rgb(${Math.floor(170 + progress * 70)}, ${Math.floor(100 + progress * 50)}, ${Math.floor(150 - progress * 80)})`,
            bottom: `rgb(${Math.floor(180 + progress * 60)}, ${Math.floor(120 - progress * 40)}, ${Math.floor(70 - progress * 30)})`
        };
        mountainColor = `rgb(${Math.floor(90 - progress * 40)}, ${Math.floor(110 - progress * 50)}, ${Math.floor(140 - progress * 60)})`;
        waterColor = `rgba(219, 152, 52, ${0.5 + progress * 0.2})`; // 金色反射
        isNight = false;
    } else if (timeSystem2D.currentHour >= dusk && timeSystem2D.currentHour < night) {
        // 黃昏 19:00-21:00
        const progress = (timeSystem2D.currentHour - dusk) / (night - dusk);
        skyColors = {
            top: `rgb(${Math.floor(80 - progress * 50)}, ${Math.floor(60 - progress * 30)}, ${Math.floor(120 - progress * 40)})`,
            middle: `rgb(${Math.floor(120 - progress * 70)}, ${Math.floor(80 - progress * 40)}, ${Math.floor(160 - progress * 70)})`,
            bottom: `rgb(${Math.floor(140 - progress * 80)}, ${Math.floor(100 - progress * 50)}, ${Math.floor(180 - progress * 90)})`
        };
        mountainColor = `rgb(${Math.floor(50 - progress * 20)}, ${Math.floor(60 - progress * 25)}, ${Math.floor(80 - progress * 30)})`;
        waterColor = `rgba(52, 152, 219, ${0.7 - progress * 0.3})`;
        isNight = true;
    } else {
        // 夜晚 21:00-5:00
        skyColors = { top: '#0a0a1a', middle: '#1a1a3e', bottom: '#2c3e60' };
        mountainColor = '#0a0f14';
        waterColor = 'rgba(52, 152, 219, 0.3)';
        isNight = true;
    }
    
    timeSystem2D.skyColors = skyColors;
    timeSystem2D.mountainColor = mountainColor;
    timeSystem2D.waterColor = waterColor;
    timeSystem2D.isNight = isNight;
    
    return {
        skyColors,
        mountainColor,
        waterColor,
        isNight,
        timeString: `${String(Math.floor(timeSystem2D.currentHour)).padStart(2, '0')}:${String(Math.floor(minute)).padStart(2, '0')}`
    };
}

// Supabase 配置 - 在這裡直接填入您的配置
const SUPABASE_URL = 'https://bvdgbnlzfyygosqtknaw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZGdibmx6Znl5Z29zcXRrbmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzM3OTQsImV4cCI6MjA3MDA0OTc5NH0.OYPJoXN9LNQuIfyWyDXs0V2BvdbS7Rkw-mXcVskrv4g';

// 動態加載Supabase客戶端
let supabase = null;

async function initSupabase() {
    try {
        console.log('🔄 開始加載 Supabase CDN...');
        // 從CDN加載Supabase
        const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js@2');
        
        console.log('✅ Supabase CDN 加載成功');
        console.log('🔧 創建 Supabase 客戶端...', {
            url: SUPABASE_URL,
            keyLength: SUPABASE_ANON_KEY?.length || 0
        });
        
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase客戶端初始化成功');
        return true;
    } catch (error) {
        console.error('❌ Supabase 初始化失敗:', error);
        console.warn('⚠️ 將使用本地存儲模式');
        return false;
    }
}

class WaterLantern {
    constructor(id, x, y, message, savedData = null) {
        this.id = id;
        this.message = message;
        
        if (savedData) {
            this.baseX = savedData.baseX || savedData.basex;
            this.baseY = savedData.baseY || savedData.basey;
            this.angle = savedData.angle || 0;
            this.floatSpeed = savedData.floatSpeed || savedData.floatspeed || 0.03;
            this.bobAmount = savedData.bobAmount || savedData.bobamount || 3;
            this.driftSpeed = savedData.driftSpeed || savedData.driftspeed || 0.15;
            this.driftAngle = savedData.driftAngle || savedData.driftangle || 0;
            this.time = savedData.time || 0;
            this.rotationSpeed = savedData.rotationSpeed || savedData.rotationspeed || 0;
            this.depth = savedData.depth || 0.5;
        } else {
            this.baseX = x;
            this.baseY = y;
            this.angle = Math.random() * Math.PI * 2;
            this.floatSpeed = 0.02 + Math.random() * 0.03;
            this.bobAmount = 2 + Math.random() * 3;
            this.driftSpeed = 0.1 + Math.random() * 0.2;
            this.driftAngle = Math.random() * Math.PI * 2;
            this.time = Math.random() * 1000;
            this.rotationSpeed = (Math.random() - 0.5) * 0.01;
            this.depth = Math.random();
        }
        
        this.x = this.baseX;
        this.y = this.baseY;
    }

    update() {
        this.time += 1;
        this.angle += this.floatSpeed;
        this.driftAngle += this.rotationSpeed;
        
        // 原有的浮動動畫
        const baseFloatX = Math.sin(this.angle) * this.bobAmount + Math.sin(this.driftAngle) * 1;
        const baseFloatY = Math.cos(this.angle * 1.3) * (this.bobAmount * 0.5) + Math.cos(this.driftAngle * 0.8) * 0.5;
        
        // 添加水流和風動效果
        const windForceX = Math.cos(environmentSystem.windDirection) * environmentSystem.windStrength * 0.5;
        const windForceY = Math.sin(environmentSystem.windDirection) * environmentSystem.windStrength * 0.3;
        
        // 湍流效果（每個水燈有不同的隨機相位）
        const turbulenceX = Math.sin(environmentSystem.time * 0.01 + this.id) * environmentSystem.turbulenceStrength;
        const turbulenceY = Math.cos(environmentSystem.time * 0.008 + this.id * 1.5) * environmentSystem.turbulenceStrength;
        
        // 組合所有效果
        this.x = this.baseX + baseFloatX + windForceX + turbulenceX;
        this.y = this.baseY + baseFloatY + windForceY + turbulenceY;
        
        // 基礎位置緩慢漂移（受水流影響）
        this.baseX += Math.sin(this.driftAngle) * this.driftSpeed * 0.1 + environmentSystem.waterCurrentX;
        this.baseY += Math.cos(this.driftAngle) * this.driftSpeed * 0.05 + environmentSystem.waterCurrentY;
        
        // 邊界約束和中心吸引力系統
        const worldCenterX = 400;  // 湖面中心 X 坐標
        const worldCenterY = 600;  // 湖面中心 Y 坐標
        const maxDistance = 200;   // 最大漂移距離
        const centerAttraction = 0.0005; // 中心吸引力強度
        
        // 計算距離中心的偏移
        const offsetX = this.baseX - worldCenterX;
        const offsetY = this.baseY - worldCenterY;
        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        
        // 如果距離過遠，增強中心吸引力
        if (distance > maxDistance) {
            const pullStrength = (distance - maxDistance) * 0.001;
            this.baseX -= offsetX * pullStrength;
            this.baseY -= offsetY * pullStrength;
        }
        
        // 輕微的中心吸引力（保持一半水燈在中心區域）
        const attractionChance = this.id % 2 === 0 ? 1.5 : 0.5; // 一半水燈有更強吸引力
        this.baseX -= offsetX * centerAttraction * attractionChance;
        this.baseY -= offsetY * centerAttraction * attractionChance;
    }

    draw(ctx) {
        // 近大遠小效果：depth越大，水燈越大越亮
        const baseScale = 0.6 + this.depth * 0.6; // 增大基礎大小
        const alpha = 0.7 + this.depth * 0.3;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        this.drawPixelLantern(ctx, baseScale);
        
        // 水燈編號
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.depth > 0.5 ? '#000' : '#444';
        ctx.font = `${Math.max(6, 8 * baseScale)}px monospace`;
        ctx.textAlign = 'center';
        const numberY = this.y + (20 * baseScale);
        ctx.fillText(`(${String(this.id).padStart(4, '0')})`, this.x, numberY);
        
        ctx.restore();
    }
    
    drawPixelLantern(ctx, scale) {
        // 簡化的像素風格水燈，確保可見性
        const pixelScale = scale * 16; // 放大像素尺寸
        
        // 水燈底座（木質船體）
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(this.x - pixelScale/2, this.y + pixelScale/4, pixelScale, pixelScale/3);
        
        // 蠟燭主體
        ctx.fillStyle = '#FFF8DC';
        ctx.fillRect(this.x - pixelScale/6, this.y - pixelScale/4, pixelScale/3, pixelScale/2);
        
        // 火焰 - 簡化動態效果
        const flameFlicker = 1 + Math.sin(this.time * 0.1) * 0.1;
        const flameHeight = (pixelScale/2) * flameFlicker;
        
        // 外層火焰
        ctx.fillStyle = '#FF6B35';
        ctx.fillRect(this.x - pixelScale/8, this.y - pixelScale/2 - flameHeight, pixelScale/4, flameHeight);
        
        // 內層火焰
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(this.x - pixelScale/12, this.y - pixelScale/2 - flameHeight*0.8, pixelScale/6, flameHeight*0.8);
        
        // 火焰光暈
        ctx.globalAlpha *= 0.4;
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.arc(this.x, this.y - pixelScale/2, pixelScale/3, 0, Math.PI * 2);
        ctx.fill();
        
        // 水面倒影
        ctx.globalAlpha *= 0.5;
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(this.x - pixelScale/8, this.y + pixelScale/2, pixelScale/4, pixelScale/4);
    }

    isNear(mouseX, mouseY, distance = 30) {
        const adjustedDistance = distance * (0.5 + this.depth * 1.5);
        return Math.sqrt((this.x - mouseX) ** 2 + (this.y - mouseY) ** 2) < adjustedDistance;
    }
    
    toSaveData() {
        return {
            id: this.id,
            baseX: this.baseX,
            baseY: this.baseY,
            message: this.message,
            angle: this.angle,
            floatSpeed: this.floatSpeed,
            bobAmount: this.bobAmount,
            driftSpeed: this.driftSpeed,
            driftAngle: this.driftAngle,
            time: this.time,
            rotationSpeed: this.rotationSpeed,
            depth: this.depth,
            timestamp: new Date().toISOString()
        };
    }
}

class WaterLanternApp {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tooltip = document.getElementById('tooltip');
        this.addForm = document.getElementById('addLanternForm');
        this.messageInput = document.getElementById('messageInput');
        this.addButton = document.getElementById('addButton');
        
        this.lanterns = [];
        this.nextId = 1;
        this.isAddingMode = false;
        this.lakeArea = null;
        this.supabaseEnabled = false;
        
        // 響應式全景系統
        this.viewport = {
            x: 0, // 當前視窗偏移
            y: 0,
            width: 0,
            height: 0,
            worldWidth: 0, // 完整場景寬度
            worldHeight: 0, // 完整場景高度
            scale: 1
        };
        
        this.isPortrait = false;
        this.isDragging = false;
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        
        // 音效系統
        this.audioContext = null;
        this.sounds = {
            water: null,
            addLantern: null
        };
        this.audioEnabled = false;
        
        this.init();
    }

    async init() {
        this.setupCanvas();
        this.checkConfiguration();
        this.initAudio();
        this.initTimeSystem();
        this.supabaseEnabled = await initSupabase();
        await this.loadLanterns();
        this.setupEventListeners();
        this.gameLoop();
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.createWaterSounds();
            this.audioEnabled = true;
        } catch (error) {
            console.log('音頻不支持或被禁用');
            this.audioEnabled = false;
        }
    }
    
    // 初始化時間系統
    initTimeSystem() {
        calculateTimeBasedColors(); // 初始化時間顏色
        this.updateTimeDisplay();
        console.log('⏰ 時間系統初始化完成');
    }
    
    // UI 更新和 FPS 計算
    updateUI() {
        // FPS 計算
        const now = performance.now();
        if (!this.lastFpsTime) this.lastFpsTime = now;
        if (!this.fpsFrames) this.fpsFrames = 0;
        
        this.fpsFrames++;
        if (now - this.lastFpsTime >= 1000) {
            const fps = Math.round((this.fpsFrames * 1000) / (now - this.lastFpsTime));
            const fpsElement = document.getElementById('fps');
            if (fpsElement) fpsElement.textContent = fps;
            
            this.lastFpsTime = now;
            this.fpsFrames = 0;
        }
        
        // 更新數量
        const countElement = document.getElementById('count');
        if (countElement) countElement.textContent = this.lanterns.length;
        
        // 更新視角模式
        const viewModeElement = document.getElementById('viewMode');
        if (viewModeElement) {
            viewModeElement.textContent = this.isPortrait ? '橫向拖拽' : '全景';
        }
        
        // 更新畫布尺寸
        const canvasSizeElement = document.getElementById('canvasSize');
        if (canvasSizeElement) {
            canvasSizeElement.textContent = `${this.viewport.width}x${this.viewport.height}`;
        }
        
        // 更新 Debug 信息
        this.updateDebugInfo();
    }

    // Debug 信息更新
    updateDebugInfo() {
        const debugMessages = [
            `環境風力: ${environmentSystem.windStrength.toFixed(2)} | 風向: ${(environmentSystem.windDirection * 180 / Math.PI).toFixed(0)}°`,
            `水流: X=${environmentSystem.waterCurrentX.toFixed(3)} Y=${environmentSystem.waterCurrentY.toFixed(3)}`,
            `湍流強度: ${environmentSystem.turbulenceStrength.toFixed(2)} | 時間: ${environmentSystem.time}`,
            `視窗: ${this.viewport.width}x${this.viewport.height} | 世界: ${this.viewport.worldWidth}x${this.viewport.worldHeight}`,
            `視角偏移: (${this.viewport.x.toFixed(0)}, ${this.viewport.y.toFixed(0)}) | 縮放: ${this.viewport.scale.toFixed(2)}`,
            `活動水燈: ${this.lanterns.filter(l => l.x >= this.lakeArea.x && l.x <= this.lakeArea.x + this.lakeArea.width).length}/${this.lanterns.length}`,
            `時間系統: ${timeSystem2D.isNight ? '夜晚' : '白天'} ${timeSystem2D.currentHour.toFixed(1)}h`,
            `性能: 幀數=${document.getElementById('fps')?.textContent || '--'} | 記憶體使用正常`
        ];
        
        const currentIndex = Math.floor(Date.now() / 3000) % debugMessages.length;
        const debugText = document.getElementById('debugText');
        if (debugText) {
            debugText.textContent = debugMessages[currentIndex];
        }
    }
    
    // 更新時間顯示
    updateTimeDisplay() {
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            const colors = calculateTimeBasedColors();
            timeElement.textContent = colors.timeString;
            
            // 根據是否夜晚調整顯示樣式
            const timeDisplay = document.getElementById('timeDisplay');
            if (timeDisplay) {
                timeDisplay.style.background = timeSystem2D.isNight 
                    ? 'rgba(10, 10, 30, 0.8)' 
                    : 'rgba(0, 0, 0, 0.7)';
                timeDisplay.style.color = timeSystem2D.isNight 
                    ? '#aabbee' 
                    : 'white';
            }
        }
    }
    
    createWaterSounds() {
        // 創建水聲背景音效
        this.sounds.water = this.createWaterSound();
        this.sounds.addLantern = this.createLanternSound();
    }
    
    createWaterSound() {
        if (!this.audioContext) return null;
        
        const bufferSize = this.audioContext.sampleRate * 2; // 2秒循環
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const channelData = buffer.getChannelData(0);
        
        // 生成水聲：低頻率白噪音 + 波浪效果
        for (let i = 0; i < bufferSize; i++) {
            const time = i / this.audioContext.sampleRate;
            const wave1 = Math.sin(time * Math.PI * 0.5) * 0.1;
            const wave2 = Math.sin(time * Math.PI * 0.3) * 0.05;
            const noise = (Math.random() - 0.5) * 0.02;
            channelData[i] = wave1 + wave2 + noise;
        }
        
        return buffer;
    }
    
    createLanternSound() {
        if (!this.audioContext) return null;
        
        const bufferSize = this.audioContext.sampleRate * 0.5; // 0.5秒
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const channelData = buffer.getChannelData(0);
        
        // 生成水滴聲：短促的鐘聲效果
        for (let i = 0; i < bufferSize; i++) {
            const time = i / this.audioContext.sampleRate;
            const decay = Math.exp(-time * 8);
            const tone = Math.sin(time * Math.PI * 880) * decay * 0.1; // 880Hz音調
            const splash = Math.sin(time * Math.PI * 220) * decay * 0.05; // 低頻濺水聲
            channelData[i] = tone + splash;
        }
        
        return buffer;
    }
    
    playWaterSound() {
        if (!this.audioEnabled || !this.sounds.water) return;
        
        try {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = this.sounds.water;
            source.loop = true;
            gainNode.gain.value = 0.1; // 很低的背景音量
            
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            source.start();
            
            // 淡出效果
            setTimeout(() => {
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1);
                setTimeout(() => source.stop(), 1000);
            }, 3000);
        } catch (error) {
            console.log('播放水聲失敗');
        }
    }
    
    playLanternSound() {
        if (!this.audioEnabled || !this.sounds.addLantern) return;
        
        try {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = this.sounds.addLantern;
            gainNode.gain.value = 0.2;
            
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            source.start();
        } catch (error) {
            console.log('播放水燈音效失敗');
        }
    }

    setupCanvas() {
        this.updateViewport();
        this.setupDragControls();
        
        window.addEventListener('resize', () => {
            this.updateViewport();
        });
        
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.updateViewport(), 100);
        });
    }
    
    updateViewport() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 判斷是否為竪屏
        this.isPortrait = windowHeight > windowWidth;
        
        // 設置畫布尺寸
        this.canvas.width = windowWidth;
        this.canvas.height = windowHeight;
        
        // 設置視窗參數
        this.viewport.width = windowWidth;
        this.viewport.height = windowHeight;
        
        if (this.isPortrait) {
            // 竪屏：世界比畫布更寬，主要水平拖拽
            this.viewport.worldWidth = windowHeight * 1.8; // 增加拖拽範圍
            this.viewport.worldHeight = windowHeight * 1.2; // 增加少量垂直拖拽
            this.viewport.scale = windowHeight / 800; // 基準高度 800
        } else {
            // 橫屏：創建更大的世界空間，支持全方向拖拽
            this.viewport.worldWidth = windowWidth * 1.5; // 更大的世界寬度
            this.viewport.worldHeight = windowHeight * 1.5; // 更大的世界高度
            this.viewport.scale = Math.min(windowWidth / 1920, windowHeight / 1200); // 調整基準
            // 不重置偏移，保持用戶的拖拽位置
        }
        
        // 更新湖面區域（基於世界坐標）- 延伸到富士山底部
        this.lakeArea = {
            x: this.viewport.worldWidth * 0.05, // 稍微擴大左右邊界
            y: this.viewport.worldHeight * 0.35, // 從山脚線開始
            width: this.viewport.worldWidth * 0.9, // 更寬的湖面
            height: this.viewport.worldHeight * 0.65 // 延伸到底部
        };
        
        // 更新光標樣式
        this.updateCanvasCursor();
    }
    
    setupDragControls() {
        // 鼠標拖拽（桌面）
        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.isAddingMode) {
                this.isDragging = true;
                this.lastTouchX = e.clientX;
                this.lastTouchY = e.clientY;
                this.updateCanvasCursor();
            }
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = e.clientX - this.lastTouchX;
                const deltaY = e.clientY - this.lastTouchY;
                this.updateViewportOffset(deltaX, deltaY);
                this.lastTouchX = e.clientX;
                this.lastTouchY = e.clientY;
            } else if (!this.isAddingMode) {
                this.handleMouseMove(e.clientX, e.clientY);
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.updateCanvasCursor();
            }
        });
        
        // 觸摸拖拽（移動設備）
        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.isAddingMode && e.touches.length === 1) {
                this.isDragging = true;
                this.lastTouchX = e.touches[0].clientX;
                this.lastTouchY = e.touches[0].clientY;
                e.preventDefault();
            }
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (this.isDragging && e.touches.length === 1) {
                const deltaX = e.touches[0].clientX - this.lastTouchX;
                const deltaY = e.touches[0].clientY - this.lastTouchY;
                this.updateViewportOffset(deltaX, deltaY);
                this.lastTouchX = e.touches[0].clientX;
                this.lastTouchY = e.touches[0].clientY;
                e.preventDefault();
            } else if (!this.isDragging && !this.isAddingMode && e.touches.length === 1) {
                const touch = e.touches[0];
                this.handleMouseMove(touch.clientX, touch.clientY);
            }
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                e.preventDefault();
                return;
            }
            
            if (this.isAddingMode && e.changedTouches.length === 1) {
                const touch = e.changedTouches[0];
                this.handleAddLantern(touch.clientX, touch.clientY);
                e.preventDefault();
            }
        });

        // 鼠標滾輪支持
        this.canvas.addEventListener('wheel', (e) => {
            if (!this.isAddingMode) {
                e.preventDefault();
                
                // 滾輪垂直移動畫布
                const scrollSpeed = 30;
                const deltaY = e.deltaY > 0 ? scrollSpeed : -scrollSpeed;
                this.updateViewportOffset(0, deltaY);
            }
        });
    }
    
    updateViewportOffset(deltaX, deltaY = 0) {
        // 根據屏幕方向調整拖拽行為
        if (this.isPortrait) {
            // 竖屏：主要水平拖拽，少量垂直拖拽
            this.viewport.x -= deltaX;
            this.viewport.y -= deltaY * 0.5; // 垂直拖拽減半
        } else {
            // 横屏：全方向拖拽
            this.viewport.x -= deltaX;
            this.viewport.y -= deltaY;
        }
        
        // 限制水平拖拽範圍
        const maxOffsetX = Math.max(0, this.viewport.worldWidth - this.viewport.width);
        this.viewport.x = Math.max(0, Math.min(maxOffsetX, this.viewport.x));
        
        // 限制垂直拖拽範圍
        const maxOffsetY = Math.max(0, this.viewport.worldHeight - this.viewport.height);
        this.viewport.y = Math.max(0, Math.min(maxOffsetY, this.viewport.y));
    }
    
    // 坐標轉換：屏幕坐標 -> 世界坐標
    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.viewport.x,
            y: screenY + this.viewport.y
        };
    }
    
    // 坐標轉換：世界坐標 -> 屏幕坐標  
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.viewport.x,
            y: worldY - this.viewport.y
        };
    }

    setupEventListeners() {
        // 首次點擊時啟動音頻上下文（瀏覽器要求）
        const enableAudio = () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
                this.playWaterSound();
                document.removeEventListener('click', enableAudio);
                document.removeEventListener('touchstart', enableAudio);
            }
        };
        document.addEventListener('click', enableAudio, { once: true });
        document.addEventListener('touchstart', enableAudio, { once: true });
        
        this.addButton.addEventListener('click', () => {
            this.addForm.style.display = 'block';
            this.messageInput.focus(); // 自動聚焦到輸入框
        });
        
        // 添加取消和確認按鈕的事件監聽器
        document.getElementById('cancelButton').addEventListener('click', () => {
            this.cancelAdd();
        });
        
        document.getElementById('confirmButton').addEventListener('click', () => {
            this.confirmAdd();
        });

        this.canvas.addEventListener('click', (e) => {
            console.log('🖱️ Canvas 點擊事件:', {
                clientX: e.clientX, 
                clientY: e.clientY, 
                isAddingMode: this.isAddingMode,
                isDragging: this.isDragging
            });
            
            // 只有在不是拖拽狀態下才處理點擊
            if (this.isAddingMode && !this.isDragging) {
                this.handleAddLantern(e.clientX, e.clientY);
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hideTooltip();
            this.isDragging = false; // 重置拖拽狀態
            this.updateCanvasCursor();
        });
    }

    checkConfiguration() {
        const notice = document.getElementById('configNotice');
        
        // 檢查配置是否正確
        if (SUPABASE_URL === 'https://your-project-id.supabase.co' || 
            SUPABASE_ANON_KEY === 'your-anon-public-key-here' ||
            !SUPABASE_URL.includes('supabase.co') ||
            SUPABASE_ANON_KEY.length < 50) {
            // 配置不正確，顯示提示
            notice.style.display = 'block';
            console.warn('請配置Supabase URL和API Key');
        } else {
            // 配置正確，隱藏提示
            notice.style.display = 'none';
            console.log('Supabase配置已正確設置');
        }
    }

    drawBackground() {
        // 清除畫布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 更新時間光照（每30秒）
        const now = Date.now();
        if (now - timeSystem2D.lastUpdateTime > 30000) { // 30秒
            calculateTimeBasedColors();
            timeSystem2D.lastUpdateTime = now;
        }
        
        // 保存畫布狀態並應用視窗變換
        this.ctx.save();
        this.ctx.translate(-this.viewport.x, -this.viewport.y);
        
        // 動態漸變天空背景
        const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.viewport.worldHeight * 0.4);
        skyGradient.addColorStop(0, timeSystem2D.skyColors.top);
        skyGradient.addColorStop(0.7, timeSystem2D.skyColors.middle);
        skyGradient.addColorStop(1, timeSystem2D.skyColors.bottom);
        
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, this.viewport.worldWidth, this.viewport.worldHeight * 0.35);

        this.drawLake();
        this.drawMountains();
        
        this.ctx.restore();
    }

    drawMountains() {
        const baselineY = this.viewport.worldHeight * 0.35;
        
        // 富士山形狀（居中，兩邊坡度為 30 度）
        const mountFuji = {
            x: this.viewport.worldWidth * 0.5,  // 居中位置
            height: this.viewport.worldHeight * 0.22, // 稍微降低高度
            get baseWidth() { 
                // 30度坡度：底邊寬度 = 2 * 高度 / tan(30°) = 2 * 高度 * √3
                return 2 * this.height * Math.sqrt(3);
            }
        };
        
        // 繪製富士山主體 - 30度緩坡圓錐形，與湖水自然銜接
        this.ctx.fillStyle = timeSystem2D.mountainColor;
        this.ctx.beginPath();
        this.ctx.moveTo(mountFuji.x - mountFuji.baseWidth/2, baselineY);
        this.ctx.lineTo(mountFuji.x, baselineY - mountFuji.height);
        this.ctx.lineTo(mountFuji.x + mountFuji.baseWidth/2, baselineY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 添加山脚與湖水的過渡效果
        const transitionGradient = this.ctx.createLinearGradient(0, baselineY - 20, 0, baselineY + 20);
        transitionGradient.addColorStop(0, timeSystem2D.mountainColor);
        transitionGradient.addColorStop(1, 'rgba(' + timeSystem2D.mountainColor.match(/\d+/g).join(',') + ',0.3)');
        this.ctx.fillStyle = transitionGradient;
        this.ctx.fillRect(mountFuji.x - mountFuji.baseWidth/2, baselineY - 20, mountFuji.baseWidth, 40);
        
        
        // 繪製山體陰影（右側）
        const shadowColor = timeSystem2D.mountainColor.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/, 
            (match, r, g, b) => `rgb(${Math.max(0, parseInt(r) - 25)}, ${Math.max(0, parseInt(g) - 30)}, ${Math.max(0, parseInt(b) - 35)})`);
        this.ctx.fillStyle = shadowColor;
        this.ctx.beginPath();
        this.ctx.moveTo(mountFuji.x, baselineY - mountFuji.height);
        this.ctx.lineTo(mountFuji.x + mountFuji.baseWidth/2, baselineY);
        this.ctx.lineTo(mountFuji.x + mountFuji.baseWidth/3, baselineY);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawLake() {
        // 動態湖面漸變
        const gradient = this.ctx.createLinearGradient(0, this.lakeArea.y, 0, this.lakeArea.y + this.lakeArea.height);
        const lakeColors = this.getLakeGradientColors();
        gradient.addColorStop(0, lakeColors.top);
        gradient.addColorStop(0.3, lakeColors.middle);
        gradient.addColorStop(1, lakeColors.bottom);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(this.lakeArea.x, this.lakeArea.y, this.lakeArea.width, this.lakeArea.height);

        // 動態水波效果
        for (let y = this.lakeArea.y; y < this.lakeArea.y + this.lakeArea.height; y += 8) {
            for (let x = this.lakeArea.x; x < this.lakeArea.x + this.lakeArea.width; x += 16) {
                if (Math.random() > 0.7) {
                    const waveOffset = Math.sin((Date.now() * 0.001) + (x * 0.01)) * 2;
                    this.ctx.fillStyle = timeSystem2D.waterColor;
                    this.ctx.fillRect(x, y + waveOffset, 8, 2);
                }
            }
        }
    }
    
    // 獲取湖面漸變顏色
    getLakeGradientColors() {
        const skyBottom = timeSystem2D.skyColors.bottom;
        const mountain = timeSystem2D.mountainColor;
        
        // 將顏色稍微調暗作為湖面反射
        const adjustColor = (colorStr, factor = 0.7) => {
            if (colorStr.startsWith('#')) {
                const hex = colorStr.slice(1);
                const r = Math.floor(parseInt(hex.substring(0, 2), 16) * factor);
                const g = Math.floor(parseInt(hex.substring(2, 4), 16) * factor);
                const b = Math.floor(parseInt(hex.substring(4, 6), 16) * factor);
                return `rgb(${r}, ${g}, ${b})`;
            } else if (colorStr.startsWith('rgb')) {
                return colorStr.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/, 
                    (match, r, g, b) => `rgb(${Math.floor(parseInt(r) * factor)}, ${Math.floor(parseInt(g) * factor)}, ${Math.floor(parseInt(b) * factor)})`);
            }
            return colorStr;
        };
        
        return {
            top: adjustColor(skyBottom, 0.8),
            middle: adjustColor(mountain, 0.9),
            bottom: adjustColor(mountain, 0.6)
        };
    }

    isInLake(screenX, screenY) {
        // 轉換為世界坐標
        const world = this.screenToWorld(screenX, screenY);
        return world.x >= this.lakeArea.x && world.x <= this.lakeArea.x + this.lakeArea.width &&
               world.y >= this.lakeArea.y && world.y <= this.lakeArea.y + this.lakeArea.height;
    }

    async handleAddLantern(screenX, screenY) {
        console.log('🎯 handleAddLantern 被調用:', {screenX, screenY, isInLake: this.isInLake(screenX, screenY)});
        
        if (!this.isInLake(screenX, screenY)) {
            alert('請點擊湖面來放置水燈！');
            return;
        }

        const message = this.messageInput.value.trim();
        console.log('💬 消息內容:', message);
        
        if (!message) {
            alert('請輸入水燈上的消息！');
            return;
        }

        // 播放水燈添加音效
        this.playLanternSound();

        // 轉換為世界坐標來創建水燈
        const worldPos = this.screenToWorld(screenX, screenY);
        console.log('🏮 創建新水燈...', {世界坐標: worldPos});
        const lantern = new WaterLantern(this.nextId++, worldPos.x, worldPos.y, message);
        this.lanterns.push(lantern);
        console.log('✅ 水燈已添加到本地數組, 總數:', this.lanterns.length);
        
        console.log('📡 開始保存到 Supabase...');
        await this.addSingleLantern(lantern);
        
        this.isAddingMode = false;
        this.addForm.style.display = 'none';
        this.messageInput.value = '';
        this.updateCanvasCursor();
        this.canvas.classList.remove('adding-mode');
        
        // 移除瞄準提示
        const aimingHint = document.getElementById('aimingHint');
        if (aimingHint && aimingHint.parentNode) {
            aimingHint.parentNode.removeChild(aimingHint);
        }
    }
    
    cancelAdd() {
        this.isAddingMode = false;
        this.addForm.style.display = 'none';
        this.messageInput.value = '';
        this.updateCanvasCursor();
        this.canvas.classList.remove('adding-mode');
        
        // 移除瞄準提示（如果存在）
        const aimingHint = document.getElementById('aimingHint');
        if (aimingHint && aimingHint.parentNode) {
            aimingHint.parentNode.removeChild(aimingHint);
        }
    }
    
    confirmAdd() {
        const message = this.messageInput.value.trim();
        if (!message) {
            alert('請輸入水燈上的消息！');
            return;
        }
        
        console.log('✅ confirmAdd: 進入瞄準模式, 消息:', message);
        
        // 進入瞄準模式
        this.isAddingMode = true; // 🚨 這是關鍵！
        this.addForm.style.display = 'none';
        this.canvas.style.cursor = 'crosshair';
        this.canvas.classList.add('adding-mode');
        
        // 顯示瞄準提示
        this.showAimingHint();
    }
    
    showAimingHint() {
        // 創建瞄準提示元素（如果不存在）
        let aimingHint = document.getElementById('aimingHint');
        if (!aimingHint) {
            aimingHint = document.createElement('div');
            aimingHint.id = 'aimingHint';
            aimingHint.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(255, 193, 7, 0.95);
                color: #856404;
                padding: 15px 25px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                z-index: 1001;
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                text-align: center;
                animation: fadeInOut 3s ease-in-out;
            `;
            aimingHint.innerHTML = '🎯 點擊湖面放置水燈';
            document.body.appendChild(aimingHint);
            
            // 3秒後自動隱藏
            setTimeout(() => {
                if (aimingHint && aimingHint.parentNode) {
                    aimingHint.parentNode.removeChild(aimingHint);
                }
            }, 3000);
        }
    }
    
    showSuccessMessage(message) {
        // 创建成功提示元素
        const successHint = document.createElement('div');
        successHint.style.cssText = `
            position: fixed;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(40, 167, 69, 0.95);
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            z-index: 1002;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            text-align: center;
            animation: successFade 2s ease-in-out;
        `;
        successHint.innerHTML = message;
        document.body.appendChild(successHint);
        
        // 2秒后自动删除
        setTimeout(() => {
            if (successHint && successHint.parentNode) {
                successHint.parentNode.removeChild(successHint);
            }
        }, 2000);
    }

    handleMouseMove(screenX, screenY) {
        if (this.isAddingMode || this.isDragging) return;

        // 轉換為世界坐標進行檢測
        const worldPos = this.screenToWorld(screenX, screenY);
        
        let hoveredLantern = null;
        for (let lantern of this.lanterns) {
            if (lantern.isNear(worldPos.x, worldPos.y)) {
                hoveredLantern = lantern;
                break;
            }
        }
        
        if (hoveredLantern) {
            this.showTooltip(screenX, screenY, hoveredLantern.message, hoveredLantern.id);
        } else {
            this.hideTooltip();
        }
    }

    showTooltip(x, y, message, id) {
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (x + 15) + 'px';
        this.tooltip.style.top = (y - 40) + 'px';
        if (id) {
            this.tooltip.innerHTML = `<strong>(${String(id).padStart(4, '0')})</strong><br>${message}`;
        } else {
            this.tooltip.textContent = message;
        }
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    async saveLanterns() {
        const lanternData = this.lanterns.map(l => {
            const data = l.toSaveData();
            // 确保字段名与数据库匹配（使用引号）
            return {
                "id": data.id,
                "baseX": data.baseX,
                "baseY": data.baseY,
                "message": data.message,
                "angle": data.angle,
                "floatSpeed": data.floatSpeed,
                "bobAmount": data.bobAmount,
                "driftSpeed": data.driftSpeed,
                "driftAngle": data.driftAngle,
                "time": data.time,
                "rotationSpeed": data.rotationSpeed,
                "depth": data.depth,
                "timestamp": data.timestamp
            };
        });
        
        if (this.supabaseEnabled && supabase) {
            try {
                // 刪除所有現有記錄
                await supabase.from('water_lanterns').delete().neq('id', 0);
                
                // 插入新記錄
                const { error } = await supabase
                    .from('water_lanterns')
                    .insert(lanternData);

                if (error) {
                    console.error('Supabase批量更新失敗:', error);
                    localStorage.setItem('waterLanterns', JSON.stringify(lanternData));
                } else {
                    console.log('數據已保存到Supabase');
                }
            } catch (error) {
                console.error('Supabase操作失敗:', error);
                localStorage.setItem('waterLanterns', JSON.stringify(lanternData));
            }
        } else {
            localStorage.setItem('waterLanterns', JSON.stringify(lanternData));
            console.log('數據已保存到本地存儲');
        }
    }
    
    async addSingleLantern(lantern) {
        console.log('嘗試添加新水燈:', lantern.toSaveData());
        
        if (this.supabaseEnabled && supabase) {
            try {
                const lanternData = lantern.toSaveData();
                console.log('發送到Supabase的數據:', lanternData);
                
                // 清理和驗證數據（使用引号确保与数据库字段名匹配）
                const cleanData = {
                    "baseX": Number(lanternData.baseX) || 0,
                    "baseY": Number(lanternData.baseY) || 0,
                    "message": String(lanternData.message || '').substring(0, 140),
                    "angle": Number(lanternData.angle) || 0,
                    "floatSpeed": Number(lanternData.floatSpeed) || 0.03,
                    "bobAmount": Number(lanternData.bobAmount) || 3,
                    "driftSpeed": Number(lanternData.driftSpeed) || 0.15,
                    "driftAngle": Number(lanternData.driftAngle) || 0,
                    "time": Number(lanternData.time) || 0,
                    "rotationSpeed": Number(lanternData.rotationSpeed) || 0,
                    "depth": Number(lanternData.depth) || 0.5
                    // 不包含 id 和 timestamp，讓數據庫自動生成
                };
                
                console.log('清理後的數據:', cleanData);
                
                const { data, error } = await supabase
                    .from('water_lanterns')
                    .insert([cleanData])
                    .select()
                    .single();

                if (error) {
                    console.log('⚠️ Supabase插入遇到問題，使用本地存儲:', error.message);
                    this.saveLanterns(); // 靜默備份到本地
                } else {
                    console.log('✅ 新水燈已添加到Supabase:', data);
                    // 更新本地水燈的ID為數據庫返回的ID
                    if (data && data.id) {
                        lantern.id = data.id;
                        console.log('🔄 水燈ID已更新為:', data.id);
                    }
                    // Supabase 成功時顯示成功提示
                    this.showSuccessMessage('🏮 水燈添加成功！');
                }
            } catch (error) {
                console.log('⚠️ 網絡連接問題，已保存到本地:', error.message);
                this.saveLanterns(); // 靜默備份到本地
            }
        } else {
            console.log('⚠️ Supabase未啟用，保存到本地存儲');
            this.saveLanterns();
            this.showSuccessMessage('🏮 水燈添加成功！');
        }
    }

    async loadLanterns() {
        let loaded = false;
        
        if (this.supabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('water_lanterns')
                    .select(`
                        id,
                        "baseX",
                        "baseY", 
                        message,
                        angle,
                        "floatSpeed",
                        "bobAmount",
                        "driftSpeed", 
                        "driftAngle",
                        time,
                        "rotationSpeed",
                        depth,
                        timestamp
                    `)
                    .order('id', { ascending: true });

                if (!error && data && data.length > 0) {
                    console.log('從Supabase加載水燈數據:', data.length + '個');
                    data.forEach(item => {
                        // 兼容不同的字段命名格式
                        const x = item.baseX || item.basex || 0;
                        const y = item.baseY || item.basey || 0;
                        const lantern = new WaterLantern(item.id, x, y, item.message, item);
                        this.lanterns.push(lantern);
                        this.nextId = Math.max(this.nextId, item.id + 1);
                    });
                    loaded = true;
                } else {
                    console.log('Supabase中無數據，將創建初始數據');
                }
            } catch (error) {
                console.error('從Supabase加載數據失敗:', error);
            }
        }
        
        if (!loaded) {
            const saved = localStorage.getItem('waterLanterns');
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    console.log('從本地存儲加載水燈數據:', data.length + '個');
                    data.forEach(item => {
                        // 兼容多种字段命名格式
                        const x = item.baseX || item.basex || item.x || 0;
                        const y = item.baseY || item.basey || item.y || 0;
                        const lantern = new WaterLantern(item.id, x, y, item.message, item);
                        this.lanterns.push(lantern);
                        this.nextId = Math.max(this.nextId, item.id + 1);
                    });
                    loaded = true;
                } catch (e) {
                    console.log('本地數據解析失敗，將創建初始數據');
                }
            }
        }

        if (!loaded || this.lanterns.length === 0) {
            console.log('創建初始水燈');
            this.createInitialLanterns();
        }
        
        console.log('總共加載了', this.lanterns.length, '個水燈');
    }

    createInitialLanterns() {
        const messages = [
            '願所有人平安健康', '心想事成，萬事如意', '希望疫情早日結束',
            '祈禱世界和平', '願家人身體健康', '希望明天更美好',
            '感謝生命中的每一天', '願愛永遠傳遞', '祝願所有人快樂',
            '希望夢想成真', '願友誼長存', '祈求風調雨順',
            '希望學業進步', '願工作順利', '祝福所有的孩子',
            '希望環境更美好', '願所有動物平安', '祈禱沒有戰爭',
            '希望科技造福人類', '願每個人都有溫飽'
        ];

        for (let i = 0; i < 20; i++) {
            const margin = 50;
            const x = this.lakeArea.x + margin + Math.random() * (this.lakeArea.width - 2 * margin);
            const y = this.lakeArea.y + margin + Math.random() * (this.lakeArea.height - 2 * margin);
            const message = messages[i % messages.length];
            
            const lantern = new WaterLantern(this.nextId++, x, y, message);
            this.lanterns.push(lantern);
        }
        this.saveLanterns();
    }

    gameLoop() {
        this.drawBackground();
        
        // 應用視窗變換來繪製水燈
        this.ctx.save();
        this.ctx.translate(-this.viewport.x, -this.viewport.y);
        
        this.lanterns.sort((a, b) => a.depth - b.depth);
        
        // 更新環境效果
        updateEnvironment();
        
        this.lanterns.forEach(lantern => {
            // 只繪製在可見範圍內的水燈
            const screenPos = this.worldToScreen(lantern.x, lantern.y);
            if (screenPos.x > -50 && screenPos.x < this.viewport.width + 50 && 
                screenPos.y > -50 && screenPos.y < this.viewport.height + 50) {
                lantern.update();
                lantern.draw(this.ctx);
            }
        });
        
        this.ctx.restore();
        
        // 繪製拖拽提示
        this.drawPanHint();
        
        if (this.frameCount % 300 === 0) {
            this.saveLanterns();
        }
        
        // 每 5 秒更新一次時間顯示（300 frames）
        if (this.frameCount % 300 === 0) {
            this.updateTimeDisplay();
        }
        
        this.frameCount = (this.frameCount || 0) + 1;

        // FPS 計算和界面更新
        this.updateUI();

        requestAnimationFrame(() => this.gameLoop());
    }
    
    drawPanHint() {
        // 顯示拖拽提示和位置指示器
        if (!this.isDragging) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.font = '14px monospace';
            this.ctx.textAlign = 'center';
            
            if (this.isPortrait) {
                // 竖屏：只显示滾動條指示器，不显示文字提示（避免与Debug信息重叠）
                const scrollBarWidth = this.viewport.width - 40;
                const maxOffsetX = Math.max(1, this.viewport.worldWidth - this.viewport.width);
                const scrollProgress = this.viewport.x / maxOffsetX;
                
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.fillRect(20, this.viewport.height - 60, scrollBarWidth, 4);
                
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                const indicatorX = 20 + scrollProgress * scrollBarWidth;
                this.ctx.fillRect(indicatorX - 10, this.viewport.height - 62, 20, 8);
            } else {
                // 横屏：全方向拖拽提示
                this.ctx.fillText('🖱️ 拖拽移動 | 滾輪上下 | 探索完整場景', this.viewport.width / 2, this.viewport.height - 55);
                
                // 位置指示器（右下角小地图样式）
                const mapSize = 80;
                const mapX = this.viewport.width - mapSize - 20;
                const mapY = this.viewport.height - mapSize - 20;
                
                // 地图背景
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.fillRect(mapX, mapY, mapSize, mapSize);
                
                // 当前视口位置
                const viewX = (this.viewport.x / this.viewport.worldWidth) * mapSize;
                const viewY = (this.viewport.y / this.viewport.worldHeight) * mapSize;
                const viewW = (this.viewport.width / this.viewport.worldWidth) * mapSize;
                const viewH = (this.viewport.height / this.viewport.worldHeight) * mapSize;
                
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                this.ctx.fillRect(mapX + viewX, mapY + viewY, viewW, viewH);
                
                // 地图边框
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                this.ctx.strokeRect(mapX, mapY, mapSize, mapSize);
            }
            
            this.ctx.restore();
        }
    }
    
    updateCanvasCursor() {
        if (this.isAddingMode) {
            this.canvas.style.cursor = 'crosshair';
        } else if (!this.isDragging) {
            this.canvas.style.cursor = 'grab';
        } else if (this.isDragging) {
            this.canvas.style.cursor = 'grabbing';  
        } else {
            this.canvas.style.cursor = 'default';
        }
    }
}

function cancelAdd() {
    app.isAddingMode = false;
    app.addForm.style.display = 'none';
    app.messageInput.value = '';
    app.canvas.style.cursor = 'default';
}

function confirmAdd() {
    if (!app.messageInput.value.trim()) {
        alert('請輸入水燈上的消息！');
        return;
    }
    alert('現在點擊湖面選擇水燈位置');
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new WaterLanternApp();
});