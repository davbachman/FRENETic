import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Vector3,
} from 'three';
import {
  calculateFrenetDerivativeVectors,
  projectNormalDerivativeToTangentBinormalDisplay,
  type TangentBinormalDisplayVectors,
} from '../curves/frenetVectors';
import type { CurveSample } from '../curves/types';
import type { GameState } from '../state/gameState';
import type { InvariantHistoryPoint, SimulationState } from '../simulation/types';
import { hudColors } from './colors';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ArcMeterTick {
  normalized: number;
  angle: number;
  label: string;
  major: boolean;
}

interface ArcMeterGeometry {
  startAngle: number;
  endAngle: number;
  needleAngle: number;
  ticks: ArcMeterTick[];
}

interface ArcMeterLayout {
  center: MinimapPoint;
  radiusX: number;
  radiusY: number;
  tickInnerX: number;
  tickInnerY: number;
  labelRadiusX: number;
  labelRadiusY: number;
  needleLength: number;
}

type ArcMeterKind = 'curvature' | 'torsion';

interface ArcMeterVisualStyle {
  scaleColor: string;
  needleColor: string;
}

interface InvariantSymbolStyle {
  color: string;
  shadowBlur: number;
  fontFamily: string;
}

interface HudInsetBorderStyle {
  strokeColor: string;
  accentColor: string;
}

interface MinimapPoint {
  x: number;
  y: number;
}

interface MinimapProjectionPoint extends MinimapPoint {
  depth: number;
}

interface MinimapProjection {
  points: MinimapProjectionPoint[];
  nearest: MinimapProjectionPoint;
}

interface MinimapStrokeSegment {
  start: MinimapProjectionPoint;
  end: MinimapProjectionPoint;
  depth: number;
  alpha: number;
  lineWidth: number;
  shadowBlur: number;
}

interface MinimapTangentVector extends RadarVector {
  label: 'T';
  labelPosition: MinimapPoint;
  labelVisible: boolean;
  color: string;
}

interface HudLayout {
  curvatureMeter: Rect;
  torsionMeter: Rect;
  minimap: Rect;
  radar: Rect;
}

interface InvariantHistoryGraph {
  curvature: MinimapPoint[];
  torsion: MinimapPoint[];
  torsionZeroY: number;
}

interface RadarVector {
  start: MinimapPoint;
  end: MinimapPoint;
}

interface BottomBridgePanel {
  rect: Rect;
  path: MinimapPoint[];
}

interface BottomBridgeVisualStyle {
  fillColor: string;
  strokeColor: string;
}

interface SideVerticalHudGuide {
  x: number;
  start: MinimapPoint;
  end: MinimapPoint;
}

interface SideVerticalHudGuideStyle {
  strokeColor: string;
  lineWidth: number;
  dash: number[];
  shadowBlur: number;
}

interface MainViewDerivativeVectors {
  base: MinimapPoint;
  maxLength: number;
  tangentDerivative: RadarVector;
  normalDerivative: RadarVector;
}

interface DerivativeVectorStyle {
  tangentDerivativeColor?: string;
  normalDerivativeColor: string;
  tProjectionColor?: string;
  bProjectionColor?: string;
}

interface VectorLabelOptions {
  distance: number;
  shadowBlur: number;
  fontSize?: number;
}

const TEXT_DIM = 'rgba(180, 232, 238, 0.64)';
const TAU = Math.PI * 2;
const SCREEN_UP = new Vector3(0, 0, 1);
const DERIVATIVE_VECTOR_DISPLAY_SCALE = 3;
const MAIN_VIEW_VECTOR_LENGTH_RATIO = 0.72;
const MAIN_VIEW_VECTOR_MIN_LENGTH = 216;
const ARC_METER_START = Math.PI * 1.14;
const ARC_METER_END = Math.PI * 1.86;
const ARC_METER_TICKS = 9;
const ARC_METER_TITLE_LEFT_PADDING = 36;
export const CURVATURE_METER_MAX = 0.4;
export const TORSION_METER_MAX_MAGNITUDE = 0.1;
const HUD_HISTORY_SECONDS = 3;
const TORSION_HISTORY_RAIL_MARGIN = 20;
const BOTTOM_BRIDGE_SHOULDER_X = 0.28;
const BOTTOM_BRIDGE_THROAT_TOP = 0.37;
const BOTTOM_BRIDGE_THROAT_BOTTOM = 0.63;
const MINIMAP_TANGENT_LABEL_WIDTH = 7;
const MINIMAP_TANGENT_LABEL_HEIGHT = 10;
const MINIMAP_TANGENT_LABEL_INSET = 4;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function displayNumber(value: number): number {
  const finite = finiteOrZero(value);
  return Math.abs(finite) < 1e-12 ? 0 : finite;
}

function alignStrokeCoordinate(value: number): number {
  return Math.round(value - 0.5) + 0.5;
}

export function calculateHudInsetBorderStyle(): HudInsetBorderStyle {
  return {
    strokeColor: hudColors.red,
    accentColor: hudColors.red,
  };
}

export function calculateMainViewDerivativeVectorStyle(): DerivativeVectorStyle {
  return {
    tangentDerivativeColor: hudColors.blue,
    normalDerivativeColor: hudColors.green,
  };
}

export function calculateMainViewDerivativeVectorLabelOptions(): VectorLabelOptions {
  return {
    distance: 12,
    shadowBlur: 7,
    fontSize: 16,
  };
}

export function calculateTangentBinormalPlaneVectorStyle(): DerivativeVectorStyle {
  return {
    normalDerivativeColor: '#ffffff',
    tProjectionColor: hudColors.blue,
    bProjectionColor: hudColors.green,
  };
}

export function calculateTangentBinormalPlaneNormalLabelOptions(): VectorLabelOptions {
  return {
    distance: 22,
    shadowBlur: 0,
  };
}

export function calculateVectorLabelPosition(
  start: MinimapPoint,
  end: MinimapPoint,
  distance: number,
): MinimapPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-4) {
    return { ...end };
  }

  return {
    x: end.x + (dx / length) * distance + 4,
    y: end.y + (dy / length) * distance - 4,
  };
}

export function formatHudInsetGuideLineColor(alpha = 0.48): string {
  return `rgba(${hudColors.redRgb}, ${clamp01(alpha).toFixed(3)})`;
}

