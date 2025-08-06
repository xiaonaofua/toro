class WaterLantern {
    constructor(id, x, y, message, savedData = null) {
        this.id = id;
        this.message = message;
        
        if (savedData) {
            this.baseX = savedData.baseX;
            this.baseY = savedData.baseY;
            this.angle = savedData.angle;
            this.floatSpeed = savedData.floatSpeed;
            this.bobAmount = savedData.bobAmount;
            this.driftSpeed = savedData.driftSpeed;
            this.driftAngle = savedData.driftAngle;
            this.time = savedData.time;
            this.rotationSpeed = savedData.rotationSpeed;
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
        const scale = 0.4 + this.depth * 1.2;
        const alpha = 0.7 + this.depth * 0.3;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // 水灯底座（木质船体）
        const boatWidth = 16 * scale;
        const boatHeight = 6 * scale;
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(this.x - boatWidth/2, this.y + 2*scale, boatWidth, boatHeight);
        
        // 蜡烛主体
        const candleWidth = 6 * scale;
        const candleHeight = 12 * scale;
        ctx.fillStyle = '#FFF8DC';
        ctx.fillRect(this.x - candleWidth/2, this.y - candleHeight/2, candleWidth, candleHeight);
        
        // 蜡烛火焰
        const flameHeight = 8 * scale;
        const flameWidth = 4 * scale;
        // 外层火焰（橙色）
        ctx.fillStyle = '#FF6B35';
        ctx.fillRect(this.x - flameWidth/2, this.y - candleHeight/2 - flameHeight, flameWidth, flameHeight);
        // 内层火焰（黄色）
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(this.x - flameWidth/3, this.y - candleHeight/2 - flameHeight + 2*scale, flameWidth/1.5, flameHeight - 2*scale);
        
        // 火焰光晕效果
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#FFA500';
        const glowSize = 12 * scale;
        ctx.fillRect(this.x - glowSize/2, this.y - candleHeight/2 - flameHeight - 2*scale, glowSize, glowSize);
        
        // 水面倒影
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(this.x - flameWidth/2, this.y + boatHeight + 2*scale, flameWidth, flameHeight * 0.6);
        
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.depth > 0.5 ? '#000' : '#333';
        ctx.font = `${Math.max(8, 10 * scale)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`(${String(this.id).padStart(4, '0')})`, this.x, this.y + boatHeight + 18*scale);
        
        ctx.restore();
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
        
        this.setupCanvas();
        this.loadLanterns();
        this.setupEventListeners();
        this.gameLoop();
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
        this.addButton.addEventListener('click', () => {
            this.isAddingMode = true;
            this.addForm.style.display = 'block';
            this.canvas.style.cursor = 'crosshair';
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.isAddingMode) {
                this.handleAddLantern(e.clientX, e.clientY);
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
    }

    drawBackground() {
        // 渐变天空背景
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
        
        // 主富士山形状
        const mainPeak = {
            x: this.canvas.width * 0.3,
            height: this.canvas.height * 0.28,
            width: this.canvas.width * 0.4
        };
        
        // 绘制主山峰（类似富士山）
        this.ctx.fillStyle = '#1a252f';
        this.ctx.beginPath();
        this.ctx.moveTo(mainPeak.x - mainPeak.width/2, baselineY);
        this.ctx.lineTo(mainPeak.x, baselineY - mainPeak.height);
        this.ctx.lineTo(mainPeak.x + mainPeak.width/2, baselineY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 绘制更深色的山体阴影
        this.ctx.fillStyle = '#0f1419';
        this.ctx.beginPath();
        this.ctx.moveTo(mainPeak.x, baselineY - mainPeak.height);
        this.ctx.lineTo(mainPeak.x + mainPeak.width/2, baselineY);
        this.ctx.lineTo(mainPeak.x + mainPeak.width/3, baselineY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 左侧较小的山峰
        this.ctx.fillStyle = '#243342';
        this.ctx.beginPath();
        this.ctx.moveTo(0, baselineY);
        this.ctx.lineTo(this.canvas.width * 0.15, baselineY - this.canvas.height * 0.15);
        this.ctx.lineTo(this.canvas.width * 0.25, baselineY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 右侧山峰群
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
        
        // 添加山顶积雪效果
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

    handleAddLantern(x, y) {
        if (!this.isInLake(x, y)) {
            alert('请点击湖面来放置水灯！');
            return;
        }

        const message = this.messageInput.value.trim();
        if (!message) {
            alert('请输入水灯上的消息！');
            return;
        }

        const lantern = new WaterLantern(this.nextId++, x, y, message);
        this.lanterns.push(lantern);
        this.addSingleLantern(lantern);
        
        this.isAddingMode = false;
        this.addForm.style.display = 'none';
        this.messageInput.value = '';
        this.canvas.style.cursor = 'default';
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
        
        try {
            const response = await fetch('/api/lanterns', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(lanternData),
            });
        } catch (error) {
            console.log('离线模式：数据将保存在本地存储中');
            localStorage.setItem('waterLanterns', JSON.stringify(lanternData));
        }
    }
    
    async addSingleLantern(lantern) {
        try {
            const response = await fetch('/api/lanterns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(lantern.toSaveData()),
            });
        } catch (error) {
            console.log('离线模式：数据将保存在本地存储中');
            const lanternData = this.lanterns.map(l => l.toSaveData());
            localStorage.setItem('waterLanterns', JSON.stringify(lanternData));
        }
    }

    async loadLanterns() {
        let loaded = false;
        
        try {
            const response = await fetch('/api/lanterns?' + new Date().getTime());
            if (response.ok) {
                const data = await response.json();
                console.log('从服务器加载水灯数据:', data.length + '个');
                
                data.forEach(item => {
                    const lantern = new WaterLantern(item.id, item.baseX || item.x, item.baseY || item.y, item.message, item);
                    this.lanterns.push(lantern);
                    this.nextId = Math.max(this.nextId, item.id + 1);
                });
                loaded = true;
            }
        } catch (error) {
            console.log('无法连接服务器，尝试本地存储');
        }
        
        if (!loaded) {
            const saved = localStorage.getItem('waterLanterns');
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    console.log('从本地存储加载水灯数据:', data.length + '个');
                    data.forEach(item => {
                        const lantern = new WaterLantern(item.id, item.baseX || item.x, item.baseY || item.y, item.message, item);
                        this.lanterns.push(lantern);
                        this.nextId = Math.max(this.nextId, item.id + 1);
                    });
                    loaded = true;
                } catch (e) {
                    console.log('本地数据解析失败');
                }
            }
        }

        if (!loaded || this.lanterns.length === 0) {
            console.log('创建初始水灯');
            this.createInitialLanterns();
        }
        
        console.log('总共加载了', this.lanterns.length, '个水灯');
    }

    createInitialLanterns() {
        const messages = [
            '愿所有人平安健康', '心想事成，万事如意', '希望疫情早日结束',
            '祈祷世界和平', '愿家人身体健康', '希望明天更美好',
            '感谢生命中的每一天', '愿爱永远传递', '祝愿所有人快乐',
            '希望梦想成真', '愿友谊长存', '祈求风调雨顺',
            '希望学业进步', '愿工作顺利', '祝福所有的孩子',
            '希望环境更美好', '愿所有动物平安', '祈祷没有战争',
            '希望科技造福人类', '愿每个人都有温饱'
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
        alert('请输入水灯上的消息！');
        return;
    }
    alert('现在点击湖面选择水灯位置');
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new WaterLanternApp();
});