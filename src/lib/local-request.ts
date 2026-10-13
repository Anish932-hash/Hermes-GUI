const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Restrict local-control APIs to loopback Host headers and same-origin browser
 * requests. This is a defense-in-depth check; services should also bind only
 * to the WSL interface address, never 0.0.0.0.
 */
export function isLocalRequest(req: Request): boolean {
  const hostHeader = req.headers.get("host");
  if (!hostHeader) return false;

  let requestUrl: URL;
  try {
    requestUrl = new URL(`http://${hostHeader}`);
  } catch {
    return false;
  }

  const requestHost = requestUrl.hostname.toLowerCase();
  if (!LOOPBACK_HOSTS.has(requestHost)) return false;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") return false;
      if (!LOOPBACK_HOSTS.has(originUrl.hostname.toLowerCase())) return false;
      if (originUrl.host.toLowerCase() !== hostHeader.toLowerCase()) return false;
    } catch {
      return false;
    }
  }

  return true;
}
