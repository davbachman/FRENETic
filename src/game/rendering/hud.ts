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

interface HudLayout {
  curvatureMeter: Rect;
  torsionMeter: Rect;
  minimap: Rect;
  radar: Rect;
}

interface RadarVector {
  start: MinimapPoint;
  end: MinimapPoint;
}

interface RadarVectors {
  blue: RadarVector;
  red: RadarVector;
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

export function calculateSignedMeterGeometry(
  value: number,
  acceptableRange: [number, number],
  maxMagnitude: number,
): MeterGeometry {
  const max = Math.max(1e-6, Math.abs(finiteOrZero(maxMagnitude)));
  const start = Math.min(acceptableRange[0], acceptableRange[1]);
  const end = Math.max(acceptableRange[0], acceptableRange[1]);
  const normalize = (input: number): number => clamp01((finiteOrZero(input) + max) / (max * 2));

  return {
    indicator: normalize(value),
    acceptableStart: normalize(start),
    acceptableEnd: normalize(end),
  };
}

export function calculateMeterTrack(rect: Rect): Rect {
  const horizontalPadding = Math.min(24, Math.max(14, rect.width * 0.1));
  const trackHeight = rect.height < 70 ? 10 : 14;
  return {
    x: rect.x + horizontalPadding,
    y: rect.y + rect.height - trackHeight - 18,
    width: Math.max(1, rect.width - horizontalPadding * 2),
    height: trackHeight,
  };
}

export function calculateRadarHudRect(width: number, height: number): Rect {
  return getRadarRect(width, height);
}

export function calculateResponsiveHudLayout(width: number, height: number): HudLayout {
  const minDimension = Math.min(width, height);
  const margin = Math.max(8, Math.min(28, minDimension * 0.035));
  const gap = Math.max(8, Math.min(18, width * 0.03));
  const meterMaxWidth = width < 700 ? 320 : 430;
  const meterAvailableWidth = Math.max(0, (width - margin * 2 - gap) / 2);
  const meterWidth = Math.min(
    meterMaxWidth,
    meterAvailableWidth,
    Math.max(132, (width - margin * 2 - gap) / 2, width * 0.3),
  );
  const meterHeight = width < 560 ? 58 : 86;
  const bottomGap = Math.max(8, Math.min(18, width * 0.035));
  const radar = getRadarRect(width, height);
  const minimapAvailableWidth = Math.max(0, radar.x - margin - bottomGap);
  const bottomSize = Math.min(230, Math.max(96, minDimension * 0.26), minimapAvailableWidth);
  const bottomY = height - Math.max(bottomSize, radar.height) - margin;

  return {
    curvatureMeter: { x: margin, y: 18, width: meterWidth, height: meterHeight },
    torsionMeter: { x: width - margin - meterWidth, y: 18, width: meterWidth, height: meterHeight },
    minimap: { x: margin, y: bottomY, width: bottomSize, height: bottomSize },
    radar,
  };
}

export function calculateStatusTextY(width: number, layout: HudLayout): number {
  if (width < 560) {
    return Math.max(
      layout.curvatureMeter.y + layout.curvatureMeter.height,
      layout.torsionMeter.y + layout.torsionMeter.height,
    ) + 15;
  }

  return 31;
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

export function calculateRadarVectors(steering: Vec2, cx: number, cy: number, radius: number): RadarVectors {
  const blueEnd = {
    x: cx + steering.x * radius,
    y: cy - steering.y * radius,
  };
  const redScale = radius * 0.74;
  return {
    blue: {
      start: { x: cx, y: cy },
      end: blueEnd,
    },
    red: {
      start: blueEnd,
      end: {
        x: blueEnd.x - steering.y * redScale,
        y: blueEnd.y - steering.x * redScale,
      },
    },
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

  private traceAngularPanel(rect: Rect, bevel: number): void {
    const ctx = this.ctx;
    const cut = Math.min(bevel, rect.width * 0.18, rect.height * 0.42);
    ctx.beginPath();
    ctx.moveTo(rect.x + cut, rect.y);
    ctx.lineTo(rect.x + rect.width - cut, rect.y);
    ctx.lineTo(rect.x + rect.width, rect.y + cut);
    ctx.lineTo(rect.x + rect.width, rect.y + rect.height - cut);
    ctx.lineTo(rect.x + rect.width - cut, rect.y + rect.height);
    ctx.lineTo(rect.x + cut, rect.y + rect.height);
    ctx.lineTo(rect.x, rect.y + rect.height - cut);
    ctx.lineTo(rect.x, rect.y + cut);
    ctx.closePath();
  }

  private drawAngularPanel(rect: Rect, color: string, intensity = 1): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 * intensity;
    this.traceAngularPanel(rect, Math.min(20, rect.height * 0.28));
    ctx.fillStyle = hudColors.glassFill;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hudColors.magenta;
    ctx.globalAlpha = 0.32 * intensity;
    ctx.beginPath();
    ctx.moveTo(rect.x + 28, rect.y + rect.height - 8);
    ctx.lineTo(rect.x + rect.width - 28, rect.y + rect.height - 8);
    ctx.stroke();
    ctx.restore();
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
    const layout = calculateResponsiveHudLayout(width, this.canvas.height);
    const curvatureMax = Math.max(
      game.level.acceptableCurvature[1] * 1.35,
      simulation.player.currentCurvature,
      0.75,
    );
    const torsionMax = Math.max(
      Math.abs(game.level.acceptableTorsion[0]),
      Math.abs(game.level.acceptableTorsion[1]),
      Math.abs(simulation.player.currentTorsion),
      0.15,
    ) * 1.35;

    this.drawMeter(
      layout.curvatureMeter,
      'CURV',
      simulation.player.currentCurvature,
      game.level.acceptableCurvature,
      curvatureMax,
      hudColors.blue,
    );
    this.drawMeter(
      layout.torsionMeter,
      'TORS',
      simulation.player.currentTorsion,
      game.level.acceptableTorsion,
      torsionMax,
      hudColors.green,
      true,
    );
  }

  private drawMeter(
    rect: Rect,
    label: string,
    value: number,
    acceptableRange: [number, number],
    maxValue: number,
    color: string,
    signed = false,
  ): void {
    const ctx = this.ctx;
    this.drawAngularPanel(rect, color, 1);
    const track = calculateMeterTrack(rect);
    const geometry = signed
      ? calculateSignedMeterGeometry(value, acceptableRange, maxValue)
      : calculateMeterGeometry(value, acceptableRange, maxValue);

    ctx.save();
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(label === 'CURV' ? 'CURVATURE' : 'TORSION', rect.x + 24, rect.y + 19);

    ctx.font = rect.width < 170
      ? '20px ui-monospace, SFMono-Regular, Menlo, monospace'
      : '32px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillText(value.toFixed(2), rect.x + 24, rect.y + (rect.height < 70 ? 42 : 52));

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(track.x, track.y, track.width, track.height);

    const dangerGradient = ctx.createLinearGradient(track.x, 0, track.x + track.width, 0);
    dangerGradient.addColorStop(0, hudColors.danger);
    dangerGradient.addColorStop(0.32, hudColors.amber);
    dangerGradient.addColorStop(0.5, hudColors.safe);
    dangerGradient.addColorStop(0.68, hudColors.amber);
    dangerGradient.addColorStop(1, hudColors.danger);
    ctx.fillStyle = dangerGradient;
    ctx.globalAlpha = 0.72;
    ctx.fillRect(track.x, track.y, track.width, track.height);
    ctx.globalAlpha = 1;

    ctx.fillStyle = signed ? 'rgba(112, 255, 157, 0.54)' : 'rgba(50, 229, 109, 0.56)';
    ctx.fillRect(
      track.x + geometry.acceptableStart * track.width,
      track.y,
      Math.max(2, (geometry.acceptableEnd - geometry.acceptableStart) * track.width),
      track.height,
    );

    if (signed) {
      const center = track.x + track.width / 2;
      ctx.fillStyle = 'rgba(218, 252, 255, 0.38)';
      ctx.fillRect(center - 0.5, track.y - 4, 1, track.height + 8);
    }

    const indicatorX = track.x + geometry.indicator * track.width;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(indicatorX, track.y - 8);
    ctx.lineTo(indicatorX - 7, track.y - 18);
    ctx.lineTo(indicatorX + 7, track.y - 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(indicatorX - 1, track.y - 2, 2, track.height + 7);

    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    const arcCx = rect.x + rect.width - Math.min(66, rect.width * 0.22);
    const arcCy = rect.y + Math.min(39, rect.height * 0.45);
    const arcRadius = Math.min(34, rect.width * 0.11, rect.height * 0.38);
    ctx.beginPath();
    ctx.arc(arcCx, arcCy, arcRadius, Math.PI * 1.05, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();
  }

  private drawMinimap(simulation: SimulationState, width: number, height: number): void {
    const rect = calculateResponsiveHudLayout(width, height).minimap;
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
    const rect = calculateResponsiveHudLayout(width, height).radar;
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

    const vectors = calculateRadarVectors(simulation.player.smoothedSteering, cx, cy, radius);
    this.drawHistory(simulation.player.steeringHistory, cx, cy, radius);
    this.drawVector(vectors.blue.start, vectors.blue.end, hudColors.blue, 3);
    this.drawVector(
      vectors.red.start,
      vectors.red.end,
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
    start: MinimapPoint,
    end: MinimapPoint,
    color: string,
    lineWidth: number,
  ): void {
    const ctx = this.ctx;
    const angle = Math.atan2(start.y - end.y, end.x - start.x);
    const head = 8;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - Math.cos(angle - 0.52) * head, end.y + Math.sin(angle - 0.52) * head);
    ctx.lineTo(end.x - Math.cos(angle + 0.52) * head, end.y + Math.sin(angle + 0.52) * head);
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
    const statusY = calculateStatusTextY(width, calculateResponsiveHudLayout(width, height));
    ctx.save();
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'center';
    ctx.fillText(
      `${game.levelIndex + 1}/${game.levels.length} ${game.level.name}  ${(simulation.player.progress * 100).toFixed(0)}%  H:${Math.round(simulation.player.health * 100)}`,
      width / 2,
      statusY,
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
