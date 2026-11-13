const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const webDir = path.join(rootDir, 'web');
const targets = [
  path.join(rootDir, 'android-app', 'www'),
  path.join(__dirname, 'public')
];

const files = [
  'index.html',
  'app.js',
  'style.css',
  'manifest.json',
  'tracking-ui.js',
  'weekly_receivables_summary.html',
  'privacy-policy.html',
  'privacy.html'
];

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

targets.forEach(destDir => {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  files.forEach(f => {
    const src = path.join(webDir, f);
    const dest = path.join(destDir, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  });
  ['assets', 'data'].forEach(folder => {
    const srcFolder = path.join(webDir, folder);
    if (fs.existsSync(srcFolder)) {
      copyDirRecursive(srcFolder, path.join(destDir, folder));
    }
  });
  console.log(`Synced Web -> ${destDir}`);
});

fs.writeFileSync(path.join(webDir, '.nojekyll'), '', 'utf8');
