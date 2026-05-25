import type { LevelDefinition } from '../curves/types';

export type GameMode = 'demo';

const DEMO_LEVEL_INDEX = 3;

export interface GameState {
  mode: GameMode;
  levels: LevelDefinition[];
  levelIndex: number;
  level: LevelDefinition;
}

export function createGameState(levels: LevelDefinition[]): GameState {
  if (levels.length === 0) {
    throw new Error('FRENETic requires at least one level.');
  }

  const levelIndex = Math.min(DEMO_LEVEL_INDEX, levels.length - 1);
  return {
    mode: 'demo',
    levels,
    levelIndex,
    level: levels[levelIndex],
  };
}
