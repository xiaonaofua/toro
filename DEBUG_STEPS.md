# 調試步驟 - 水燈數據不保存問題

## 🔍 **第1步：檢查瀏覽器控制台**

1. **打開網站並按F12**
2. **點擊Console標籤**
3. **嘗試添加一個水燈**
4. **查看控制台輸出**

### 預期的正常輸出：
```
✅ Supabase客戶端初始化成功
嘗試添加新水燈: {id: 21, baseX: 300, baseY: 400, message: "測試"}
發送到Supabase的數據: {id: 21, baseX: 300, baseY: 400, message: "測試", ...}
✅ 新水燈已添加到Supabase: {id: 21, ...}
```

### 可能的錯誤輸出：
```
❌ Supabase插入失敗: {message: "permission denied", code: "42501"}
❌ Supabase操作異常: TypeError: Cannot read property...
⚠️ Supabase未啟用，保存到本地存儲
```

## 🛠️ **第2步：運行權限修復SQL**

1. **打開Supabase項目**
2. **點擊左側 "SQL Editor"**
3. **點擊 "New query"**
4. **複製粘貼 `fix_permissions.sql` 的內容**
5. **點擊 "Run"**

### 檢查結果：
- 測試插入是否成功
- 表結構是否正確
- RLS是否已禁用

## 🔧 **第3步：常見問題排查**

### A. RLS (Row Level Security) 問題
**症狀**: 控制台顯示 "permission denied" 或 "insufficient privilege"
**解決**: 運行 `ALTER TABLE water_lanterns DISABLE ROW LEVEL SECURITY;`

### B. 表結構問題  
**症狀**: 控制台顯示 "column does not exist" 
**解決**: 重新運行 `create_table.sql` 創建正確的表結構

### C. API Key權限問題
**症狀**: 控制台顯示 "Invalid API key" 或 "unauthorized"
**解決**: 
1. 檢查 `app.js` 中的 `SUPABASE_ANON_KEY` 是否正確
2. 確認使用的是 "anon public key" 不是 "service_role key"

### D. 網絡連接問題
**症狀**: 控制台顯示 "Failed to fetch" 或 "Network error"
**解決**: 檢查網絡連接，確認Supabase項目狀態正常

### E. 數據類型問題
**症狀**: 控制台顯示 "invalid input syntax" 
**解決**: 檢查發送的數據類型是否匹配表結構

## 📋 **第4步：手動測試**

在Supabase SQL Editor中直接測試：

```sql
-- 1. 檢查表是否存在
SELECT * FROM water_lanterns LIMIT 1;

-- 2. 手動插入測試數據
INSERT INTO water_lanterns (baseX, baseY, message) 
VALUES (300, 400, '手動測試水燈');

-- 3. 查看是否插入成功
SELECT * FROM water_lanterns ORDER BY id DESC LIMIT 3;
```

## 🎯 **第5步：根據錯誤信息採取行動**

| 錯誤類型 | 控制台信息 | 解決方案 |
|----------|------------|----------|
| 權限問題 | `permission denied` | 運行權限修復SQL |
| 表不存在 | `relation does not exist` | 重新創建表 |
| 列不存在 | `column does not exist` | 檢查表結構 |
| 數據類型 | `invalid input syntax` | 檢查數據格式 |
| 網絡問題 | `Failed to fetch` | 檢查連接和API配置 |

## 💡 **快速修復建議**

最常見的問題是RLS權限，嘗試這個快速修復：

```sql
-- 在 Supabase SQL Editor 中運行
ALTER TABLE water_lanterns DISABLE ROW LEVEL SECURITY;
```

然後刷新網頁重新測試。

---

**請按順序執行這些步驟，並告訴我在哪一步看到了什麼錯誤信息！**