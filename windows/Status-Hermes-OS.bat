@echo off
title HERMES AGENT OS - SERVICES STATUS
color 0e
echo [*] Checking Hermes Agent OS live subsystem status...
echo.
wsl.exe -d kali-linux /home/thecyberexpert/.gemini/antigravity/scratch/studio/scripts/manage-services.sh status
echo.
pause
