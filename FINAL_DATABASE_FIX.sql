-- 🚨 最終數據庫修復方案 🚨
-- 這個腳本會完全重置water_lanterns表並創建正確的結構
-- 在Supabase SQL Editor中運行此腳本

-- ==========================================
-- 第1步：完全刪除現有表（如果存在）
-- ==========================================
DROP TABLE IF EXISTS water_lanterns CASCADE;

-- ==========================================  
-- 第2步：創建具有正確結構的新表
-- ==========================================
CREATE TABLE water_lanterns (
    id BIGSERIAL PRIMARY KEY,
    baseX FLOAT8 NOT NULL,
    baseY FLOAT8 NOT NULL,
    message TEXT NOT NULL CHECK (LENGTH(message) <= 140),
    angle FLOAT8 DEFAULT 0,
    floatSpeed FLOAT8 DEFAULT 0.03,
    bobAmount FLOAT8 DEFAULT 3,
    driftSpeed FLOAT8 DEFAULT 0.15,
    driftAngle FLOAT8 DEFAULT 0,
    time FLOAT8 DEFAULT 0,
    rotationSpeed FLOAT8 DEFAULT 0,
    depth FLOAT8 DEFAULT 0.5,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 第3步：禁用行級安全性
-- ==========================================
ALTER TABLE water_lanterns DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 第4步：創建性能索引
-- ==========================================
CREATE INDEX idx_water_lanterns_timestamp ON water_lanterns(timestamp);
CREATE INDEX idx_water_lanterns_id ON water_lanterns(id);

-- ==========================================
-- 第5步：插入測試數據
-- ==========================================
INSERT INTO water_lanterns (baseX, baseY, message) VALUES
(300, 400, '測試水燈 - 數據庫修復成功'),
(500, 450, '願所有人平安健康'),
(400, 500, '希望明天更美好');

-- ==========================================
-- 第6步：驗證表結構
-- ==========================================
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'water_lanterns' 
ORDER BY ordinal_position;

-- ==========================================
-- 第7步：測試數據插入
-- ==========================================
SELECT 
    id, 
    baseX, 
    baseY, 
    message, 
    timestamp 
FROM water_lanterns 
ORDER BY timestamp DESC 
LIMIT 5;

-- ==========================================
-- 預期結果
-- ==========================================
-- 如果成功，您應該看到：
-- 1. 表結構顯示所有必需的列（包括baseX, baseY等）
-- 2. 3條測試數據記錄
-- 3. 沒有任何錯誤信息

-- 如果看到這些結果，說明數據庫已經修復成功！
-- 現在刷新網頁，應該不再看到 "Could not find the 'baseX' column" 錯誤