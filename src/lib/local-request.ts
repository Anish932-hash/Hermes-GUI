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

  // A Host header is an authority, not a URL. Reject paths, credentials, query
  // strings, and fragments rather than accepting a parsed localhost hostname.
  if (requestUrl.pathname !== '/' || requestUrl.search || requestUrl.hash || requestUrl.username || requestUrl.password) return false;

  const requestHost = requestUrl.hostname.toLowerCase();
  if (!LOOPBACK_HOSTS.has(requestHost)) return false;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") return false;
      if (originUrl.pathname !== '/' || originUrl.search || originUrl.hash || originUrl.username || originUrl.password) return false;
      if (!LOOPBACK_HOSTS.has(originUrl.hostname.toLowerCase())) return false;
      if (originUrl.host.toLowerCase() !== hostHeader.toLowerCase()) return false;
    } catch {
      return false;
    }
  }

  return true;
}
