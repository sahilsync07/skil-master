const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'android-app', 'www');
const destDir = path.join(__dirname, '..');

// Files to copy to root
const files = [
  'index.html',
  'app.js',
  'style.css',
  'manifest.json',
  'tracking-ui.js'
];

files.forEach(f => {
  const src = path.join(srcDir, f);
  const dest = path.join(destDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${f} to root`);
  }
});

// Copy directories: assets and data
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

// Copy assets
const assetsSrc = path.join(srcDir, 'assets');
const assetsDest = path.join(destDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  copyDirRecursive(assetsSrc, assetsDest);
  console.log('Copied assets directory to root');
}

// Copy data
const dataSrc = path.join(srcDir, 'data');
const dataDest = path.join(destDir, 'data');
if (fs.existsSync(dataSrc)) {
  copyDirRecursive(dataSrc, dataDest);
  console.log('Copied data directory to root');
}

// Create .nojekyll in root
const noJekyllPath = path.join(destDir, '.nojekyll');
fs.writeFileSync(noJekyllPath, '', 'utf8');
console.log('Created .nojekyll in root for GitHub Pages');
