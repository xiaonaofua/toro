-- 修復 water_lanterns 表權限的SQL腳本
-- 在 Supabase SQL Editor 中運行

-- 1. 檢查當前表的狀態
SELECT 
    table_name,
    row_security
FROM information_schema.tables 
WHERE table_name = 'water_lanterns';

-- 2. 禁用行級安全性（如果之前啟用了）
ALTER TABLE water_lanterns DISABLE ROW LEVEL SECURITY;

-- 3. 刪除所有現有策略（重新開始）
DROP POLICY IF EXISTS "允許查看所有水燈" ON water_lanterns;
DROP POLICY IF EXISTS "限制添加水燈" ON water_lanterns; 
DROP POLICY IF EXISTS "Enable read access for all users" ON water_lanterns;
DROP POLICY IF EXISTS "Enable insert for all users" ON water_lanterns;

-- 4. 檢查表結構是否正確
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'water_lanterns' 
ORDER BY ordinal_position;

-- 5. 測試插入（看看是否有權限問題）
-- 注意：這會插入一個測試數據
INSERT INTO water_lanterns (baseX, baseY, message) 
VALUES (100, 200, '測試水燈 - 請在確認功能正常後刪除');

-- 6. 檢查插入是否成功
SELECT COUNT(*) as total_lanterns FROM water_lanterns;

-- 7. 顯示最新的幾個記錄
SELECT 
    id, 
    baseX, 
    baseY, 
    message, 
    timestamp 
FROM water_lanterns 
ORDER BY timestamp DESC 
LIMIT 5;

-- 8. 如果要清理測試數據，取消註釋下面這行
-- DELETE FROM water_lanterns WHERE message = '測試水燈 - 請在確認功能正常後刪除';