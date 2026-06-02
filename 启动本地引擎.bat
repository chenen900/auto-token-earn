@echo off
REM MediaCraft AI 本地引擎 — 高质量自主赚钱
REM 双击启动，保持窗口开着。关闭即停止。
cd /d "%~dp0"
echo ==========================================
echo   MediaCraft AI 本地赚钱引擎
echo   高质量模式：每次投标前分析历史胜率
echo ==========================================
echo.
echo [1/3] 启动 AgentHansa Daemon（核心赚钱）...
start "AgentHansa" cmd /c "node daemon_simple.js"
echo [2/3] 启动 Headless Keepalive（防 Render 休眠）...
start "Keepalive" cmd /c "node headless_keepalive.js"
echo [3/3] 启动任务扫描器（每 15 分钟扫 Pinchwork/Superteam/Toku）...
start "TaskScanner" cmd /c "node local_task_scanner.js"
echo.
echo 三个窗口已启动。不要关闭此窗口。
echo 打开 dashboard.html 查看实时状态。
echo.
pause
