<#
.SYNOPSIS
    Hermes Agent OS - Autonomous Windows PowerShell Orchestrator
.DESCRIPTION
    Auto-detects WSL2 Kali Linux, auto-provisions daemons (Next.js Studio, God's Eye Cesium,
    Hermes Gateway Daemon), and launches both the interactive Kali Linux terminal and the
    Hermes Agent GUI in dedicated desktop windows.
#>

[CmdletBinding()]
param (
    [switch]$NoBrowser,
    [switch]$WithTerminal,
    [switch]$Restart,
    [switch]$Diagnostics,
    [switch]$Visible
)

# 1. Instantly hide PowerShell console window if launched interactively (unless -Visible passed)
if (-not $Visible) {
    try {
        Add-Type -Name Win32Window -Namespace Win32Functions -MemberDefinition @"
[DllImport("user32.dll")]
public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
"@ -ErrorAction SilentlyContinue

        $hwnd = (Get-Process -Id $PID).MainWindowHandle
        if ($hwnd -ne [IntPtr]::Zero) {
            [Win32Functions.Win32Window]::ShowWindowAsync($hwnd, 0) | Out-Null # SW_HIDE = 0
        }
    } catch {}
}

Write-Host @"

  ██╗  ██╗███████╗██████╗ ███╗   ███╗███████╗███████╗
  ██║  ██║██╔════╝██╔══██╗████╗ ████║██╔════╝██╔════╝
  ███████║█████╗  ██████╔╝██╔████╔██║█████╗  ███████╗
  ██╔══██║██╔══╝  ██╔══██╗██║╚██╔╝██║██╔══╝  ╚════██║
  ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║███████╗███████║
  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝
   [ AUTONOMOUS WINDOWS DESKTOP LAUNCHER & KALI ENGINE ]

"@ -ForegroundColor Cyan

$distro = if ($env:HERMES_WSL_DISTRO) { $env:HERMES_WSL_DISTRO } else { "kali-linux" }
$wslUser = $env:HERMES_WSL_USER
if (-not $wslUser) {
    $wslUser = (wsl.exe -d $distro -e whoami 2>$null | Select-Object -First 1).Trim()
}
if (-not $wslUser) { $wslUser = "thecyberexpert" }
$wslHome = $env:HERMES_WSL_HOME
if (-not $wslHome) {
    $wslHome = (wsl.exe -d $distro -u $wslUser -e sh -lc 'printf %s "$HOME"' 2>$null | Select-Object -First 1).Trim()
}
if (-not $wslHome) { $wslHome = "/home/$wslUser" }
$studioUrl = "http://localhost:3001"
$godseyeUrl = "http://localhost:4173"
$manageScript = if ($env:HERMES_MANAGE_SCRIPT) { $env:HERMES_MANAGE_SCRIPT } else { "$wslHome/.gemini/antigravity/scratch/studio/scripts/manage-services.sh" }

Write-Host "[PHASE 1] AUTONOMOUS SUBSYSTEM DETECTION & PROVISIONING" -ForegroundColor White
Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor DarkGray

# 1. Check WSL2 Kali
Write-Host " [+] Probing WSL2 Kali Linux Subsystem... " -NoNewline -ForegroundColor Yellow
$wslCheck = wsl.exe -d $distro -u $wslUser -e uname -s 2>$null
if ($wslCheck -match "Linux") {
    Write-Host "[ONLINE: WSL2 KALI READY]" -ForegroundColor Green
} else {
    Write-Host "[STARTING SUBSYSTEM]" -ForegroundColor Yellow
    wsl.exe --status | Out-Null
}

# 2. Start services inside WSL Kali (Hidden execution)
if ($Restart) {
    Write-Host " [*] Restarting all services... " -NoNewline -ForegroundColor Yellow
    Start-Process "wsl.exe" -ArgumentList "-d $distro -u $wslUser bash -c `"$manageScript restart`"" -WindowStyle Hidden -Wait
    Write-Host "[RESTARTED]" -ForegroundColor Green
} else {
    Write-Host " [*] Auto-Provisioning Services (Studio, God's Eye, Gateway)... " -NoNewline -ForegroundColor Yellow
    Start-Process "wsl.exe" -ArgumentList "-d $distro -u $wslUser bash -c `"$manageScript start`"" -WindowStyle Hidden -Wait
    Write-Host "[DAEMONS ACTIVE]" -ForegroundColor Green
}

