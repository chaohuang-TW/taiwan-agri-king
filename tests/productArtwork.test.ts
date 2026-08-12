import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../src/data/products';
import { getProductArtwork, PRODUCT_ARTWORK, renderProductArtwork } from '../src/ui/productArtwork';

describe('product artwork presentation mapping', () => {
  it('maps all twenty supplied samples to exact product IDs', () => {
    expect(Object.keys(PRODUCT_ARTWORK)).toEqual([
      'miaoli-strawberry',
      'changhua-rice',
      'new-taipei-bamboo-shoot',
      'nantou-high-mountain-tea',
      'tainan-milkfish',
      'changhua-eggs',
      'new-taipei-wendan',
      'taoyuan-persimmon',
      'hsinchu-persimmon',
      'taichung-pear',
      'changhua-grape',
      'nantou-plum',
      'chiayi-pineapple',
      'tainan-mango',
      'kaohsiung-jujube',
      'pingtung-pineapple',
      'taitung-custard-apple',
      'taoyuan-rice',
      'miaoli-taro',
      'yunlin-peanut',
    ]);
    for (const id of Object.keys(PRODUCT_ARTWORK)) {
      expect(PRODUCTS.some((product) => product.id === id)).toBe(true);
      expect(getProductArtwork(id)?.assetUrl).toMatch(/\.png$/);
    }
  });

  it('keeps the two pineapple product IDs mapped to distinct supplied assets', () => {
    const chiayiPineapple = getProductArtwork('chiayi-pineapple');
    const pingtungPineapple = getProductArtwork('pingtung-pineapple');

    expect(chiayiPineapple).not.toBeNull();
    expect(pingtungPineapple).not.toBeNull();
    expect(chiayiPineapple?.assetUrl).not.toBe(pingtungPineapple?.assetUrl);
  });

  it('returns no formal artwork for products outside the twenty samples', () => {
    expect(getProductArtwork('chiayi-rice')).toBeNull();
  });

  it('renders no placeholder markup when a product has no supplied artwork', () => {
    const product = PRODUCTS.find(({ id }) => id === 'chiayi-rice')!;

    expect(renderProductArtwork(product)).toBe('');
  });
});
