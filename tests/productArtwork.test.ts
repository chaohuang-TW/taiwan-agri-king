import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../src/data/products';
import { getProductArtwork, PRODUCT_ARTWORK, renderProductArtwork } from '../src/ui/productArtwork';

describe('product artwork presentation mapping', () => {
  it('maps the six supplied samples to exact product IDs', () => {
    expect(Object.keys(PRODUCT_ARTWORK)).toEqual([
      'miaoli-strawberry',
      'changhua-rice',
      'new-taipei-bamboo-shoot',
      'nantou-high-mountain-tea',
      'tainan-milkfish',
      'changhua-eggs',
    ]);
    for (const id of Object.keys(PRODUCT_ARTWORK)) {
      expect(PRODUCTS.some((product) => product.id === id)).toBe(true);
      expect(getProductArtwork(id)?.assetUrl).toMatch(/\.png$/);
    }
  });

  it('returns no formal artwork for products outside the six samples', () => {
    expect(getProductArtwork('taoyuan-persimmon')).toBeNull();
  });

  it('renders no placeholder markup when a product has no supplied artwork', () => {
    const product = PRODUCTS.find(({ id }) => id === 'changhua-grape')!;

    expect(renderProductArtwork(product)).toBe('');
  });
});
