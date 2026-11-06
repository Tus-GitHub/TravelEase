// Isolated development Next server for booking acceptance. Credentials arrive
// only in the child environment; outbound mail goes to the parent loopback sink.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const next = require('next');

(async () => {
  assert(process.env.BOOKING_SMOKE_SERVER === 'dev-only' && !process.env.VERCEL);
  assert.equal(process.env.SMTP_HOST, '127.0.0.1');
  const root = process.cwd();
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'travel-booking-acceptance-'));
  process.send?.({ sandbox });
  // Next14's custom-server router reloads next.config from dir, ignoring conf
  // passed to next(). A separate app directory keeps the user's .next untouched.
  // Copy source: Next's route watcher does not enumerate an app through a source
  // junction under node_modules. No .env files or repository metadata are copied.
  await fs.cp(path.join(root, 'src'), path.join(sandbox, 'src'), { recursive: true });
  try { await fs.cp(path.join(root, 'public'), path.join(sandbox, 'public'), { recursive: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.symlink(path.join(root, 'node_modules'), path.join(sandbox, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const name of ['next.config.mjs', 'postcss.config.mjs', 'tailwind.config.ts', 'package.json']) await fs.copyFile(path.join(root, name), path.join(sandbox, name));
  const config = JSON.parse(await fs.readFile(path.join(root, 'tsconfig.json'), 'utf8'));
  config.compilerOptions.incremental = false;
  config.include = ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx', '.next/types/**/*.ts'];
  await fs.writeFile(path.join(sandbox, 'tsconfig.json'), JSON.stringify(config));
  const app = next({ dev: true, dir: sandbox, hostname: '127.0.0.1', port: 3103 });
  await app.prepare();
  const server = http.createServer(app.getRequestHandler());
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(3103, '127.0.0.1', resolve); });
  process.send?.({ ready: true });
  process.once('message', async message => {
    if (message !== 'stop') return;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await app.close();
    process.exit(0);
  });
})().catch(error => { console.error(error.message); process.exit(1); });
