@echo off
title HERMES AGENT OS - Autonomous Desktop Application Launcher
cd /d "%~dp0"

:: Check if electron exists locally
if exist "node_modules\electron\dist\electron.exe" (
    start "" "node_modules\electron\dist\electron.exe" .
    exit /b 0
)

if exist "Hermes-Agent-OS.exe" (
    start "" "Hermes-Agent-OS.exe"
    exit /b 0
)

:: Fallback to npx electron
start "" cmd.exe /c "call npx electron ."
exit /b 0
