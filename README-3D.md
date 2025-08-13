# 🌊 燈籠流水 3D - 革新的3D水燈遊戲

使用最新3D遊戲引擎技術打造的沉浸式水燈許願體驗。

## ✨ 3D特色功能

### 🎮 3D遊戲引擎
- **Babylon.js 6.0** - 業界領先的WebGL 3D引擎
- **WebGL 2.0支持** - 現代GPU加速渲染
- **實時3D渲染** - 60fps流暢體驗
- **跨平台兼容** - 桌面和移動設備優化

### 🌊 高級水面模擬
- **FFT波浪算法** - 真實物理水面動畫
- **實時反射與折射** - 逼真的水面光學效果
- **動態法線貼圖** - 細緻的水面細節
- **粒子漣漪系統** - 交互式水波擴散

### 🏮 3D水燈系統
- **立體燈籠模型** - 精細的3D日式燈籠造型
- **動態光照系統** - 每個燈籠發出真實光芒
- **物理浮動效果** - 基於Cannon.js的真實物理模擬
- **粒子光暈特效** - GPU加速的發光粒子系統

### 🎯 沉浸式交互
- **3D視角控制** - 360度旋轉查看場景
- **精確點擊檢測** - 3D射線拾取技術
- **觸摸優化控制** - 移動設備手勢支持
- **智能相機系統** - 自動聚焦和平滑過渡

### 🎨 視覺效果
- **程序化天空** - 動態天空盒系統
- **3D山脈背景** - 立體環境建模
- **霧效渲染** - 大氣透視效果
- **後處理效果** - Bloom、FXAA抗鋸齒

### ⚡ 性能優化
- **自適應品質** - 根據設備性能動態調整
- **LOD層次細節** - 距離基礎品質優化
- **視錐體剔除** - 只渲染可見物體
- **移動端優化** - 針對手機平板特別優化

## 🚀 快速開始

### 1. 啟動3D版本
```bash
# 啟動本地服務器
npm start

# 或使用Python
python -m http.server 8080
```

### 2. 訪問網址
- **3D版本**: http://localhost:8080/index3d.html
- **2D版本**: http://localhost:8080/index.html

### 3. 瀏覽器要求
- **推薦**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **必須**: 支持WebGL 2.0和ES6
- **硬件**: 支持硬件加速的GPU

## 📋 系統要求

### 桌面端
- **CPU**: Intel i3 / AMD Ryzen 3 或更高
- **GPU**: 支持WebGL 2.0的顯卡
- **內存**: 4GB RAM
- **網絡**: 穩定的網絡連接 (首次加載)

### 移動端
- **iOS**: iPhone 8 / iPad (第6代) 或更新
- **Android**: Android 7.0+ 配備Adreno 530/Mali-G71或更高GPU
- **內存**: 3GB RAM推薦

## 🎯 控制指南

### 桌面端控制
- **鼠標拖拽**: 旋轉視角
- **滾輪**: 縮放視距
- **左鍵點擊**: 選擇水燈/添加位置
- **右鍵**: 取消操作

### 移動端控制
- **單指拖拽**: 旋轉視角
- **雙指縮放**: 調整視距
- **點擊**: 選擇水燈/添加位置
- **長按**: 顯示詳細信息

## 🛠️ 技術架構

### 核心技術棧
```
前端渲染: Babylon.js 6.0 + WebGL 2.0
物理引擎: Cannon.js
數據庫: Supabase PostgreSQL
部署: GitHub Pages / Netlify
```

### 文件結構
```
toro/
├── index3d.html          # 3D遊戲主頁面
├── app3d.js              # 3D遊戲邏輯
├── babylon.config.js     # 3D引擎配置
├── index.html            # 2D版本 (備用)
├── app.js                # 2D版本邏輯
└── README-3D.md          # 3D版本說明
```

### 3D系統組件
```javascript
WaterLantern3DGame
├── Babylon.js Engine     // 核心3D引擎
├── Scene Manager         // 場景管理
├── Water System          // 水面模擬
├── Lantern System        // 水燈3D模型
├── Physics Engine        // 物理模擬
├── Particle Effects      // 粒子特效
├── Camera Controller     // 相機控制
└── Performance Monitor   // 性能監控
```

