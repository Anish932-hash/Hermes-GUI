@echo off
title STOP HERMES AGENT OS
color 0c
echo [*] Gracefully stopping all Hermes Agent OS background services...
wsl.exe -d kali-linux /home/thecyberexpert/.gemini/antigravity/scratch/studio/scripts/manage-services.sh stop
echo [✔] All services stopped successfully.
timeout /t 2 >nul
