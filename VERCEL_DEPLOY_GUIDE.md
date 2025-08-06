# Vercel部署详细指南

本文档详细说明如何将放水灯项目部署到Vercel平台。

## 🚀 Vercel部署详细步骤

### 1. 注册并登录Vercel
- 访问 https://vercel.com
- 点击右上角 "Sign Up" 注册（建议用GitHub账号登录）
- 或者点击 "Log In" 登录现有账号

### 2. 导入GitHub项目
登录后：
- 点击 "New Project" 或 "Import Project" 按钮
- 选择 "Import Git Repository"
- 如果是第一次，需要连接GitHub账号：
  - 点击 "Continue with GitHub"
  - 授权Vercel访问您的GitHub仓库

### 3. 选择仓库
- 在仓库列表中找到 `xiaonaofua/toro`
- 点击仓库旁边的 "Import" 按钮

### 4. 配置项目设置
在导入页面会看到这些设置：

**Project Name**: `toro` (可以修改)
**Framework Preset**: 选择 "Other" 或 "Node.js"
**Root Directory**: `.` (保持默认)
**Build Command**: 留空或填入 `npm run build`（我们的项目不需要构建）
**Output Directory**: 留空
**Install Command**: `npm install`

### 5. 环境变量（可选）
如果您想使用Vercel KV数据库实现真正的数据持久化：
- 点击 "Environment Variables"
- 暂时跳过，稍后配置

### 6. 部署
- 点击 "Deploy" 按钮
- 等待部署完成（通常1-2分钟）

### 7. 部署成功
部署成功后：
- 会显示庆祝页面
- 获得一个类似 `https://toro-xxxxx.vercel.app` 的网址
- 点击 "Visit" 查看您的水灯网站

### 8. 配置数据库（可选但推荐）
为了让多用户共享水灯数据：

**8.1 创建KV数据库：**
- 在项目dashboard中，点击 "Storage" 标签
- 点击 "Create Database"
- 选择 "KV" 
- 输入数据库名称（例如：`toro-lanterns`）
- 选择地区（选择离您最近的）
- 点击 "Create"

**8.2 连接到项目：**
- 创建后，点击 "Connect Project"
- 选择您的 `toro` 项目
- 点击 "Connect"
- 这会自动设置环境变量 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`

**8.3 重新部署：**
- 返回项目页面
- 点击 "Deployments" 标签
- 点击最新部署右侧的三个点
- 选择 "Redeploy"

### 9. 自定义域名（可选）
如果您有自己的域名：
- 在项目dashboard中，点击 "Settings" 标签
- 点击 "Domains"
- 添加您的自定义域名

## 🔄 后续更新流程

每次您修改代码并推送到GitHub：
1. 运行 `deploy.bat` 推送更新
2. Vercel会自动检测更改并重新部署
3. 几分钟后新版本就会生效

## ⚠️ 常见问题

**问题1：部署失败**
- 检查 `vercel.json` 文件是否正确
- 确保所有文件都已推送到GitHub

**问题2：API不工作**
- 检查 `api/lanterns.js` 文件路径是否正确
- 查看Vercel的 "Functions" 标签确认API函数已部署

**问题3：数据不持久化**
- 没有KV数据库时，数据只在内存中，重启会丢失
- 按照步骤8设置KV数据库即可解决

**问题4：中文字符显示问题**
- 确保所有文件都使用UTF-8编码
- 如果仍有问题，尝试重新部署

## 📱 最终结果

成功部署后，您将获得：
- 一个公开的水灯网站URL
- 全球CDN加速
- 自动HTTPS
- 真正的数据持久化（配置KV后）
- 多用户实时共享水灯

## 💡 高级配置

### 自动部署设置
- 推送到main分支时自动部署
- 可以设置预览部署（Preview Deployments）
- 支持多环境部署

### 监控和分析
- 在Vercel dashboard查看访问统计
- 监控API函数调用情况
- 查看部署历史和日志

### 性能优化
- Vercel自动优化静态资源
- 全球CDN分发
- 自动图片优化（如果使用）

---

## 🎯 快速部署检查清单

- [ ] 代码已推送到GitHub
- [ ] 访问vercel.com并登录
- [ ] 导入xiaonaofua/toro仓库
- [ ] 配置项目设置
- [ ] 点击Deploy部署
- [ ] 测试部署后的网站
- [ ] （可选）配置KV数据库
- [ ] （可选）设置自定义域名

完成以上步骤后，您的放水灯网站就可以在全世界访问了！