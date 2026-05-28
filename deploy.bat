@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === 情侣网页 · GitHub Pages 部署 ===
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
echo.
pause
