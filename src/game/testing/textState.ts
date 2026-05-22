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
    player: {
      health: Number(player.health.toFixed(3)),
      progress: Number(player.progress.toFixed(3)),
      distanceFromCenterline: Number(player.distanceFromCenterline.toFixed(3)),
      warning: Number(player.warning.toFixed(3)),
      currentCurvature: Number(player.currentCurvature.toFixed(3)),
      currentTorsion: Number(player.currentTorsion.toFixed(3)),
      rawSteering: {
        x: Number(player.rawSteering.x.toFixed(3)),
        y: Number(player.rawSteering.y.toFixed(3)),
      },
      smoothedSteering: {
        x: Number(player.smoothedSteering.x.toFixed(3)),
        y: Number(player.smoothedSteering.y.toFixed(3)),
      },
    },
    hud: {
      minimapVisible: true,
      radarVisible: true,
      curvatureMeterColor: 'blue',
      torsionMeterColor: 'green',
      steeringTracePoints: player.steeringHistory.length,
    },
  });
}
