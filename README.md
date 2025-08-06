# 放水燈網頁

一個互動式的放水燈網頁應用。用戶可以在虛擬湖面上放置水燈並寫下願望。

## 功能特點

- 像素風格的山湖背景
- 水燈在湖面上漂浮移動
- 點擊添加自己的水燈
- 鼠標懸停查看水燈消息
- 數據自動保存

## 快速開始

### 在線體驗
部署到 [Vercel](https://vercel.com) 即可在線使用。

### 本地運行
```bash
npm install
npm start
```
然後訪問 http://localhost:3001

## 部署

### GitHub
雙擊運行 `quick-deploy.bat` 或 `push.bat`

### Vercel
1. 推送代碼到GitHub
2. 在Vercel導入倉庫
3. 點擊Deploy

## 使用方法

1. 點擊"添加水燈"按鈕
2. 輸入願望消息
3. 點擊湖面放置水燈
4. 鼠標移到水燈上查看消息

## 技術棧

- 前端：HTML5 Canvas + JavaScript
- 後端：Node.js / Vercel Functions
- 存儲：本地JSON / Vercel KV

## 許可證

MIT License