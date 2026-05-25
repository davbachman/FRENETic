import type { GameState } from '../state/gameState';
import type { SimulationState } from '../simulation/types';

export function buildTextState(game: GameState, simulation: SimulationState): string {
  const { player } = simulation;
  return JSON.stringify({
    coordinateSystem: 'World uses x/y minimap plane and +z as minimap screen normal/up.',
    mode: game.mode,
    level: {
      id: game.level.id,
      name: game.level.name,
      index: game.levelIndex,
      count: game.levels.length,
    },
    camera: {
      progress: Number(player.progress.toFixed(3)),
      distanceFromCenterline: 0,
      currentCurvature: Number(player.currentCurvature.toFixed(3)),
      currentTorsion: Number(player.currentTorsion.toFixed(3)),
    },
    hud: {
      minimapVisible: true,
      tangentBinormalPlaneVisible: true,
      meterStyle: 'vector-colored-retro-arc',
    },
  });
}
