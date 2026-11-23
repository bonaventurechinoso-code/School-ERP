const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function generateAssets() {
  const src = 'C:/Users/DELL/.gemini/antigravity/brain/362f6193-ea22-4062-84a4-8adfa010f82e/.user_uploaded/media_1795449427720_cc474305.jpg';
  
  if (!fs.existsSync(src)) {
    throw new Error('Source logo file not found at: ' + src);
  }

  // 1. Trim outer whitespace to isolate the cyan monogram
  const trimmed = await sharp(src).trim().toBuffer({ resolveWithObject: true });
  console.log('Trimmed size:', trimmed.info.width, 'x', trimmed.info.height);
  
  const size = 512;
  const padding = 60; // 392x392 comfortable area for monogram
  
  const resizedMonogram = await sharp(trimmed.data)
    .resize(size - padding * 2, size - padding * 2, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  console.log('Resized monogram:', resizedMonogram.info.width, 'x', resizedMonogram.info.height);

  // High-fidelity rounded mask for 512x512 with rx=112 (proportional to rounded-xl / 22% radius)
  const rectRadius = 112;
  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${rectRadius}" ry="${rectRadius}" fill="#fff"/></svg>`
  );

  // Step A: Composite the cyan monogram onto white canvas
  const stepA = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .composite([
    { input: resizedMonogram.data, gravity: 'center' }
  ])
  .png()
  .toBuffer();

  // Step B: Apply rounded corner mask to make outer corners transparent
  await sharp(stepA)
    .composite([
      { input: maskSvg, blend: 'dest-in' }
    ])
    .png()
    .toFile('public/img/business-logo.png');

  console.log('Updated public/img/business-logo.png with valid cyan monogram & rounded corners!');

  // Generate PWA icons (512, 192) and favicons using the two-step composition
  for (const s of [512, 192]) {
    const sPadding = Math.round(s * 0.12);
    const monoResized = await sharp(trimmed.data)
      .resize(s - sPadding * 2, s - sPadding * 2, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    const sRadius = Math.round(s * 0.22);
    const sMask = Buffer.from(
      `<svg width="${s}" height="${s}"><rect x="0" y="0" width="${s}" height="${s}" rx="${sRadius}" ry="${sRadius}" fill="#fff"/></svg>`
    );

    const stepIcon = await sharp({
      create: {
        width: s,
        height: s,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .composite([{ input: monoResized.data, gravity: 'center' }])
    .png()
    .toBuffer();

    await sharp(stepIcon)
      .composite([{ input: sMask, blend: 'dest-in' }])
      .png()
      .toFile(`public/icon-${s}.png`);

    // Also update maskable icon
    await sharp(stepIcon).png().toFile(`public/icon-maskable-${s}.png`);
  }

  // Favicon and apple-touch-icon
  await sharp('public/icon-192.png').resize(180, 180).toFile('public/apple-touch-icon.png');
  await sharp('public/icon-192.png').resize(32, 32).toFile('public/favicon.png');
  await sharp('public/icon-192.png').resize(32, 32).toFile('public/favicon.ico');

  // Verify non-white pixel presence
  const finalMeta = await sharp('public/img/business-logo.png').raw().toBuffer({ resolveWithObject: true });
  let nonWhitePixels = 0;
  for (let i = 0; i < finalMeta.data.length; i += 4) {
    const r = finalMeta.data[i];
    const g = finalMeta.data[i+1];
    const b = finalMeta.data[i+2];
    const a = finalMeta.data[i+3];
    if (a > 0 && (r < 240 || g < 240 || b < 240)) {
      nonWhitePixels++;
    }
  }

  console.log(`Verification: Found ${nonWhitePixels} cyan/colored pixels in public/img/business-logo.png!`);
  if (nonWhitePixels === 0) {
    throw new Error('FAIL: Generated logo has NO colored pixels!');
  }
}

generateAssets().catch(err => {
  console.error(err);
  process.exit(1);
});
