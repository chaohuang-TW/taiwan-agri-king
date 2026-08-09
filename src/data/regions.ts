import type { Region, TaiwanRegion } from '../game/types';

export const REGIONS: Region[] = [
  { id: 'north', name: '北部', description: '都會近郊、丘陵茶園與北海岸漁業交織。' },
  { id: 'central', name: '中部', description: '盆地、山區與濁水溪平原孕育多樣農產。' },
  { id: 'south', name: '南部', description: '日照充足，果品、蔬菜、養殖與近海漁業興盛。' },
  { id: 'east', name: '東部', description: '縱谷稻作、山海物產與特色作物並存。' },
  { id: 'offshore', name: '離島', description: '海島環境形成獨特漁產、畜產與特色作物。' },
];

export const REGION_NAMES: Record<TaiwanRegion, string> = Object.fromEntries(
  REGIONS.map((region) => [region.id, region.name]),
) as Record<TaiwanRegion, string>;
