import type { Product } from '../game/types';

import strawberryUrl from '../assets/products/miaoli-strawberry.webp';
import riceUrl from '../assets/products/changhua-rice.webp';
import bambooShootUrl from '../assets/products/new-taipei-bamboo-shoot.webp';
import teaUrl from '../assets/products/nantou-high-mountain-tea.webp';
import fishUrl from '../assets/products/tainan-milkfish.webp';
import eggsUrl from '../assets/products/changhua-eggs.webp';
import wendanUrl from '../assets/products/new-taipei-wendan.webp';
import taoyuanPersimmonUrl from '../assets/products/taoyuan-persimmon.webp';
import hsinchuPersimmonUrl from '../assets/products/hsinchu-persimmon.webp';
import pearUrl from '../assets/products/taichung-pear.webp';
import grapeUrl from '../assets/products/changhua-grape.webp';
import plumUrl from '../assets/products/nantou-plum.webp';
import pineappleUrl from '../assets/products/chiayi-pineapple.webp';
import mangoUrl from '../assets/products/tainan-mango.webp';
import jujubeUrl from '../assets/products/kaohsiung-jujube.webp';
import pingtungPineappleUrl from '../assets/products/pingtung-pineapple.webp';
import custardAppleUrl from '../assets/products/taitung-custard-apple.webp';
import taoyuanRiceUrl from '../assets/products/taoyuan-rice.webp';
import taroUrl from '../assets/products/miaoli-taro.webp';
import peanutUrl from '../assets/products/yunlin-peanut.webp';
import chiayiRiceUrl from '../assets/products/chiayi-rice.webp';
import edamameUrl from '../assets/products/kaohsiung-edamame.webp';
import hualienRiceUrl from '../assets/products/hualien-rice.webp';
import milletUrl from '../assets/products/taitung-millet.webp';
import mushroomUrl from '../assets/products/taichung-mushroom.webp';
import cabbageUrl from '../assets/products/yunlin-cabbage.webp';
import sweetCornUrl from '../assets/products/chiayi-sweet-corn.webp';
import carrotUrl from '../assets/products/tainan-carrot.webp';
import onionUrl from '../assets/products/pingtung-onion.webp';
import scallionUrl from '../assets/products/yilan-scallion.webp';
import tieguanyinUrl from '../assets/products/taipei-tieguanyin.webp';
import baozhongTeaUrl from '../assets/products/new-taipei-baozhong-tea.webp';
import orientalBeautyTeaUrl from '../assets/products/hsinchu-oriental-beauty-tea.webp';
import coffeeUrl from '../assets/products/chiayi-coffee.webp';
import daylilyUrl from '../assets/products/hualien-daylily.webp';
import roselleUrl from '../assets/products/taitung-roselle.webp';
import squidUrl from '../assets/products/keelung-squid.webp';
import flowerCrabUrl from '../assets/products/new-taipei-flower-crab.webp';
import clamUrl from '../assets/products/changhua-clam.webp';
import oysterUrl from '../assets/products/chiayi-oyster.webp';
import grouperUrl from '../assets/products/kaohsiung-grouper.webp';
import bluefinTunaUrl from '../assets/products/pingtung-bluefin-tuna.webp';
import mackerelUrl from '../assets/products/yilan-mackerel.webp';
import cobiaUrl from '../assets/products/penghu-cobia.webp';
import chickenUrl from '../assets/products/taoyuan-chicken.webp';
import porkUrl from '../assets/products/yunlin-pork.webp';
import beefUrl from '../assets/products/kinmen-beef.webp';
import redYeastUrl from '../assets/products/lienchiang-red-yeast.webp';

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
  'tainan-mango': {
    productId: 'tainan-mango',
    assetUrl: mangoUrl,
    alt: '芒果產品圖',
  },
  'kaohsiung-jujube': {
    productId: 'kaohsiung-jujube',
    assetUrl: jujubeUrl,
    alt: '蜜棗產品圖',
  },
  'pingtung-pineapple': {
    productId: 'pingtung-pineapple',
    assetUrl: pingtungPineappleUrl,
    alt: '屏東鳳梨產品圖',
  },
  'taitung-custard-apple': {
    productId: 'taitung-custard-apple',
    assetUrl: custardAppleUrl,
    alt: '釋迦產品圖',
  },
  'taoyuan-rice': {
    productId: 'taoyuan-rice',
    assetUrl: taoyuanRiceUrl,
    alt: '桃園稻米產品圖',
  },
  'miaoli-taro': {
    productId: 'miaoli-taro',
    assetUrl: taroUrl,
    alt: '芋頭產品圖',
  },
  'yunlin-peanut': {
    productId: 'yunlin-peanut',
    assetUrl: peanutUrl,
    alt: '花生產品圖',
  },
  'chiayi-rice': {
    productId: 'chiayi-rice',
    assetUrl: chiayiRiceUrl,
    alt: '嘉義稻米產品圖',
  },
  'kaohsiung-edamame': {
    productId: 'kaohsiung-edamame',
    assetUrl: edamameUrl,
    alt: '毛豆產品圖',
  },
  'hualien-rice': {
    productId: 'hualien-rice',
    assetUrl: hualienRiceUrl,
    alt: '花蓮稻米產品圖',
  },
  'taitung-millet': {
    productId: 'taitung-millet',
    assetUrl: milletUrl,
    alt: '小米產品圖',
  },
  'taichung-mushroom': {
    productId: 'taichung-mushroom',
    assetUrl: mushroomUrl,
    alt: '香菇產品圖',
  },
  'yunlin-cabbage': {
    productId: 'yunlin-cabbage',
    assetUrl: cabbageUrl,
    alt: '高麗菜產品圖',
  },
  'chiayi-sweet-corn': {
    productId: 'chiayi-sweet-corn',
    assetUrl: sweetCornUrl,
    alt: '甜玉米產品圖',
  },
  'tainan-carrot': {
    productId: 'tainan-carrot',
    assetUrl: carrotUrl,
    alt: '胡蘿蔔產品圖',
  },
  'pingtung-onion': {
    productId: 'pingtung-onion',
    assetUrl: onionUrl,
    alt: '洋蔥產品圖',
  },
  'yilan-scallion': {
    productId: 'yilan-scallion',
    assetUrl: scallionUrl,
    alt: '三星蔥產品圖',
  },
  'taipei-tieguanyin': {
    productId: 'taipei-tieguanyin',
    assetUrl: tieguanyinUrl,
    alt: '木柵鐵觀音產品圖',
  },
  'new-taipei-baozhong-tea': {
    productId: 'new-taipei-baozhong-tea',
    assetUrl: baozhongTeaUrl,
    alt: '文山包種茶產品圖',
  },
  'hsinchu-oriental-beauty-tea': {
    productId: 'hsinchu-oriental-beauty-tea',
    assetUrl: orientalBeautyTeaUrl,
    alt: '東方美人茶產品圖',
  },
  'chiayi-coffee': {
    productId: 'chiayi-coffee',
    assetUrl: coffeeUrl,
    alt: '阿里山咖啡產品圖',
  },
  'hualien-daylily': {
    productId: 'hualien-daylily',
    assetUrl: daylilyUrl,
    alt: '金針產品圖',
  },
  'taitung-roselle': {
    productId: 'taitung-roselle',
    assetUrl: roselleUrl,
    alt: '洛神葵產品圖',
  },
  'keelung-squid': {
    productId: 'keelung-squid',
    assetUrl: squidUrl,
    alt: '鎖管產品圖',
  },
  'new-taipei-flower-crab': {
    productId: 'new-taipei-flower-crab',
    assetUrl: flowerCrabUrl,
    alt: '花蟹產品圖',
  },
  'changhua-clam': {
    productId: 'changhua-clam',
    assetUrl: clamUrl,
    alt: '文蛤產品圖',
  },
  'chiayi-oyster': {
    productId: 'chiayi-oyster',
    assetUrl: oysterUrl,
    alt: '牡蠣產品圖',
  },
  'kaohsiung-grouper': {
    productId: 'kaohsiung-grouper',
    assetUrl: grouperUrl,
    alt: '石斑魚產品圖',
  },
  'pingtung-bluefin-tuna': {
    productId: 'pingtung-bluefin-tuna',
    assetUrl: bluefinTunaUrl,
    alt: '黑鮪魚產品圖',
  },
  'yilan-mackerel': {
    productId: 'yilan-mackerel',
    assetUrl: mackerelUrl,
    alt: '鯖魚產品圖',
  },
  'penghu-cobia': {
    productId: 'penghu-cobia',
    assetUrl: cobiaUrl,
    alt: '海鱺產品圖',
  },
  'taoyuan-chicken': {
    productId: 'taoyuan-chicken',
    assetUrl: chickenUrl,
    alt: '土雞產品圖',
  },
  'yunlin-pork': {
    productId: 'yunlin-pork',
    assetUrl: porkUrl,
    alt: '豬肉產品圖',
  },
  'kinmen-beef': {
    productId: 'kinmen-beef',
    assetUrl: beefUrl,
    alt: '牛肉產品圖',
  },
  'lienchiang-red-yeast': {
    productId: 'lienchiang-red-yeast',
    assetUrl: redYeastUrl,
    alt: '紅麴產品圖',
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
