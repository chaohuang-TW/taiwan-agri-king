import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../src/data/products';
import { getProductArtwork, PRODUCT_ARTWORK, renderProductArtwork } from '../src/ui/productArtwork';

describe('product artwork presentation mapping', () => {
  it('maps all forty-eight supplied samples to exact product IDs', () => {
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
      'chiayi-rice',
      'kaohsiung-edamame',
      'hualien-rice',
      'taitung-millet',
      'taichung-mushroom',
      'yunlin-cabbage',
      'chiayi-sweet-corn',
      'tainan-carrot',
      'pingtung-onion',
      'yilan-scallion',
      'taipei-tieguanyin',
      'new-taipei-baozhong-tea',
      'hsinchu-oriental-beauty-tea',
      'chiayi-coffee',
      'hualien-daylily',
      'taitung-roselle',
      'keelung-squid',
      'new-taipei-flower-crab',
      'changhua-clam',
      'chiayi-oyster',
      'kaohsiung-grouper',
      'pingtung-bluefin-tuna',
      'yilan-mackerel',
      'penghu-cobia',
      'taoyuan-chicken',
      'yunlin-pork',
      'kinmen-beef',
      'lienchiang-red-yeast',
    ]);
    for (const id of Object.keys(PRODUCT_ARTWORK)) {
      expect(PRODUCTS.some((product) => product.id === id)).toBe(true);
      expect(getProductArtwork(id)?.assetUrl).toMatch(/\.png$/);
    }
  });

  it('keeps the three tea product IDs mapped to distinct supplied assets', () => {
    const teaArtwork = [
      'taipei-tieguanyin',
      'new-taipei-baozhong-tea',
      'hsinchu-oriental-beauty-tea',
    ].map((id) => getProductArtwork(id));

    expect(teaArtwork).not.toContain(null);
    expect(new Set(teaArtwork.map((artwork) => artwork?.assetUrl)).size).toBe(3);
  });

  it('keeps all four rice product IDs mapped to distinct supplied assets', () => {
    const riceArtwork = ['changhua-rice', 'taoyuan-rice', 'chiayi-rice', 'hualien-rice'].map((id) =>
      getProductArtwork(id),
    );

    expect(riceArtwork).not.toContain(null);
    expect(new Set(riceArtwork.map((artwork) => artwork?.assetUrl)).size).toBe(4);
  });

  it('keeps the two pineapple product IDs mapped to distinct supplied assets', () => {
    const chiayiPineapple = getProductArtwork('chiayi-pineapple');
    const pingtungPineapple = getProductArtwork('pingtung-pineapple');

    expect(chiayiPineapple).not.toBeNull();
    expect(pingtungPineapple).not.toBeNull();
    expect(chiayiPineapple?.assetUrl).not.toBe(pingtungPineapple?.assetUrl);
  });

  it('maps every sixth batch product ID to formal artwork', () => {
    const sixthBatchIds = [
      'hualien-daylily',
      'taitung-roselle',
      'keelung-squid',
      'new-taipei-flower-crab',
      'changhua-clam',
      'chiayi-oyster',
      'kaohsiung-grouper',
    ];

    for (const id of sixthBatchIds) {
      expect(getProductArtwork(id)).not.toBeNull();
    }
  });

  it('keeps supplied seafood samples mapped to distinct assets', () => {
    const seafoodIds = [
      'keelung-squid',
      'new-taipei-flower-crab',
      'changhua-clam',
      'chiayi-oyster',
      'kaohsiung-grouper',
    ];
    const seafoodArtwork = seafoodIds.map((id) => getProductArtwork(id));

    expect(seafoodArtwork).not.toContain(null);
    expect(new Set(seafoodArtwork.map((artwork) => artwork?.assetUrl)).size).toBe(5);
  });

  it('maps every final batch product ID to formal artwork', () => {
    const finalBatchIds = [
      'pingtung-bluefin-tuna',
      'yilan-mackerel',
      'penghu-cobia',
      'taoyuan-chicken',
      'yunlin-pork',
      'kinmen-beef',
      'lienchiang-red-yeast',
    ];

    for (const id of finalBatchIds) {
      expect(getProductArtwork(id)).not.toBeNull();
    }
  });

  it('maps every formal product to an artwork with no text-only fallback', () => {
    expect(PRODUCTS).toHaveLength(48);
    expect(Object.keys(PRODUCT_ARTWORK)).toHaveLength(48);

    for (const product of PRODUCTS) {
      expect(getProductArtwork(product.id)).not.toBeNull();
      expect(renderProductArtwork(product)).toContain('data-product-artwork');
    }
  });

  it('keeps all fish product IDs mapped to distinct supplied assets', () => {
    const fishIds = [
      'tainan-milkfish',
      'kaohsiung-grouper',
      'pingtung-bluefin-tuna',
      'yilan-mackerel',
      'penghu-cobia',
    ];
    const fishArtwork = fishIds.map((id) => getProductArtwork(id));

    expect(fishArtwork).not.toContain(null);
    expect(new Set(fishArtwork.map((artwork) => artwork?.assetUrl)).size).toBe(5);
  });

  it('keeps all livestock product IDs mapped to distinct supplied assets', () => {
    const livestockIds = ['taoyuan-chicken', 'changhua-eggs', 'yunlin-pork', 'kinmen-beef'];
    const livestockArtwork = livestockIds.map((id) => getProductArtwork(id));

    expect(livestockArtwork).not.toContain(null);
    expect(new Set(livestockArtwork.map((artwork) => artwork?.assetUrl)).size).toBe(4);
  });
});
