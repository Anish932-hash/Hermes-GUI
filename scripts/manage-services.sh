#!/usr/bin/env bash
# ==============================================================================
# HERMES AGENT OS — SERVICES CONTROLLER & DAEMON MANAGER (PERSISTENT & RESILIENT)
# Autonomous manager for Next.js Studio (3001), God's Eye Cesium (4173),
# and Hermes Gateway Daemon in WSL2 Kali Linux, bound to its private eth0 address.
# ==============================================================================

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:$PATH"

# Bind only to the WSL2 eth0 address instead of every interface. The Windows
# Electron bridge connects to this address; loopback-only binding would break it.
BIND_HOST="${HERMES_BIND_HOST:-$(ip -4 addr show eth0 2>/dev/null | awk '/inet / { print $2; exit }' | cut -d/ -f1)}"
if [[ ! "${BIND_HOST}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "[-] Could not determine WSL2 eth0 IPv4 address; refusing to bind services to all interfaces."
  exit 1
fi
export HERMES_BIND_HOST="${BIND_HOST}"

STUDIO_DIR="${HERMES_STUDIO_DIR:-${HOME}/.gemini/antigravity/scratch/studio}"
GODSEYE_DIR="${HERMES_GODSEYE_DIR:-${HOME}/gods-eye-view}"
HERMES_DIR="${HERMES_HOME:-${HOME}/.hermes}"
RUN_DIR="${HERMES_DIR}/run"
mkdir -p "${RUN_DIR}"

is_port_listening() {
  local port="$1"
  curl -s --max-time 1.5 -o /dev/null "http://${BIND_HOST}:${port}/" 2>/dev/null
}

start_studio() {
  if is_port_listening 3001; then
    echo "[ONLINE] Next.js Studio is already running on http://${BIND_HOST}:3001"
  else
    echo "[*] Starting Next.js Studio on ${BIND_HOST}:3001 (WSL interface only)..."
    tmux kill-session -t hermes-studio 2>/dev/null || true
    fuser -k 3001/tcp 2>/dev/null || true
    cd "${STUDIO_DIR}"
    if [ -d ".next" ]; then
      tmux new-session -d -s hermes-studio "cd '${STUDIO_DIR}' && HERMES_BIND_HOST='${BIND_HOST}' PORT=3001 npx next start -H '${BIND_HOST}' -p 3001 > '${RUN_DIR}/studio.log' 2>&1"
    else
      tmux new-session -d -s hermes-studio "cd '${STUDIO_DIR}' && HERMES_BIND_HOST='${BIND_HOST}' PORT=3001 npx next dev -H '${BIND_HOST}' -p 3001 --turbopack > '${RUN_DIR}/studio.log' 2>&1"
    fi

    # Fallback to direct nohup daemon if tmux is unavailable
    sleep 1
    if ! tmux has-session -t hermes-studio 2>/dev/null && ! is_port_listening 3001; then
      echo "[*] Tmux session absent; launching Next.js Studio via persistent nohup daemon..."
      nohup bash -c "cd '${STUDIO_DIR}' && HERMES_BIND_HOST='${BIND_HOST}' PORT=3001 npx next start -H '${BIND_HOST}' -p 3001" > "${RUN_DIR}/studio.log" 2>&1 &
      echo $! > "${RUN_DIR}/studio.pid"
    fi
    echo "[+] Next.js Studio initiated in persistent session."
  fi
}

start_godseye() {
  if is_port_listening 4173; then
    echo "[ONLINE] God's Eye Cesium Viewer is already running on http://${BIND_HOST}:4173"
  else
    echo "[*] Starting God's Eye Cesium Viewer on ${BIND_HOST}:4173 (WSL interface only)..."
    if [ -d "${GODSEYE_DIR}" ]; then
      tmux kill-session -t hermes-godseye 2>/dev/null || true
      fuser -k 4173/tcp 2>/dev/null || true
      tmux new-session -d -s hermes-godseye "cd '${GODSEYE_DIR}' && HERMES_BIND_HOST='${BIND_HOST}' npm run dev -- --host '${BIND_HOST}' --port 4173 > '${RUN_DIR}/godseye.log' 2>&1"

      sleep 1
      if ! tmux has-session -t hermes-godseye 2>/dev/null && ! is_port_listening 4173; then
        echo "[*] Tmux session absent; launching God's Eye Viewer via persistent nohup daemon..."
        nohup bash -c "cd '${GODSEYE_DIR}' && HERMES_BIND_HOST='${BIND_HOST}' npm run dev -- --host '${BIND_HOST}' --port 4173" > "${RUN_DIR}/godseye.log" 2>&1 &
        echo $! > "${RUN_DIR}/godseye.pid"
      fi
      echo "[+] God's Eye Cesium initiated in persistent session."
    else
      echo "[-] Warning: God's Eye directory not found at ${GODSEYE_DIR}"
    fi
  fi
}

start_gateway() {
  local gw_running=false
  local pidFile="${HERMES_DIR}/gateway.pid"
  if [ -f "${pidFile}" ]; then
    local pid=$(grep -o '"pid":\s*[0-9]*' "${pidFile}" | grep -o '[0-9]*' || true)
    if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
      gw_running=true
      echo "[ONLINE] Hermes Gateway Daemon is running (PID: ${pid})"
    fi
  fi

  if [ "${gw_running}" = false ]; then
    local pgrep_pid=$(pgrep -f "hermes_cli.*gateway run" | head -n 1 || true)
    if [ -n "${pgrep_pid}" ]; then
      echo "[ONLINE] Hermes Gateway Daemon active via pgrep (PID: ${pgrep_pid})"
      gw_running=true
    fi
  fi

  if [ "${gw_running}" = false ]; then
    echo "[*] Starting Hermes Gateway Daemon..."
    local pyBin="${HERMES_DIR}/tools/python-3.14.7+20260901-linux-x64/bin/python3"
    local cliBin="${HERMES_DIR}/hermes-agent/hermes_cli/main.py"
    if [ -x "${pyBin}" ] && [ -f "${cliBin}" ]; then
      tmux kill-session -t hermes-gateway 2>/dev/null || true
      tmux new-session -d -s hermes-gateway "cd '${HERMES_DIR}' && '${pyBin}' '${cliBin}' gateway run > '${RUN_DIR}/gateway.log' 2>&1"
      echo "[+] Hermes Gateway Daemon initiated."
    else
      echo "[-] Warning: Sandboxed Python or Hermes CLI not found."
    fi
  fi
}

wait_ready() {
  local timeout=${1:-30}
  local elapsed=0
  echo "[*] Waiting for services on ${BIND_HOST} (timeout: ${timeout}s)..."
  while [ ${elapsed} -lt ${timeout} ]; do
    if is_port_listening 3001 && is_port_listening 4173; then
      echo "[+] All services are ready! Studio: http://localhost:3001 | God's Eye: http://localhost:4173"
      curl -s -H 'Host: localhost:3001' -X POST http://${BIND_HOST}:3001/api/system/auto-setup >/dev/null 2>&1 || true
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "[-] Warning: Timeout waiting for all services, continuing anyway..."
}

stop_all() {
  echo "[*] Stopping Hermes Agent OS services..."
  tmux kill-session -t hermes-studio 2>/dev/null || true
  tmux kill-session -t hermes-godseye 2>/dev/null || true
  fuser -k 3001/tcp 2>/dev/null || true
  fuser -k 4173/tcp 2>/dev/null || true
  echo "[+] Services stopped successfully."
}

status_all() {
  echo "=== HERMES AGENT OS SERVICES STATUS ==="
  echo "Studio (port 3001):    $(is_port_listening 3001 && echo "ONLINE (http://localhost:3001)" || echo "OFFLINE")"
  echo "God's Eye (port 4173):  $(is_port_listening 4173 && echo "ONLINE (http://localhost:4173)" || echo "OFFLINE")"
  local gw_status="OFFLINE"
  local pgrep_pid=$(pgrep -f "hermes_cli.*gateway run" | head -n 1 || true)
  if [ -n "${pgrep_pid}" ]; then gw_status="ONLINE (PID: ${pgrep_pid})"; fi
  echo "Hermes Gateway Daemon:  ${gw_status}"
  echo "Active Tmux Sessions:   $(tmux ls 2>/dev/null | cut -d: -f1 | tr '\n' ' ' || echo 'none')"
  echo "======================================="
}

case "$1" in
  start)
    start_gateway
    start_godseye
    start_studio
    wait_ready 20
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    sleep 1
    start_gateway
    start_godseye
    start_studio
    wait_ready 20
    ;;
  status)
    status_all
    ;;
  wait)
    wait_ready "${2:-30}"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|wait}"
    exit 1
    ;;
esac
