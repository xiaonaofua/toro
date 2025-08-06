# Supabase 配置詳細指南

## 📋 第1步：創建Supabase項目

1. **註冊登錄**
   - 訪問 [supabase.com](https://supabase.com)
   - 點擊 "Start your project" 並登錄GitHub賬號

2. **創建新項目**
   - 點擊 "New Project"
   - 項目名稱：`toro-water-lanterns`
   - 選擇組織（或創建新組織）
   - 設置數據庫密碼（請記住！）
   - 選擇地區（選擇就近的）
   - 點擊 "Create new project"
   - 等待1-2分鐘初始化完成

## 📊 第2步：創建數據表

1. **進入Table Editor**
   - 在項目面板左側點擊 "Table Editor"
   - 點擊 "Create a new table"

2. **表基本設置**
   - **Name**: `water_lanterns`
   - **Description**: `Water lantern data storage`
   - **❌ 重要：取消勾選 "Enable Row Level Security"**

3. **添加列（保留默認的id列）**

點擊 "Add column" 依次添加以下列：

| 列名 | 類型 | 默認值 | 是否必填 |
|------|------|--------|----------|
| `baseX` | `float8` | 無 | ✓ |
| `baseY` | `float8` | 無 | ✓ |
| `message` | `text` | 無 | ✓ |
| `angle` | `float8` | `0` | - |
| `floatSpeed` | `float8` | `0.03` | - |
| `bobAmount` | `float8` | `3` | - |
| `driftSpeed` | `float8` | `0.15` | - |
| `driftAngle` | `float8` | `0` | - |
| `time` | `float8` | `0` | - |
| `rotationSpeed` | `float8` | `0` | - |
| `depth` | `float8` | `0.5` | - |
| `timestamp` | `timestamptz` | `now()` | - |

4. **保存表**
   - 點擊 "Save" 創建表

## 🔑 第3步：獲取API密鑰

1. **進入API設置**
   - 在項目面板左側點擊 "Settings"
   - 點擊 "API" 標籤

2. **複製必要信息**
   - **Project URL**: 類似 `https://abcdefghijk.supabase.co`
   - **anon public key**: 很長的公開API密鑰（以 `eyJ` 開頭）

   **注意**：只需要這兩個值，不需要service_role key

## 💻 第4步：配置代碼

1. **編輯配置**
   打開 `app.js` 文件，修改頂部的配置：

   ```javascript
   // 替換為您的實際配置
   const SUPABASE_URL = 'https://您的項目ID.supabase.co'; 
   const SUPABASE_ANON_KEY = '您的anon-public-key這裡';
   ```

2. **保存文件**
   確保配置正確無誤

## 🚀 第5步：部署到GitHub Pages

1. **推送代碼**
   ```bash
   push.bat
   ```

2. **啟用GitHub Pages**
   - 訪問 GitHub 倉庫頁面
   - 點擊 "Settings" 標籤
   - 滾動到 "Pages" 部分
   - Source 選擇 "Deploy from a branch"
   - Branch 選擇 "master"（或 "main"）
   - 文件夾選擇 "/ (root)"
   - 點擊 "Save"

3. **等待部署**
   - 等待1-2分鐘
   - 訪問 `https://您的用戶名.github.io/toro/`

## ✅ 第6步：測試功能

1. **檢查連接**
   - 打開網站，按F12打開開發者工具
   - 查看Console標籤
   - 應該看到：
     - "Supabase客戶端初始化成功"
     - "從Supabase加載水燈數據: XX個" 或 "創建初始水燈"

2. **測試添加水燈**
   - 點擊"添加水燈"按鈕
   - 輸入測試消息
   - 點擊湖面添加
   - 應該看到新水燈出現

3. **檢查數據同步**
   - 在Supabase項目的Table Editor中
   - 查看 `water_lanterns` 表
   - 應該能看到您剛添加的水燈數據

## 🔧 常見問題

### Q1: 黃色提示不消失？
**A**: 檢查 `app.js` 中的配置是否正確，URL和API key不能包含範例文字。

### Q2: 控制台顯示"無法加載Supabase"？
**A**: 
- 檢查網絡連接
- 確認URL和API key正確
- 確認Supabase項目狀態正常

### Q3: 無法讀寫數據？
**A**: 
- 確認已取消勾選"Enable Row Level Security"
- 檢查表名是否為 `water_lanterns`
- 確認所有必填列都已創建

### Q4: 水燈不同步？
**A**: 
- 檢查多個瀏覽器/設備是否都能看到相同數據
- 確認Supabase表中有數據
- 嘗試刷新頁面

## 🎉 完成！

配置成功後，您將擁有：
- 🌍 全球多用戶共享的水燈網站
- 💾 永久保存在雲端的水燈數據
- 📱 支持任何設備訪問的響應式設計
- 🚀 完全免費的託管和數據庫服務

---

**需要幫助？** 檢查瀏覽器控制台的錯誤信息，或重新檢查配置步驟。