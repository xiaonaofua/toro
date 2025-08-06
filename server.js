const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'lanterns.json');

app.use(express.json());
app.use(express.static(__dirname));

async function loadLanterns() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function saveLanterns(lanterns) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(lanterns, null, 2));
        return true;
    } catch (error) {
        console.error('保存水灯数据失败:', error);
        return false;
    }
}

app.get('/api/lanterns', async (req, res) => {
    try {
        const lanterns = await loadLanterns();
        res.json(lanterns);
    } catch (error) {
        console.error('读取水灯数据失败:', error);
        res.status(500).json({ error: '读取数据失败' });
    }
});

app.post('/api/lanterns', async (req, res) => {
    try {
        const lanternData = req.body;
        
        if (!lanternData.message || lanternData.message.length > 140) {
            return res.status(400).json({ error: '消息内容无效' });
        }
        
        const lanterns = await loadLanterns();
        lanterns.push(lanternData);
        
        const success = await saveLanterns(lanterns);
        if (success) {
            res.json({ success: true, lantern: lanternData });
        } else {
            res.status(500).json({ error: '保存数据失败' });
        }
    } catch (error) {
        console.error('添加水灯失败:', error);
        res.status(500).json({ error: '添加数据失败' });
    }
});

app.put('/api/lanterns', async (req, res) => {
    try {
        const lanternDataArray = req.body;
        
        if (!Array.isArray(lanternDataArray)) {
            return res.status(400).json({ error: '数据格式错误' });
        }
        
        const success = await saveLanterns(lanternDataArray);
        if (success) {
            res.json({ success: true, count: lanternDataArray.length });
        } else {
            res.status(500).json({ error: '保存数据失败' });
        }
    } catch (error) {
        console.error('更新水灯数据失败:', error);
        res.status(500).json({ error: '更新数据失败' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`放水灯服务器运行在 http://localhost:${PORT}`);
    console.log('打开浏览器访问上面的地址来使用水灯系统');
});

module.exports = app;