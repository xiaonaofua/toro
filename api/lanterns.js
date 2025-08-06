// Vercel无服务器函数处理水灯数据
import { createClient } from '@vercel/kv';

// 由于Vercel无法直接写文件，我们使用Vercel KV存储
// 如果没有配置KV，则返回模拟数据
let kv;
try {
  kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
} catch (error) {
  console.log('KV not configured, using in-memory storage');
}

// 默认水灯数据
const defaultLanterns = [
  { id: 1, baseX: 200, baseY: 300, message: '愿所有人平安健康', angle: 1.2, floatSpeed: 0.03, bobAmount: 3, driftSpeed: 0.15, driftAngle: 0.5, time: 100, rotationSpeed: 0.005, depth: 0.8, timestamp: new Date().toISOString() },
  { id: 2, baseX: 400, baseY: 250, message: '心想事成，万事如意', angle: 2.1, floatSpeed: 0.025, bobAmount: 2.5, driftSpeed: 0.12, driftAngle: 1.2, time: 200, rotationSpeed: -0.003, depth: 0.6, timestamp: new Date().toISOString() },
  { id: 3, baseX: 600, baseY: 320, message: '希望疫情早日结束', angle: 0.8, floatSpeed: 0.04, bobAmount: 4, driftSpeed: 0.18, driftAngle: 2.1, time: 50, rotationSpeed: 0.008, depth: 0.4, timestamp: new Date().toISOString() },
  { id: 4, baseX: 300, baseY: 400, message: '祈祷世界和平', angle: 1.5, floatSpeed: 0.035, bobAmount: 3.2, driftSpeed: 0.14, driftAngle: 0.8, time: 150, rotationSpeed: -0.006, depth: 0.9, timestamp: new Date().toISOString() },
  { id: 5, baseX: 500, baseY: 380, message: '愿家人身体健康', angle: 0.3, floatSpeed: 0.028, bobAmount: 2.8, driftSpeed: 0.16, driftAngle: 1.8, time: 80, rotationSpeed: 0.004, depth: 0.7, timestamp: new Date().toISOString() },
  { id: 6, baseX: 250, baseY: 280, message: '希望明天更美好', angle: 2.5, floatSpeed: 0.032, bobAmount: 3.5, driftSpeed: 0.13, driftAngle: 0.2, time: 300, rotationSpeed: -0.007, depth: 0.3, timestamp: new Date().toISOString() },
  { id: 7, baseX: 450, baseY: 420, message: '感谢生命中的每一天', angle: 1.8, floatSpeed: 0.038, bobAmount: 2.2, driftSpeed: 0.19, driftAngle: 1.5, time: 180, rotationSpeed: 0.009, depth: 0.85, timestamp: new Date().toISOString() },
  { id: 8, baseX: 350, baseY: 270, message: '愿爱永远传递', angle: 0.6, floatSpeed: 0.026, bobAmount: 3.8, driftSpeed: 0.11, driftAngle: 2.3, time: 120, rotationSpeed: -0.004, depth: 0.5, timestamp: new Date().toISOString() },
  { id: 9, baseX: 550, baseY: 350, message: '祝愿所有人快乐', angle: 2.2, floatSpeed: 0.041, bobAmount: 2.6, driftSpeed: 0.17, driftAngle: 0.7, time: 250, rotationSpeed: 0.007, depth: 0.65, timestamp: new Date().toISOString() },
  { id: 10, baseX: 180, baseY: 360, message: '希望梦想成真', angle: 1.1, floatSpeed: 0.029, bobAmount: 4.2, driftSpeed: 0.15, driftAngle: 1.9, time: 90, rotationSpeed: -0.005, depth: 0.75, timestamp: new Date().toISOString() },
  { id: 11, baseX: 380, baseY: 300, message: '愿友谊长存', angle: 0.9, floatSpeed: 0.037, bobAmount: 3.1, driftSpeed: 0.12, driftAngle: 0.4, time: 210, rotationSpeed: 0.006, depth: 0.45, timestamp: new Date().toISOString() },
  { id: 12, baseX: 480, baseY: 290, message: '祈求风调雨顺', angle: 1.7, floatSpeed: 0.033, bobAmount: 2.9, driftSpeed: 0.16, driftAngle: 1.3, time: 160, rotationSpeed: -0.008, depth: 0.8, timestamp: new Date().toISOString() },
  { id: 13, baseX: 320, baseY: 390, message: '希望学业进步', angle: 2.4, floatSpeed: 0.024, bobAmount: 3.6, driftSpeed: 0.14, driftAngle: 2.0, time: 70, rotationSpeed: 0.003, depth: 0.35, timestamp: new Date().toISOString() },
  { id: 14, baseX: 420, baseY: 260, message: '愿工作顺利', angle: 0.4, floatSpeed: 0.042, bobAmount: 2.4, driftSpeed: 0.18, driftAngle: 0.9, time: 190, rotationSpeed: -0.007, depth: 0.9, timestamp: new Date().toISOString() },
  { id: 15, baseX: 280, baseY: 340, message: '祝福所有的孩子', angle: 1.9, floatSpeed: 0.031, bobAmount: 3.3, driftSpeed: 0.13, driftAngle: 1.6, time: 140, rotationSpeed: 0.005, depth: 0.55, timestamp: new Date().toISOString() },
  { id: 16, baseX: 520, baseY: 310, message: '希望环境更美好', angle: 0.7, floatSpeed: 0.036, bobAmount: 2.7, driftSpeed: 0.17, driftAngle: 0.3, time: 220, rotationSpeed: -0.004, depth: 0.7, timestamp: new Date().toISOString() },
  { id: 17, baseX: 360, baseY: 410, message: '愿所有动物平安', angle: 2.3, floatSpeed: 0.027, bobAmount: 4.1, driftSpeed: 0.15, driftAngle: 2.2, time: 110, rotationSpeed: 0.008, depth: 0.25, timestamp: new Date().toISOString() },
  { id: 18, baseX: 460, baseY: 330, message: '祈祷没有战争', angle: 1.4, floatSpeed: 0.039, bobAmount: 3.0, driftSpeed: 0.19, driftAngle: 1.1, time: 270, rotationSpeed: -0.006, depth: 0.85, timestamp: new Date().toISOString() },
  { id: 19, baseX: 240, baseY: 370, message: '希望科技造福人类', angle: 0.5, floatSpeed: 0.034, bobAmount: 2.3, driftSpeed: 0.12, driftAngle: 1.7, time: 60, rotationSpeed: 0.004, depth: 0.6, timestamp: new Date().toISOString() },
  { id: 20, baseX: 440, baseY: 380, message: '愿每个人都有温饱', angle: 2.1, floatSpeed: 0.030, bobAmount: 3.7, driftSpeed: 0.16, driftAngle: 0.6, time: 240, rotationSpeed: -0.005, depth: 0.4, timestamp: new Date().toISOString() }
];

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      // 获取所有水灯数据
      let lanterns;
      if (kv) {
        lanterns = await kv.get('water-lanterns');
        if (!lanterns) {
          await kv.set('water-lanterns', defaultLanterns);
          lanterns = defaultLanterns;
        }
      } else {
        lanterns = defaultLanterns;
      }
      res.status(200).json(lanterns);
    }
    
    else if (req.method === 'POST') {
      // 添加单个水灯
      const newLantern = req.body;
      
      if (!newLantern.message || newLantern.message.length > 140) {
        return res.status(400).json({ error: '消息内容无效' });
      }

      let lanterns;
      if (kv) {
        lanterns = await kv.get('water-lanterns') || defaultLanterns;
        lanterns.push(newLantern);
        await kv.set('water-lanterns', lanterns);
      } else {
        lanterns = [...defaultLanterns, newLantern];
      }
      
      res.status(200).json({ success: true, lantern: newLantern });
    }
    
    else if (req.method === 'PUT') {
      // 更新所有水灯数据
      const lanternDataArray = req.body;
      
      if (!Array.isArray(lanternDataArray)) {
        return res.status(400).json({ error: '数据格式错误' });
      }

      if (kv) {
        await kv.set('water-lanterns', lanternDataArray);
      }
      
      res.status(200).json({ success: true, count: lanternDataArray.length });
    }
    
    else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}