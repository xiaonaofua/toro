# 放水燈網頁

一個互動式的放水燈網頁應用。用戶可以在虛擬湖面上放置水燈並寫下願望。

## ✨ 功能特點

- 像素風格的富士山背景
- 精美的水燈設計（木質船體+蠟燭火焰）
- 水燈在湖面上漂浮移動
- 點擊湖面添加自己的水燈
- 鼠標懸停查看水燈消息
- 多用戶實時共享水燈
- 數據永久保存到雲端

## 🚀 快速開始

### 第1步：配置Supabase
1. 在 [supabase.com](https://supabase.com) 創建新項目
2. 創建 `water_lanterns` 數據表（參考配置指南）
3. 獲取項目URL和API密鑰

### 第2步：修改配置
編輯 `app.js` 文件頂部：
```javascript
const SUPABASE_URL = 'https://您的項目ID.supabase.co'; 
const SUPABASE_ANON_KEY = '您的anon-public-key';
```

### 第3步：部署
```bash
# 推送到GitHub
push.bat

# 在GitHub倉庫 Settings → Pages 中啟用GitHub Pages
```

訪問：https://您的用戶名.github.io/toro/

## 📊 Supabase數據表結構

創建名為 `water_lanterns` 的表，包含以下列：

| 列名 | 類型 | 說明 |
|------|------|------|
| id | int8 | 主鍵（自動）|
| baseX | float8 | X坐標 |
| baseY | float8 | Y坐標 |
| message | text | 用戶消息 |
| angle | float8 | 漂浮角度 |
| floatSpeed | float8 | 漂浮速度 |
| bobAmount | float8 | 擺動幅度 |
| driftSpeed | float8 | 漂移速度 |
| driftAngle | float8 | 漂移角度 |
| time | float8 | 時間偏移 |
| rotationSpeed | float8 | 旋轉速度 |
| depth | float8 | 深度值 |
| timestamp | timestamptz | 創建時間 |

**重要**：創建表時取消勾選 "Enable Row Level Security"

## 🔧 使用方法

1. 點擊"添加水燈"按鈕
2. 輸入願望消息（最多140字）
3. 點擊湖面選擇水燈位置
4. 您的水燈會出現並同步給所有用戶
5. 鼠標移到水燈上可查看消息

## 🌍 部署平台

支持部署到任何靜態託管平台：
- GitHub Pages（推薦）
- Netlify
- Cloudflare Pages
- Vercel（靜態模式）

## 💾 數據存儲

- **主要存儲**：Supabase PostgreSQL數據庫
- **備用存儲**：瀏覽器本地存儲（離線時）
- **實時同步**：所有用戶看到相同的水燈

## 📝 技術棧

- 前端：HTML5 Canvas + 原生 JavaScript
- 數據庫：Supabase PostgreSQL
- 存儲：雲端數據庫 + 本地存儲備份
- 部署：GitHub Pages 等靜態平台

## 🆓 免費額度

- **GitHub Pages**：完全免費
- **Supabase**：每月 50MB 數據庫 + 50萬 API 調用

## 📄 許可證

MIT License

---

💡 **提示**：首次訪問時會自動創建20個初始水燈，配置正確後黃色提示會自動消失。