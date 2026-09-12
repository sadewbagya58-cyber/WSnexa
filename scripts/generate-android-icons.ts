/**
 * WSNexa Android Icon & Splash Generator
 * Generates all Android mipmap icons and splash drawables using the official WSNexa assets.
 * Source App Icon / Mark: image/1000041441.png
 * Source Full Logo: image/1000041430.png
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const ICON_SIZES: { folder: string; size: number }[] = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

const SPLASH_PORT_SIZES: { folder: string; width: number; height: number }[] = [
  { folder: 'drawable-port-mdpi', width: 320, height: 480 },
  { folder: 'drawable-port-hdpi', width: 480, height: 800 },
  { folder: 'drawable-port-xhdpi', width: 720, height: 1280 },
  { folder: 'drawable-port-xxhdpi', width: 960, height: 1600 },
  { folder: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
];

const SPLASH_LAND_SIZES: { folder: string; width: number; height: number }[] = [
  { folder: 'drawable-land-mdpi', width: 480, height: 320 },
  { folder: 'drawable-land-hdpi', width: 800, height: 480 },
  { folder: 'drawable-land-xhdpi', width: 1280, height: 720 },
  { folder: 'drawable-land-xxhdpi', width: 1600, height: 960 },
  { folder: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
];

async function generateBranding() {
  const rootDir = process.cwd();
  const resDir = path.resolve(rootDir, 'android/app/src/main/res');
  const markPath = path.resolve(rootDir, 'image/1000041441.png');
  const logoPath = path.resolve(rootDir, 'image/1000041430.png');

  if (!fs.existsSync(resDir)) {
    throw new Error(`Android resources directory does not exist at ${resDir}`);
  }
  if (!fs.existsSync(markPath)) {
    throw new Error(`Official launcher icon source does not exist at ${markPath}`);
  }

  console.log('🎨 Generating Official WSNexa Android Launcher Icons (source: image/1000041441.png)...');

  // Load raw 1000041441.png and extract the white WS mark to transparent RGBA buffer.
  // The supplied image has solid black background and white mark.
  // Using luminance as alpha preserves exact anti-aliasing and avoids opaque box artifacts on Xiaomi HyperOS.
  const rawSource = await sharp(markPath).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = rawSource;
  const rgbaBuffer = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += info.channels, j += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    rgbaBuffer[j] = 255;     // Pure white
    rgbaBuffer[j + 1] = 255;
    rgbaBuffer[j + 2] = 255;
    rgbaBuffer[j + 3] = lum; // Alpha from luminance
  }

  const transparentMark = await sharp(rgbaBuffer, {
    raw: { width: info.width, height: info.height, channels: 4 }
  }).png().toBuffer();

  // 1. Generate Mipmap Icons
  for (const { folder, size } of ICON_SIZES) {
    const targetDir = path.resolve(resDir, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // A. Legacy non-adaptive launcher icons (ic_launcher.png & ic_launcher_round.png)
    // Solid black #000000 background with white mark scaled to 72%
    const legacyInnerSize = Math.round(size * 0.72);
    const legacyInnerMark = await sharp(transparentMark)
      .resize(legacyInnerSize, legacyInnerSize, { fit: 'contain' })
      .toBuffer();

    const legacyIcon = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([{ input: legacyInnerMark, gravity: 'center' }])
      .png()
      .toBuffer();

    fs.writeFileSync(path.resolve(targetDir, 'ic_launcher.png'), legacyIcon);
    fs.writeFileSync(path.resolve(targetDir, 'ic_launcher_round.png'), legacyIcon);

    // B. Android Adaptive Icon Foreground (ic_launcher_foreground.png):
    // Android adaptive icon specification:
    // Canvas: 108dp x 108dp. Safe zone: center 66dp diameter (61.1%).
    // Scaled to 65% ensures the mark occupies ~60.5% width, perfectly inside the safe zone.
    // Background is 100% transparent so the system background (@color/ic_launcher_background: #000000)
    // fills the entire masked squircle/circle, preventing Xiaomi HyperOS from wrapping in a white box.
    const fgInnerSize = Math.round(size * 0.65);
    const fgInnerMark = await sharp(transparentMark)
      .resize(fgInnerSize, fgInnerSize, { fit: 'contain' })
      .toBuffer();

    const fgBuffer = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: fgInnerMark, gravity: 'center' }])
      .png()
      .toBuffer();

    fs.writeFileSync(path.resolve(targetDir, 'ic_launcher_foreground.png'), fgBuffer);
    console.log(`✓ Generated ${folder} (${size}x${size}px)`);
  }

  console.log('🎨 Generating Official WSNexa Android Splash Screens (source: image/1000041430.png)...');

  // 2. Base drawable/splash.png
  const drawableDir = path.resolve(resDir, 'drawable');
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });

  const baseSplash = await sharp(logoPath)
    .resize(480, 240, { fit: 'contain', background: { r: 9, g: 9, b: 11, alpha: 1 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.resolve(drawableDir, 'splash.png'), baseSplash);
  console.log('✓ Generated drawable/splash.png');

  // 3. Portrait Splashes
  for (const { folder, width, height } of SPLASH_PORT_SIZES) {
    const targetDir = path.resolve(resDir, folder);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const logoW = Math.round(width * 0.75);
    const logoH = Math.round(logoW / 3);

    const logoBuffer = await sharp(logoPath)
      .resize(logoW, logoH, { fit: 'contain', background: { r: 9, g: 9, b: 11, alpha: 0 } })
      .toBuffer();

    const splash = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 9, g: 9, b: 11, alpha: 1 },
      },
    })
      .composite([{ input: logoBuffer, gravity: 'center' }])
      .png()
      .toBuffer();

    fs.writeFileSync(path.resolve(targetDir, 'splash.png'), splash);
    console.log(`✓ Generated ${folder}/splash.png (${width}x${height}px)`);
  }

  // 4. Landscape Splashes
  for (const { folder, width, height } of SPLASH_LAND_SIZES) {
    const targetDir = path.resolve(resDir, folder);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const logoW = Math.round(width * 0.45);
    const logoH = Math.round(logoW / 3);

    const logoBuffer = await sharp(logoPath)
      .resize(logoW, logoH, { fit: 'contain', background: { r: 9, g: 9, b: 11, alpha: 0 } })
      .toBuffer();

    const splash = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 9, g: 9, b: 11, alpha: 1 },
      },
    })
      .composite([{ input: logoBuffer, gravity: 'center' }])
      .png()
      .toBuffer();

    fs.writeFileSync(path.resolve(targetDir, 'splash.png'), splash);
    console.log(`✓ Generated ${folder}/splash.png (${width}x${height}px)`);
  }

  console.log('🎉 All Android Icons & Splash Screens Generated Successfully!');
}

generateBranding().catch((err) => {
  console.error('❌ Failed to generate branding:', err);
  process.exit(1);
});
