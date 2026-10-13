$targetDir = 'C:\Users\anish\Hermes-Agent-OS'
$desktopDir = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$wScript = New-Object -ComObject WScript.Shell

$lnk1Path = Join-Path $desktopDir 'Hermes Agent OS.lnk'
$shortcut1 = $wScript.CreateShortcut($lnk1Path)
$shortcut1.TargetPath = Join-Path $targetDir 'Hermes-Agent-OS.exe'
$shortcut1.WorkingDirectory = $targetDir
$shortcut1.Description = 'Hermes Agent OS - Autonomous Launcher and Multi-Window Cockpit'
$icoPath = Join-Path $targetDir 'hermes.ico'
if (Test-Path $icoPath) {
    $shortcut1.IconLocation = $icoPath + ', 0'
}
$shortcut1.Save()

$lnk2Path = Join-Path $desktopDir 'Hermes Kali Linux.lnk'
$shortcut2 = $wScript.CreateShortcut($lnk2Path)
$shortcut2.TargetPath = Join-Path $targetDir 'Launch-Kali-Terminal.bat'
$shortcut2.WorkingDirectory = $targetDir
$shortcut2.Description = 'Launch Interactive WSL2 Kali Linux Terminal Session'
if (Test-Path $icoPath) {
    $shortcut2.IconLocation = $icoPath + ', 0'
}
$shortcut2.Save()

Write-Host '[SUCCESS] Desktop shortcuts created successfully!' -ForegroundColor Green
Write-Host ('  Shortcut 1: ' + $lnk1Path) -ForegroundColor Cyan
Write-Host ('  Shortcut 2: ' + $lnk2Path) -ForegroundColor Cyan
