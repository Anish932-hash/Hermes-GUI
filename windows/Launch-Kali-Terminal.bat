@echo off
title KALI LINUX - HERMES AGENT OS TERMINAL
where wt.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start "" wt.exe wsl.exe -d kali-linux -u thecyberexpert ~
) else (
    start "Kali Linux - Hermes Agent OS" wsl.exe -d kali-linux -u thecyberexpert ~
)
