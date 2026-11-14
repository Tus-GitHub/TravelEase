/** Run against an isolated local production build. No account writes or mail. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const base = process.argv.find(x => x.startsWith('--base='))?.slice(7);
const modulePath = process.argv.find(x => x.startsWith('--browser-module='))?.slice(17);
assert(base && ['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local verification only: pass --base=http://127.0.0.1:PORT');
assert(modulePath, 'Pass --browser-module=PATH_TO_PLAYWRIGHT');
const { chromium } = require(modulePath);

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jagdamba-home-screen-'));
  let context;
  let flowBrowser;
  let checks = 0;
  try {
    // A disposable regular profile lets Chrome check install eligibility;
    // incognito contexts intentionally cannot install applications.
    context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    let page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/install', { waitUntil: 'networkidle' });
    const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
    const response = await context.request.get(base + manifestUrl);
    assert.equal(response.status(), 200);
    const manifest = await response.json();
    assert.equal(manifest.display, 'standalone'); assert.equal(manifest.id, '/'); assert.equal(manifest.start_url, '/'); assert.equal(manifest.scope, '/');
    for (const size of ['192x192', '512x512']) assert(manifest.icons.some(i => i.sizes === size));
    assert(manifest.icons.some(i => i.purpose === 'maskable'));
    for (const icon of manifest.icons) {
      const image = await context.request.get(base + icon.src); assert.equal(image.status(), 200);
      const bytes = await image.body(); assert.equal(bytes.readUInt32BE(0), 0x89504e47); assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
    }
    assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'), 'yes');
    const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    assert.equal((await context.request.get(base + apple)).status(), 200);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    assert(viewport.includes('viewport-fit=cover')); assert(!viewport.includes('user-scalable=no'));
    checks++; console.log('PASS manifest, standalone identity, PNG dimensions, maskable and Apple icons, safe areas and pinch zoom');

    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const devtools = await context.newCDPSession(page);
    const eligibility = await devtools.send('Page.getInstallabilityErrors');
    assert.deepEqual(eligibility.installabilityErrors, [], 'Chrome home-screen installability checks');
    await devtools.detach();
    const cached = await page.evaluate(async () => { const names = await caches.keys(); return (await Promise.all(names.filter(n => n.startsWith('jagdamba-shell-')).map(async n => (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname)))).flat(); });
    assert.deepEqual(cached.sort(), ['/offline.html', '/icons/app-192.png', '/icons/app-512.png', '/icons/app-maskable-512.png', '/icons/apple-touch-icon.png'].sort());
    const unauth = await page.evaluate(async () => { const r = await fetch('/api/bookings'); return { status: r.status, type: r.headers.get('content-type') }; });
    assert.equal(unauth.status, 401); assert(unauth.type.includes('application/json'));
    checks++; console.log('PASS worker caches only generic shell; account API preserves its authorization/JSON response');

    // Exercise a synthetic one-use event in a fresh incognito context so a
    // late native promotion cannot replace it. Native eligibility used the
    // regular profile above, without this substitution.
    await context.close();
    flowBrowser = await chromium.launch({ channel: 'chrome', headless: true });
    context = await flowBrowser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/install', { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.goto(base + '/help', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      window.__installJourney = 'pending';
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, { prompt: async () => { window.__installPrompts = (window.__installPrompts || 0) + 1; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
      window.dispatchEvent(event);
    });
    await page.waitForTimeout(150);
    // A client transition proves the provider retained the browser event.
    await page.locator('footer a[href="/install"]').click();
    await page.waitForURL('**/install');
    await page.waitForLoadState('networkidle');
    assert.equal(await page.evaluate(() => window.__installJourney), 'pending', 'Install guide uses client navigation');
    await page.getByRole('button', { name: 'Add to home screen', exact: true }).click();
    await page.waitForFunction(() => window.__installPrompts === 1);
    assert.equal(await page.evaluate(() => window.__installPrompts), 1);
    await page.getByRole('status').filter({ hasText: 'Installation requested' }).waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await page.getByText('You’re using the home-screen app.').waitFor();
    checks++; console.log('PASS browser install event survives navigation, prompts once on tap, and installed state updates');

    await context.setOffline(true);
    await page.goto(base + '/profile/bookings', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'You’re offline.' }).waitFor();
    assert.equal(await page.locator('body').innerText().then(t => /TE-|password|@example/.test(t)), false);
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.waitForURL(/login/);
    checks++; console.log('PASS offline private navigation shows generic fallback; reconnect/retry restores normal auth flow');
    for (const [width, height] of [[320,568], [360,800], [390,844], [430,932], [844,390]]) {
      await page.setViewportSize({ width, height });
      await page.goto(base + '/install', { waitUntil: 'networkidle' });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert(await page.getByRole('heading', { name: 'iPhone & iPad' }).isVisible());
      assert(await page.getByRole('heading', { name: 'Android', exact: true }).isVisible());
    }
    assert.deepEqual(errors, []);
    checks++; console.log('PASS phone/landscape install guide and zero browser runtime errors');
    console.log(`PASS ${checks} home-screen browser groups`);
  } finally {
    await context?.close();
    await flowBrowser?.close();
    assert(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep + 'jagdamba-home-screen-'));
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