export function formatNormalPlaneBackgroundLineColor(alpha = 0.48): string {
  return formatHudInsetGuideLineColor(alpha);
}

export function formatTangentBinormalPlaneBackgroundLineColor(alpha = 0.48): string {
  return formatHudInsetGuideLineColor(alpha);
}

export function formatMinimapGuideLineColor(alpha = 0.48): string {
  return formatHudInsetGuideLineColor(alpha);
}

export function calculateArcMeterGeometry(
  value: number,
  maxMagnitude: number,
  signed = false,
): ArcMeterGeometry {
  const max = Math.max(1e-6, Math.abs(finiteOrZero(maxMagnitude)));
  const normalize = (input: number): number => signed
    ? clamp01((finiteOrZero(input) + max) / (max * 2))
    : clamp01(finiteOrZero(input) / max);
  const angleFor = (normalized: number): number =>
    ARC_METER_START + normalized * (ARC_METER_END - ARC_METER_START);
  const minValue = signed ? -max : 0;
  const range = signed ? max * 2 : max;

  return {
    startAngle: ARC_METER_START,
    endAngle: ARC_METER_END,
    needleAngle: angleFor(normalize(value)),
    ticks: Array.from({ length: ARC_METER_TICKS }, (_, index) => {
      const normalized = index / (ARC_METER_TICKS - 1);
      const tickValue = minValue + range * normalized;
      return {
        normalized,
        angle: angleFor(normalized),
        label: displayNumber(tickValue).toFixed(2),
        major: index % 2 === 0,
      };
    }),
  };
}

export function calculateArcNeedleEndpoint(
  center: MinimapPoint,
  angle: number,
  length: number,
): MinimapPoint {
  return {
    x: center.x + Math.cos(angle) * length,
    y: center.y + Math.sin(angle) * length,
  };
}

function calculateEllipseRadiusAt(angle: number, radiusX: number, radiusY: number): number {
  return 1 / Math.sqrt(
    (Math.cos(angle) ** 2) / (radiusX ** 2) +
    (Math.sin(angle) ** 2) / (radiusY ** 2),
  );
}

export function calculateClippedNeedleSegment(
  start: MinimapPoint,
  end: MinimapPoint,
  rect: Rect,
): RadarVector | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let t0 = 0;
  let t1 = 1;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) {
      return q >= 0;
    }

    const r = q / p;
    if (p < 0) {
      if (r > t1) {
        return false;
      }
      if (r > t0) {
        t0 = r;
      }
    } else {
      if (r < t0) {
        return false;
      }
      if (r < t1) {
        t1 = r;
      }
    }
    return true;
  };

  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  if (
    !clip(-dx, start.x - rect.x) ||
    !clip(dx, right - start.x) ||
    !clip(-dy, start.y - rect.y) ||
    !clip(dy, bottom - start.y)
  ) {
    return null;
  }

  return {
    start: {
      x: start.x + dx * t0,
      y: start.y + dy * t0,
    },
    end: {
      x: start.x + dx * t1,
      y: start.y + dy * t1,
    },
  };
}

export function calculateArcMeterLayout(rect: Rect): ArcMeterLayout {
  const centerY = rect.y + rect.height + Math.max(20, rect.height * 0.42);
  const center = {
    x: rect.x + rect.width / 2,
    y: centerY,
  };
  const radiusX = rect.width * 0.43;
  const radiusY = Math.max(1, center.y - rect.y - Math.max(8, rect.height * 0.1));
  const shortestArcBoundary = Math.min(
    calculateEllipseRadiusAt(ARC_METER_START, radiusX, radiusY),
    calculateEllipseRadiusAt((ARC_METER_START + ARC_METER_END) / 2, radiusX, radiusY),
    calculateEllipseRadiusAt(ARC_METER_END, radiusX, radiusY),
  );
  const needleMargin = Math.max(20, rect.height * 0.2);

  return {
    center,
    radiusX,
    radiusY,
    tickInnerX: radiusX * 0.88,
    tickInnerY: radiusY * 0.9,
    labelRadiusX: radiusX * 0.73,
    labelRadiusY: radiusY * 0.82,
    needleLength: Math.max(1, shortestArcBoundary - needleMargin),
  };
}

export function calculateArcMeterVisualStyle(kind: ArcMeterKind): ArcMeterVisualStyle {
  return kind === 'curvature'
    ? { scaleColor: hudColors.blue, needleColor: hudColors.blue }
    : { scaleColor: hudColors.green, needleColor: hudColors.green };
}

export function calculateInvariantSymbolStyle(kind: ArcMeterKind): InvariantSymbolStyle {
  return {
    color: kind === 'curvature' ? hudColors.blue : hudColors.green,
    shadowBlur: 0,
    fontFamily: 'Georgia, "Times New Roman", serif',
  };
}

export function formatArcMeterDigitalReadout(_value: number): string {
  return '';
}

export function calculateArcMeterTitlePosition(rect: Rect): MinimapPoint {
  return {
    x: rect.x + ARC_METER_TITLE_LEFT_PADDING,
    y: rect.y + 18,
  };
}

export function calculateArcMeterSymbolPosition(rect: Rect): MinimapPoint {
  const title = calculateArcMeterTitlePosition(rect);
  return {
    x: rect.x + rect.width - Math.max(34, rect.width * 0.08),
    y: title.y,
  };
}

export function calculateTangentBinormalPlaneTitlePosition(rect: Rect): MinimapPoint {
  return {
    x: rect.x + 13,
    y: rect.y + 24,
  };
}

function calculateLegacyBottomRightInset(width: number, height: number): Rect {
  const size = Math.max(168, Math.min(300, Math.min(width, height) * 0.27));
  const margin = Math.max(18, Math.min(width, height) * 0.035);
  return {
    x: width - size - margin,
    y: height - size - margin,
    width: size,
    height: size,
  };
}

export function calculateRadarHudRect(width: number, height: number): Rect {
  const legacy = calculateLegacyBottomRightInset(width, height);
  const scale = width < 700 ? 1 : 1.35;
  const maxSize = Math.max(legacy.width, Math.min(450, Math.min(width, height)));
  const size = Math.min(maxSize, legacy.width * scale);
  const right = legacy.x + legacy.width;
  const bottom = legacy.y + legacy.height;

  return {
    x: right - size,
    y: bottom - size,
    width: size,
    height: size,
  };
}

