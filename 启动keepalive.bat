@echo off
REM 启动无头 keepalive（后台运行，无需浏览器）
REM 双击此文件即可启动，关闭窗口即停止
cd /d "%~dp0"
echo === MediaCraft Keepalive ===
echo Render 防休眠后台进程
echo 保持此窗口打开即可
echo.
node headless_keepalive.js
pause
