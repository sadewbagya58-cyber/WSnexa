/**
 * WSNexa Android Icon & Splash Generator
 * Generates all Android mipmap icons and splash drawables using the official WSNexa assets.
 * Source Mark: image/1000041108.png
 * Source Logo: image/1000041106.png
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
  const markPath = path.resolve(rootDir, 'image/1000041108.png');
  const logoPath = path.resolve(rootDir, 'image/1000041106.png');

  if (!fs.existsSync(resDir)) {
    throw new Error(`Android resources directory does not exist at ${resDir}`);
  }

  console.log('🎨 Generating Official WSNexa Android Launcher Icons...');

  // 1. Generate Mipmap Icons from WS Mark (1000041108.png)
  for (const { folder, size } of ICON_SIZES) {
    const targetDir = path.resolve(resDir, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const resizedBuffer = await sharp(markPath)
      .resize(size, size, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
      .png()
      .toBuffer();

    // ic_launcher.png
    fs.writeFileSync(path.resolve(targetDir, 'ic_launcher.png'), resizedBuffer);
    // ic_launcher_round.png
    fs.writeFileSync(path.resolve(targetDir, 'ic_launcher_round.png'), resizedBuffer);
    // ic_launcher_foreground.png (transparent background)
    const fgBuffer = await sharp(markPath)
      .resize(Math.round(size * 0.72), Math.round(size * 0.72), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: Math.round(size * 0.14),
        bottom: Math.round(size * 0.14),
        left: Math.round(size * 0.14),
        right: Math.round(size * 0.14),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .resize(size, size)
      .png()
      .toBuffer();

    fs.writeFileSync(path.resolve(targetDir, 'ic_launcher_foreground.png'), fgBuffer);
    console.log(`✓ Generated ${folder} (${size}x${size}px)`);
  }

  console.log('🎨 Generating Official WSNexa Android Splash Screens...');

  // 2. Base drawable/splash.png
  const drawableDir = path.resolve(resDir, 'drawable');
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });

  const baseSplash = await sharp(logoPath)
    .resize(480, 240, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
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
      .resize(logoW, logoH, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 0 } })
      .toBuffer();

    const splash = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 },
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
      .resize(logoW, logoH, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 0 } })
      .toBuffer();

    const splash = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 },
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