export function calculateConnectedMeterCanopy(layout: HudLayout, width: number): Rect {
  const top = Math.min(layout.curvatureMeter.y, layout.torsionMeter.y);
  const bottom = Math.max(
    layout.curvatureMeter.y + layout.curvatureMeter.height,
    layout.torsionMeter.y + layout.torsionMeter.height,
  );
  const x = Math.max(0, layout.minimap.x);
  const right = Math.min(width, layout.radar.x + layout.radar.width);

  return {
    x,
    y: Math.max(0, top - 6),
    width: Math.max(0, right - x),
    height: bottom - top + 14,
  };
}

export function calculateConnectedMeterCanopyPath(layout: HudLayout, width: number): MinimapPoint[] {
  const rect = calculateConnectedMeterCanopy(layout, width);
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const cut = Math.min(34, rect.height * 0.36);
  const leftMeterRight = layout.curvatureMeter.x + layout.curvatureMeter.width;
  const rightMeterLeft = layout.torsionMeter.x;
  const mid = rect.x + rect.width / 2;
  const bridgeHalfWidth = Math.min(170, rect.width * 0.13);
  const shelfY = top + Math.min(28, rect.height * 0.22);
  const bridgeBottomY = top + Math.min(52, rect.height * 0.4);

  return [
    { x: left + cut, y: top },
    { x: leftMeterRight - 44, y: top },
    { x: leftMeterRight - 16, y: shelfY },
    { x: mid - bridgeHalfWidth, y: shelfY },
    { x: mid - bridgeHalfWidth + 24, y: bridgeBottomY },
    { x: mid + bridgeHalfWidth - 24, y: bridgeBottomY },
    { x: mid + bridgeHalfWidth, y: shelfY },
    { x: rightMeterLeft + 16, y: shelfY },
    { x: rightMeterLeft + 44, y: top },
    { x: right - cut, y: top },
    { x: right, y: top + cut },
    { x: right, y: bottom - cut },
    { x: right - cut, y: bottom },
    { x: left + cut, y: bottom },
    { x: left, y: bottom - cut },
    { x: left, y: top + cut },
  ];
}

export function calculateInvariantHistoryPanel(layout: HudLayout, width: number, height: number): Rect {
  const gap = Math.max(8, Math.min(18, width * 0.035));
  const left = layout.minimap.x + layout.minimap.width + gap;
  const right = layout.radar.x - gap;
  const available = Math.max(0, right - left);
  const preferredWidth = Math.min(540, Math.max(300, width * 0.37));
  const panelWidth = Math.min(available, preferredWidth);
  const x = left + (available - panelWidth) / 2;
  const compactHeight = Math.min(
    layout.minimap.height,
    230,
    Math.max(96, Math.min(width, height) * 0.26),
  );
  const panelBottom = Math.min(
    height - Math.max(8, height * 0.01),
    layout.minimap.y + layout.minimap.height,
  );

  return {
    x,
    y: panelBottom - compactHeight,
    width: panelWidth,
    height: Math.max(0, compactHeight),
  };
}

export function calculateBottomBridgePanels(layout: HudLayout, width: number, height: number): BottomBridgePanel[] {
  const historyPanel = calculateInvariantHistoryPanel(layout, width, height);
  if (historyPanel.width <= 0 || historyPanel.height <= 0) {
    return [];
  }

  const leftStart = layout.minimap.x + layout.minimap.width;
  const leftEnd = historyPanel.x;
  const rightStart = historyPanel.x + historyPanel.width;
  const rightEnd = layout.radar.x;
  const leftGap = leftEnd - leftStart;
  const rightGap = rightEnd - rightStart;
  const bridgeWidth = Math.min(leftGap, rightGap);
  if (bridgeWidth < 42) {
    return [];
  }

  const bridgeHeight = Math.max(
    38,
    Math.min(70, historyPanel.height * 0.38, layout.minimap.height * 0.28),
  );
  const centerY = historyPanel.y + historyPanel.height * 0.74;
  const bridgeY = centerY - bridgeHeight / 2;
  const leftCenter = (leftStart + leftEnd) / 2;
  const rightCenter = (rightStart + rightEnd) / 2;
  const makeBridge = (centerX: number): BottomBridgePanel => {
    const rect = {
      x: centerX - bridgeWidth / 2,
      y: bridgeY,
      width: bridgeWidth,
      height: bridgeHeight,
    };
    const shoulderX = rect.width * BOTTOM_BRIDGE_SHOULDER_X;
    const throatTop = rect.y + rect.height * BOTTOM_BRIDGE_THROAT_TOP;
    const throatBottom = rect.y + rect.height * BOTTOM_BRIDGE_THROAT_BOTTOM;
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;

    return {
      rect,
      path: [
        { x: rect.x, y: rect.y },
        { x: rect.x, y: bottom },
        { x: rect.x + shoulderX, y: throatBottom },
        { x: right - shoulderX, y: throatBottom },
        { x: right, y: bottom },
        { x: right, y: rect.y },
        { x: right - shoulderX, y: throatTop },
        { x: rect.x + shoulderX, y: throatTop },
      ],
    };
  };

  return [makeBridge(leftCenter), makeBridge(rightCenter)];
}

export function calculateBottomBridgeVisualStyle(): BottomBridgeVisualStyle {
  return {
    fillColor: hudColors.panelFill,
    strokeColor: hudColors.red,
  };
}

export function calculateSideVerticalHudGuides(layout: HudLayout, width: number): SideVerticalHudGuide[] {
  const canopy = calculateConnectedMeterCanopy(layout, width);
  const lowerTop = Math.min(layout.minimap.y, layout.radar.y);
  const startY = canopy.y + canopy.height + 14;
  const endY = lowerTop - 14;
  if (endY <= startY + 16) {
    return [];
  }

  const canopyCut = Math.min(34, canopy.height * 0.36);
  const leftX = alignStrokeCoordinate(canopy.x + canopyCut + 10);
  const rightX = alignStrokeCoordinate(canopy.x + canopy.width - canopyCut - 10);
  return [leftX, rightX].map((x) => ({
    x,
    start: { x, y: startY },
    end: { x, y: endY },
  }));
}

