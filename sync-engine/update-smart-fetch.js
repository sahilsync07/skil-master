const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'android-app', 'www', 'app.js');
const syncAppJsPath = path.join(__dirname, 'public', 'app.js');

[appJsPath, syncAppJsPath].forEach(p => {
  if (!fs.existsSync(p)) return;
  let code = fs.readFileSync(p, 'utf8');

  // Update GITHUB_RAW_BASE
  code = code.replace(
    /const GITHUB_RAW_BASE = ['"][^'"]+['"];/,
    "const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/skillifestyle/master/main';"
  );

  // Update smartFetch to prioritize GitHub Pages relative fetch
  const oldSmartFetch = `async function smartFetch(apiEndpoint, fallbackFile) {
  const serverHost = getApiBaseUrl();`;

  const newSmartFetch = `async function smartFetch(apiEndpoint, fallbackFile) {
  // If running on GitHub Pages or HTTPS static host, fetch relative ./data/ directly (same origin, zero CORS)
  if (window.location.hostname.includes('github.io') || window.location.protocol === 'https:') {
    try {
      const res = await fetch(\`./data/\${fallbackFile}?v=\${Date.now()}\`);
      if (res.ok) {
        state.dataSource = 'github-pages';
        return await res.json();
      }
    } catch (e) {
      // Continue to next tiers
    }
  }

  const serverHost = getApiBaseUrl();`;

  if (!code.includes("state.dataSource = 'github-pages';")) {
    code = code.replace(oldSmartFetch, newSmartFetch);
  }

  fs.writeFileSync(p, code, 'utf8');
  console.log('Updated app.js at:', p);
});
