import type { Vec2 } from './types';

export function smoothSteering(
  current: Vec2,
  target: Vec2,
  dt: number,
  responseSeconds: number,
): Vec2 {
  const factor = 1 - Math.exp(-dt / Math.max(responseSeconds, 1e-6));
  return {
    x: current.x + (target.x - current.x) * factor,
    y: current.y + (target.y - current.y) * factor,
  };
}

export function clampSteering(input: Vec2): Vec2 {
  const length = Math.hypot(input.x, input.y);
  if (length <= 1) {
    return input;
  }

  return {
    x: input.x / length,
    y: input.y / length,
  };
}
