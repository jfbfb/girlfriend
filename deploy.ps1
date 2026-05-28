# Deploy to GitHub Pages
# Usage: .\deploy.ps1   or double-click deploy.bat

$ErrorActionPreference = "Stop"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Set-Location $PSScriptRoot

function Invoke-Gh {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & gh @Args
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  return $code
}

Write-Host ""
Write-Host "=== GitHub Pages Deploy ===" -ForegroundColor Magenta
Write-Host ""

$loggedIn = $true
if ((Invoke-Gh auth status) -ne 0) { $loggedIn = $false }

if (-not $loggedIn) {
  Write-Host "Please login to GitHub in the browser..." -ForegroundColor Yellow
  if ((Invoke-Gh auth login --hostname github.com --git-protocol https --web) -ne 0) {
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

if ((Invoke-Gh repo view $repoFull) -ne 0) {
  Write-Host "Creating public repo $repoFull ..." -ForegroundColor Yellow
  if ((Invoke-Gh repo create $repoName --public --description "Couple love gallery website") -ne 0) {
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
$pagesEnabled = $false
if ((Invoke-Gh api repos/$repoFull/pages) -eq 0) {
  $pagesEnabled = $true
} else {
  if ((Invoke-Gh api --method POST repos/$repoFull/pages -f build_type=workflow) -eq 0) {
    $pagesEnabled = $true
  }
}

if (-not $pagesEnabled) {
  Write-Host "Pages API setup skipped. Enable manually:" -ForegroundColor Yellow
  Write-Host "  https://github.com/$repoFull/settings/pages" -ForegroundColor Yellow
  Write-Host "  Source -> GitHub Actions" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host ""
Write-Host "Site URL (ready in 1-3 minutes):" -ForegroundColor Green
Write-Host "  $siteUrl" -ForegroundColor White
Write-Host ""
Write-Host "Run deploy.ps1 again after each update." -ForegroundColor Cyan
Write-Host ""
