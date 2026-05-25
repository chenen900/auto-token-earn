@echo off
schtasks /create /tn "AgentHansaWorker" /tr "node d:\自媒体运营\auto-token-earn\agent_hansa_worker.js" /sc hourly /mo 4 /st 00:00 /f
echo Done. Run "schtasks /query /tn AgentHansaWorker" to verify.
pause
