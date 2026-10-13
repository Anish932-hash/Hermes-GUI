Set WshShell = CreateObject("WScript.Shell")
' Launch Hermes-Launcher.ps1 with window style 0 (SW_HIDE) - guarantees ZERO console popups or flashes
WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File ""C:\Users\anish\Hermes-Agent-OS\Hermes-Launcher.ps1""", 0, False
