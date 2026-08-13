import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const assetsDir = path.join(root, 'src/assets/products');
const sourceFiles = (await fs.readdir(assetsDir)).filter((file) => file.endsWith('.png')).sort();
const optimizedFiles = (await fs.readdir(assetsDir))
  .filter((file) => file.endsWith('.webp'))
  .sort();

if (sourceFiles.length !== 48 || optimizedFiles.length !== 48) {
  throw new Error(
    `Expected 48 PNG and WebP assets; found ${sourceFiles.length} PNG and ${optimizedFiles.length} WebP`,
  );
}

const results = [];
for (const sourceFile of sourceFiles) {
  const productId = sourceFile.replace(/\.png$/, '');
  const optimizedFile = `${productId}.webp`;
  const source = await sharp(path.join(assetsDir, sourceFile)).metadata();
  const optimized = await sharp(path.join(assetsDir, optimizedFile)).metadata();
  const sourceRatio = source.width / source.height;
  const optimizedRatio = optimized.width / optimized.height;
  const ratioDelta = Math.abs(sourceRatio - optimizedRatio) / sourceRatio;

  if (!optimized.width || !optimized.height || Math.max(optimized.width, optimized.height) > 512) {
    throw new Error(`${optimizedFile} exceeds the 512px dimension gate`);
  }
  if (source.hasAlpha !== true || optimized.hasAlpha !== true) {
    throw new Error(`${optimizedFile} did not preserve alpha`);
  }
  if (ratioDelta > 0.005) {
    throw new Error(`${optimizedFile} changed aspect ratio by ${(ratioDelta * 100).toFixed(3)}%`);
  }

  results.push({
    productId,
    file: optimizedFile,
    width: optimized.width,
    height: optimized.height,
    alpha: optimized.hasAlpha,
  });
}

console.log(JSON.stringify({ count: results.length, valid: true, results }, null, 2));
