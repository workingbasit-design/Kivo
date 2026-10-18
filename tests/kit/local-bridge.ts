import type { BrowserContext, Route } from '@playwright/test';

/**
 * Localhost bridge for the kit readability suite.
 *
 * The sandboxed Chromium build in this environment blocks direct localhost
 * navigations (Local Network Access checks), so `page.goto()` to a local
 * app server fails with ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS.
 *
 * This route-level bridge re-issues every loopback request from Node (which
 * has no such restriction) and fulfills the response back into the page, so
 * the app renders and behaves identically from the test's point of view:
 * cookies, redirects, POST bodies and streaming HTML all pass through.
 *
 * Only active when KIT_LOCAL_BRIDGE=1, and only for loopback URLs —
 * every other request continues through the browser untouched.
 */
export async function enableLocalhostBridge(
  context: BrowserContext,
): Promise<void> {
  await context.route('**/*', async (route: Route) => {
    const req = route.request();
    let hostname = '';
    try {
      hostname = new URL(req.url()).hostname;
    } catch {
      await route.continue();
      return;
    }
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
      await route.continue();
      return;
    }
    try {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers())) {
        const lk = k.toLowerCase();
        if (lk === 'host' || lk === 'connection' || lk === 'content-length') continue;
        headers[k] = v;
      }
      const postData = req.postDataBuffer();
      const res = await fetch(req.url(), {
        method: req.method(),
        headers,
        body: postData ? new Uint8Array(postData) : undefined,
        redirect: 'manual',
      });
      const buf = Buffer.from(await res.arrayBuffer());
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        const lk = k.toLowerCase();
        if (
          lk === 'content-encoding' ||
          lk === 'content-length' ||
          lk === 'transfer-encoding'
        )
          return;
        resHeaders[k] = v;
      });
      await route.fulfill({ status: res.status, headers: resHeaders, body: buf });
    } catch {
      await route.abort('failed');
    }
  });
}
