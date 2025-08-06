# 部署说明文档

## 📁 新增的文件

- `VERCEL_DEPLOY_GUIDE.md` - Vercel部署详细指南
- `deploy.bat` - Windows批处理部署脚本（修复编码问题）
- `deploy.ps1` - PowerShell部署脚本（推荐使用）
- `DEPLOY_INSTRUCTIONS.md` - 本说明文档

## 🚀 如何部署到GitHub

### 方式一：使用PowerShell脚本（推荐）
```powershell
# 右键点击 deploy.ps1 -> "使用PowerShell运行"
# 或在PowerShell中执行：
powershell -ExecutionPolicy Bypass -File deploy.ps1
```

### 方式二：使用批处理脚本
```cmd
# 双击运行 deploy.bat
# 或在命令提示符中执行：
deploy.bat
```

### 方式三：手动Git命令
```bash
git add .
git commit -m "Update water lantern app"
git push -u origin main
```

## 🌐 如何部署到Vercel

详细步骤请参考 `VERCEL_DEPLOY_GUIDE.md` 文件。

简要步骤：
1. 先将代码推送到GitHub
2. 访问 https://vercel.com 并登录
3. 导入 `xiaonaofua/toro` 仓库
4. 点击 Deploy 完成部署

## ⚠️ 编码问题解决方案

如果 `deploy.bat` 出现乱码或无法识别命令的问题：

### 问题原因
- Windows系统区域设置为日文
- 批处理文件编码不兼容
- 中文字符在非中文系统中显示异常

### 解决方案

1. **使用PowerShell脚本**（推荐）
   - `deploy.ps1` 对Unicode支持更好
   - 支持彩色输出和更好的错误处理

2. **修改系统区域设置**
   - 控制面板 -> 时钟和区域 -> 区域 -> 管理 -> 更改系统区域设置
   - 选择 "中文(简体，中国)" 或 "英语(美国)"

3. **使用英文版脚本**
   - `deploy.bat` 现已修改为纯英文版本
   - 避免了编码问题

4. **手动执行Git命令**
   - 直接使用Git命令行工具
   - 避免批处理脚本的编码问题

## 🔧 故障排除

### Git认证问题
如果推送时要求输入用户名密码：
1. 配置Git凭据：
   ```bash
   git config --global user.name "你的GitHub用户名"
   git config --global user.email "你的邮箱"
   ```
2. 使用GitHub Personal Access Token代替密码

### 推送失败
1. 检查网络连接
2. 确认仓库地址正确
3. 检查Git凭据是否有效
4. 尝试推送到不同分支（main/master）

### 部署脚本无法运行
1. 确保在项目根目录运行
2. 检查PowerShell执行策略：
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

## 📝 更新日志

### 2024年最新版本
- ✅ 修复编码问题
- ✅ 添加PowerShell版本脚本  
- ✅ 改进错误处理
- ✅ 添加彩色输出
- ✅ 提供多种部署方式
- ✅ 完整的Vercel部署指南

---

如有任何问题，请查看相关文档或使用手动Git命令进行部署。