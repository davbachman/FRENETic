import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
} from 'three';
import type { CurveSample } from '../curves/types';
import { getRadarRect, type Rect } from '../input/pointerTrackpad';
import type { GameState } from '../state/gameState';
import type { SimulationState, SteeringHistoryPoint, Vec2 } from '../simulation/types';
import { hudColors } from './colors';

interface MeterGeometry {
  indicator: number;
  acceptableStart: number;
  acceptableEnd: number;
}

interface MinimapPoint {
  x: number;
  y: number;
}

interface MinimapProjection {
  points: MinimapPoint[];
  nearest: MinimapPoint;
}

interface TorsionArc {
  direction: 1 | -1;
  opacity: number;
}

const PANEL_FILL = 'rgba(2, 10, 18, 0.64)';
const PANEL_STROKE = 'rgba(54, 243, 255, 0.62)';
const GRID_STROKE = 'rgba(54, 243, 255, 0.16)';
const TEXT = 'rgba(218, 252, 255, 0.92)';
const TEXT_DIM = 'rgba(180, 232, 238, 0.64)';
const TAU = Math.PI * 2;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function calculateMeterGeometry(
  value: number,
  acceptableRange: [number, number],
  maxValue: number,
): MeterGeometry {
  const max = Math.max(1e-6, finiteOrZero(maxValue));
  const start = Math.min(acceptableRange[0], acceptableRange[1]);
  const end = Math.max(acceptableRange[0], acceptableRange[1]);

  return {
    indicator: clamp01(finiteOrZero(value) / max),
    acceptableStart: clamp01(finiteOrZero(start) / max),
    acceptableEnd: clamp01(finiteOrZero(end) / max),
  };
}

export function calculateRadarHudRect(width: number, height: number): Rect {
  return getRadarRect(width, height);
}

export function calculateMinimapProjection(
  samples: CurveSample[],
  nearestSample: CurveSample,
  rect: Rect,
): MinimapProjection {
  if (samples.length === 0) {
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    return { points: [], nearest: center };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const sample of samples) {
    minX = Math.min(minX, sample.position.x);
    maxX = Math.max(maxX, sample.position.x);
    minY = Math.min(minY, sample.position.y);
    maxY = Math.max(maxY, sample.position.y);
  }

  const padding = Math.min(18, Math.max(10, Math.min(rect.width, rect.height) * 0.1));
  const usableWidth = Math.max(1, rect.width - padding * 2);
  const usableHeight = Math.max(1, rect.height - padding * 2);
  const rangeX = Math.max(1e-6, maxX - minX);
  const rangeY = Math.max(1e-6, maxY - minY);
  const scale = Math.min(usableWidth / rangeX, usableHeight / rangeY);
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const worldCenterX = (minX + maxX) / 2;
  const worldCenterY = (minY + maxY) / 2;

  const project = (sample: CurveSample): MinimapPoint => ({
    x: centerX + (sample.position.x - worldCenterX) * scale,
    y: centerY - (sample.position.y - worldCenterY) * scale,
  });

  const points = samples.map(project);
  const nearest = points[nearestSample.index] ?? project(nearestSample);
  return { points, nearest };
}

export function calculateTorsionArc(torsion: number, acceptableRange: [number, number]): TorsionArc {
  const maxMagnitude = Math.max(Math.abs(acceptableRange[0]), Math.abs(acceptableRange[1]), 1e-6);
  return {
    direction: torsion < 0 ? -1 : 1,
    opacity: clamp01(Math.abs(finiteOrZero(torsion)) / maxMagnitude),
  };
}

