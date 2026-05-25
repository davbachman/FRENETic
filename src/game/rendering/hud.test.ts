import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { CurveSample } from '../curves/types';
import { hudColors } from './colors';
import {
  calculateArcMeterGeometry,
  calculateArcMeterLayout,
  calculateArcMeterSymbolPosition,
  calculateArcMeterTitlePosition,
  calculateArcMeterVisualStyle,
  calculateBottomBridgePanels,
  calculateBottomBridgeVisualStyle,
  calculateArcNeedleEndpoint,
  calculateClippedNeedleSegment,
  calculateConnectedMeterCanopy,
  calculateConnectedMeterCanopyPath,
  calculateHudInsetBorderStyle,
  calculateInvariantHistoryGraph,
  calculateInvariantHistoryGraphSymbolPositions,
  calculateInvariantHistoryPanel,
  calculateInvariantSymbolStyle,
  calculateMinimapStrokeSegments,
  calculateMinimapTangentVector,
  calculateMainViewDerivativeVectors,
  calculateMainViewDerivativeVectorLabelOptions,
  calculateMainViewDerivativeVectorStyle,
  calculateMinimapProjection,
  calculateRadarHudRect,
  calculateResponsiveHudLayout,
  calculateSideVerticalHudGuides,
  calculateSideVerticalHudGuideStyle,
  calculateTangentBinormalPlaneNormalLabelOptions,
  calculateTangentBinormalPlaneVectors,
  calculateTangentBinormalPlaneTitlePosition,
  calculateTangentBinormalPlaneVectorStyle,
  calculateVectorLabelPosition,
  CURVATURE_METER_MAX,
  formatArcMeterDigitalReadout,
  formatHudInsetGuideLineColor,
  formatMinimapGuideLineColor,
  formatMinimapStrokeColor,
  formatTangentBinormalPlaneBackgroundLineColor,
  TORSION_METER_MAX_MAGNITUDE,
} from './hud';

function sample(index: number, x: number, y: number, z = 0): CurveSample {
  return {
    index,
    t: index / 4,
    position: new Vector3(x, y, z),
    tangent: new Vector3(1, 0, 0),
    normal: new Vector3(0, 1, 0),
    binormal: new Vector3(0, 0, 1),
    curvature: 0,
    torsion: 0,
    arcLength: index,
  };
}

function ellipseRadiusAt(angle: number, radiusX: number, radiusY: number): number {
  return 1 / Math.sqrt(
    (Math.cos(angle) ** 2) / (radiusX ** 2) +
    (Math.sin(angle) ** 2) / (radiusY ** 2),
  );
}