## 🔧 配置選項

### 性能配置
在 `babylon.config.js` 中調整:

```javascript
// 性能等級
performance: {
  quality: 'auto',     // auto, low, medium, high, ultra
  targetFPS: 60,       // 目標幀率
  adaptiveQuality: true // 自適應品質
}

// 移動端優化
mobile: {
  hardwareScaling: 1.5,      // 渲染比例
  maxParticles: 150,         // 最大粒子數
  shadowsEnabled: false      // 禁用陰影
}
```

### 視覺效果配置
```javascript
// 水面設置
water: {
  waveHeight: 1.2,          // 波浪高度
  windForce: -15,           // 風力
  reflectionsEnabled: true   // 反射效果
}

// 後處理
postProcessing: {
  bloom: true,              // 泛光效果
  fxaa: true               // 抗鋸齒
}
```

## 🎨 自定義功能

### 添加新的水燈樣式
1. 在 `WaterLantern3D.createLanternMesh()` 中定義新模型
2. 設置材質和紋理
3. 配置光照和粒子效果

### 擴展水面效果
1. 修改 `setupWater()` 方法
2. 調整波浪參數和材質屬性
3. 添加新的水面紋理

### 增強環境細節
1. 在 `setupEnvironment()` 中添加新模型
2. 配置光照和陰影
3. 優化LOD和性能

## 📊 性能基準

### 桌面端 (GTX 1060)
- **Ultra品質**: 60fps, 6K粒子, 全效果
- **High品質**: 75fps, 4K粒子, 高品質效果
- **Medium品質**: 90fps, 2K粒子, 標準效果

### 移動端 (iPhone 12)
- **High品質**: 45fps, 1.5K粒子, 簡化陰影
- **Medium品質**: 60fps, 1K粒子, 無陰影
- **Low品質**: 60fps, 500粒子, 最小效果

## 🔍 調試功能

### 開發者模式
在URL後添加 `?debug=true` 啟用:
- 實時FPS顯示
- 記憶體使用監控
- 渲染統計
- 場景檢查器
- 2D/3D切換按鈕

### 性能分析
```javascript
// 啟用性能監控
BabylonConfig.debug.enabled = true;
BabylonConfig.debug.stats.enabled = true;
```

## 🚨 故障排除

### 常見問題

**Q: 頁面顯示WebGL錯誤**
A: 確保瀏覽器支持WebGL 2.0並啟用硬件加速

**Q: 3D效果卡頓**
A: 降低品質設置或使用移動端優化模式

**Q: 水燈不顯示**
A: 檢查瀏覽器控制台錯誤，確保Babylon.js正確加載

**Q: 觸摸控制不響應**
A: 確保設備支持觸摸事件，嘗試刷新頁面

### 性能優化建議
1. 關閉不必要的瀏覽器標籤頁
2. 使用最新版本瀏覽器
3. 確保設備有足夠可用記憶體
4. 在移動端使用省電模式

## 🆕 版本更新

### v2.0.0 (當前版本)
- ✅ 完整3D引擎集成
- ✅ 高級水面模擬
- ✅ 3D水燈模型系統
- ✅ 移動端優化
- ✅ 自適應性能調節

### 計劃中功能
- 🔄 VR/AR支持
- 🔄 多人在線模式  
- 🔄 更多水燈樣式
- 🔄 季節主題變化
- 🔄 音效系統增強

## 📞 技術支持

### 問題報告
如遇到技術問題，請提供:
1. 瀏覽器版本和操作系統
2. 設備硬件配置
3. 錯誤截圖和控制台日誌
4. 重現問題的具體步驟

### 聯繫方式
- **GitHub Issues**: [項目問題追蹤](https://github.com/your-username/water-lantern-3d/issues)
- **技術文檔**: [完整API文檔](https://docs.babylonjs.com/)

## 📄 許可證

MIT License - 自由使用和修改

---

**享受這個革新的3D水燈體驗！** 🏮✨

*讓科技與傳統文化完美融合，在虛擬的3D世界中傳遞真摯的祝福。*