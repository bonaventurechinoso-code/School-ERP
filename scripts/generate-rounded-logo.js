const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function generateAssets() {
  const src = 'C:/Users/DELL/.gemini/antigravity/brain/362f6193-ea22-4062-84a4-8adfa010f82e/.user_uploaded/media_1795449427720_cc474305.jpg';
  
  // 1. Trim whitespace
  const trimmed = await sharp(src).trim().toBuffer({ resolveWithObject: true });
  console.log('Trimmed size:', trimmed.info.width, 'x', trimmed.info.height);
  
  const size = 512;
  const padding = 56; // 400x400 max area for monogram
  
  const resizedMonogram = await sharp(trimmed.data)
    .resize(size - padding * 2, size - padding * 2, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  console.log('Resized monogram:', resizedMonogram.info.width, 'x', resizedMonogram.info.height);

  // High-fidelity rounded mask for 512x512 with rx=112 (proportional to rounded-xl / 22% radius)
  const rectRadius = 112;
  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${rectRadius}" ry="${rectRadius}" fill="#fff"/></svg>`
  );

  // 1. business-logo.png with matching radius shape (rounded corners with transparent outside!)
  await sharp({
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
  .composite([
    { input: maskSvg, blend: 'dest-in' }
  ])
  .png()
  .toFile('public/img/business-logo.png');

  console.log('Updated public/img/business-logo.png with rounded-radius badge shape!');

  // Also update PWA & favicon icons with this clean rounded shape so everything is consistent
  for (const s of [192, 512]) {
    const sMask = Buffer.from(
      `<svg width="${s}" height="${s}"><rect x="0" y="0" width="${s}" height="${s}" rx="${Math.round(s * 0.22)}" ry="${Math.round(s * 0.22)}" fill="#fff"/></svg>`
    );
    const monoResized = await sharp(trimmed.data)
      .resize(Math.round(s * 0.78), Math.round(s * 0.78), { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    await sharp({
      create: {
        width: s,
        height: s,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .composite([{ input: monoResized.data, gravity: 'center' }])
    .composite([{ input: sMask, blend: 'dest-in' }])
    .png()
    .toFile(`public/icon-${s}.png`);
  }

  // Favicon and apple-touch-icon
  await sharp('public/icon-192.png').resize(180, 180).toFile('public/apple-touch-icon.png');
  await sharp('public/icon-192.png').resize(32, 32).toFile('public/favicon.png');
  await sharp('public/icon-192.png').resize(32, 32).toFile('public/favicon.ico');

  console.log('All icons and business-logo.png updated successfully!');
}

generateAssets().catch(err => {
  console.error(err);
  process.exit(1);
});
