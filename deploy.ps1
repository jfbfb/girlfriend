# Deploy to GitHub Pages
# Usage: .\deploy.ps1   or double-click deploy.bat

$ErrorActionPreference = "Stop"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=== GitHub Pages Deploy ===" -ForegroundColor Magenta
Write-Host ""

$loggedIn = $true
try {
  gh auth status 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { $loggedIn = $false }
} catch {
  $loggedIn = $false
}

if (-not $loggedIn) {
  Write-Host "Please login to GitHub in the browser..." -ForegroundColor Yellow
  gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Login failed." -ForegroundColor Red
    exit 1
  }
}

$username = gh api user -q .login
if (-not $username) {
  Write-Host "Cannot get GitHub username." -ForegroundColor Red
  exit 1
}

$repoName = "girlfriend"
$repoFull = "$username/$repoName"
$siteUrl = "https://$username.github.io/$repoName/"

Write-Host "GitHub user: $username" -ForegroundColor Cyan
Write-Host "Repository:  $repoName" -ForegroundColor Cyan
Write-Host ""

$repoExists = $false
try {
  gh repo view $repoFull 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $repoExists = $true }
} catch {}

if (-not $repoExists) {
  Write-Host "Creating public repo $repoFull ..." -ForegroundColor Yellow
  gh repo create $repoName --public --description "Couple love gallery website"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create repository." -ForegroundColor Red
    exit 1
  }
}

$remoteUrl = "https://github.com/$repoFull.git"
git remote remove origin 2>$null
git remote add origin $remoteUrl

$status = git status --porcelain
if ($status) {
  git add .
  git commit -m "Update website"
}

Write-Host "Pushing to GitHub ..." -ForegroundColor Yellow
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host "Push failed. Check network or login." -ForegroundColor Red
  exit 1
}

Write-Host "Enabling GitHub Pages ..." -ForegroundColor Yellow
gh api -X PUT "repos/$repoFull/pages" -f build_type=workflow 2>$null
if ($LASTEXITCODE -ne 0) {
  gh api -X POST "repos/$repoFull/pages" -f build_type=workflow 2>$null
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host ""
Write-Host "Site URL (ready in 1-3 minutes):" -ForegroundColor Green
Write-Host "  $siteUrl" -ForegroundColor White
Write-Host ""
Write-Host "Run deploy.ps1 again after each update." -ForegroundColor Cyan
Write-Host ""
