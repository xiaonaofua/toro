# 放水燈

3D 互動放水燈網頁：寫下心願，把水燈放到湖面上，看它隨水流慢慢漂向富士山。

## 🌐 在線演示

**https://xiaonaofua.github.io/toro/**

## 🎮 另一个小游戏：闯关东

**https://xiaonaofua.github.io/toro/guandong/**

清末“闯关东”背景的文字分支叙事游戏：扮演一个山东黄县的普通人，靠一次次选择走完光绪二十五年到民国元年的十二年。一局约二十分钟，共八个结局。点击 / 空格加速文字，数字键 1–4 选择，进度自动保存在浏览器里。源码在 `guandong/`（`story.js` 是全部剧情数据）。

## ✨ 特色

- 真實水面：倒映天空、遠山與每一盞燭光，隨微風起伏
- 天色跟著當地時間變化：白天、夕陽、藍調時刻、星空與月光
- 水燈隨波浮沉、輕微傾斜，順著水流漂遠後再從岸邊重新出發
- 點一下水燈即可看到上面寫的心願
- 可在網址加上 `?hour=20` 預覽指定時刻的景色

## 🛠️ 技術棧

- Three.js（Water 反射、自訂天空 Shader、Bloom 後製）
- Supabase PostgreSQL（`water_lanterns` 資料表；無法連線時退回 localStorage）
- GitHub Pages

## 🚀 本地執行

```bash
python -m http.server 8080
# 開啟 http://localhost:8080
```
