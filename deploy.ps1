# 一键部署到 GitHub Pages
# 用法：在项目文件夹里右键「在终端中打开」，运行：  .\deploy.ps1

$ErrorActionPreference = "Stop"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=== 情侣网页 · GitHub Pages 部署 ===" -ForegroundColor Magenta
Write-Host ""

# 1. 检查 GitHub 登录
$loggedIn = $true
try {
  gh auth status 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { $loggedIn = $false }
} catch {
  $loggedIn = $false
}

if (-not $loggedIn) {
  Write-Host "请先登录 GitHub（会打开浏览器，按提示完成授权）..." -ForegroundColor Yellow
  gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) {
    Write-Host "登录失败，请重试。" -ForegroundColor Red
    exit 1
  }
}

# 2. 获取 GitHub 用户名
$username = gh api user -q .login
if (-not $username) {
  Write-Host "无法获取 GitHub 用户名。" -ForegroundColor Red
  exit 1
}

$repoName = "girlfriend"
$repoFull = "$username/$repoName"
$siteUrl = "https://$username.github.io/$repoName/"

Write-Host "GitHub 账号: $username" -ForegroundColor Cyan
Write-Host "仓库名称: $repoName" -ForegroundColor Cyan
Write-Host ""

# 3. 创建远程仓库（若不存在）
$repoExists = $false
try {
  gh repo view $repoFull 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $repoExists = $true }
} catch {}

if (-not $repoExists) {
  Write-Host "正在创建公开仓库 $repoFull ..." -ForegroundColor Yellow
  gh repo create $repoName --public --description "情侣浪漫网页 · 纯前端照片互动"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "创建仓库失败。" -ForegroundColor Red
    exit 1
  }
}

# 4. 配置 git remote
$remoteUrl = "https://github.com/$repoFull.git"
git remote remove origin 2>$null
git remote add origin $remoteUrl

# 5. 提交并推送
$status = git status --porcelain
if ($status) {
  git add .
  git commit -m "Update website"
}

Write-Host "正在推送到 GitHub ..." -ForegroundColor Yellow
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host "推送失败，请检查网络或登录状态。" -ForegroundColor Red
  exit 1
}

# 6. 启用 GitHub Pages（GitHub Actions 部署）
Write-Host "正在启用 GitHub Pages ..." -ForegroundColor Yellow
gh api -X PUT "repos/$repoFull/pages" -f build_type=workflow 2>$null
if ($LASTEXITCODE -ne 0) {
  gh api -X POST "repos/$repoFull/pages" -f build_type=workflow 2>$null
}

Write-Host ""
Write-Host "部署完成！" -ForegroundColor Green
Write-Host ""
Write-Host "网站地址（约 1～3 分钟后生效）：" -ForegroundColor Green
Write-Host "  $siteUrl" -ForegroundColor White
Write-Host ""
Write-Host "以后修改代码后，只需再运行一次：  .\deploy.ps1" -ForegroundColor Cyan
Write-Host ""