export function calculateSideVerticalHudGuideStyle(): SideVerticalHudGuideStyle {
  return {
    strokeColor: formatMinimapGuideLineColor(0.72),
    lineWidth: 1.2,
    dash: [],
    shadowBlur: 0,
  };
}

export function calculateInvariantHistoryGraph(
  history: InvariantHistoryPoint[],
  rect: Rect,
  historySeconds: number,
  maxCurvature: number,
  maxTorsionMagnitude: number,
): InvariantHistoryGraph {
  const maxAge = Math.max(1e-6, historySeconds);
  const curvatureScale = Math.max(1e-6, Math.abs(finiteOrZero(maxCurvature)));
  const torsionScale = Math.max(1e-6, Math.abs(finiteOrZero(maxTorsionMagnitude)));
  const padX = Math.min(26, Math.max(14, rect.width * 0.08));
  const topPad = Math.min(46, Math.max(34, rect.height * 0.24));
  const bottomPad = Math.min(28, Math.max(18, rect.height * 0.16));
  const left = rect.x + padX;
  const graphTop = rect.y + topPad;
  const graphWidth = Math.max(1, rect.width - padX * 2);
  const graphHeight = Math.max(1, rect.height - topPad - bottomPad);
  const centerY = graphTop + graphHeight / 2;
  const requestedTorsionMargin = Math.max(TORSION_HISTORY_RAIL_MARGIN, graphHeight * 0.28);
  const torsionRailMargin = Math.min(Math.max(0, graphHeight / 2 - 1), requestedTorsionMargin);
  const torsionHalfHeight = Math.max(1, graphHeight / 2 - torsionRailMargin);
  const sorted = [...history].sort((a, b) => b.age - a.age);
  const xFor = (age: number): number => left + clamp01(1 - finiteOrZero(age) / maxAge) * graphWidth;

  return {
    curvature: sorted.map((point) => ({
      x: xFor(point.age),
      y: graphTop + (1 - clamp01(point.curvature / curvatureScale)) * graphHeight,
    })),
    torsion: sorted.map((point) => ({
      x: xFor(point.age),
      y: centerY - clampSigned(point.torsion / torsionScale) * torsionHalfHeight,
    })),
    torsionZeroY: centerY,
  };
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
  const meterHeight = width < 560 ? 58 : 108;
  const bottomGap = Math.max(8, Math.min(18, width * 0.035));
  const radar = calculateRadarHudRect(width, height);
  const minimapAvailableWidth = Math.max(0, radar.x - margin - bottomGap);
  const bottomSize = Math.min(radar.width, minimapAvailableWidth);
  const bottomY = height - Math.max(bottomSize, radar.height) - margin;
  const minimap = { x: margin, y: bottomY, width: bottomSize, height: bottomSize };
  const rightInsetEdge = radar.x + radar.width;

  return {
    curvatureMeter: { x: minimap.x, y: 18, width: meterWidth, height: meterHeight },
    torsionMeter: { x: rightInsetEdge - meterWidth, y: 18, width: meterWidth, height: meterHeight },
    minimap,
    radar,
  };
}

export function calculateInvariantHistoryGraphSymbolPositions(rect: Rect): {
  curvature: MinimapPoint;
  torsion: MinimapPoint;
} {
  const padX = Math.min(26, Math.max(14, rect.width * 0.08));
  const graphTop = rect.y + Math.min(46, Math.max(34, rect.height * 0.24));
  const left = rect.x + padX;
  const right = rect.x + rect.width - padX;
  const y = graphTop + 15;

  return {
    curvature: { x: left + 5, y },
    torsion: { x: right - 13, y },
  };
}

export function calculateMinimapProjection(
  samples: CurveSample[],
  nearestSample: CurveSample,
  rect: Rect,
): MinimapProjection {
  if (samples.length === 0) {
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, depth: 0.5 };
    return { points: [], nearest: center };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const sample of samples) {
    minX = Math.min(minX, sample.position.x);
    maxX = Math.max(maxX, sample.position.x);
    minY = Math.min(minY, sample.position.y);
    maxY = Math.max(maxY, sample.position.y);
    minZ = Math.min(minZ, sample.position.z);
    maxZ = Math.max(maxZ, sample.position.z);
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
  const rangeZ = maxZ - minZ;

  const project = (sample: CurveSample): MinimapProjectionPoint => ({
    x: centerX + (sample.position.x - worldCenterX) * scale,
    y: centerY - (sample.position.y - worldCenterY) * scale,
    depth: rangeZ <= 1e-6 ? 0.5 : clamp01((sample.position.z - minZ) / rangeZ),
  });

  const points = samples.map(project);
  const nearest = points[nearestSample.index] ?? project(nearestSample);
  return { points, nearest };
}

export function calculateMinimapStrokeSegments(points: MinimapProjectionPoint[]): MinimapStrokeSegment[] {
  if (points.length < 2) {
    return [];
  }

  return points.map((start, index) => {
    const end = points[(index + 1) % points.length];
    const depth = (start.depth + end.depth) / 2;
    return {
      start,
      end,
      depth,
      alpha: 0.18 + depth * 0.72,
      lineWidth: 2,
      shadowBlur: 0,
    };
  });
}

export function formatMinimapStrokeColor(alpha: number): string {
  return `rgba(${hudColors.orangeRgb}, ${clamp01(alpha).toFixed(3)})`;
}

export function calculateMinimapTangentVector(
  start: MinimapPoint,
  sample: Pick<CurveSample, 'tangent'>,
  rect: Rect,
): MinimapTangentVector {
  const projected = {
    x: sample.tangent.x,
    y: -sample.tangent.y,
  };
  const projectedLength = Math.hypot(projected.x, projected.y);
  const direction = projectedLength > 1e-6
    ? { x: projected.x / projectedLength, y: projected.y / projectedLength }
    : { x: 1, y: 0 };
  const length = Math.min(26, Math.max(18, Math.min(rect.width, rect.height) * 0.12));
  const end = {
    x: start.x + direction.x * length,
    y: start.y + direction.y * length,
  };
  const labelPosition = calculateVectorLabelPosition(start, end, 8);
  const labelVisible =
    labelPosition.x >= rect.x + MINIMAP_TANGENT_LABEL_INSET &&
    labelPosition.x + MINIMAP_TANGENT_LABEL_WIDTH <= rect.x + rect.width - MINIMAP_TANGENT_LABEL_INSET &&
    labelPosition.y - MINIMAP_TANGENT_LABEL_HEIGHT >= rect.y + MINIMAP_TANGENT_LABEL_INSET &&
    labelPosition.y <= rect.y + rect.height - MINIMAP_TANGENT_LABEL_INSET;

  return {
    start,
    end,
    label: 'T',
    labelPosition,
    labelVisible,
    color: '#ffffff',
  };
}

