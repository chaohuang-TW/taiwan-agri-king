import { describe, expect, it } from 'vitest';
import { BOARD_TILES } from '../src/data/board';
import { validateBoard } from '../src/game/dataValidation';
import type { BoardTile } from '../src/game/types';

const cloneBoard = (): BoardTile[] => structuredClone(BOARD_TILES);

describe('棋盤資料', () => {
  it('恰好30格且position完整唯一', () => {
    expect(BOARD_TILES).toHaveLength(30);
    expect(BOARD_TILES.map(({ position }) => position).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 30 }, (_, index) => index),
    );
    expect(() => validateBoard()).not.toThrow();
  });

  it('符合預期格型分配', () => {
    const count = (type: BoardTile['type']) =>
      BOARD_TILES.filter((tile) => tile.type === type).length;
    expect(count('production')).toBe(16);
    expect(count('farmers-association')).toBe(4);
    expect(count('fishers-association')).toBe(2);
    expect(count('market')).toBe(3);
    expect(count('event')).toBe(3);
    expect(count('transport')).toBe(2);
  });

  it.each([
    [
      '重複position',
      (board: BoardTile[]) => {
        board[1]!.position = 0;
      },
      '不得重複',
    ],
    [
      '產地缺縣市',
      (board: BoardTile[]) => {
        delete board.find((tile) => tile.type === 'production')!.countyId;
      },
      '必須有countyId',
    ],
    [
      '錯誤產品',
      (board: BoardTile[]) => {
        board[1]!.productIds = ['missing'];
      },
      '不存在的產品',
    ],
    [
      '錯誤目的地',
      (board: BoardTile[]) => {
        board[0]!.transportDestinationIds = ['missing'];
      },
      '不存在的目的地',
    ],
    [
      '非交通目的地',
      (board: BoardTile[]) => {
        board[1]!.transportDestinationIds = ['penghu-island-stop'];
      },
      '非交通格',
    ],
  ])('拒絕錯誤棋盤資料：%s', (_label, mutate, message) => {
    const board = cloneBoard();
    mutate(board);
    expect(() => validateBoard(board)).toThrow(message);
  });
});