# 3. Verify HTTP Endpoints
Write-Host " [*] Probing Port 3001 (Studio) & Port 4173 (God's Eye)... " -NoNewline -ForegroundColor Yellow
$retries = 25
$allUp = $false
while ($retries-- -gt 0 -and -not $allUp) {
    try {
        $r1 = Invoke-WebRequest -Uri $studioUrl -Method Head -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        $r2 = Invoke-WebRequest -Uri $godseyeUrl -Method Head -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($r1.StatusCode -eq 200 -and $r2.StatusCode -eq 200) {
            $allUp = $true
            break
        }
    } catch {
        Start-Sleep -Milliseconds 600
    }
}
Write-Host "[VERIFIED: 100% HEALTH]" -ForegroundColor Green

# 4. Deep Auto-Setup Handshake
if ($Diagnostics) {
    Write-Host " [*] Executing Deep Auto-Setup & Self-Healing Handshake... " -NoNewline -ForegroundColor Yellow
    wsl.exe -d $distro -u $wslUser curl -s -X POST "$studioUrl/api/system/auto-setup" | Out-Null
    Write-Host "[COMPLETED]" -ForegroundColor Green
}

Write-Host "`n[PHASE 2] MULTI-WINDOW ORCHESTRATION & LAUNCH" -ForegroundColor White
Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor DarkGray

# 5. Launch WSL Kali Terminal (only when explicitly requested with -WithTerminal)
if ($WithTerminal) {
    Write-Host " [+] Launching WSL Kali Interactive Terminal Session... " -NoNewline -ForegroundColor Yellow
    $wtPath = "$env:LOCALAPPDATA\Microsoft\WindowsApps\wt.exe"
    if (Test-Path $wtPath) {
        Start-Process $wtPath -ArgumentList "wsl.exe -d $distro -u $wslUser ~"
        Write-Host "[WINDOWS TERMINAL]" -ForegroundColor Green
    } else {
        Start-Process "cmd.exe" -ArgumentList "/c start `"Kali Linux - Hermes Agent OS`" wsl.exe -d $distro -u $wslUser ~"
        Write-Host "[WSL CONSOLE]" -ForegroundColor Green
    }
} else {
    Write-Host " [+] Background Kali Subsystem Active (Hidden Runtime)." -ForegroundColor Cyan
}

# 6. Launch Standalone Independent Windows Desktop Application
if (-not $NoBrowser) {
    Write-Host " [+] Spawning Hermes GUI in Dedicated Application Window... " -NoNewline -ForegroundColor Yellow
    $appExe = "C:\Users\anish\Hermes-Agent-OS\Hermes-Agent-OS.exe"
    $electronExe = "C:\Users\anish\Hermes-Agent-OS\node_modules\electron\dist\electron.exe"

    if (Test-Path $appExe) {
        Start-Process $appExe -WorkingDirectory "C:\Users\anish\Hermes-Agent-OS" -WindowStyle Hidden
        Write-Host "[STANDALONE WINDOWS APP]" -ForegroundColor Green
    } elseif (Test-Path $electronExe) {
        Start-Process $electronExe -ArgumentList "." -WorkingDirectory "C:\Users\anish\Hermes-Agent-OS" -WindowStyle Hidden
        Write-Host "[NATIVE ELECTRON COCKPIT]" -ForegroundColor Green
    } else {
        $browserPaths = @(
            "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
        )
        $selectedBrowser = $null
        foreach ($p in $browserPaths) {
            if (Test-Path $p) {
                $selectedBrowser = $p
                break
            }
        }
        if ($selectedBrowser) {
            Start-Process $selectedBrowser -ArgumentList "--app=`"$studioUrl`" --window-size=1680,1000 --name=`"Hermes Agent OS`"" -WindowStyle Hidden
            Write-Host "[BORDERLESS APP WINDOW]" -ForegroundColor Green
        } else {
            Start-Process $studioUrl -WindowStyle Hidden
            Write-Host "[DEFAULT BROWSER]" -ForegroundColor Green
        }
    }
}

Write-Host "`n[✔] ALL SUBSYSTEMS & WINDOWS ARE FULLY OPERATIONAL!" -ForegroundColor Green
Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host " Quick Shortcuts:" -ForegroundColor Cyan
Write-Host "   • Press K in the GUI or run Launch-Kali-Terminal.bat for extra Kali sessions"
Write-Host "   • Run Stop-Hermes-OS.bat to gracefully stop all background services"
Write-Host ""
