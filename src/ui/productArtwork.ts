import type { Product } from '../game/types';

import strawberryUrl from '../assets/products/miaoli-strawberry.png';
import riceUrl from '../assets/products/changhua-rice.png';
import bambooShootUrl from '../assets/products/new-taipei-bamboo-shoot.png';
import teaUrl from '../assets/products/nantou-high-mountain-tea.png';
import fishUrl from '../assets/products/tainan-milkfish.png';
import eggsUrl from '../assets/products/changhua-eggs.png';
import wendanUrl from '../assets/products/new-taipei-wendan.png';
import taoyuanPersimmonUrl from '../assets/products/taoyuan-persimmon.png';
import hsinchuPersimmonUrl from '../assets/products/hsinchu-persimmon.png';
import pearUrl from '../assets/products/taichung-pear.png';
import grapeUrl from '../assets/products/changhua-grape.png';
import plumUrl from '../assets/products/nantou-plum.png';
import pineappleUrl from '../assets/products/chiayi-pineapple.png';

export interface ProductArtwork {
  productId: string;
  assetUrl: string;
  alt: string;
}

export const PRODUCT_ARTWORK: Readonly<Record<string, ProductArtwork>> = {
  'miaoli-strawberry': {
    productId: 'miaoli-strawberry',
    assetUrl: strawberryUrl,
    alt: '草莓產品圖',
  },
  'changhua-rice': {
    productId: 'changhua-rice',
    assetUrl: riceUrl,
    alt: '稻米產品圖',
  },
  'new-taipei-bamboo-shoot': {
    productId: 'new-taipei-bamboo-shoot',
    assetUrl: bambooShootUrl,
    alt: '綠竹筍產品圖',
  },
  'nantou-high-mountain-tea': {
    productId: 'nantou-high-mountain-tea',
    assetUrl: teaUrl,
    alt: '高山茶產品圖',
  },
  'tainan-milkfish': {
    productId: 'tainan-milkfish',
    assetUrl: fishUrl,
    alt: '虱目魚產品圖',
  },
  'changhua-eggs': {
    productId: 'changhua-eggs',
    assetUrl: eggsUrl,
    alt: '雞蛋產品圖',
  },
  'new-taipei-wendan': {
    productId: 'new-taipei-wendan',
    assetUrl: wendanUrl,
    alt: '文旦柚產品圖',
  },
  'taoyuan-persimmon': {
    productId: 'taoyuan-persimmon',
    assetUrl: taoyuanPersimmonUrl,
    alt: '甜柿產品圖',
  },
  'hsinchu-persimmon': {
    productId: 'hsinchu-persimmon',
    assetUrl: hsinchuPersimmonUrl,
    alt: '柿餅用柿產品圖',
  },
  'taichung-pear': {
    productId: 'taichung-pear',
    assetUrl: pearUrl,
    alt: '高接梨產品圖',
  },
  'changhua-grape': {
    productId: 'changhua-grape',
    assetUrl: grapeUrl,
    alt: '葡萄產品圖',
  },
  'nantou-plum': {
    productId: 'nantou-plum',
    assetUrl: plumUrl,
    alt: '青梅產品圖',
  },
  'chiayi-pineapple': {
    productId: 'chiayi-pineapple',
    assetUrl: pineappleUrl,
    alt: '嘉義鳳梨產品圖',
  },
};

export function getProductArtwork(productId: string): ProductArtwork | null {
  return PRODUCT_ARTWORK[productId] ?? null;
}

export function renderProductArtwork(product: Product, className = ''): string {
  const artwork = getProductArtwork(product.id);
  if (!artwork) return '';
  return `<img class="product-artwork ${className}" src="${artwork.assetUrl}" alt="${artwork.alt}" data-product-artwork="${product.id}" loading="lazy" decoding="async" draggable="false" />`;
}
