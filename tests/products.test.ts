import { describe, expect, it } from 'vitest';
import { COUNTIES } from '../src/data/counties';
import { PRODUCTS } from '../src/data/products';
import { REGIONS } from '../src/data/regions';
import { validateCounties, validateProducts } from '../src/game/dataValidation';
import type { Product } from '../src/game/types';

const cloneProducts = (): Product[] => structuredClone(PRODUCTS);

describe('產品與縣市資料', () => {
  it('包含22縣市、5地區與48項有效產品', () => {
    expect(COUNTIES).toHaveLength(22);
    expect(REGIONS).toHaveLength(5);
    expect(PRODUCTS).toHaveLength(48);
    expect(() => validateCounties()).not.toThrow();
    expect(() => validateProducts()).not.toThrow();
  });

  it('產品ID、縣市、地區、類別與數值符合規格', () => {
    expect(new Set(PRODUCTS.map(({ id }) => id)).size).toBe(48);
    const countyIds = new Set(COUNTIES.map(({ id }) => id));
    for (const product of PRODUCTS) {
      expect(countyIds.has(product.countyId)).toBe(true);
      expect(product.purchaseCost).toBeGreaterThanOrEqual(1);
      expect(product.purchaseCost).toBeLessThanOrEqual(5);
      expect(product.baseValue).toBeGreaterThanOrEqual(2);
      expect(product.baseValue).toBeLessThanOrEqual(8);
      expect(product.peakSeasons.length).toBeGreaterThan(0);
      expect(Number.isNaN(product.purchaseCost)).toBe(false);
      expect(Number.isNaN(product.baseValue)).toBe(false);
    }
  });

  it('分類數量符合設計目標', () => {
    const count = (category: Product['category']) =>
      PRODUCTS.filter((product) => product.category === category).length;
    expect(count('fruit')).toBe(12);
    expect(count('grain')).toBe(8);
    expect(count('vegetable')).toBe(7);
    expect(count('tea-specialty')).toBe(7);
    expect(count('seafood')).toBe(9);
    expect(count('livestock-other')).toBe(5);
  });

  it.each([
    ['數量', (items: Product[]) => items.pop(), '48項'],
    [
      '重複ID',
      (items: Product[]) => {
        items[1]!.id = items[0]!.id;
      },
      '不得重複',
    ],
    [
      '非法縣市',
      (items: Product[]) => {
        items[0]!.countyId = 'missing';
      },
      '不存在的縣市',
    ],
    [
      '地區不一致',
      (items: Product[]) => {
        items[0]!.region = 'south';
      },
      '不一致',
    ],
    [
      '成本',
      (items: Product[]) => {
        items[0]!.purchaseCost = 0;
      },
      '1至5',
    ],
    [
      '產值',
      (items: Product[]) => {
        items[0]!.baseValue = Number.NaN;
      },
      '有限數字',
    ],
    [
      '旺季',
      (items: Product[]) => {
        items[0]!.peakSeasons = [];
      },
      '至少需要一個旺季',
    ],
    [
      '來源',
      (items: Product[]) => {
        items[0]!.sourceNote = '';
      },
      'sourceNote',
    ],
  ])('拒絕錯誤產品資料：%s', (_label, mutate, message) => {
    const products = cloneProducts();
    mutate(products);
    expect(() => validateProducts(products)).toThrow(message);
  });
});
