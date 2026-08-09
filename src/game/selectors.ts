import { BOARD_TILES } from '../data/board';
import { PRODUCTS } from '../data/products';
import { getMarketCard } from './market';
import type { BoardTile, GameState, PlayerState, Product } from './types';

export function getCurrentPlayer(state: GameState): PlayerState {
  const player = state.players[state.currentPlayerIndex];
  if (!player) throw new Error('找不到目前玩家。');
  return player;
}

export function getTileByPosition(position: number): BoardTile {
  const tile = BOARD_TILES.find((candidate) => candidate.position === position);
  if (!tile) throw new Error(`找不到位置 ${position} 的棋盤格。`);
  return tile;
}

export function getTileById(id: string): BoardTile {
  const tile = BOARD_TILES.find((candidate) => candidate.id === id);
  if (!tile) throw new Error(`找不到棋盤格：${id}`);
  return tile;
}

export function getProductById(id: string): Product {
  const product = PRODUCTS.find((candidate) => candidate.id === id);
  if (!product) throw new Error(`找不到產品：${id}`);
  return product;
}

export function getActiveMarketCard(state: GameState) {
  return getMarketCard(state.marketDeck.activeCardId);
}