describe('HUD overlay helpers', () => {
  it('uses solid black for HUD inset panel backgrounds', () => {
    expect(hudColors.panelFill).toBe('#000000');
  });

  it('uses red for HUD inset panel borders', () => {
    expect(calculateHudInsetBorderStyle()).toEqual({
      strokeColor: hudColors.red,
      accentColor: hudColors.red,
    });
  });

  it('uses green for only the main-view N prime vector', () => {
    expect(calculateMainViewDerivativeVectorStyle()).toEqual({
      tangentDerivativeColor: hudColors.blue,
      normalDerivativeColor: hudColors.green,
    });
    expect(calculateTangentBinormalPlaneVectorStyle().normalDerivativeColor).toBe('#ffffff');
  });

  it('uses larger labels for the main tunnel-view derivative vectors', () => {
    const options = calculateMainViewDerivativeVectorLabelOptions();

    expect(options.fontSize).toBe(16);
    expect(options.distance).toBeGreaterThan(8);
  });

  it('uses a plain farther-out N prime label in the tangent-binormal inset', () => {
    const options = calculateTangentBinormalPlaneNormalLabelOptions();
    const start = { x: 100, y: 100 };
    const end = { x: 130, y: 100 };
    const defaultLabel = calculateVectorLabelPosition(start, end, 8);
    const tangentBinormalLabel = calculateVectorLabelPosition(start, end, options.distance);

    expect(options.shadowBlur).toBe(0);
    expect(options.distance).toBeGreaterThan(8);
    expect(tangentBinormalLabel.x).toBeGreaterThan(defaultLabel.x);
  });

  it('uses red background guide lines in the tangent-binormal inset', () => {
    expect(formatTangentBinormalPlaneBackgroundLineColor()).toBe('rgba(255, 20, 20, 0.480)');
  });

  it('uses the same red guide-line color in the minimap inset', () => {
    expect(formatMinimapGuideLineColor()).toBe(formatTangentBinormalPlaneBackgroundLineColor());
    expect(formatHudInsetGuideLineColor(1)).toBe('rgba(255, 20, 20, 1.000)');
  });

  it('maps unsigned meter values across a retro upper arc scale', () => {
    const geometry = calculateArcMeterGeometry(0.5, 1, false);

    expect(geometry.startAngle).toBeCloseTo(Math.PI * 1.14);
    expect(geometry.endAngle).toBeCloseTo(Math.PI * 1.86);
    expect(geometry.needleAngle).toBeCloseTo(Math.PI * 1.5);
    expect(geometry.ticks).toHaveLength(9);
    expect(geometry.ticks[0]).toMatchObject({ normalized: 0, label: '0.00' });
    expect(geometry.ticks.at(-1)).toMatchObject({ normalized: 1, label: '1.00' });
  });

  it('maps signed torsion zero to the top center of the arc scale', () => {
    const negative = calculateArcMeterGeometry(-1, 1, true);
    const zero = calculateArcMeterGeometry(0, 1, true);
    const positive = calculateArcMeterGeometry(1, 1, true);

    expect(negative.needleAngle).toBeCloseTo(negative.startAngle);
    expect(zero.needleAngle).toBeCloseTo(Math.PI * 1.5);
    expect(positive.needleAngle).toBeCloseTo(positive.endAngle);
    expect(zero.ticks[0].label).toBe('-1.00');
    expect(zero.ticks[4].label).toBe('0.00');
    expect(zero.ticks.at(-1)?.label).toBe('1.00');
  });

  it('uses fixed top arc gauge domains for curvature and torsion', () => {
    const curvature = calculateArcMeterGeometry(0, CURVATURE_METER_MAX, false);
    const torsion = calculateArcMeterGeometry(0, TORSION_METER_MAX_MAGNITUDE, true);

    expect(curvature.ticks[0].label).toBe('0.00');
    expect(curvature.ticks.at(-1)?.label).toBe('0.40');
    expect(torsion.ticks[0].label).toBe('-0.10');
    expect(torsion.ticks[Math.floor(torsion.ticks.length / 2)].label).toBe('0.00');
    expect(torsion.ticks.at(-1)?.label).toBe('0.10');
  });

  it('colors arc meters to match the normal-plane derivative vectors', () => {
    expect(calculateArcMeterVisualStyle('curvature')).toEqual({
      scaleColor: hudColors.blue,
      needleColor: hudColors.blue,
    });
    expect(calculateArcMeterVisualStyle('torsion')).toEqual({
      scaleColor: hudColors.green,
      needleColor: hudColors.green,
    });
  });

  it('renders Greek invariant symbols without glow', () => {
    expect(calculateInvariantSymbolStyle('curvature')).toEqual({
      color: hudColors.blue,
      shadowBlur: 0,
      fontFamily: 'Georgia, "Times New Roman", serif',
    });
    expect(calculateInvariantSymbolStyle('torsion')).toEqual({
      color: hudColors.green,
      shadowBlur: 0,
      fontFamily: 'Georgia, "Times New Roman", serif',
    });
  });

  it('does not format top arc meter digital readouts', () => {
    expect(formatArcMeterDigitalReadout(0.29)).toBe('');
    expect(formatArcMeterDigitalReadout(-0.65)).toBe('');
  });

  it('adds enough left padding for top arc meter labels inside the canopy window', () => {
    const rect = { x: 28, y: 18, width: 430, height: 108 };
    const title = calculateArcMeterTitlePosition(rect);

    expect(title.x).toBeGreaterThanOrEqual(rect.x + 36);
    expect(title.y).toBe(rect.y + 18);
  });

  it('places Greek symbols on the top meter title baseline near the meter right edge', () => {
    const rect = { x: 28, y: 18, width: 430, height: 108 };
    const title = calculateArcMeterTitlePosition(rect);
    const symbol = calculateArcMeterSymbolPosition(rect);

    expect(symbol.y).toBe(title.y);
    expect(symbol.x).toBeGreaterThan(rect.x + rect.width - 45);
    expect(symbol.x).toBeLessThan(rect.x + rect.width);
  });

  it('keeps arc meter needles a constant visual length at every angle', () => {
    const center = { x: 100, y: 90 };
    const length = 72;
    const left = calculateArcNeedleEndpoint(center, Math.PI * 0.95, length);
    const top = calculateArcNeedleEndpoint(center, Math.PI * 1.5, length);
    const right = calculateArcNeedleEndpoint(center, Math.PI * 2.05, length);

    expect(Math.hypot(left.x - center.x, left.y - center.y)).toBeCloseTo(length);
    expect(Math.hypot(top.x - center.x, top.y - center.y)).toBeCloseTo(length);
    expect(Math.hypot(right.x - center.x, right.y - center.y)).toBeCloseTo(length);
  });

  it('places retro arc meter needle pivots below the HUD panel while scale endpoints stay visible', () => {
    const rect = { x: 28, y: 18, width: 430, height: 108 };
    const layout = calculateArcMeterLayout(rect);
    const geometry = calculateArcMeterGeometry(0.5, 1, false);
    const points = [
      {
        x: layout.center.x + Math.cos(geometry.startAngle) * layout.radiusX,
        y: layout.center.y + Math.sin(geometry.startAngle) * layout.radiusY,
      },
      {
        x: layout.center.x + Math.cos(geometry.endAngle) * layout.radiusX,
        y: layout.center.y + Math.sin(geometry.endAngle) * layout.radiusY,
      },
      {
        x: layout.center.x + Math.cos(Math.PI * 1.5) * layout.radiusX,
        y: layout.center.y + Math.sin(Math.PI * 1.5) * layout.radiusY,
      },
    ];

    expect(layout.center.y).toBeGreaterThan(rect.y + rect.height);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(rect.x);
      expect(point.x).toBeLessThanOrEqual(rect.x + rect.width);
      expect(point.y).toBeGreaterThanOrEqual(rect.y);
      expect(point.y).toBeLessThanOrEqual(rect.y + rect.height);
    }
  });

  it('clips arc meter needles to the visible HUD panel when their pivot is below it', () => {
    const rect = { x: 28, y: 18, width: 430, height: 108 };
    const layout = calculateArcMeterLayout(rect);
    const geometry = calculateArcMeterGeometry(0.5, 1, false);
    const needleEnd = calculateArcNeedleEndpoint(layout.center, geometry.needleAngle, layout.needleLength);

    const clipped = calculateClippedNeedleSegment(layout.center, needleEnd, rect);

    expect(clipped).not.toBeNull();
    expect(clipped!.start.y).toBeCloseTo(rect.y + rect.height);
    for (const point of [clipped!.start, clipped!.end]) {
      expect(point.x).toBeGreaterThanOrEqual(rect.x);
      expect(point.x).toBeLessThanOrEqual(rect.x + rect.width);
      expect(point.y).toBeGreaterThanOrEqual(rect.y);
      expect(point.y).toBeLessThanOrEqual(rect.y + rect.height);
    }
  });

  it('keeps arc meter needle tips inside the scale arc at extreme values', () => {
    const rect = { x: 28, y: 18, width: 430, height: 108 };
    const layout = calculateArcMeterLayout(rect);
    const geometry = calculateArcMeterGeometry(0.5, 1, false);
    const testedAngles = [geometry.startAngle, geometry.needleAngle, geometry.endAngle];

    for (const angle of testedAngles) {
      const scaleBoundary = ellipseRadiusAt(angle, layout.radiusX, layout.radiusY);
      const visibleGlowGap = Math.max(18, rect.height * 0.18);

      expect(layout.needleLength).toBeLessThan(scaleBoundary - visibleGlowGap);
    }
  });

  it('keeps the enlarged HUD radar anchored to the bottom-right corner', () => {
    const hudRadar = calculateRadarHudRect(1000, 700);

    expect(hudRadar.x + hudRadar.width).toBeLessThanOrEqual(1000);
    expect(hudRadar.y + hudRadar.height).toBeLessThanOrEqual(700);
    expect(hudRadar.width).toBeGreaterThan(200);
    expect(hudRadar.height).toBe(hudRadar.width);
  });

  it('caps the demo HUD corner inset size on desktop', () => {
    const hudRadar = calculateRadarHudRect(1280, 800);

    expect(hudRadar.width).toBeGreaterThanOrEqual(290);
    expect(hudRadar.width).toBeLessThanOrEqual(405);
    expect(hudRadar.height).toBe(hudRadar.width);
    expect(hudRadar.x + hudRadar.width).toBeLessThanOrEqual(1280);
    expect(hudRadar.y + hudRadar.height).toBeLessThanOrEqual(800);
  });

  it('places two identical symmetric lower bridges between the bottom HUD windows', () => {
    const layout = calculateResponsiveHudLayout(1280, 720);
    const historyPanel = calculateInvariantHistoryPanel(layout, 1280, 720);
    const bridges = calculateBottomBridgePanels(layout, 1280, 720);

    expect(bridges).toHaveLength(2);
    const [left, right] = bridges;
    expect(left.rect.width).toBeCloseTo(right.rect.width);
    expect(left.rect.height).toBeCloseTo(right.rect.height);
    expect(left.rect.y).toBeCloseTo(right.rect.y);
    expect(left.rect.x).toBeGreaterThanOrEqual(layout.minimap.x + layout.minimap.width);
    expect(left.rect.x + left.rect.width).toBeLessThanOrEqual(historyPanel.x);
    expect(right.rect.x).toBeGreaterThanOrEqual(historyPanel.x + historyPanel.width);
    expect(right.rect.x + right.rect.width).toBeLessThanOrEqual(layout.radar.x);

    const normalize = (bridge: (typeof bridges)[number]) => bridge.path.map((point) => ({
      x: (point.x - bridge.rect.x) / bridge.rect.width,
      y: (point.y - bridge.rect.y) / bridge.rect.height,
    }));
    const leftNormalized = normalize(left);
    const rightNormalized = normalize(right);
    leftNormalized.forEach((point, index) => {
      expect(point.x).toBeCloseTo(rightNormalized[index].x);
      expect(point.y).toBeCloseTo(rightNormalized[index].y);
    });
    for (const point of leftNormalized) {
      const mirror = leftNormalized.find(
        (candidate) =>
          Math.abs(candidate.x - (1 - point.x)) < 1e-9 &&
          Math.abs(candidate.y - point.y) < 1e-9,
      );
      expect(mirror).toBeDefined();
    }
  });

  it('uses the same black fill for lower bridges as the bottom HUD windows', () => {
    expect(calculateBottomBridgeVisualStyle()).toEqual({
      fillColor: hudColors.panelFill,
      strokeColor: hudColors.red,
    });
  });

  it('places solid vertical red guide lines inward of the top canopy chamfers', () => {
    const layout = calculateResponsiveHudLayout(1280, 720);
    const canopy = calculateConnectedMeterCanopy(layout, 1280);
    const canopyCut = Math.min(34, canopy.height * 0.36);
    const guides = calculateSideVerticalHudGuides(layout, 1280);

    expect(guides).toHaveLength(2);
    const leftTarget = canopy.x + canopyCut + 10;
    const rightTarget = canopy.x + canopy.width - canopyCut - 10;
    expect(Math.abs(guides[0].x - leftTarget)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(guides[1].x - rightTarget)).toBeLessThanOrEqual(0.5);
    for (const guide of guides) {
      expect(guide.x % 1).toBeCloseTo(0.5);
      expect(guide.start.y).toBeGreaterThan(canopy.y + canopy.height);
      expect(guide.end.y).toBeLessThan(layout.minimap.y);
    }
    expect(calculateSideVerticalHudGuideStyle()).toEqual({
      strokeColor: formatMinimapGuideLineColor(0.72),
      lineWidth: 1.2,
      dash: [],
      shadowBlur: 0,
    });
  });

  it('keeps HUD panels from overlapping on narrow mobile viewports', () => {
    const layout = calculateResponsiveHudLayout(320, 568);

    expect(layout.curvatureMeter.x + layout.curvatureMeter.width).toBeLessThanOrEqual(layout.torsionMeter.x);
    expect(layout.minimap.x + layout.minimap.width).toBeLessThanOrEqual(layout.radar.x);
    expect(layout.curvatureMeter.x).toBeGreaterThanOrEqual(0);
    expect(layout.radar.x + layout.radar.width).toBeLessThanOrEqual(320);
  });

  it('matches bottom-left and bottom-right inset sizes on desktop viewports', () => {
    const layout = calculateResponsiveHudLayout(1280, 800);

    expect(layout.minimap.width).toBeCloseTo(layout.radar.width);
    expect(layout.minimap.height).toBeCloseTo(layout.radar.height);
  });

  it('keeps the responsive radar rectangle anchored in the bottom-right corner', () => {
    const layout = calculateResponsiveHudLayout(320, 568);

    expect(layout.radar.width).toBe(layout.radar.height);
    expect(layout.radar.x + layout.radar.width).toBeLessThanOrEqual(320);
    expect(layout.radar.y + layout.radar.height).toBeLessThanOrEqual(568);
  });

  it('reserves cinematic top meter space on desktop viewports', () => {
    const layout = calculateResponsiveHudLayout(1440, 900);

    expect(layout.curvatureMeter.height).toBeGreaterThanOrEqual(78);
    expect(layout.torsionMeter.height).toBe(layout.curvatureMeter.height);
    expect(layout.curvatureMeter.width).toBeGreaterThanOrEqual(360);
    expect(layout.torsionMeter.x).toBeGreaterThan(layout.curvatureMeter.x + layout.curvatureMeter.width);
    expect(layout.curvatureMeter.y).toBeGreaterThanOrEqual(16);
  });

  it('connects the top curvature and torsion meters with a shared canopy window', () => {
    const layout = calculateResponsiveHudLayout(1440, 900);
    const canopy = calculateConnectedMeterCanopy(layout, 1440);

    expect(canopy.x).toBeLessThanOrEqual(layout.curvatureMeter.x);
    expect(canopy.x + canopy.width).toBeGreaterThanOrEqual(layout.torsionMeter.x + layout.torsionMeter.width);
    expect(canopy.y).toBeLessThanOrEqual(layout.curvatureMeter.y);
    expect(canopy.y + canopy.height).toBeGreaterThanOrEqual(layout.curvatureMeter.y + layout.curvatureMeter.height);
    expect(canopy.y + canopy.height).toBeGreaterThanOrEqual(layout.torsionMeter.y + layout.torsionMeter.height);
  });

  it('aligns the shared top meter canopy with the outer bottom inset edges', () => {
    const layout = calculateResponsiveHudLayout(1440, 900);
    const canopy = calculateConnectedMeterCanopy(layout, 1440);

    expect(canopy.x).toBeCloseTo(layout.minimap.x);
    expect(canopy.x + canopy.width).toBeCloseTo(layout.radar.x + layout.radar.width);
  });

  it('uses a shallow A-style center bridge for the connected meter canopy path', () => {
    const layout = calculateResponsiveHudLayout(1440, 900);
    const canopy = calculateConnectedMeterCanopy(layout, 1440);
    const path = calculateConnectedMeterCanopyPath(layout, 1440);
    const centerBand = path.filter((point) => Math.abs(point.x - (canopy.x + canopy.width / 2)) < canopy.width * 0.12);
    const deepestCenterY = Math.max(...centerBand.map((point) => point.y));

    expect(path.length).toBeGreaterThan(12);
    expect(deepestCenterY).toBeLessThan(canopy.y + canopy.height * 0.56);
  });

  it('places a bottom center invariant history panel between the curve and normal-plane pods', () => {
    const layout = calculateResponsiveHudLayout(1440, 900);
    const panel = calculateInvariantHistoryPanel(layout, 1440, 900);

    expect(panel.x).toBeGreaterThanOrEqual(layout.minimap.x + layout.minimap.width);
    expect(panel.x + panel.width).toBeLessThanOrEqual(layout.radar.x);
    expect(panel.width).toBeGreaterThan(520);
    expect(panel.y + panel.height).toBe(layout.minimap.y + layout.minimap.height);
    expect(panel.height).toBeLessThan(layout.minimap.height);
    expect(panel.height).toBeLessThanOrEqual(230);
  });

  it('maps curvature and torsion history into bottom-center graph coordinates from old to current', () => {
    const rect = { x: 300, y: 500, width: 300, height: 120 };
    const history = [
      { age: 0, curvature: 0.75, torsion: 0.5 },
      { age: 1.5, curvature: 0.375, torsion: 0 },
      { age: 3, curvature: 0, torsion: -0.5 },
    ];

    const graph = calculateInvariantHistoryGraph(history, rect, 3, 0.75, 0.5);

    expect(graph.curvature).toHaveLength(3);
    expect(graph.torsion).toHaveLength(3);
    expect(graph.curvature[0].x).toBeLessThan(graph.curvature[1].x);
    expect(graph.curvature[1].x).toBeLessThan(graph.curvature[2].x);
    expect(graph.curvature[0].y).toBeGreaterThan(graph.curvature[2].y);
    expect(graph.torsion[0].y).toBeGreaterThan(graph.torsion[1].y);
    expect(graph.torsion[2].y).toBeLessThan(graph.torsion[1].y);
    expect(graph.torsionZeroY).toBeCloseTo(graph.torsion[1].y);
  });

  it('keeps max-magnitude torsion history off the graph rails with visual headroom', () => {
    const rect = { x: 300, y: 500, width: 300, height: 120 };
    const history = [
      { age: 0, curvature: 0.3, torsion: 1 },
      { age: 1.5, curvature: 0.3, torsion: 0 },
      { age: 3, curvature: 0.3, torsion: -1 },
    ];
    const graphTop = rect.y + Math.min(46, Math.max(34, rect.height * 0.24));
    const graphHeight = Math.max(
      1,
      rect.height -
        Math.min(46, Math.max(34, rect.height * 0.24)) -
        Math.min(28, Math.max(18, rect.height * 0.16)),
    );
    const graphBottom = graphTop + graphHeight;

    const graph = calculateInvariantHistoryGraph(history, rect, 3, 0.75, 1);
    const torsionYs = graph.torsion.map((point) => point.y);

    expect(Math.min(...torsionYs)).toBeGreaterThan(graphTop + 18);
    expect(Math.max(...torsionYs)).toBeLessThan(graphBottom - 18);
    expect(graph.torsionZeroY).toBeCloseTo(graphTop + graphHeight / 2);
  });

  it('places invariant history Greek symbols in the top graph corners', () => {
    const rect = { x: 300, y: 500, width: 300, height: 120 };
    const graphTop = rect.y + Math.min(46, Math.max(34, rect.height * 0.24));
    const padX = Math.min(26, Math.max(14, rect.width * 0.08));
    const symbols = calculateInvariantHistoryGraphSymbolPositions(rect);

    expect(symbols.curvature.x).toBeCloseTo(rect.x + padX + 5);
    expect(symbols.torsion.x).toBeCloseTo(rect.x + rect.width - padX - 13);
    expect(symbols.curvature.y).toBeCloseTo(graphTop + 15);
    expect(symbols.torsion.y).toBe(symbols.curvature.y);
  });

  it('keeps core HUD panels separated on compact screens after cinematic sizing', () => {
    const layout = calculateResponsiveHudLayout(320, 568);
    const topMeterBottom = Math.max(
      layout.curvatureMeter.y + layout.curvatureMeter.height,
      layout.torsionMeter.y + layout.torsionMeter.height,
    );

    expect(layout.curvatureMeter.x + layout.curvatureMeter.width).toBeLessThanOrEqual(layout.torsionMeter.x);
    expect(layout.minimap.x + layout.minimap.width).toBeLessThanOrEqual(layout.radar.x);
    expect(layout.minimap.y).toBeGreaterThan(topMeterBottom + 180);
    expect(layout.minimap.width).toBeGreaterThanOrEqual(96);
    expect(layout.radar.width).toBeGreaterThanOrEqual(168);
    expect(layout.radar.x + layout.radar.width).toBeLessThanOrEqual(320);
  });

  it('uses available width as the hard overlap bound on very narrow viewports', () => {
    const layout = calculateResponsiveHudLayout(280, 568);

    expect(layout.curvatureMeter.x).toBeGreaterThanOrEqual(0);
    expect(layout.curvatureMeter.x + layout.curvatureMeter.width).toBeLessThanOrEqual(layout.torsionMeter.x);
    expect(layout.torsionMeter.x + layout.torsionMeter.width).toBeLessThanOrEqual(280);
    expect(layout.minimap.x).toBeGreaterThanOrEqual(0);
    expect(layout.minimap.x + layout.minimap.width).toBeLessThanOrEqual(layout.radar.x);
    expect(layout.radar.x + layout.radar.width).toBeLessThanOrEqual(280);
  });

  it('projects minimap samples into a padded square while preserving nearest sample identity', () => {
    const samples = [
      sample(0, -2, -1),
      sample(1, 2, -1),
      sample(2, 2, 1),
      sample(3, -2, 1),
    ];

    const projection = calculateMinimapProjection(samples, samples[2], {
      x: 20,
      y: 300,
      width: 200,
      height: 160,
    });

    expect(projection.points).toHaveLength(samples.length);
    expect(projection.points[0].x).toBeCloseTo(36);
    expect(projection.points[0].y).toBeCloseTo(422);
    expect(projection.points[2].x).toBeCloseTo(204);
    expect(projection.points[2].y).toBeCloseTo(338);
    expect(projection.nearest).toEqual(projection.points[2]);
  });

  it('normalizes minimap sample depth from the curve height', () => {
    const samples = [
      sample(0, -1, 0, -2),
      sample(1, 0, 0, 0),
      sample(2, 1, 0, 2),
    ];

    const projection = calculateMinimapProjection(samples, samples[1], {
      x: 0,
      y: 0,
      width: 200,
      height: 160,
    });

    expect(projection.points[0].depth).toBeCloseTo(0);
    expect(projection.points[1].depth).toBeCloseTo(0.5);
    expect(projection.points[2].depth).toBeCloseTo(1);
    expect(projection.nearest.depth).toBeCloseTo(0.5);
  });

  it('maps minimap stroke brightness visibly to z depth while keeping width constant', () => {
    const samples = [
      sample(0, -1, 0, -2),
      sample(1, 0, 0, -2),
      sample(2, 1, 0, 2),
      sample(3, 2, 0, 2),
    ];
    const projection = calculateMinimapProjection(samples, samples[0], {
      x: 0,
      y: 0,
      width: 200,
      height: 160,
    });

    const segments = calculateMinimapStrokeSegments(projection.points);
    const widths = segments.map((segment) => segment.lineWidth);
    const alphas = segments.map((segment) => segment.alpha);

    expect(segments).toHaveLength(samples.length);
    expect(Math.max(...widths)).toBeLessThanOrEqual(2.25);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(0.25);
    expect(Math.max(...alphas) - Math.min(...alphas)).toBeGreaterThanOrEqual(0.5);
    expect(segments[2].alpha).toBeGreaterThan(segments[0].alpha);
    expect(formatMinimapStrokeColor(segments[2].alpha)).toBe('rgba(255, 159, 47, 0.900)');
  });

  it('projects a fixed-length white tangent vector from the current minimap dot', () => {
    const current = {
      ...sample(0, 0, 0),
      tangent: new Vector3(0, 1, 3),
    };
    const rect = { x: 0, y: 0, width: 200, height: 160 };
    const base = { x: 100, y: 100 };

    const vector = calculateMinimapTangentVector(base, current, rect);

    expect(vector.start).toEqual(base);
    expect(vector.end.x).toBeCloseTo(base.x);
    expect(vector.end.y).toBeLessThan(base.y);
    expect(Math.hypot(vector.end.x - base.x, vector.end.y - base.y)).toBeCloseTo(19.2);
    expect(vector.color).toBe('#ffffff');
    expect(vector.label).toBe('T');
    expect(vector.labelVisible).toBe(true);
    expect(vector.labelPosition.y).toBeLessThan(vector.end.y);
  });

  it('hides the minimap tangent label when it would leave the panel bounds', () => {
    const current = {
      ...sample(0, 0, 0),
      tangent: new Vector3(1, 0, 0),
    };
    const rect = { x: 0, y: 0, width: 200, height: 160 };
    const base = { x: 184, y: 80 };

    const vector = calculateMinimapTangentVector(base, current, rect);

    expect(vector.end.x).toBeGreaterThan(base.x);
    expect(vector.labelPosition.x).toBeGreaterThan(rect.x + rect.width);
    expect(vector.labelVisible).toBe(false);
  });

  it('maps N prime and its projections into the tangent-binormal plane', () => {
    const current = {
      ...sample(0, 0, 0),
      curvature: 0.1,
      torsion: 0.05,
    };

    const vectors = calculateTangentBinormalPlaneVectors(current, 1, 0.5);

    expect(vectors.normalDerivative.start).toEqual({ x: 0, y: 0 });
    expect(vectors.normalDerivative.end.x).toBeCloseTo(0.3);
    expect(vectors.normalDerivative.end.y).toBeCloseTo(-0.3);
    expect(vectors.tProjection.end.y).toBeCloseTo(-0.3);
    expect(vectors.bProjection.end.x).toBeCloseTo(0.3);
  });

  it('adds vertical padding above the tangent-binormal plane title', () => {
    const rect = { x: 100, y: 200, width: 260, height: 220 };

    const title = calculateTangentBinormalPlaneTitlePosition(rect);

    expect(title.x).toBe(rect.x + 13);
    expect(title.y).toBe(rect.y + 24);
  });

  it('preserves torsion sign in the tangent-binormal B projection', () => {
    const current = {
      ...sample(0, 0, 0),
      curvature: 0.1,
      torsion: -0.05,
    };

    const vectors = calculateTangentBinormalPlaneVectors(current, 1, 0.5);

    expect(vectors.normalDerivative.end.x).toBeCloseTo(-0.3);
    expect(vectors.normalDerivative.end.y).toBeCloseTo(-0.3);
    expect(vectors.bProjection.end.x).toBeCloseTo(-0.3);
  });

  it('clamps tangent-binormal vector lengths to the display radius', () => {
    const current = {
      ...sample(0, 0, 0),
      curvature: 4,
      torsion: 3,
    };

    const vectors = calculateTangentBinormalPlaneVectors(current, 1, 0.5);

    expect(Math.hypot(vectors.normalDerivative.end.x, vectors.normalDerivative.end.y)).toBeLessThanOrEqual(1);
    expect(Math.hypot(vectors.tProjection.end.x, vectors.tProjection.end.y)).toBeLessThanOrEqual(1);
    expect(Math.hypot(vectors.bProjection.end.x, vectors.bProjection.end.y)).toBeLessThanOrEqual(1);
  });

  it('places main-view derivative vectors as a 2D overlay centered on the tunnel view', () => {
    const current = {
      ...sample(0, 0, 0),
      tangentDerivative: new Vector3(0, 0.5, 0),
      curvature: 0.5,
      torsion: 0.25,
    };

    const vectors = calculateMainViewDerivativeVectors(current, 1000, 700, 1, 0.5);

    expect(vectors.base).toEqual({ x: 500, y: 350 });
    expect(vectors.tangentDerivative.start).toEqual(vectors.base);
    expect(vectors.normalDerivative.start).toEqual(vectors.base);
    expect(vectors.tangentDerivative.end.x).toBeLessThan(vectors.base.x);
    expect(vectors.tangentDerivative.end.x).toBeCloseTo(248);
    expect(vectors.normalDerivative.end.y).toBeLessThan(vectors.base.y);
    expect(vectors.maxLength).toBeCloseTo(504);
  });

  it('clamps main-view derivative vectors to a fixed overlay length', () => {
    const current = {
      ...sample(0, 0, 0),
      curvature: 5,
      torsion: 5,
    };

    const vectors = calculateMainViewDerivativeVectors(current, 1000, 700, 1, 0.5);
    const tLength = Math.hypot(
      vectors.tangentDerivative.end.x - vectors.base.x,
      vectors.tangentDerivative.end.y - vectors.base.y,
    );
    const nLength = Math.hypot(
      vectors.normalDerivative.end.x - vectors.base.x,
      vectors.normalDerivative.end.y - vectors.base.y,
    );

    expect(tLength).toBeLessThanOrEqual(vectors.maxLength);
    expect(nLength).toBeLessThanOrEqual(vectors.maxLength);
  });
});
