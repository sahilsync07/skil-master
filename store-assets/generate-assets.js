const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const WORKSPACE = path.resolve(__dirname, '..');
const WWW_DIR = path.join(WORKSPACE, 'android-app', 'www');
const ASSETS_DIR = path.join(WORKSPACE, 'assets');
const OUT_DIR = __dirname;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      if (cleanUrl === '/__icon.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buildIconHtml());
        return;
      }
      if (cleanUrl === '/__feature.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buildFeatureHtml());
        return;
      }
      let relPath = cleanUrl === '/' ? '/index.html' : cleanUrl;
      let filePath = path.join(WWW_DIR, relPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(WORKSPACE, relPath);
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function buildIconHtml() {
  const logoB64 = fs.readFileSync(path.join(ASSETS_DIR, 'skil-white-transparent.png')).toString('base64');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 512px;
    height: 512px;
    overflow: hidden;
    background: #09090B;
  }
  .canvas {
    width: 512px;
    height: 512px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at 50% 35%, rgba(163, 230, 53, 0.11) 0%, rgba(15, 23, 42, 0.48) 45%, #050507 100%);
  }
  .emblem-wrap {
    width: 340px;
    height: 340px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .logo-img {
    width: 320px;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.85));
  }
  .accent-bar {
    margin-top: 22px;
    width: 72px;
    height: 4px;
    border-radius: 4px;
    background: #A3E635;
    opacity: 0.92;
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="emblem-wrap">
      <img class="logo-img" src="data:image/png;base64,${logoB64}" alt="SKIL Master">
      <div class="accent-bar"></div>
    </div>
  </div>
</body>
</html>`;
}

function buildFeatureHtml() {
  const logoB64 = fs.readFileSync(path.join(ASSETS_DIR, 'skil-white-transparent.png')).toString('base64');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 1024px;
    height: 500px;
    overflow: hidden;
    font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif;
    background: #090D16;
    color: #F8FAFC;
  }
  .banner {
    width: 1024px;
    height: 500px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 52px 64px;
    background:
      radial-gradient(circle at 18% 50%, rgba(163, 230, 53, 0.11) 0%, transparent 48%),
      radial-gradient(circle at 85% 20%, rgba(56, 189, 248, 0.12) 0%, transparent 45%),
      linear-gradient(135deg, #09090B 0%, #0F172A 55%, #111827 100%);
  }
  .grid-overlay {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
    background-size: 36px 36px;
    pointer-events: none;
  }
  .left-col {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 580px;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #A3E635;
    margin-bottom: 14px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #A3E635;
  }
  h1 {
    font-size: 58px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    color: #FFFFFF;
    margin-bottom: 14px;
  }
  .subtitle {
    font-size: 19px;
    font-weight: 500;
    line-height: 1.48;
    color: #CBD5E1;
    margin-bottom: 28px;
    max-width: 520px;
  }
  .pills {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
  }
  .pill {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    color: #E2E8F0;
    background: rgba(30, 41, 59, 0.85);
    border: 1px solid rgba(148, 163, 184, 0.25);
    padding: 7px 13px;
    border-radius: 999px;
  }
  .pill strong {
    color: #A3E635;
    font-weight: 700;
  }
  .right-col {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .brand-card {
    width: 286px;
    height: 286px;
    border-radius: 56px;
    background: linear-gradient(145deg, #09090B 0%, #18181B 100%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 28px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(163, 230, 53, 0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px;
  }
  .brand-card img {
    width: 205px;
    height: auto;
    object-fit: contain;
  }
  .brand-tag {
    margin-top: 22px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: #94A3B8;
    text-transform: uppercase;
  }
</style>
</head>
<body>
  <div class="banner">
    <div class="grid-overlay"></div>
    <div class="left-col">
      <div class="eyebrow"><span class="dot"></span> SKIL LIFESTYLE LLP</div>
      <h1>SKIL Master</h1>
      <p class="subtitle">Distribution ERP, TallyPrime Sync, GST Compliance &amp; Receivables Intelligence</p>
      <div class="pills">
        <div class="pill"><strong>TallyPrime</strong> Sync</div>
        <div class="pill">Aging &amp; CD</div>
        <div class="pill">GST &amp; Audit</div>
        <div class="pill">AES-256 Vault</div>
      </div>
    </div>
    <div class="right-col">
      <div class="brand-card">
        <img src="data:image/png;base64,${logoB64}" alt="SKIL Lifestyle">
        <div class="brand-tag">Rayagada &bull; Odisha</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }
  async call(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.ws.close();
  }
}

async function waitForPort(port, retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) return await res.json();
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Chrome debugging port timed out');
}

async function waitForAppReady(cdp) {
  await cdp.call('Runtime.evaluate', {
    awaitPromise: true,
    expression: `(async () => {
      try { await document.fonts.ready; } catch {}
      for (let i = 0; i < 40; i++) {
        if (window.lucide && document.querySelectorAll('svg.lucide').length > 3) break;
        await new Promise(r => setTimeout(r, 150));
      }
      await new Promise(r => setTimeout(r, 600));
    })()`
  });
}

async function capturePage(cdp, url, width, height, scale, outFile, evaluateScript = null, isApp = false) {
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: width < 500
  });
  await cdp.call('Page.navigate', { url });
  if (isApp) {
    await new Promise(r => setTimeout(r, 1200));
    await waitForAppReady(cdp);
  } else {
    await new Promise(r => setTimeout(r, 1400));
  }
  if (evaluateScript) {
    await cdp.call('Runtime.evaluate', { expression: evaluateScript, awaitPromise: true });
    await new Promise(r => setTimeout(r, 900));
  }
  const { data } = await cdp.call('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(data, 'base64');
  fs.writeFileSync(outFile, buf);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  console.log(`Saved ${path.basename(outFile)} -> ${w}x${h} (${(buf.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  const { server, port } = await startStaticServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const userDataDir = path.join(OUT_DIR, '_chrome_profile');
  fs.rmSync(userDataDir, { recursive: true, force: true });

  const debugPort = 9232;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${debugPort}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  let cdp = null;
  try {
    const targets = await waitForPort(debugPort);
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');

    // 1. App Icon (512 x 512)
    await capturePage(cdp, `${baseUrl}/__icon.html`, 512, 512, 1, path.join(OUT_DIR, 'app-icon-512x512.png'));

    // 2. Feature Graphic (1024 x 500)
    await capturePage(cdp, `${baseUrl}/__feature.html`, 1024, 500, 1, path.join(OUT_DIR, 'feature-graphic-1024x500.png'));

    // 3. Phone Screenshots: 432 x 768 @ 2.5x => exact 1080 x 1920 px (9:16 portrait)
    await capturePage(cdp, `${baseUrl}/index.html`, 432, 768, 2.5, path.join(OUT_DIR, 'phone-1-dashboard.png'), null, true);

    await capturePage(
      cdp,
      `${baseUrl}/index.html`,
      432,
      768,
      2.5,
      path.join(OUT_DIR, 'phone-2-ajanta-hub.png'),
      `document.querySelector('[data-tab="supplier-ajanta"]')?.click();`,
      true
    );

    await capturePage(
      cdp,
      `${baseUrl}/index.html`,
      432,
      768,
      2.5,
      path.join(OUT_DIR, 'phone-3-aging.png'),
      `document.querySelector('[data-tab="payment-aging"]')?.click();`,
      true
    );

    await capturePage(
      cdp,
      `${baseUrl}/index.html`,
      432,
      768,
      2.5,
      path.join(OUT_DIR, 'phone-4-audit.png'),
      `document.querySelector('[data-tab="audit-reconcile"]')?.click();`,
      true
    );

    try { await cdp.call('Browser.close'); } catch {}
  } finally {
    if (cdp) cdp.close();
    chrome.kill();
    server.close();
    await new Promise(r => setTimeout(r, 800));
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
