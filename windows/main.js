const { app, BrowserWindow, Menu, Tray, shell, session, desktopCapturer } = require('electron');
const path = require('path');
const { execFile, execFileSync, spawn } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let wslKeepAliveChild = null;
let studioBridge = null;
let godseyeBridge = null;

const DISTRO = 'kali-linux';
const STUDIO_PORT = 3001;
const STUDIO_URL = 'http://127.0.0.1:3001';
const MANAGE_SCRIPT = '/home/thecyberexpert/.gemini/antigravity/scratch/studio/scripts/manage-services.sh';

// Query WSL eth0 IP early to register origin as secure in Chromium
let wslIpCached = null;
try {
  const ipOut = execFileSync(
    'wsl.exe',
    ['-d', DISTRO, '-u', 'thecyberexpert', 'bash', '-c', "ip -4 addr show eth0 | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){3}' | head -n 1"],
    { timeout: 3500, windowsHide: true }
  );
  const ip = ipOut.toString().trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    wslIpCached = ip;
  }
} catch {}

// 1. Configure audio autoplay policy & hardware flags before app ready
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-features', 'AudioServiceOutOfProcess,WebRtcHideLocalIpsWithMdns');
app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('ignore-certificate-errors');

// 2. Crucial: Treat all WSL local endpoints as Secure Contexts to unlock navigator.mediaDevices & microphone APIs
const secureOrigins = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];
if (wslIpCached) {
  secureOrigins.push(`http://${wslIpCached}:3001`);
  secureOrigins.push(`http://${wslIpCached}:4173`);
}
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', secureOrigins.join(','));

// 3. Set application identity for Windows taskbar grouping
app.setAppUserModelId('com.hermes.agent.os');

