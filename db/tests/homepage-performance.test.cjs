/** Read-only browser checks against an isolated local production build.
 * node db/tests/homepage-performance.test.cjs --base=http://127.0.0.1:3242 --browser-module=PATH_TO_PLAYWRIGHT
 * Optional --engine=webkit; install that engine through your normal browser tooling.
 */
const assert = require('node:assert/strict');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const base = arg('base'), modulePath = arg('browser-module'), engine = arg('engine') || 'chromium';
assert(base && ['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local verification only');
assert(modulePath, 'Pass --browser-module=PATH_TO_PLAYWRIGHT');
const playwright = require(modulePath);

(async () => {
  const browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: 'chrome' } : {}) });
  let checks = 0;
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      for (const colorScheme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
        await context.addInitScript(() => {
          window.__webgl = 0;
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (type, ...args) {
            if (String(type).includes('webgl')) window.__webgl++;
            return original.call(this, type, ...args);
          };
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const response = await page.goto(base, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        await page.locator('main h1').waitFor();
        assert(await page.locator('main h1').isVisible());
        assert.equal(await page.locator('canvas').count(), 0, 'Homepage should not start a GPU/particle canvas');
        assert.equal(await page.evaluate(() => window.__webgl), 0);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis')), false);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px overflow`);
        assert(await page.locator('[data-hero="stats"] dt').evaluateAll(nodes => nodes.every(node => {
          const range = document.createRange(); range.selectNodeContents(node);
          const text = range.getBoundingClientRect(), cell = node.getBoundingClientRect();
          return text.left >= cell.left - 1 && text.right <= cell.right + 1;
        })), `${width}px hero labels must stay inside their columns`);
        assert.equal(await page.locator('[aria-busy="true"]').count(), 0, 'Catalogue must finish streaming');
        assert(await page.locator('[data-hero="cta"] a').count() >= 1);
        const cta = page.locator('[data-hero="cta"] a').first();
        const href = await cta.getAttribute('href');
        assert(href?.startsWith('/'));
        await page.mouse.move(width / 2, 600);
        await page.mouse.wheel(0, 600);
        await page.waitForFunction(() => scrollY > 100);
        await page.waitForFunction(() => {
          const bar = document.querySelector('[data-scroll-progress]');
          return bar && parseFloat(bar.style.transform.slice(7)) > 0;
        });
        // Streamed page geometry and native scroll must agree at the bottom.
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
        await page.waitForFunction(() => parseFloat(document.querySelector('[data-scroll-progress]').style.transform.slice(7)) > 0.99);
        await cta.click();
        await page.waitForURL(url => url.pathname === new URL(href, base).pathname);
        await page.locator('.site-page-content h1, .site-page-content h2').first().waitFor();
        assert.deepEqual(errors, [], `${width}px ${colorScheme} browser errors`);
        console.log(`PASS ${engine} ${width}px ${colorScheme}: visible hero, no canvas/WebGL, native scroll, streamed content, CTA navigation`);
        checks++;
        await context.close();
      }
    }
    console.log(`${checks} browser groups passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