export class HudOverlay {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: CanvasTexture;
  private readonly material: MeshBasicMaterial;
  private readonly geometry = new PlaneGeometry(2, 2);
  private readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;

  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('HUD overlay requires a 2D canvas context.');
    }

    this.ctx = ctx;
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.texture = new CanvasTexture(this.canvas);
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
  }

  resize(width: number, height: number): void {
    this.canvas.width = Math.max(1, Math.floor(width));
    this.canvas.height = Math.max(1, Math.floor(height));
  }

  draw(game: GameState, simulation: SimulationState): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    this.drawMeters(game, simulation, width);
    this.drawMinimap(simulation, width, height);
    this.drawRadar(simulation, width, height);
    this.drawStatus(game, simulation, width, height);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  private drawPanel(rect: Rect): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = hudColors.cyan;
    ctx.shadowBlur = 12;
    drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 8);
    ctx.fillStyle = PANEL_FILL;
    ctx.fill();
    ctx.strokeStyle = PANEL_STROKE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawMeters(game: GameState, simulation: SimulationState, width: number): void {
    const margin = Math.max(16, Math.min(28, width * 0.025));
    const meterWidth = Math.min(300, Math.max(180, width * 0.28));
    const rectLeft = { x: margin, y: 18, width: meterWidth, height: 46 };
    const rectRight = { x: width - margin - meterWidth, y: 18, width: meterWidth, height: 46 };
    const curvatureMax = Math.max(
      game.level.acceptableCurvature[1] * 1.35,
      simulation.player.currentCurvature,
      0.75,
    );
    const torsionMagnitude = Math.abs(simulation.player.currentTorsion);
    const torsionMax = Math.max(
      Math.abs(game.level.acceptableTorsion[0]),
      Math.abs(game.level.acceptableTorsion[1]),
      torsionMagnitude,
      0.15,
    ) * 1.35;

    this.drawMeter(
      rectLeft,
      'CURV',
      simulation.player.currentCurvature,
      game.level.acceptableCurvature,
      curvatureMax,
      hudColors.blue,
    );
    this.drawMeter(
      rectRight,
      'TORS',
      torsionMagnitude,
      [0, Math.max(Math.abs(game.level.acceptableTorsion[0]), Math.abs(game.level.acceptableTorsion[1]))],
      torsionMax,
      hudColors.green,
    );
  }

  private drawMeter(
    rect: Rect,
    label: string,
    value: number,
    acceptableRange: [number, number],
    maxValue: number,
    color: string,
  ): void {
    const ctx = this.ctx;
    this.drawPanel(rect);
    const track = {
      x: rect.x + 16,
      y: rect.y + 25,
      width: rect.width - 32,
      height: 9,
    };
    const geometry = calculateMeterGeometry(value, acceptableRange, maxValue);

    ctx.save();
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(label, rect.x + 16, rect.y + 16);
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'right';
    ctx.fillText(value.toFixed(2), rect.x + rect.width - 16, rect.y + 16);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.11)';
    ctx.fillRect(track.x, track.y, track.width, track.height);
    ctx.fillStyle = 'rgba(112, 255, 157, 0.34)';
    ctx.fillRect(
      track.x + geometry.acceptableStart * track.width,
      track.y,
      Math.max(2, (geometry.acceptableEnd - geometry.acceptableStart) * track.width),
      track.height,
    );
    const filled = geometry.indicator * track.width;
    const gradient = ctx.createLinearGradient(track.x, 0, track.x + track.width, 0);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.88)');
    ctx.fillStyle = gradient;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillRect(track.x, track.y, filled, track.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(track.x + filled - 1, track.y - 4, 2, track.height + 8);
    ctx.restore();
  }

  private drawMinimap(simulation: SimulationState, width: number, height: number): void {
    const size = Math.max(150, Math.min(230, Math.min(width, height) * 0.26));
    const margin = Math.max(18, Math.min(width, height) * 0.035);
    const rect = { x: margin, y: height - size - margin, width: size, height: size };
    const projection = calculateMinimapProjection(
      simulation.sampled.samples,
      simulation.player.nearestSample,
      rect,
    );
    const ctx = this.ctx;

    this.drawPanel(rect);
    ctx.save();
    ctx.beginPath();
    projection.points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(54, 243, 255, 0.78)';
    ctx.lineWidth = 2;
    ctx.shadowColor = hudColors.cyan;
    ctx.shadowBlur = 8;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(projection.nearest.x, projection.nearest.y, 4, 0, TAU);
    ctx.fill();

    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = TEXT_DIM;
    ctx.shadowBlur = 0;
    ctx.fillText('MAP', rect.x + 13, rect.y + 18);
    ctx.restore();
  }

  private drawRadar(simulation: SimulationState, width: number, height: number): void {
    const rect = calculateRadarHudRect(width, height);
    const ctx = this.ctx;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const radius = rect.width / 2 - 18;

    this.drawPanel(rect);
    ctx.save();
    ctx.strokeStyle = GRID_STROKE;
    ctx.lineWidth = 1;
    for (const scale of [0.33, 0.66, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * scale, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    this.drawHistory(simulation.player.steeringHistory, cx, cy, radius);
    this.drawVector(cx, cy, simulation.player.smoothedSteering, radius, hudColors.blue, 3);
    this.drawVector(
      cx,
      cy,
      {
        x: -simulation.player.smoothedSteering.y,
        y: simulation.player.smoothedSteering.x,
      },
      radius * 0.74,
      hudColors.red,
      2,
    );
    this.drawTorsionArc(cx, cy, radius, simulation.player.currentTorsion, simulation.sampled.level.acceptableTorsion);

    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('RADAR', rect.x + 13, rect.y + 18);
    ctx.restore();
  }

  private drawHistory(history: SteeringHistoryPoint[], cx: number, cy: number, radius: number): void {
    const ctx = this.ctx;
    const maxAge = Math.max(1, ...history.map((point) => point.age));
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const point = history[index];
      const alpha = clamp01(1 - point.age / maxAge) * 0.7;
      const x = cx + point.smoothed.x * radius;
      const y = cy - point.smoothed.y * radius;
      ctx.fillStyle = `rgba(54, 243, 255, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, TAU);
      ctx.fill();
    }
  }

  private drawVector(
    cx: number,
    cy: number,
    steering: Vec2,
    radius: number,
    color: string,
    lineWidth: number,
  ): void {
    const ctx = this.ctx;
    const endX = cx + steering.x * radius;
    const endY = cy - steering.y * radius;
    const angle = Math.atan2(cy - endY, endX - cx);
    const head = 8;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - Math.cos(angle - 0.52) * head, endY + Math.sin(angle - 0.52) * head);
    ctx.lineTo(endX - Math.cos(angle + 0.52) * head, endY + Math.sin(angle + 0.52) * head);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawTorsionArc(
    cx: number,
    cy: number,
    radius: number,
    torsion: number,
    acceptableRange: [number, number],
  ): void {
    const arc = calculateTorsionArc(torsion, acceptableRange);
    const ctx = this.ctx;
    const start = -Math.PI * 0.68;
    const end = start + arc.direction * Math.PI * 1.18;
    const alpha = (arc.opacity * 0.9).toFixed(3);

    ctx.save();
    ctx.strokeStyle = `rgba(112, 255, 157, ${alpha})`;
    ctx.fillStyle = `rgba(112, 255, 157, ${alpha})`;
    ctx.shadowColor = hudColors.green;
    ctx.shadowBlur = 10 * arc.opacity;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.72, start, end, arc.direction < 0);
    ctx.stroke();
    const tipX = cx + Math.cos(end) * radius * 0.72;
    const tipY = cy + Math.sin(end) * radius * 0.72;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawStatus(game: GameState, simulation: SimulationState, width: number, height: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'center';
    ctx.fillText(
      `${game.levelIndex + 1}/${game.levels.length} ${game.level.name}  ${(simulation.player.progress * 100).toFixed(0)}%  H:${Math.round(simulation.player.health * 100)}`,
      width / 2,
      31,
    );

    const message = this.modeMessage(game.mode);
    if (message !== '') {
      ctx.font = '18px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.shadowColor = hudColors.cyan;
      ctx.shadowBlur = 12;
      ctx.fillText(message, width / 2, height * 0.48);
    }
    ctx.restore();
  }

  private modeMessage(mode: GameState['mode']): string {
    switch (mode) {
      case 'start':
        return 'ENTER TO START';
      case 'paused':
        return 'PAUSED';
      case 'complete':
        return 'LEVEL COMPLETE';
      case 'failed':
        return 'SYSTEM FAILED';
      case 'playing':
        return '';
    }
  }
}