// 4. Single instance lock (focus existing window if re-launched)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateSplash(step, text) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      if (typeof window.updateBootProgress === 'function') {
        window.updateBootProgress(${step}, ${JSON.stringify(text)});
      }
    `).catch(() => {});
  }
}

// Resilient HTTP socket probe (non-pooled agent, stream discarded to prevent socket leaks)
function probeHttp(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.get(
        {
          hostname: u.hostname,
          port: u.port || 80,
          path: u.pathname || '/',
          timeout: timeoutMs,
          agent: false,
        },
        (res) => {
          res.resume(); // Flush incoming bytes to free socket instantly
          resolve(res.statusCode < 500);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

// Execute command in WSL2 Kali directly via execFile (0 shell processes, no cmd.exe/powershell.exe popups)
function executeWslCommand(cmd) {
  return new Promise((resolve) => {
    execFile(
      'wsl.exe',
      ['-d', DISTRO, '-u', 'thecyberexpert', 'bash', '-c', cmd],
      {
        timeout: 40000,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err) {
          // Fallback: try default WSL without -d if DISTRO name differed
          execFile(
            'wsl.exe',
            ['-u', 'thecyberexpert', 'bash', '-c', cmd],
            { timeout: 35000, windowsHide: true },
            (err2, stdout2, stderr2) => {
              resolve({ success: !err2, stdout: stdout2 || stdout, stderr: stderr2 || stderr });
            }
          );
          return;
        }
        resolve({ success: true, stdout, stderr });
      }
    );
  });
}

// Hidden zero-overhead WSL2 Keep-Alive process to prevent WSL from terminating while app is running
function startWslKeepAlive() {
  if (wslKeepAliveChild) return;
  try {
    wslKeepAliveChild = spawn(
      'wsl.exe',
      ['-d', DISTRO, '-u', 'thecyberexpert', 'bash', '-c', 'while true; do sleep 3600; done'],
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }
    );
    wslKeepAliveChild.unref();
  } catch (err) {
    console.warn('WSL keep-alive spawn notice:', err.message);
  }
}

// Launch Kali interactive terminal (on user demand only: Ctrl+K, tray menu, or UI button)
function launchKaliTerminal() {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\anish', 'AppData', 'Local');
  const wtPath = path.join(localAppData, 'Microsoft', 'WindowsApps', 'wt.exe');

  try {
    if (fs.existsSync(wtPath)) {
      const child = spawn(wtPath, ['wsl.exe', '-d', DISTRO, '-u', 'thecyberexpert', '~'], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } else {
      const child = spawn('cmd.exe', ['/c', 'start', 'Kali Linux - Hermes Agent OS', 'wsl.exe', '-d', DISTRO, '-u', 'thecyberexpert', '~'], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }
  } catch (err) {
    console.error('Failed to launch Kali terminal:', err);
  }
}

// Transparent local TCP bridge from 127.0.0.1 on Windows host -> WSL eth0 IP
// Unlocks window.isSecureContext === true and provides 100% reliable localhost access for microphone
function setupLocalBridge(wslIp) {
  if (!wslIp) return;

  if (!studioBridge) {
    try {
      studioBridge = net.createServer((clientSocket) => {
        const wslSocket = net.connect({ host: wslIp, port: 3001 }, () => {
          clientSocket.pipe(wslSocket);
          wslSocket.pipe(clientSocket);
        });
        wslSocket.on('error', () => clientSocket.destroy());
        clientSocket.on('error', () => wslSocket.destroy());
      });
      studioBridge.on('error', () => {});
      studioBridge.listen(3001, '127.0.0.1', () => {
        console.log(`[SECURE BRIDGE] 127.0.0.1:3001 -> ${wslIp}:3001`);
      });
    } catch {}
  }

  if (!godseyeBridge) {
    try {
      godseyeBridge = net.createServer((clientSocket) => {
        const wslSocket = net.connect({ host: wslIp, port: 4173 }, () => {
          clientSocket.pipe(wslSocket);
          wslSocket.pipe(clientSocket);
        });
        wslSocket.on('error', () => clientSocket.destroy());
        clientSocket.on('error', () => wslSocket.destroy());
      });
      godseyeBridge.on('error', () => {});
      godseyeBridge.listen(4173, '127.0.0.1', () => {
        console.log(`[SECURE BRIDGE] 127.0.0.1:4173 -> ${wslIp}:4173`);
      });
    } catch {}
  }
}

// Multi-candidate server detector (prioritizes 127.0.0.1 and localhost for Secure Context audio)
async function waitForServer(maxAttempts = 35) {
  let wslIp = wslIpCached;
  if (!wslIp) {
    try {
      const ipRes = await executeWslCommand("ip -4 addr show eth0 | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){3}' | head -n 1");
      if (ipRes.success && ipRes.stdout) {
        const parsed = ipRes.stdout.trim();
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(parsed)) {
          wslIp = parsed;
        }
      }
    } catch {}
  }

  if (wslIp) {
    setupLocalBridge(wslIp);
  }

  const candidateUrls = [STUDIO_URL, 'http://localhost:3001'];
  if (wslIp) {
    candidateUrls.push(`http://${wslIp}:3001`);
  }

  for (let i = 0; i < maxAttempts; i++) {
    for (const url of candidateUrls) {
      const up = await probeHttp(url);
      if (up) return url;
    }

    // Auto-heal: If server still not responsive after 10 attempts (~7s), trigger start again
    if (i === 10) {
      updateSplash(2, 'AUTO-HEALING: RE-ENGAGING STUDIO DAEMONS...');
      executeWslCommand(`${MANAGE_SCRIPT} start`).catch(() => {});
    }

    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

// Background environment orchestrator (fully hidden WSL processes)
async function initializeHermesEnvironment() {
  updateSplash(1, 'PROBING WSL2 KALI SUBSYSTEM...');
  await executeWslCommand('uname -s');
  updateSplash(1, 'WSL2 KALI SUBSYSTEM CONFIRMED.');

  updateSplash(2, 'AUTO-PROVISIONING DAEMONS (STUDIO, CESIUM, GATEWAY)...');
  await executeWslCommand(`${MANAGE_SCRIPT} start`);
  updateSplash(2, 'DAEMONS INITIALIZED IN PERSISTENT SESSIONS.');

  updateSplash(3, 'ENGAGING KALI ENGINE PERSISTENCE (HIDDEN RUNTIME)...');
  startWslKeepAlive();
  updateSplash(3, 'KALI SUBSYSTEM PERSISTENCE ENGAGED.');

  updateSplash(4, 'VALIDATING LOCAL SOCKET (PORT 3001)...');
  const activeUrl = await waitForServer(35);

  if (activeUrl) {
    updateSplash(4, 'NEURAL COCKPIT ACTIVE. ENGAGING...');
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`${activeUrl}?electron=1&skipBoot=1`);
      }
    }, 450);
  } else {
    // Self-healing fallback attempt: Restart services and wait once more
    updateSplash(2, 'AUTO-REPAIRING: RE-STARTING SUBSYSTEM DAEMONS...');
    await executeWslCommand(`${MANAGE_SCRIPT} restart`);
    const retryUrl = await waitForServer(25);
    if (retryUrl && mainWindow && !mainWindow.isDestroyed()) {
      updateSplash(4, 'NEURAL COCKPIT ACTIVE. ENGAGING...');
      setTimeout(() => {
        mainWindow.loadURL(`${retryUrl}?electron=1&skipBoot=1`);
      }, 450);
    } else {
      updateSplash(4, 'FALLBACK: ENGAGING COCKPIT AT 127.0.0.1:3001...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`${STUDIO_URL}?electron=1&skipBoot=1`);
      }
    }
  }
}

