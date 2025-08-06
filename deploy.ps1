# PowerShell script to deploy Water Lantern project to GitHub
# Usage: Right-click and "Run with PowerShell" or run "powershell -ExecutionPolicy Bypass -File deploy.ps1"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Water Lantern Project Deploy to GitHub" -ForegroundColor Cyan  
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from project root directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "🔄 Checking Git status..." -ForegroundColor Yellow
git status

Write-Host ""
Write-Host "📝 Adding all files to staging area..." -ForegroundColor Yellow
git add .

Write-Host ""
$commitMsg = Read-Host "💬 Please enter commit message (press Enter for default)"

if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMsg = "Update water lantern app - $timestamp"
}

Write-Host ""
Write-Host "📦 Committing changes..." -ForegroundColor Yellow
git commit -m $commitMsg

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  No changes to commit or commit failed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔗 Checking remote repository connection..." -ForegroundColor Yellow
git remote -v

# Check if remote origin is already set
$remoteExists = $false
try {
    git remote get-url origin | Out-Null
    $remoteExists = ($LASTEXITCODE -eq 0)
} catch {
    $remoteExists = $false
}

if (-not $remoteExists) {
    Write-Host "🔧 Adding remote repository..." -ForegroundColor Yellow
    git remote add origin https://github.com/xiaonaofua/toro.git
} else {
    Write-Host "✅ Remote repository is already set" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push to main failed, trying master branch..." -ForegroundColor Red
    git push -u origin master
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Push failed! Possible reasons:" -ForegroundColor Red
        Write-Host "   1. Network connection issue" -ForegroundColor Red
        Write-Host "   2. GitHub authentication issue" -ForegroundColor Red
        Write-Host "   3. Branch name issue" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Please manually run:" -ForegroundColor Yellow
        Write-Host "   git push -u origin main" -ForegroundColor White
        Write-Host "   or" -ForegroundColor White
        Write-Host "   git push -u origin master" -ForegroundColor White
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Successfully published to GitHub!" -ForegroundColor Green
Write-Host "📱 Project URL: https://github.com/xiaonaofua/toro" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 To deploy to Vercel:" -ForegroundColor Yellow
Write-Host "   1. Visit https://vercel.com" -ForegroundColor White
Write-Host "   2. Login and select 'Import Project'" -ForegroundColor White
Write-Host "   3. Import GitHub repository: xiaonaofua/toro" -ForegroundColor White
Write-Host "   4. Click Deploy to complete deployment" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to exit"