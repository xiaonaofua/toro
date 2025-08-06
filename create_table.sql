-- 創建水燈數據表的完整SQL腳本
-- 在Supabase項目中：Dashboard -> SQL Editor -> 粘貼此代碼 -> Run

-- 創建 water_lanterns 表
CREATE TABLE water_lanterns (
    id BIGSERIAL PRIMARY KEY,
    baseX FLOAT8 NOT NULL,
    baseY FLOAT8 NOT NULL,
    message TEXT NOT NULL,
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

-- 添加表註釋
COMMENT ON TABLE water_lanterns IS 'Water lantern data storage';

-- 添加列註釋
COMMENT ON COLUMN water_lanterns.id IS '水燈唯一標識符';
COMMENT ON COLUMN water_lanterns.baseX IS '水燈X坐標';
COMMENT ON COLUMN water_lanterns.baseY IS '水燈Y坐標';
COMMENT ON COLUMN water_lanterns.message IS '用戶消息內容';
COMMENT ON COLUMN water_lanterns.angle IS '漂浮角度';
COMMENT ON COLUMN water_lanterns.floatSpeed IS '漂浮速度';
COMMENT ON COLUMN water_lanterns.bobAmount IS '擺動幅度';
COMMENT ON COLUMN water_lanterns.driftSpeed IS '漂移速度';
COMMENT ON COLUMN water_lanterns.driftAngle IS '漂移角度';
COMMENT ON COLUMN water_lanterns.time IS '時間偏移';
COMMENT ON COLUMN water_lanterns.rotationSpeed IS '旋轉速度';
COMMENT ON COLUMN water_lanterns.depth IS '深度值（用於近大遠小效果）';
COMMENT ON COLUMN water_lanterns.timestamp IS '創建時間';

-- 禁用行級安全性（RLS）- 重要！
ALTER TABLE water_lanterns DISABLE ROW LEVEL SECURITY;

-- 創建索引以提高查詢性能
CREATE INDEX idx_water_lanterns_timestamp ON water_lanterns(timestamp);
CREATE INDEX idx_water_lanterns_id ON water_lanterns(id);

-- 驗證表創建是否成功
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'water_lanterns' 
ORDER BY ordinal_position;