function createTray() {
  const icoPath = path.join(__dirname, 'hermes.ico');
  if (!fs.existsSync(icoPath)) return;

  try {
    tray = new Tray(icoPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'HERMES AGENT OS — STARK MARK-XV',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Open Cockpit Window',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Spawn Kali Linux Terminal [Ctrl+K]',
        click: () => launchKaliTerminal(),
      },
      {
        label: 'Toggle Fullscreen HUD [F11]',
        click: () => {
          if (mainWindow) {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        },
      },
      {
        label: 'Restart Subsystems & Daemons',
        click: () => {
          if (mainWindow) {
            mainWindow.loadFile(path.join(__dirname, 'splash.html')).catch(() => {});
            updateSplash(2, 'RESTARTING ALL DAEMONS & SERVICES...');
          }
          executeWslCommand(`${MANAGE_SCRIPT} restart`).then(() => {
            waitForServer(30).then((url) => {
              if (url && mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.loadURL(`${url}?electron=1&skipBoot=1`);
              }
            });
          });
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Hermes OS',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip('HERMES AGENT OS — Neural HUD & Kali Subsystem');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.warn('System tray registration notice:', err.message);
  }
}

function createWindow() {
  const icoPath = path.join(__dirname, 'hermes.ico');

  mainWindow = new BrowserWindow({
    width: 1680,
    height: 1000,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#03060c',
    title: 'HERMES AGENT OS — STARK MARK-XV',
    icon: fs.existsSync(icoPath) ? icoPath : undefined,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the offline cybernetic splash bootloader first
  mainWindow.loadFile(path.join(__dirname, 'splash.html'));

  // Keyboard accelerators for the native Windows application
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F11') {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
        event.preventDefault();
      } else if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
        mainWindow.reload();
        event.preventDefault();
      } else if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      } else if (input.control && input.key.toLowerCase() === 'k') {
        launchKaliTerminal();
        event.preventDefault();
      }
    }
  });

  // Handle external link clicks (allow God's Eye port 4173 & Studio port 3001)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith('http://localhost:4173') ||
      url.startsWith('http://127.0.0.1:4173') ||
      url.startsWith('http://localhost:3001') ||
      url.startsWith('http://127.0.0.1:3001')
    ) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle network / loading errors gracefully with active self-healing (NEVER stuck on blank)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.includes('3001')) {
      console.warn('Endpoint temporarily offline, self-healing services in background...', errorDescription);
      try {
        mainWindow.loadFile(path.join(__dirname, 'splash.html')).then(() => {
          updateSplash(2, 'SELF-HEALING DAEMONS: STARTING NEXT.JS (PORT 3001)...');
        }).catch(() => {});
      } catch {}

      // Automatically re-kick daemons in background
      executeWslCommand(`${MANAGE_SCRIPT} start`).then(() => {
        waitForServer(30).then((liveUrl) => {
          if (liveUrl && mainWindow && !mainWindow.isDestroyed()) {
            updateSplash(4, 'NEURAL COCKPIT ACTIVE. ENGAGING...');
            setTimeout(() => {
              mainWindow.loadURL(`${liveUrl}?electron=1&skipBoot=1`);
            }, 450);
          }
        });
      });
    }
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      app.isQuitting = true;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Begin background initialization
  initializeHermesEnvironment();
}

app.whenReady().then(() => {
  // 1. Grant media & microphone permissions automatically
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => true);

  // 2. Implement displayMedia handler for Windows Host Desktop Audio loopback capture
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => {
        if (sources && sources.length > 0) {
          callback({ video: sources[0], audio: 'loopback' });
        } else {
          callback({});
        }
      })
      .catch(() => {
        callback({});
      });
  });

  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (studioBridge) {
    try { studioBridge.close(); } catch {}
  }
  if (godseyeBridge) {
    try { godseyeBridge.close(); } catch {}
  }
  if (wslKeepAliveChild && !wslKeepAliveChild.killed) {
    try {
      wslKeepAliveChild.kill();
    } catch {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