function normalizedOr(vector: Vector3, fallback: Vector3): Vector3 {
  const normalized = vector.clone();
  if (normalized.lengthSq() <= 1e-12) {
    return fallback.clone().normalize();
  }

  return normalized.normalize();
}

export function calculateTangentBinormalPlaneVectors(
  sample: CurveSample,
  maxCurvature: number,
  maxTorsionMagnitude: number,
): TangentBinormalDisplayVectors {
  return projectNormalDerivativeToTangentBinormalDisplay(
    calculateFrenetDerivativeVectors(sample),
    maxCurvature / DERIVATIVE_VECTOR_DISPLAY_SCALE,
    maxTorsionMagnitude / DERIVATIVE_VECTOR_DISPLAY_SCALE,
  );
}

function screenPlaneBasis(sample: CurveSample): { viewRight: Vector3; viewUp: Vector3 } {
  const forward = normalizedOr(sample.tangent, new Vector3(1, 0, 0));
  let viewUp = SCREEN_UP.clone().sub(forward.clone().multiplyScalar(SCREEN_UP.dot(forward)));
  if (viewUp.lengthSq() <= 1e-10) {
    viewUp = sample.normal.clone().sub(forward.clone().multiplyScalar(sample.normal.dot(forward)));
  }
  viewUp = normalizedOr(viewUp, new Vector3(0, 1, 0));
  let viewRight = forward.clone().cross(viewUp);
  if (viewRight.lengthSq() <= 1e-10) {
    viewRight = sample.binormal.clone().sub(forward.clone().multiplyScalar(sample.binormal.dot(forward)));
  }

  return {
    viewRight: normalizedOr(viewRight, new Vector3(1, 0, 0)),
    viewUp,
  };
}

function projectDerivativeVectorToMainView(
  vector: Vector3,
  sample: CurveSample,
  scale: number,
  maxLength: number,
): MinimapPoint {
  const { viewRight, viewUp } = screenPlaneBasis(sample);
  const point = {
    x: (vector.dot(viewRight) / Math.max(1e-6, Math.abs(scale))) * maxLength,
    y: (-vector.dot(viewUp) / Math.max(1e-6, Math.abs(scale))) * maxLength,
  };
  const length = Math.hypot(point.x, point.y);
  if (length <= maxLength) {
    return point;
  }

  return {
    x: (point.x / length) * maxLength,
    y: (point.y / length) * maxLength,
  };
}

