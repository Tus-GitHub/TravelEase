// Real React DOM in Chrome; compile the actual BookingFlow component. Network
// completions are controlled and deliberately ignore abort to exercise late responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

(async () => {
  const modulePath = process.argv.find(value => value.startsWith('--browser-module='))?.slice(17);
  assert(modulePath, 'Pass --browser-module=<installed Playwright module>');
  const { chromium } = require(modulePath);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ path: path.join(path.dirname(require.resolve('react/package.json')), 'umd/react.development.js') });
    await page.addScriptTag({ path: path.join(path.dirname(require.resolve('react-dom/package.json')), 'umd/react-dom.development.js') });
    const source = fs.readFileSync(path.resolve('src/components/booking/BookingFlow.tsx'), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
    await page.evaluate(compiled => {
      const requests = [];
      window.fetch = async (url, init) => {
        if (url === '/api/vehicle-types') return { ok: true, json: async () => ({ vehicleTypes: [{ id: 1, slug: 'sedan' }] }) };
        if (url !== '/api/quotes') throw Error(`Unexpected request ${url}`);
        return new Promise((resolve, reject) => { requests.push({ body: JSON.parse(init.body), signal: init.signal, resolve, reject }); });
      };
      const box = ({ children }) => React.createElement('div', null, children);
      const button = ({ children, href, onClick, type }) => React.createElement(href ? 'a' : 'button', { href, onClick, type }, children);
      const link = ({ children, href }) => React.createElement('a', { href }, children);
      const router = { push() {} };
      const imports = {
        react: React,
        'next/navigation': { useRouter: () => router, useSearchParams: () => new URLSearchParams() },
        'next/link': { __esModule: true, default: link },
        '@/components/common/Card': { __esModule: true, default: box },
        '@/components/common/Button': { __esModule: true, default: button },
        '@/context/AuthContext': { useAuth: () => ({ user: null, isLoading: false }) },
      };
      const module = { exports: {} };
      new Function('require', 'module', 'exports', compiled)(name => { if (!(name in imports)) throw Error(`Unexpected module ${name}`); return imports[name]; }, module, module.exports);
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(React.StrictMode, null, React.createElement(module.exports.default)));
      window.quoteHarness = { requests, root };
    }, compiled);
    const coupon = page.getByPlaceholder('e.g. WELCOME10');
    const pendingCount = async count => page.waitForFunction(count => window.quoteHarness.requests.length === count, count);
    const complete = async (index, amount, code, error = false) => page.evaluate(({ index, amount, code, error }) => {
      const payload = error ? { error: 'Quote unavailable' } : { quote: { subtotal: amount, taxAmount: 0, totalAmount: amount, currency: 'INR', breakdown: [{ label: `Quote ${code}`, amount }] }, coupon: { code, discountAmount: 10 } };
      window.quoteHarness.requests[index].resolve({ ok: !error, json: async () => payload });
    }, { index, amount, code, error });
    const total = amount => page.getByText(`₹${amount}`, { exact: true }).last();
    await pendingCount(1);
    await complete(0, 111, 'INITIAL'); await total(111).waitFor();
    await coupon.fill('OLD');
    await total(111).waitFor({ state: 'hidden' });
    await page.getByText('Calculating…', { exact: true }).waitFor();
    assert.equal(await page.getByText(/Code INITIAL applied/).count(), 0);
    await pendingCount(2);
    await coupon.fill('LATEST'); await pendingCount(3);
    assert(await page.evaluate(() => window.quoteHarness.requests[1].signal.aborted));
    await complete(2, 333, 'LATEST'); await total(333).waitFor();
    await complete(1, 222, 'OLD');
    // A new browser task runs after promise continuations / React updates.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
    assert.equal(await total(333).count(), 1);
    assert.equal(await page.getByText(/Code LATEST applied/).count(), 1);
    assert.equal(await page.getByText(/Code OLD applied/).count(), 0);
    console.log('PASS immediate quote/coupon invalidation, abort and out-of-order success');

    await coupon.fill('FAIL-OLD'); await pendingCount(4);
    await coupon.fill('WAIT-NEW'); await pendingCount(5);
    await page.evaluate(() => window.quoteHarness.requests[3].reject(Error('Late network failure')));
    await page.getByText('Calculating…', { exact: true }).waitFor();
    await complete(4, 555, 'WAIT-NEW'); await total(555).waitFor();
    console.log('PASS obsolete rejection/finally cannot clear current loading state');

    await coupon.fill('HTTP-OLD'); await pendingCount(6);
    await coupon.fill('HTTP-NEW'); await pendingCount(7);
    await complete(6, 777, 'HTTP-NEW'); await total(777).waitFor();
    await complete(5, 0, '', true);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
    assert.equal(await total(777).count(), 1);
    assert.equal(await page.getByText(/Code HTTP-NEW applied/).count(), 1);
    console.log('PASS obsolete HTTP failure cannot clear latest quote/coupon');

    await coupon.fill('REJECTED'); await pendingCount(8);
    await page.evaluate(() => window.quoteHarness.requests[7].resolve({ ok: true, json: async () => ({ quote: { totalAmount: 888, breakdown: [] }, couponError: 'Coupon rejected' }) }));
    await page.getByText('Coupon rejected', { exact: true }).waitFor();
    await coupon.fill('BAD-JSON');
    await page.getByText('Coupon rejected', { exact: true }).waitFor({ state: 'hidden' });
    await pendingCount(9);
    await page.evaluate(() => window.quoteHarness.requests[8].resolve({ ok: true, json: async () => { throw Error('Malformed JSON'); } }));
    await page.getByText('Fill in the trip details for a price.', { exact: true }).waitFor();
    assert.equal(await page.getByText(/Code .* applied/).count(), 0);
    console.log('PASS current malformed response recovers and old coupon errors are cleared');

    await coupon.fill('UNMOUNT'); await pendingCount(10);
    await page.evaluate(() => window.quoteHarness.root.unmount());
    assert(await page.evaluate(() => window.quoteHarness.requests[9].signal.aborted));
    await complete(9, 999, 'UNMOUNT');
    assert.equal(await page.locator('#root').textContent(), '');
    assert.deepEqual(errors, []);
    console.log('PASS unmount aborts pending quote; Strict Mode browser run has no runtime errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
