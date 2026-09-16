/**
 * WSNexa Mobile Distribution Builder
 * Prepares offline fallback assets and branding for the native Android APK container.
 */

import * as fs from 'fs';
import * as path from 'path';

async function buildMobileDist() {
  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, 'mobile-dist');
  const assetsDir = path.resolve(outDir, 'assets');

  console.log('🚀 Preparing WSNexa Mobile Packaging Assets...');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Copy offline fallback HTML
  const srcHtml = path.resolve(rootDir, 'src/mobile/index.html');
  fs.copyFileSync(srcHtml, path.resolve(outDir, 'index.html'));
  fs.copyFileSync(srcHtml, path.resolve(outDir, 'offline.html'));
  console.log('✓ Copied index.html & offline.html');

  // Copy official branding assets
  const markSrc = path.resolve(rootDir, 'image/1000041419.png');
  const logoSrc = path.resolve(rootDir, 'image/1000041430.png');
  const publicBrandDir = path.resolve(rootDir, 'public/brand');

  if (!fs.existsSync(publicBrandDir)) {
    fs.mkdirSync(publicBrandDir, { recursive: true });
  }

  if (fs.existsSync(markSrc)) {
    fs.copyFileSync(markSrc, path.resolve(assetsDir, 'ws-mark.png'));
    fs.copyFileSync(markSrc, path.resolve(publicBrandDir, 'ws-mark.png'));
    console.log('✓ Copied official WS mark (image/1000041419.png) to mobile-dist & public/brand');
  }
  if (fs.existsSync(logoSrc)) {
    fs.copyFileSync(logoSrc, path.resolve(assetsDir, 'wsnexa-full-logo.png'));
    fs.copyFileSync(logoSrc, path.resolve(publicBrandDir, 'wsnexa-full-logo.png'));
    console.log('✓ Copied official WSNexa full logo (image/1000041430.png) to mobile-dist & public/brand');
  }

  // Clean minimal app.css
  const appCss = `
/* WSNexa Mobile Offline Shell Styles */
body {
  margin: 0;
  padding: 0;
  background-color: #09090b;
  color: #fafafa;
}
`;
  fs.writeFileSync(path.resolve(outDir, 'app.css'), appCss);
  console.log('✓ Generated minimal app.css');

  // Remove any stale app.js from the custom terminal attempt
  const staleAppJs = path.resolve(outDir, 'app.js');
  if (fs.existsSync(staleAppJs)) {
    fs.unlinkSync(staleAppJs);
    console.log('✓ Removed stale custom terminal bundle app.js');
  }

  console.log('🎉 WSNexa Mobile Packaging Assets Ready!');
}

buildMobileDist().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
