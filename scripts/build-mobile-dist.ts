/**
 * WSNexa Mobile Distribution Bundler
 * Compiles the self-contained offline-first mobile client into mobile-dist/
 * for Capacitor native packaging.
 */

import * as fs from 'fs';
import * as path from 'path';
import { build } from 'esbuild';

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function buildMobileDist() {
  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, 'mobile-dist');
  const assetsDir = path.resolve(outDir, 'assets');

  loadEnvFile(path.resolve(rootDir, '.env.local'));
  loadEnvFile(path.resolve(rootDir, '.env'));

  console.log('🚀 Building WSNexa Mobile Distribution...');

  // 1. Ensure directories exist
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // 2. Copy index.html
  const srcHtml = path.resolve(rootDir, 'src/mobile/index.html');
  const destHtml = path.resolve(outDir, 'index.html');
  fs.copyFileSync(srcHtml, destHtml);
  console.log('✓ Copied index.html');

  // 3. Copy official branding assets
  const markSrc = path.resolve(rootDir, 'image/1000041108.png');
  const logoSrc = path.resolve(rootDir, 'image/1000041106.png');

  if (fs.existsSync(markSrc)) {
    fs.copyFileSync(markSrc, path.resolve(assetsDir, 'ws-mark.png'));
    console.log('✓ Copied official WS mark (image/1000041108.png)');
  }
  if (fs.existsSync(logoSrc)) {
    fs.copyFileSync(logoSrc, path.resolve(assetsDir, 'wsnexa-full-logo.png'));
    console.log('✓ Copied official WSNexa full logo (image/1000041106.png)');
  }

  // 4. Generate app.css
  const appCssContent = `
/* WSNexa Mobile Clean Stylesheet */
*, ::before, ::after {
  box-sizing: border-box;
  border-width: 0;
  border-style: solid;
  border-color: #334155;
}
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  background-color: #0f172a;
  color: #f8fafc;
  font-family: system-ui, -apple-system, sans-serif;
  overflow: hidden;
}
.flex { display: flex; }
.flex-col { flex-direction: column; }
.grid { display: grid; }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.justify-center { justify-content: center; }
.justify-end { justify-content: flex-end; }
.flex-1 { flex: 1 1 0%; }
.shrink-0 { flex-shrink: 0; }
.h-full { height: 100%; }
.w-full { width: 100%; }
.max-w-sm { max-width: 24rem; }
.max-w-md { max-width: 28rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.p-2 { padding: 0.5rem; }
.p-2\\.5 { padding: 0.625rem; }
.p-3 { padding: 0.75rem; }
.p-3\\.5 { padding: 0.875rem; }
.p-4 { padding: 1rem; }
.p-6 { padding: 1.5rem; }
.px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
.px-2\\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
.px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
.px-3\\.5 { padding-left: 0.875rem; padding-right: 0.875rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
.py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.py-2\\.5 { padding-top: 0.625rem; padding-bottom: 0.625rem; }
.py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-1\\.5 { margin-bottom: 0.375rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-6 { margin-bottom: 1.5rem; }
.mb-8 { margin-bottom: 2rem; }
.mt-0\\.5 { margin-top: 0.125rem; }
.mt-1 { margin-top: 0.25rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 0.75rem; }
.mt-4 { margin-top: 1rem; }
.mt-8 { margin-top: 2rem; }
.gap-1 { gap: 0.25rem; }
.gap-1\\.5 { gap: 0.375rem; }
.gap-2 { gap: 0.5rem; }
.gap-2\\.5 { gap: 0.625rem; }
.gap-3 { gap: 0.75rem; }
.rounded { border-radius: 0.25rem; }
.rounded-md { border-radius: 0.375rem; }
.rounded-lg { border-radius: 0.5rem; }
.rounded-xl { border-radius: 0.75rem; }
.rounded-full { border-radius: 9999px; }
.border { border-width: 1px; }
.border-b { border-bottom-width: 1px; }
.border-t { border-top-width: 1px; }
.border-l { border-left-width: 1px; }
.bg-slate-900 { background-color: #0f172a; }
.bg-slate-800 { background-color: #1e293b; }
.bg-slate-700 { background-color: #334155; }
.bg-emerald-600 { background-color: #059669; }
.bg-emerald-500 { background-color: #10b981; }
.bg-emerald-400 { background-color: #34d399; }
.bg-amber-500 { background-color: #f59e0b; }
.bg-amber-400 { background-color: #fbbf24; }
.bg-rose-600 { background-color: #e11d48; }
.bg-rose-400 { background-color: #fb7185; }
.bg-blue-600 { background-color: #2563eb; }
.bg-blue-400 { background-color: #60a5fa; }
.text-white { color: #ffffff; }
.text-slate-100 { color: #f1f5f9; }
.text-slate-200 { color: #e2e8f0; }
.text-slate-300 { color: #cbd5e1; }
.text-slate-400 { color: #94a3b8; }
.text-slate-500 { color: #64748b; }
.text-emerald-300 { color: #6ee7b7; }
.text-emerald-400 { color: #34d399; }
.text-amber-300 { color: #fcd34d; }
.text-amber-400 { color: #fbbf24; }
.text-amber-950 { color: #451a03; }
.text-rose-200 { color: #fecdd3; }
.text-xs { font-size: 0.75rem; line-height: 1rem; }
.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
.text-base { font-size: 1rem; line-height: 1.5rem; }
.text-\\[10px\\] { font-size: 10px; }
.text-\\[11px\\] { font-size: 11px; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.text-center { text-align: center; }
.text-left { text-align: left; }
.uppercase { text-transform: uppercase; }
.capitalize { text-transform: capitalize; }
.overflow-hidden { overflow: hidden; }
.overflow-y-auto { overflow-y: auto; }
.fixed { position: fixed; }
.inset-0 { inset: 0; }
.z-50 { z-index: 50; }
.cursor-pointer { cursor: pointer; }
.space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem; }
.space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
.space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.75rem; }
.space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem; }
.w-7 { width: 1.75rem; }
.h-7 { height: 1.75rem; }
.w-48 { width: 12rem; }
.w-56 { width: 14rem; }
.h-2 { height: 0.5rem; }
.w-2 { width: 0.5rem; }
.h-2\\.5 { height: 0.625rem; }
.w-2\\.5 { width: 0.625rem; }
.h-4 { height: 1rem; }
.w-4 { width: 1rem; }
`;
  fs.writeFileSync(path.resolve(outDir, 'app.css'), appCssContent);
  console.log('✓ Generated app.css');

  // 5. Bundle app.tsx with esbuild
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  console.log('Bundling app.tsx with esbuild...');
  await build({
    entryPoints: [path.resolve(rootDir, 'src/mobile/app.tsx')],
    outfile: path.resolve(outDir, 'app.js'),
    bundle: true,
    minify: true,
    sourcemap: false,
    format: 'esm',
    target: ['es2022', 'chrome100'],
    define: {
      'process.env.NODE_ENV': '"production"',
      '__ENV__': JSON.stringify({
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
        NEXT_PUBLIC_APP_URL: appUrl,
      }),
    },
    loader: {
      '.png': 'file',
      '.svg': 'file',
    },
  });

  console.log('✓ Successfully bundled mobile-dist/app.js');
  console.log('🎉 WSNexa Mobile Distribution Ready!');
}

buildMobileDist().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