export function calculateMainViewDerivativeVectors(
  sample: CurveSample,
  width: number,
  height: number,
  maxCurvature: number,
  maxTorsionMagnitude: number,
): MainViewDerivativeVectors {
  const base = { x: width / 2, y: height / 2 };
  const maxLength = Math.max(MAIN_VIEW_VECTOR_MIN_LENGTH, Math.min(width, height) * MAIN_VIEW_VECTOR_LENGTH_RATIO);
  const vectors = calculateFrenetDerivativeVectors(sample);
  const normalDerivativeScale = Math.hypot(
    Math.max(1e-6, Math.abs(finiteOrZero(maxCurvature))),
    Math.max(1e-6, Math.abs(finiteOrZero(maxTorsionMagnitude))),
  );
  const tangentOffset = projectDerivativeVectorToMainView(
    vectors.tangentDerivative,
    sample,
    maxCurvature,
    maxLength,
  );
  const normalOffset = projectDerivativeVectorToMainView(
    vectors.normalDerivative,
    sample,
    normalDerivativeScale,
    maxLength,
  );

  return {
    base,
    maxLength,
    tangentDerivative: {
      start: base,
      end: { x: base.x + tangentOffset.x, y: base.y + tangentOffset.y },
    },
    normalDerivative: {
      start: base,
      end: { x: base.x + normalOffset.x, y: base.y + normalOffset.y },
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
    const layout = calculateResponsiveHudLayout(width, height);
    this.ctx.clearRect(0, 0, width, height);

    this.drawMainViewDerivativeVectors(simulation, width, height);
    this.drawMeters(game, simulation, layout, width);
    this.drawSideVerticalGuides(layout, width);
    this.drawBottomBridges(layout, width, height);
    this.drawMinimap(simulation, layout);
    this.drawTangentBinormalPlane(game, simulation, layout);
    this.drawInvariantHistory(simulation, layout, width, height);
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
    const notch = Math.min(cut * 0.45, rect.height * 0.18, rect.width * 0.08);
    const topA = rect.x + rect.width * 0.36;
    const topB = rect.x + rect.width * 0.64;
    const bottomA = rect.x + rect.width * 0.42;
    const bottomB = rect.x + rect.width * 0.58;
    ctx.beginPath();
    ctx.moveTo(rect.x + cut, rect.y);
    ctx.lineTo(topA, rect.y);
    ctx.lineTo(topA + notch, rect.y + notch);
    ctx.lineTo(topB - notch, rect.y + notch);
    ctx.lineTo(topB, rect.y);
    ctx.lineTo(rect.x + rect.width - cut, rect.y);
    ctx.lineTo(rect.x + rect.width, rect.y + cut);
    ctx.lineTo(rect.x + rect.width, rect.y + rect.height - cut);
    ctx.lineTo(rect.x + rect.width - cut, rect.y + rect.height);
    ctx.lineTo(bottomB, rect.y + rect.height);
    ctx.lineTo(bottomB - notch, rect.y + rect.height - notch);
    ctx.lineTo(bottomA + notch, rect.y + rect.height - notch);
    ctx.lineTo(bottomA, rect.y + rect.height);
    ctx.lineTo(rect.x + cut, rect.y + rect.height);
    ctx.lineTo(rect.x, rect.y + rect.height - cut);
    ctx.lineTo(rect.x, rect.y + cut);
    ctx.closePath();
  }

  private drawAngularPanel(rect: Rect, _color: string, intensity = 1, lowerAccent = true): void {
    const ctx = this.ctx;
    const borderStyle = calculateHudInsetBorderStyle();
    ctx.save();
    ctx.shadowColor = borderStyle.strokeColor;
    ctx.shadowBlur = 16 * intensity;
    this.traceAngularPanel(rect, Math.min(20, rect.height * 0.28));
    ctx.fillStyle = hudColors.panelFill;
    ctx.fill();
    ctx.strokeStyle = borderStyle.strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (lowerAccent) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = borderStyle.accentColor;
      ctx.globalAlpha = 0.32 * intensity;
      ctx.beginPath();
      ctx.moveTo(rect.x + 28, rect.y + rect.height - 8);
      ctx.lineTo(rect.x + rect.width - 28, rect.y + rect.height - 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawConnectedMeterCanopy(layout: HudLayout, width: number): void {
    const rect = calculateConnectedMeterCanopy(layout, width);
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const ctx = this.ctx;
    const top = rect.y;
    const mid = rect.x + rect.width / 2;
    const leftMeterRight = layout.curvatureMeter.x + layout.curvatureMeter.width;
    const rightMeterLeft = layout.torsionMeter.x;
    const path = calculateConnectedMeterCanopyPath(layout, width);
    const borderStyle = calculateHudInsetBorderStyle();

    ctx.save();
    ctx.shadowColor = borderStyle.strokeColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = hudColors.panelFill;
    ctx.strokeStyle = borderStyle.strokeColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    path.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.46;
    ctx.strokeStyle = formatHudInsetGuideLineColor(1);
    const shelfY = top + Math.min(28, rect.height * 0.22);
    ctx.beginPath();
    ctx.moveTo(rect.x + 54, top + 8);
    ctx.lineTo(leftMeterRight - 72, top + 8);
    ctx.moveTo(rightMeterLeft + 72, top + 8);
    ctx.lineTo(rect.x + rect.width - 54, top + 8);
    ctx.moveTo(mid - 94, shelfY + 6);
    ctx.lineTo(mid + 94, shelfY + 6);
    ctx.stroke();
    ctx.restore();
  }

  private drawMeters(_game: GameState, simulation: SimulationState, layout: HudLayout, width: number): void {
    this.drawConnectedMeterCanopy(layout, width);

    this.drawMeter(
      layout.curvatureMeter,
      'CURVATURE',
      simulation.player.currentCurvature,
      CURVATURE_METER_MAX,
      'curvature',
      false,
      false,
    );
    this.drawMeter(
      layout.torsionMeter,
      'TORSION',
      simulation.player.currentTorsion,
      TORSION_METER_MAX_MAGNITUDE,
      'torsion',
      true,
      false,
    );
  }

  private drawMeter(
    rect: Rect,
    label: string,
    value: number,
    maxValue: number,
    kind: ArcMeterKind,
    signed = false,
    drawPanel = true,
  ): void {
    const ctx = this.ctx;
    if (drawPanel) {
      this.drawAngularPanel(rect, hudColors.cyanSoft, 0.9, false);
    }
    const geometry = calculateArcMeterGeometry(value, maxValue, signed);
    const arcLayout = calculateArcMeterLayout(rect);
    const visualStyle = calculateArcMeterVisualStyle(kind);
    const cx = arcLayout.center.x;
    const cy = arcLayout.center.y;
    const pointOnMeter = (angle: number, xRadius: number, yRadius: number): MinimapPoint => ({
      x: cx + Math.cos(angle) * xRadius,
      y: cy + Math.sin(angle) * yRadius,
    });

    ctx.save();
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = TEXT_DIM;
    const titlePosition = calculateArcMeterTitlePosition(rect);
    ctx.fillText(label, titlePosition.x, titlePosition.y);
    const symbolPosition = calculateArcMeterSymbolPosition(rect);
    const symbolStyle = calculateInvariantSymbolStyle(kind);
    ctx.save();
    ctx.font = `18px ${symbolStyle.fontFamily}`;
    ctx.fillStyle = symbolStyle.color;
    ctx.shadowBlur = symbolStyle.shadowBlur;
    ctx.textAlign = 'right';
    ctx.fillText(kind === 'curvature' ? 'κ' : 'τ', symbolPosition.x, symbolPosition.y);
    ctx.restore();

    ctx.lineCap = 'round';
    ctx.shadowColor = visualStyle.scaleColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = visualStyle.scaleColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, arcLayout.radiusX, arcLayout.radiusY, 0, geometry.startAngle, geometry.endAngle);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = visualStyle.scaleColor;
    ctx.fillStyle = visualStyle.scaleColor;
    for (const tick of geometry.ticks) {
      const innerScale = tick.major ? 0.95 : 1.02;
      const outer = pointOnMeter(tick.angle, arcLayout.radiusX, arcLayout.radiusY);
      const inner = pointOnMeter(
        tick.angle,
        arcLayout.tickInnerX * innerScale,
        arcLayout.tickInnerY * innerScale,
      );
      ctx.lineWidth = tick.major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(outer.x, outer.y);
      ctx.lineTo(inner.x, inner.y);
      ctx.stroke();

      if (tick.major && rect.width >= 250) {
        const labelPoint = pointOnMeter(tick.angle, arcLayout.labelRadiusX, arcLayout.labelRadiusY);
        ctx.save();
        ctx.translate(labelPoint.x, labelPoint.y);
        ctx.rotate(tick.angle - Math.PI * 1.5);
        ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tick.label, 0, 0);
        ctx.restore();
      }
    }

    const needleEnd = calculateArcNeedleEndpoint(arcLayout.center, geometry.needleAngle, arcLayout.needleLength);
    const needleSegment = calculateClippedNeedleSegment(arcLayout.center, needleEnd, rect);
    ctx.shadowColor = visualStyle.needleColor;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = visualStyle.needleColor;
    ctx.lineWidth = Math.max(2, Math.min(4, rect.height * 0.045));
    if (needleSegment) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.width, rect.height);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(needleSegment.start.x, needleSegment.start.y);
      ctx.lineTo(needleSegment.end.x, needleSegment.end.y);
      ctx.stroke();
      ctx.restore();
    }

    const digitalReadout = formatArcMeterDigitalReadout(value);
    if (digitalReadout) {
      ctx.shadowBlur = 8;
      ctx.fillStyle = visualStyle.needleColor;
      ctx.font = rect.width < 170
        ? '13px ui-monospace, SFMono-Regular, Menlo, monospace'
        : '16px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(digitalReadout, rect.x + rect.width - 22, rect.y + rect.height - 15);
    }
    ctx.restore();
  }

  private drawBottomBridges(layout: HudLayout, width: number, height: number): void {
    const bridges = calculateBottomBridgePanels(layout, width, height);
    if (bridges.length === 0) {
      return;
    }

    const ctx = this.ctx;
    const visualStyle = calculateBottomBridgeVisualStyle();
    ctx.save();
    ctx.shadowColor = visualStyle.strokeColor;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = visualStyle.strokeColor;
    ctx.fillStyle = visualStyle.fillColor;
    ctx.lineWidth = 1.5;

    for (const bridge of bridges) {
      ctx.beginPath();
      bridge.path.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const shoulderX = bridge.rect.width * BOTTOM_BRIDGE_SHOULDER_X;
      const throatMidY = bridge.rect.y + bridge.rect.height * 0.5;
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.moveTo(bridge.rect.x + shoulderX, throatMidY);
      ctx.lineTo(bridge.rect.x + bridge.rect.width - shoulderX, throatMidY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 14;
    }

    ctx.restore();
  }

  private drawSideVerticalGuides(layout: HudLayout, width: number): void {
    const guides = calculateSideVerticalHudGuides(layout, width);
    if (guides.length === 0) {
      return;
    }

    const ctx = this.ctx;
    const style = calculateSideVerticalHudGuideStyle();
    ctx.save();
    ctx.shadowColor = hudColors.red;
    ctx.shadowBlur = style.shadowBlur;
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.lineWidth;
    ctx.setLineDash(style.dash);
    for (const guide of guides) {
      ctx.beginPath();
      ctx.moveTo(guide.start.x, guide.start.y);
      ctx.lineTo(guide.end.x, guide.end.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawInvariantHistory(simulation: SimulationState, layout: HudLayout, width: number, height: number): void {
    const rect = calculateInvariantHistoryPanel(layout, width, height);
    if (rect.width < 180 || rect.height < 80) {
      return;
    }

    const ctx = this.ctx;
    const history = simulation.player.invariantHistory.length > 0
      ? simulation.player.invariantHistory
      : [{
        age: 0,
        curvature: simulation.player.currentCurvature,
        torsion: simulation.player.currentTorsion,
      }];
    const curvatureMax = Math.max(
      simulation.sampled.level.acceptableCurvature[1] * 1.35,
      simulation.player.currentCurvature,
      ...history.map((point) => point.curvature),
      0.75,
    );
    const torsionMax = Math.max(
      Math.abs(simulation.sampled.level.acceptableTorsion[0]),
      Math.abs(simulation.sampled.level.acceptableTorsion[1]),
      Math.abs(simulation.player.currentTorsion),
      ...history.map((point) => Math.abs(point.torsion)),
      0.15,
    );
    const graph = calculateInvariantHistoryGraph(
      history,
      rect,
      HUD_HISTORY_SECONDS,
      curvatureMax,
      torsionMax,
    );

    this.drawAngularPanel(rect, hudColors.cyanSoft, 0.9, false);
    ctx.save();
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';

    const padX = Math.min(26, Math.max(14, rect.width * 0.08));
    const graphTop = rect.y + Math.min(46, Math.max(34, rect.height * 0.24));
    const graphHeight = Math.max(1, rect.height - Math.min(46, Math.max(34, rect.height * 0.24)) - Math.min(28, Math.max(18, rect.height * 0.16)));
    const left = rect.x + padX;
    const right = rect.x + rect.width - padX;

    ctx.strokeStyle = formatMinimapGuideLineColor();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, graphTop);
    ctx.lineTo(right, graphTop);
    ctx.moveTo(left, graphTop + graphHeight);
    ctx.lineTo(right, graphTop + graphHeight);
    ctx.stroke();

    const graphSymbols = calculateInvariantHistoryGraphSymbolPositions(rect);
    const curvatureSymbolStyle = calculateInvariantSymbolStyle('curvature');
    const torsionSymbolStyle = calculateInvariantSymbolStyle('torsion');
    ctx.save();
    ctx.font = `16px ${curvatureSymbolStyle.fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    ctx.shadowBlur = curvatureSymbolStyle.shadowBlur;
    ctx.fillStyle = curvatureSymbolStyle.color;
    ctx.fillText('κ', graphSymbols.curvature.x, graphSymbols.curvature.y);
    ctx.shadowBlur = torsionSymbolStyle.shadowBlur;
    ctx.fillStyle = torsionSymbolStyle.color;
    ctx.fillText('τ', graphSymbols.torsion.x, graphSymbols.torsion.y);
    ctx.restore();

    ctx.strokeStyle = 'rgba(112, 255, 157, 0.34)';
    ctx.beginPath();
    ctx.moveTo(left, graph.torsionZeroY);
    ctx.lineTo(right, graph.torsionZeroY);
    ctx.stroke();

    this.drawGraphLine(graph.curvature, hudColors.blue, 2.4);
    this.drawGraphLine(graph.torsion, hudColors.green, 2.4);
    this.drawGraphEndpoint(graph.curvature.at(-1), hudColors.blue);
    this.drawGraphEndpoint(graph.torsion.at(-1), hudColors.green);
    ctx.restore();
  }

  private drawGraphLine(points: MinimapPoint[], color: string, lineWidth: number): void {
    if (points.length < 2) {
      return;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  private drawGraphEndpoint(point: MinimapPoint | undefined, color: string): void {
    if (!point) {
      return;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawMinimap(simulation: SimulationState, layout: HudLayout): void {
    const rect = layout.minimap;
    const projection = calculateMinimapProjection(
      simulation.sampled.samples,
      simulation.player.nearestSample,
      rect,
    );
    const ctx = this.ctx;

    this.drawAngularPanel(rect, hudColors.cyan, 0.78);
    ctx.save();
    ctx.strokeStyle = formatMinimapGuideLineColor();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width * 0.39, 0, TAU);
    ctx.stroke();

    this.drawMinimapBrightnessCurve(projection.points);

    const tangentVector = calculateMinimapTangentVector(projection.nearest, simulation.player, rect);
    this.drawVector(
      tangentVector.start,
      tangentVector.end,
      tangentVector.color,
      2,
      tangentVector.labelVisible ? tangentVector.label : undefined,
      { distance: 8, shadowBlur: 0 },
    );

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(projection.nearest.x, projection.nearest.y, 4, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  private drawMinimapBrightnessCurve(points: MinimapProjectionPoint[]): void {
    const segments = calculateMinimapStrokeSegments(points);
    if (segments.length === 0) {
      return;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = hudColors.knotCurve;
    ctx.shadowBlur = 5;
    ctx.strokeStyle = formatMinimapStrokeColor(0.12);
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    const bucketCount = 14;
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const alpha = 0.18 + (bucket / (bucketCount - 1)) * 0.72;
      let drewSegment = false;
      ctx.strokeStyle = formatMinimapStrokeColor(alpha);
      ctx.beginPath();
      for (const segment of segments) {
        const segmentBucket = Math.min(bucketCount - 1, Math.floor(segment.depth * bucketCount));
        if (segmentBucket !== bucket) {
          continue;
        }

        ctx.moveTo(segment.start.x, segment.start.y);
        ctx.lineTo(segment.end.x, segment.end.y);
        drewSegment = true;
      }
      if (drewSegment) {
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawMainViewDerivativeVectors(simulation: SimulationState, width: number, height: number): void {
    const readoutSample = {
      ...simulation.player.nearestSample,
      position: simulation.player.position.clone(),
      tangent: simulation.player.tangent.clone(),
      normal: simulation.player.normal.clone(),
      binormal: simulation.player.binormal.clone(),
      curvature: simulation.player.currentCurvature,
      torsion: simulation.player.currentTorsion,
    };
    const curvatureMax = Math.max(
      simulation.sampled.level.acceptableCurvature[1] * 1.35,
      Math.abs(readoutSample.curvature),
      0.75,
    );
    const torsionMax = Math.max(
      Math.abs(simulation.sampled.level.acceptableTorsion[0]),
      Math.abs(simulation.sampled.level.acceptableTorsion[1]),
      Math.abs(readoutSample.torsion),
      0.15,
    );
    const vectors = calculateMainViewDerivativeVectors(readoutSample, width, height, curvatureMax, torsionMax);
    const style = calculateMainViewDerivativeVectorStyle();
    const labelOptions = calculateMainViewDerivativeVectorLabelOptions();

    this.drawVector(
      vectors.tangentDerivative.start,
      vectors.tangentDerivative.end,
      style.tangentDerivativeColor ?? hudColors.blue,
      4,
      "T'",
      labelOptions,
    );
    this.drawVector(
      vectors.normalDerivative.start,
      vectors.normalDerivative.end,
      style.normalDerivativeColor,
      4,
      "N'",
      labelOptions,
    );
  }

  private drawTangentBinormalPlane(game: GameState, simulation: SimulationState, layout: HudLayout): void {
    const rect = layout.radar;
    const ctx = this.ctx;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const radius = rect.width / 2 - 18;
    const vectorRadius = radius * 0.78;

    this.drawAngularPanel(rect, hudColors.cyan, 0.78);
    ctx.save();
    ctx.strokeStyle = formatTangentBinormalPlaneBackgroundLineColor();
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

    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('T', cx + 8, cy - radius + 14);
    ctx.fillText('B', cx + radius - 14, cy - 8);

    const readoutSample = {
      ...simulation.player.nearestSample,
      position: simulation.player.position.clone(),
      tangent: simulation.player.tangent.clone(),
      normal: simulation.player.normal.clone(),
      binormal: simulation.player.binormal.clone(),
      curvature: game.mode === 'demo'
        ? simulation.player.currentCurvature
        : simulation.player.nearestSample.curvature,
      torsion: game.mode === 'demo'
        ? simulation.player.currentTorsion
        : simulation.player.nearestSample.torsion,
    };
    const curvatureMax = Math.max(
      simulation.sampled.level.acceptableCurvature[1] * 1.35,
      readoutSample.curvature,
      0.75,
    );
    const torsionMax = Math.max(
      Math.abs(simulation.sampled.level.acceptableTorsion[0]),
      Math.abs(simulation.sampled.level.acceptableTorsion[1]),
      Math.abs(readoutSample.torsion),
      0.15,
    );
    const vectors = calculateTangentBinormalPlaneVectors(
      readoutSample,
      curvatureMax,
      torsionMax,
    );
    this.drawTangentBinormalPlaneVectors(vectors, cx, cy, vectorRadius);

    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = TEXT_DIM;
    const titlePosition = calculateTangentBinormalPlaneTitlePosition(rect);
    ctx.fillText('TANGENT-BINORMAL PLANE', titlePosition.x, titlePosition.y);
    ctx.restore();
  }

  private drawTangentBinormalPlaneVectors(
    vectors: TangentBinormalDisplayVectors,
    cx: number,
    cy: number,
    radius: number,
  ): void {
    const ctx = this.ctx;
    const project = (point: MinimapPoint): MinimapPoint => ({
      x: cx + point.x * radius,
      y: cy - point.y * radius,
    });

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    const style = calculateTangentBinormalPlaneVectorStyle();

    this.drawVector(
      project(vectors.tProjection.start),
      project(vectors.tProjection.end),
      style.tProjectionColor ?? hudColors.blue,
      3,
    );
    this.drawVector(
      project(vectors.bProjection.start),
      project(vectors.bProjection.end),
      style.bProjectionColor ?? hudColors.green,
      3,
    );
    this.drawVector(
      project(vectors.normalDerivative.start),
      project(vectors.normalDerivative.end),
      style.normalDerivativeColor,
      3,
      "N'",
      calculateTangentBinormalPlaneNormalLabelOptions(),
    );
  }

  private drawVector(
    start: MinimapPoint,
    end: MinimapPoint,
    color: string,
    lineWidth: number,
    label?: string,
    labelOptions: VectorLabelOptions = { distance: 8, shadowBlur: 7 },
  ): void {
    const ctx = this.ctx;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < 1e-4) {
      return;
    }

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
    if (label) {
      ctx.shadowBlur = labelOptions.shadowBlur;
      ctx.font = `${labelOptions.fontSize ?? 10}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      const labelPosition = calculateVectorLabelPosition(start, end, labelOptions.distance);
      ctx.fillText(label, labelPosition.x, labelPosition.y);
    }
    ctx.restore();
  }

}
