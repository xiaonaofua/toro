# Supabase 配置指南

本指南將幫您設置Supabase數據庫來支持放水燈應用。

## 🚀 為什麼選擇Supabase？

- ✅ **真正的多用戶共享** - 所有用戶看到同樣的水燈
- ✅ **實時更新** - 用戶添加水燈時其他人立即看到  
- ✅ **免費額度豐富** - 每月50MB數據庫 + 50萬API調用
- ✅ **PostgreSQL** - 強大的關係數據庫
- ✅ **自動備份** - 數據永不丟失

## 📋 Supabase 設置步驟

### 1. 創建Supabase項目
1. 訪問 [supabase.com](https://supabase.com)
2. 點擊 "Start your project" 並登錄
3. 點擊 "New Project"
4. 填寫項目信息：
   - **Name**: `toro-water-lanterns`
   - **Organization**: 選擇或創建組織
   - **Database Password**: 設置一個強密碼（請記住）
   - **Region**: 選擇就近地區
5. 點擊 "Create new project"
6. 等待1-2分鐘項目初始化完成

### 2. 創建水燈數據表
1. 在項目儀表板中，點擊左側 "Table Editor"
2. 點擊 "Create a new table"
3. 設置表信息：
   - **Name**: `water_lanterns`
   - **Description**: `Water lantern data storage`
   - 取消勾選 "Enable Row Level Security"
4. 添加以下列（保留默認的id列）：

| 列名 | 類型 | 默認值 | 說明 |
|------|------|--------|------|
| baseX | float8 | 無 | 水燈X坐標 |
| baseY | float8 | 無 | 水燈Y坐標 |
| message | text | 無 | 用戶消息 |
| angle | float8 | 0 | 漂浮角度 |
| floatSpeed | float8 | 0.03 | 漂浮速度 |
| bobAmount | float8 | 3 | 擺動幅度 |
| driftSpeed | float8 | 0.15 | 漂移速度 |
| driftAngle | float8 | 0 | 漂移角度 |
| time | float8 | 0 | 時間偏移 |
| rotationSpeed | float8 | 0 | 旋轉速度 |
| depth | float8 | 0.5 | 深度值 |
| timestamp | timestamptz | now() | 創建時間 |

5. 點擊 "Save" 創建表

### 3. 獲取API密鑰
1. 在項目儀表板中，點擊左側 "Settings" → "API"
2. 複製以下兩個值：
   - **Project URL** (類似: `https://xxx.supabase.co`)
   - **anon public key** (很長的字符串)
   - **service_role key** (很長的字符串，用於服務端)

## 🔧 部署配置

### Vercel 部署配置

1. 在Vercel項目儀表板中，點擊 "Settings" → "Environment Variables"
2. 添加以下環境變量：

| 變量名 | 值 | 說明 |
|--------|----|----|
| `NEXT_PUBLIC_SUPABASE_URL` | 你的Project URL | 公共API地址 |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的service_role key | 服務端密鑰 |

3. 重新部署項目：
   - 點擊 "Deployments" 標籤
   - 點擊最新部署旁的三個點
   - 選擇 "Redeploy"

### 本地開發配置

1. 在項目根目錄創建 `.env.local` 文件：
```bash
NEXT_PUBLIC_SUPABASE_URL=https://你的項目ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key
```

2. 重啟本地服務器：
```bash
npm start
```

## ✅ 測試連接

部署完成後，檢查瀏覽器控制台：
- 看到 "從Supabase加載水燈數據" = 連接成功 ✅
- 看到 "無法連接Supabase" = 需要檢查配置 ❌

## 🔄 數據管理

### 查看數據
1. 在Supabase項目中，點擊 "Table Editor"
2. 選擇 `water_lanterns` 表查看所有水燈數據

### 清空數據
如果需要重置所有水燈：
```sql
DELETE FROM water_lanterns;
```

### 備份數據
Supabase自動備份，也可以手動導出：
1. Table Editor → 右上角 "..." → "Download as CSV"

## 🎯 最終效果

成功配置後您將獲得：
- 🌍 **全球共享** - 所有用戶看到相同的水燈
- ⚡ **實時更新** - 新水燈立即同步到所有用戶
- 🛡️ **數據安全** - 專業數據庫備份保護
- 📈 **可擴展** - 支持大量用戶和水燈

## ⚠️ 注意事項

1. **免費額度**: Supabase免費版有限制，適合中小型項目
2. **安全性**: service_role_key擁有管理員權限，請妥善保管
3. **性能**: 初次加載可能需要幾秒時間初始化數據

---

**🎉 配置完成後，您的水燈應用將支持真正的多用戶實時共享！**