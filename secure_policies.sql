-- Supabase 安全策略設置
-- 在 SQL Editor 中運行此腳本來增強安全性

-- 1. 啟用行級安全性
ALTER TABLE water_lanterns ENABLE ROW LEVEL SECURITY;

-- 2. 允許所有人讀取水燈數據（查看水燈）
CREATE POLICY "允許查看所有水燈" ON water_lanterns
    FOR SELECT 
    USING (true);

-- 3. 限制插入：防止大量垃圾數據
CREATE POLICY "限制添加水燈" ON water_lanterns
    FOR INSERT 
    WITH CHECK (
        -- 消息長度限制
        LENGTH(message) > 0 AND LENGTH(message) <= 140
        -- 坐標合理範圍（防止超出畫面）
        AND baseX >= 0 AND baseX <= 2000 
        AND baseY >= 0 AND baseY <= 2000
    );

-- 4. 禁止更新和删除（保護現有數據）
-- 不創建UPDATE和DELETE策略，預設禁止

-- 5. 創建速率限制函數（可選）
CREATE OR REPLACE FUNCTION check_insert_rate()
RETURNS TRIGGER AS $$
BEGIN
    -- 檢查同一IP在10分鐘內的插入次數
    IF (
        SELECT COUNT(*) 
        FROM water_lanterns 
        WHERE timestamp > NOW() - INTERVAL '10 minutes'
    ) > 10 THEN
        RAISE EXCEPTION '添加太頻繁，請稍後再試';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 創建觸發器應用速率限制
DROP TRIGGER IF EXISTS rate_limit_trigger ON water_lanterns;
CREATE TRIGGER rate_limit_trigger
    BEFORE INSERT ON water_lanterns
    FOR EACH ROW
    EXECUTE FUNCTION check_insert_rate();

-- 7. 創建清理舊數據的函數（可選）
CREATE OR REPLACE FUNCTION cleanup_old_lanterns()
RETURNS void AS $$
BEGIN
    -- 保留最新的1000個水燈，刪除更舊的
    DELETE FROM water_lanterns 
    WHERE id NOT IN (
        SELECT id FROM water_lanterns 
        ORDER BY timestamp DESC 
        LIMIT 1000
    );
END;
$$ LANGUAGE plpgsql;

-- 8. 查看當前策略（驗證設置）
SELECT 
    tablename, 
    policyname, 
    cmd, 
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'water_lanterns';