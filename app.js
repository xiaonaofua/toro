// 純前端版本 - 直接連接Supabase
// 可部署到任何靜態託管平台（GitHub Pages, Netlify等）

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
        
        this.x = this.baseX + Math.sin(this.angle) * this.bobAmount + Math.sin(this.driftAngle) * 1;
        this.y = this.baseY + Math.cos(this.angle * 1.3) * (this.bobAmount * 0.5) + Math.cos(this.driftAngle * 0.8) * 0.5;
        
        this.baseX += Math.sin(this.driftAngle) * this.driftSpeed * 0.1;
        this.baseY += Math.cos(this.driftAngle) * this.driftSpeed * 0.05;
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
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.lakeArea = {
            x: this.canvas.width * 0.1,
            y: this.canvas.height * 0.4,
            width: this.canvas.width * 0.8,
            height: this.canvas.height * 0.5
        };
        
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.lakeArea = {
                x: this.canvas.width * 0.1,
                y: this.canvas.height * 0.4,
                width: this.canvas.width * 0.8,
                height: this.canvas.height * 0.5
            };
        });
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
                isAddingMode: this.isAddingMode
            });
            
            if (this.isAddingMode) {
                this.handleAddLantern(e.clientX, e.clientY);
            }
        });
        
        // 觸摸事件支持
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.isAddingMode && e.changedTouches.length > 0) {
                const touch = e.changedTouches[0];
                this.handleAddLantern(touch.clientX, touch.clientY);
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e.clientX, e.clientY);
        });
        
        // 觸摸移動事件
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this.handleMouseMove(touch.clientX, touch.clientY);
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hideTooltip();
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
        // 漸變天空背景
        const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.4);
        skyGradient.addColorStop(0, '#1a1a3e');
        skyGradient.addColorStop(0.7, '#2c3e60');
        skyGradient.addColorStop(1, '#34495e');
        
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.35);

        this.drawMountains();
        this.drawLake();
    }

    drawMountains() {
        const baselineY = this.canvas.height * 0.35;
        
        // 主富士山形狀
        const mainPeak = {
            x: this.canvas.width * 0.3,
            height: this.canvas.height * 0.28,
            width: this.canvas.width * 0.4
        };
        
        // 繪製主山峰（類似富士山）
        this.ctx.fillStyle = '#1a252f';
        this.ctx.beginPath();
        this.ctx.moveTo(mainPeak.x - mainPeak.width/2, baselineY);
        this.ctx.lineTo(mainPeak.x, baselineY - mainPeak.height);
        this.ctx.lineTo(mainPeak.x + mainPeak.width/2, baselineY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 繪製更深色的山體陰影
        this.ctx.fillStyle = '#0f1419';
        this.ctx.beginPath();
        this.ctx.moveTo(mainPeak.x, baselineY - mainPeak.height);
        this.ctx.lineTo(mainPeak.x + mainPeak.width/2, baselineY);
        this.ctx.lineTo(mainPeak.x + mainPeak.width/3, baselineY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 左側較小的山峰
        this.ctx.fillStyle = '#243342';
        this.ctx.beginPath();
        this.ctx.moveTo(0, baselineY);
        this.ctx.lineTo(this.canvas.width * 0.15, baselineY - this.canvas.height * 0.15);
        this.ctx.lineTo(this.canvas.width * 0.25, baselineY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 右側山峰群
        const rightPeaks = [
            { x: this.canvas.width * 0.6, height: this.canvas.height * 0.18 },
            { x: this.canvas.width * 0.75, height: this.canvas.height * 0.22 },
            { x: this.canvas.width * 0.9, height: this.canvas.height * 0.16 }
        ];
        
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width * 0.55, baselineY);
        rightPeaks.forEach(peak => {
            this.ctx.lineTo(peak.x, baselineY - peak.height);
        });
        this.ctx.lineTo(this.canvas.width, baselineY - this.canvas.height * 0.1);
        this.ctx.lineTo(this.canvas.width, baselineY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 添加山頂積雪效果
        this.ctx.fillStyle = '#5a6b7c';
        this.ctx.beginPath();
        this.ctx.moveTo(mainPeak.x - 15, baselineY - mainPeak.height + 10);
        this.ctx.lineTo(mainPeak.x, baselineY - mainPeak.height);
        this.ctx.lineTo(mainPeak.x + 15, baselineY - mainPeak.height + 10);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawLake() {
        const gradient = this.ctx.createLinearGradient(0, this.lakeArea.y, 0, this.lakeArea.y + this.lakeArea.height);
        gradient.addColorStop(0, '#34495e');
        gradient.addColorStop(0.3, '#2c3e50');
        gradient.addColorStop(1, '#1a252f');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(this.lakeArea.x, this.lakeArea.y, this.lakeArea.width, this.lakeArea.height);

        for (let y = this.lakeArea.y; y < this.lakeArea.y + this.lakeArea.height; y += 8) {
            for (let x = this.lakeArea.x; x < this.lakeArea.x + this.lakeArea.width; x += 16) {
                if (Math.random() > 0.7) {
                    const waveOffset = Math.sin((Date.now() * 0.001) + (x * 0.01)) * 2;
                    this.ctx.fillStyle = '#3a5169';
                    this.ctx.fillRect(x, y + waveOffset, 8, 2);
                }
            }
        }
    }

    isInLake(x, y) {
        return x >= this.lakeArea.x && x <= this.lakeArea.x + this.lakeArea.width &&
               y >= this.lakeArea.y && y <= this.lakeArea.y + this.lakeArea.height;
    }

    async handleAddLantern(x, y) {
        console.log('🎯 handleAddLantern 被調用:', {x, y, isInLake: this.isInLake(x, y)});
        
        if (!this.isInLake(x, y)) {
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

        console.log('🏮 創建新水燈...');
        const lantern = new WaterLantern(this.nextId++, x, y, message);
        this.lanterns.push(lantern);
        console.log('✅ 水燈已添加到本地數組, 總數:', this.lanterns.length);
        
        console.log('📡 開始保存到 Supabase...');
        await this.addSingleLantern(lantern);
        
        this.isAddingMode = false;
        this.addForm.style.display = 'none';
        this.messageInput.value = '';
        this.canvas.style.cursor = 'default';
        
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
        this.canvas.style.cursor = 'default';
        
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

    handleMouseMove(x, y) {
        if (this.isAddingMode) return;

        const nearbyLantern = this.lanterns.find(lantern => lantern.isNear(x, y));
        
        if (nearbyLantern) {
            this.showTooltip(x, y, nearbyLantern.message);
        } else {
            this.hideTooltip();
        }
    }

    showTooltip(x, y, message) {
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (x + 15) + 'px';
        this.tooltip.style.top = (y - 40) + 'px';
        this.tooltip.textContent = message;
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    async saveLanterns() {
        const lanternData = this.lanterns.map(l => l.toSaveData());
        
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
                
                // 清理和驗證數據
                const cleanData = {
                    baseX: Number(lanternData.baseX) || 0,
                    baseY: Number(lanternData.baseY) || 0,
                    message: String(lanternData.message || '').substring(0, 140),
                    angle: Number(lanternData.angle) || 0,
                    floatSpeed: Number(lanternData.floatSpeed) || 0.03,
                    bobAmount: Number(lanternData.bobAmount) || 3,
                    driftSpeed: Number(lanternData.driftSpeed) || 0.15,
                    driftAngle: Number(lanternData.driftAngle) || 0,
                    time: Number(lanternData.time) || 0,
                    rotationSpeed: Number(lanternData.rotationSpeed) || 0,
                    depth: Number(lanternData.depth) || 0.5
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
                    .select('*')
                    .order('id', { ascending: true });

                if (!error && data && data.length > 0) {
                    console.log('從Supabase加載水燈數據:', data.length + '個');
                    data.forEach(item => {
                        const lantern = new WaterLantern(item.id, item.baseX, item.baseY, item.message, item);
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
                        const lantern = new WaterLantern(item.id, item.baseX || item.x, item.baseY || item.y, item.message, item);
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
        
        this.lanterns.sort((a, b) => a.depth - b.depth);
        
        this.lanterns.forEach(lantern => {
            lantern.update();
            lantern.draw(this.ctx);
        });
        
        if (this.frameCount % 300 === 0) {
            this.saveLanterns();
        }
        this.frameCount = (this.frameCount || 0) + 1;

        requestAnimationFrame(() => this.gameLoop());
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