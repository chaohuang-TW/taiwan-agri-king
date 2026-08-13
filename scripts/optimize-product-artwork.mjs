import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const assetsDir = path.join(root, 'src/assets/products');

const pngFiles = (await fs.readdir(assetsDir)).filter((file) => file.endsWith('.png')).sort();

if (pngFiles.length !== 48) {
  throw new Error(`Expected 48 source PNGs, found ${pngFiles.length}`);
}

const results = [];

for (const file of pngFiles) {
  const input = path.join(assetsDir, file);
  const output = path.join(assetsDir, file.replace(/\.png$/, '.webp'));
  const info = await sharp(input)
    .resize({
      width: 512,
      height: 512,
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: 86, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(output);

  results.push({
    productId: file.replace(/\.png$/, ''),
    source: file,
    output: path.basename(output),
    width: info.width,
    height: info.height,
    bytes: info.size,
  });
}

const totalBytes = results.reduce((sum, item) => sum + item.bytes, 0);
console.log(JSON.stringify({ count: results.length, totalBytes, results }, null, 2));
