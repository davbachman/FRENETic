# Cinematic HUD UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade FRENETic's renderer to the approved cinematic cockpit direction: hybrid top meters, volumetric cyan tunnel rings, and integrated lower console pods.

**Architecture:** Keep the pass inside the existing rendering boundary. `TunnelRings` owns preallocated ring visuals, `HudOverlay` owns canvas HUD drawing and layout, `colors.ts` owns the expanded neon palette, and `GameRenderer` continues to compose the scene without gameplay changes.

**Tech Stack:** Vite, TypeScript, Three.js, Canvas 2D HUD texture, Vitest, Playwright via the existing `develop-web-game` skill client.

---

## File Structure

Modify these files:

- `src/game/rendering/colors.ts`: expand the HUD palette with glass, magenta, danger, safe, amber, and tunnel glow colors.
- `src/game/rendering/hud.ts`: add angular panel helpers, larger top meter layout, lower console rail layout, hybrid meter drawing, minimap pod styling, and radar pod styling.
- `src/game/rendering/hud.test.ts`: add layout and helper coverage for cinematic meters and lower console bounds.
- `src/game/rendering/tunnel.ts`: convert each tunnel ring into a preallocated multi-layer ring group for thicker cyan glow.
- `src/game/rendering/tunnel.test.ts`: update ring tests for layered visuals and allocation reuse.

Do not modify simulation, input, curve sampling, game state, or level definitions.

---

### Task 1: Expand HUD Palette And Cinematic Layout Bounds

**Files:**
- Modify: `src/game/rendering/colors.ts`
- Modify: `src/game/rendering/hud.ts`
- Test: `src/game/rendering/hud.test.ts`

- [ ] **Step 1: Write failing layout tests**

Add these tests inside `describe('HUD overlay helpers', () => { ... })` in `src/game/rendering/hud.test.ts`:

```ts
  it('reserves cinematic top meter space on desktop viewports', () => {
    const layout = calculateResponsiveHudLayout(1440, 900);

    expect(layout.curvatureMeter.height).toBeGreaterThanOrEqual(78);
    expect(layout.torsionMeter.height).toBe(layout.curvatureMeter.height);
    expect(layout.curvatureMeter.width).toBeGreaterThanOrEqual(360);
    expect(layout.torsionMeter.x).toBeGreaterThan(layout.curvatureMeter.x + layout.curvatureMeter.width);
    expect(layout.curvatureMeter.y).toBeGreaterThanOrEqual(16);
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
```

- [ ] **Step 2: Run the focused HUD tests and verify they fail**

Run:

```bash
npm run test:run -- src/game/rendering/hud.test.ts
```

Expected: FAIL because `calculateResponsiveHudLayout()` still returns the old compact meter height.

- [ ] **Step 3: Expand the palette**

Replace `src/game/rendering/colors.ts` with:

```ts
export const hudColors = {
  cyan: '#36f3ff',
  cyanDim: '#1c7f8f',
  cyanSoft: '#8cecff',
  blue: '#3492ff',
  blueBright: '#27d9ff',
  green: '#70ff9d',
  greenBright: '#40ff8e',
  red: '#ff4d61',
  danger: '#ff244f',
  amber: '#ffd166',
  safe: '#32e56d',
  magenta: '#ff3dba',
  purple: '#8b35ff',
  glassFill: 'rgba(2, 10, 22, 0.72)',
  glassFillStrong: 'rgba(3, 14, 28, 0.86)',
  glassStroke: 'rgba(54, 243, 255, 0.68)',
  grid: 'rgba(54, 243, 255, 0.16)',
  text: 'rgba(218, 252, 255, 0.94)',
  textDim: 'rgba(180, 232, 238, 0.66)',
  background: '#02040a',
};
```

- [ ] **Step 4: Update responsive HUD layout sizing**

In `src/game/rendering/hud.ts`, replace the body of `calculateResponsiveHudLayout()` with:

```ts
export function calculateResponsiveHudLayout(width: number, height: number): HudLayout {
  const minDimension = Math.min(width, height);
  const margin = Math.max(8, Math.min(28, minDimension * 0.035));
  const gap = Math.max(8, Math.min(18, width * 0.03));
  const meterMaxWidth = width < 700 ? 320 : 430;
  const meterWidth = Math.min(
    meterMaxWidth,
    Math.max(132, (width - margin * 2 - gap) / 2, width * 0.3),
  );
  const meterHeight = width < 560 ? 58 : 86;
  const bottomGap = Math.max(8, Math.min(18, width * 0.035));
  const radar = getRadarRect(width, height);
  const minimapMaxWidth = Math.max(96, radar.x - margin - bottomGap);
  const bottomSize = Math.min(230, Math.max(96, minDimension * 0.26), minimapMaxWidth);
  const bottomY = height - Math.max(bottomSize, radar.height) - margin;

  return {
    curvatureMeter: { x: margin, y: 18, width: meterWidth, height: meterHeight },
    torsionMeter: { x: width - margin - meterWidth, y: 18, width: meterWidth, height: meterHeight },
    minimap: { x: margin, y: bottomY, width: bottomSize, height: bottomSize },
    radar,
  };
}
```

- [ ] **Step 5: Run the focused HUD tests and verify they pass**

Run:

```bash
npm run test:run -- src/game/rendering/hud.test.ts
```

Expected: PASS for all HUD helper tests.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add src/game/rendering/colors.ts src/game/rendering/hud.ts src/game/rendering/hud.test.ts
git commit -m "feat: size cinematic HUD layout"
```

---

### Task 2: Build Volumetric Tunnel Ring Layers

**Files:**
- Modify: `src/game/rendering/tunnel.ts`
- Test: `src/game/rendering/tunnel.test.ts`

- [ ] **Step 1: Update tunnel tests for layered ring visuals**

In `src/game/rendering/tunnel.test.ts`, change the Three.js import to:

```ts
import { BufferGeometry, Group, LineBasicMaterial, LineLoop, Vector3 } from 'three';
```

Add this helper below `makeSimulation()`:

```ts
function ringLayers(tunnel: TunnelRings, ringIndex: number): LineLoop[] {
  const ringGroup = tunnel.group.children[ringIndex] as Group;
  return ringGroup.children as LineLoop[];
}
```

Replace the first test with:

```ts
  it('creates 46 initially hidden volumetric ring groups with preallocated line layers', () => {
    const tunnel = new TunnelRings();

    expect(tunnel.group.children).toHaveLength(46);
    for (const child of tunnel.group.children) {
      expect(child.type).toBe('Group');
      const group = child as Group;
      expect(group.children).toHaveLength(3);
      for (const layer of group.children as LineLoop[]) {
        expect(layer.type).toBe('LineLoop');
        const geometry = layer.geometry as BufferGeometry;
        const material = layer.material as LineBasicMaterial;
        const position = geometry.getAttribute('position');
        expect(position).toBeDefined();
        expect(position.count).toBe(64);
        expect(geometry.drawRange.count).toBe(0);
        expect(material.transparent).toBe(true);
        expect(material.depthWrite).toBe(false);
        expect(material.opacity).toBeGreaterThan(0);
      }
    }

    tunnel.dispose();
  });
```

In the remaining tests, replace direct access to `tunnel.group.children[n] as LineLoop` with `ringLayers(tunnel, n)[0]`. In the dispose test, replace the spy setup with:

```ts
    const layers = tunnel.group.children.flatMap((child) => (child as Group).children as LineLoop[]);
    const geometryDispose = layers.map((layer) =>
      vi.spyOn(layer.geometry as BufferGeometry, 'dispose'),
    );
    const materialDispose = layers.map((layer) =>
      vi.spyOn(layer.material as LineBasicMaterial, 'dispose'),
    );
```

Add this test before the dispose test:

```ts
  it('keeps core layers brighter than halo layers and fades distant rings', () => {
    const tunnel = new TunnelRings();

    tunnel.update(makeSimulation());

    const nearLayers = ringLayers(tunnel, 0);
    const farLayers = ringLayers(tunnel, tunnel.group.children.length - 1);
    const nearCore = nearLayers[0].material as LineBasicMaterial;
    const nearOuterHalo = nearLayers[2].material as LineBasicMaterial;
    const farCore = farLayers[0].material as LineBasicMaterial;

    expect(nearCore.opacity).toBeGreaterThan(nearOuterHalo.opacity);
    expect(nearCore.opacity).toBeGreaterThan(farCore.opacity);
    expect(nearCore.color.getStyle()).toBe('rgb(255,0,170)');

    tunnel.dispose();
  });
```

- [ ] **Step 2: Run tunnel tests and verify they fail**

Run:

```bash
npm run test:run -- src/game/rendering/tunnel.test.ts
```

Expected: FAIL because `TunnelRings` still creates one `LineLoop` per ring.

- [ ] **Step 3: Implement layered tunnel rings**

In `src/game/rendering/tunnel.ts`, add these definitions after `MAX_OPACITY`:

```ts
const RING_LAYERS = [
  { radiusOffset: 0, opacityScale: 1 },
  { radiusOffset: -0.035, opacityScale: 0.38 },
  { radiusOffset: 0.035, opacityScale: 0.3 },
] as const;

interface RingVisual {
  group: Group;
  layers: LineLoop[];
}
```

Change the class field:

```ts
  private readonly rings: RingVisual[];
```

Replace the constructor with:

```ts
  constructor() {
    this.rings = Array.from({ length: RING_COUNT }, (_, index) => {
      const opacityT = 1 - index / Math.max(1, RING_COUNT - 1);
      const group = new Group();
      const layers = RING_LAYERS.map((layer) => {
        const material = new LineBasicMaterial({
          color: hudColors.cyan,
          transparent: true,
          opacity: (MIN_OPACITY + opacityT * (MAX_OPACITY - MIN_OPACITY)) * layer.opacityScale,
          depthWrite: false,
        });
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          'position',
          new BufferAttribute(new Float32Array(RING_SEGMENTS * 3), 3),
        );
        geometry.setDrawRange(0, 0);
        const line = new LineLoop(geometry, material);
        group.add(line);
        return line;
      });
      this.group.add(group);
      return { group, layers };
    });
  }
```

Replace the loop body in `update()` with:

```ts
      const visual = this.rings[ringIndex];
      const distanceT = ringIndex / Math.max(1, this.rings.length - 1);
      const baseOpacity = Math.max(MIN_OPACITY, MAX_OPACITY * (1 - distanceT));

      visual.layers.forEach((ring, layerIndex) => {
        const geometry = ring.geometry as BufferGeometry;
        const position = geometry.getAttribute('position') as BufferAttribute;
        const layer = RING_LAYERS[layerIndex];
        const layerRadius = level.tubeRadius * (1 + layer.radiusOffset);
        writeRingPositions(sample, layerRadius, position.array as Float32Array);
        position.needsUpdate = true;
        geometry.setDrawRange(0, RING_SEGMENTS);
        geometry.computeBoundingSphere();

        const material = ring.material as LineBasicMaterial;
        material.color.copy(color);
        material.opacity = Math.max(MIN_OPACITY * layer.opacityScale, baseOpacity * layer.opacityScale);
        material.needsUpdate = true;
      });
```

Replace `dispose()` with:

```ts
  dispose(): void {
    for (const visual of this.rings) {
      for (const ring of visual.layers) {
        ring.geometry.dispose();
        (ring.material as LineBasicMaterial).dispose();
      }
    }
  }
```

- [ ] **Step 4: Run tunnel tests and verify they pass**

Run:

```bash
npm run test:run -- src/game/rendering/tunnel.test.ts
```

Expected: PASS for all tunnel tests.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/game/rendering/tunnel.ts src/game/rendering/tunnel.test.ts
git commit -m "feat: layer volumetric tunnel rings"
```

---

### Task 3: Draw Hybrid Cinematic Top Meters

**Files:**
- Modify: `src/game/rendering/hud.ts`
- Test: `src/game/rendering/hud.test.ts`

- [ ] **Step 1: Write failing meter track tests**

Add `calculateMeterTrack` to the import list in `src/game/rendering/hud.test.ts`.

Add these tests inside the HUD helper describe block:

```ts
  it('places meter tracks inside cinematic meter frames', () => {
    const rect = { x: 28, y: 18, width: 430, height: 86 };
    const track = calculateMeterTrack(rect);

    expect(track.x).toBe(rect.x + 24);
    expect(track.width).toBe(rect.width - 48);
    expect(track.height).toBe(14);
    expect(track.y + track.height).toBeLessThanOrEqual(rect.y + rect.height - 12);
  });

  it('keeps compact meter tracks usable on mobile panels', () => {
    const rect = { x: 18, y: 18, width: 137, height: 58 };
    const track = calculateMeterTrack(rect);

    expect(track.width).toBeGreaterThanOrEqual(80);
    expect(track.x).toBeGreaterThan(rect.x);
    expect(track.y).toBeGreaterThan(rect.y + 28);
  });
```

- [ ] **Step 2: Run HUD tests and verify they fail**

Run:

```bash
npm run test:run -- src/game/rendering/hud.test.ts
```

Expected: FAIL because `calculateMeterTrack` is not exported.

- [ ] **Step 3: Add meter track and angular shape helpers**

In `src/game/rendering/hud.ts`, add this exported helper after `calculateSignedMeterGeometry()`:

```ts
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
```

Add these private helpers inside `HudOverlay` before `drawPanel()`:

```ts
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
```

- [ ] **Step 4: Replace top meter drawing**

In `drawMeter()`, replace `this.drawPanel(rect);` and the old track block with this implementation:

```ts
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
```

- [ ] **Step 5: Run HUD tests and verify they pass**

Run:

```bash
npm run test:run -- src/game/rendering/hud.test.ts
```

Expected: PASS for all HUD helper tests.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add src/game/rendering/hud.ts src/game/rendering/hud.test.ts
git commit -m "feat: draw cinematic top meters"
```

---

### Task 4: Draw Integrated Lower Console Pods

**Files:**
- Modify: `src/game/rendering/hud.ts`
- Test: `src/game/rendering/hud.test.ts`

- [ ] **Step 1: Write failing lower console layout tests**

Add `calculateLowerConsoleRail` to the import list in `src/game/rendering/hud.test.ts`.

Add this test inside the HUD helper describe block:

```ts
  it('connects bottom corner pods with a lower console rail that stays below core instruments', () => {
    const layout = calculateResponsiveHudLayout(1280, 800);
    const rail = calculateLowerConsoleRail(layout, 1280, 800);

    expect(rail.x).toBeGreaterThan(layout.minimap.x);
    expect(rail.x + rail.width).toBeLessThan(layout.radar.x + layout.radar.width);
    expect(rail.width).toBeGreaterThan(300);
    expect(rail.y).toBeGreaterThanOrEqual(layout.minimap.y + layout.minimap.height - rail.height);
    expect(rail.y + rail.height).toBeLessThanOrEqual(800 - 8);
  });
```

- [ ] **Step 2: Run HUD tests and verify they fail**

Run:

```bash
npm run test:run -- src/game/rendering/hud.test.ts
```

Expected: FAIL because `calculateLowerConsoleRail` is not exported.

- [ ] **Step 3: Add lower console rail helper**

In `src/game/rendering/hud.ts`, add this exported helper after `calculateRadarHudRect()`:

```ts
export function calculateLowerConsoleRail(layout: HudLayout, width: number, height: number): Rect {
  const railHeight = Math.max(18, Math.min(38, height * 0.035));
  const x = layout.minimap.x + layout.minimap.width * 0.55;
  const right = layout.radar.x + layout.radar.width * 0.45;
  const y = Math.min(
    height - railHeight - 8,
    Math.max(
      layout.minimap.y + layout.minimap.height - railHeight,
      layout.radar.y + layout.radar.height - railHeight,
    ),
  );

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: railHeight,
  };
}
```

- [ ] **Step 4: Refactor HUD draw to share one layout**

Change `draw()` in `HudOverlay` to compute the layout once:

```ts
  draw(game: GameState, simulation: SimulationState): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const layout = calculateResponsiveHudLayout(width, height);
    this.ctx.clearRect(0, 0, width, height);

    this.drawLowerConsole(layout, width, height);
    this.drawMeters(game, simulation, layout);
    this.drawMinimap(simulation, layout);
    this.drawRadar(simulation, layout);
    this.drawStatus(game, simulation, width, height, layout);
    this.texture.needsUpdate = true;
  }
```

Update method signatures and layout usage:

```ts
  private drawMeters(game: GameState, simulation: SimulationState, layout: HudLayout): void
  private drawMinimap(simulation: SimulationState, layout: HudLayout): void
  private drawRadar(simulation: SimulationState, layout: HudLayout): void
  private drawStatus(game: GameState, simulation: SimulationState, width: number, height: number, layout: HudLayout): void
```

Inside those methods, remove local `calculateResponsiveHudLayout(...)` calls and use the passed `layout`.

- [ ] **Step 5: Add lower console and pod drawing helpers**

Add this private helper inside `HudOverlay`:

```ts
  private drawLowerConsole(layout: HudLayout, width: number, height: number): void {
    const ctx = this.ctx;
    const rail = calculateLowerConsoleRail(layout, width, height);
    if (rail.width <= 0) {
      return;
    }

    ctx.save();
    ctx.shadowColor = hudColors.magenta;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = hudColors.magenta;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.58;
    ctx.beginPath();
    ctx.moveTo(rail.x, rail.y + rail.height * 0.35);
    ctx.lineTo(rail.x + rail.width, rail.y + rail.height * 0.35);
    ctx.stroke();
    ctx.strokeStyle = hudColors.cyan;
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    ctx.moveTo(rail.x + 18, rail.y + rail.height * 0.65);
    ctx.lineTo(rail.x + rail.width - 18, rail.y + rail.height * 0.65);
    ctx.stroke();
    ctx.restore();
  }
```

In `drawMinimap()` and `drawRadar()`, replace `this.drawPanel(rect);` with:

```ts
    this.drawAngularPanel(rect, hudColors.cyan, 0.78);
```

At the start of the saved block in `drawRadar()`, after `this.drawAngularPanel(...)`, draw the circular instrument frame:

```ts
    ctx.save();
    ctx.strokeStyle = GRID_STROKE;
    ctx.lineWidth = 1;
    for (const scale of [0.33, 0.66, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * scale, 0, TAU);
      ctx.stroke();
    }
```

Keep the existing radar trace, blue vector, red vector, and torsion arc draw order after the frame.

In `drawMinimap()`, after `this.drawAngularPanel(...)`, add a faint circular instrument guide before drawing the projected curve:

```ts
    ctx.save();
    ctx.strokeStyle = GRID_STROKE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width * 0.39, 0, TAU);
    ctx.stroke();
```

- [ ] **Step 6: Run HUD tests and verify they pass**

Run:

```bash
npm run test:run -- src/game/rendering/hud.test.ts
```

Expected: PASS for all HUD helper tests.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add src/game/rendering/hud.ts src/game/rendering/hud.test.ts
git commit -m "feat: draw integrated lower console"
```

---

### Task 5: Full Verification And Visual QA

**Files:**
- Read: `output/web-game/cinematic-hud-steer`
- Read: `output/web-game/cinematic-hud-level-cycle`

- [ ] **Step 1: Run all local verification commands**

Run:

```bash
npm run typecheck
npm run test:run
npm run build
```

Expected: all commands exit 0. `npm run test:run` reports all Vitest tests passing.

- [ ] **Step 2: Start the local dev server**

Run in a persistent terminal:

```bash
npm run dev -- --port 5173
```

Expected: Vite serves the app at `http://127.0.0.1:5173/`.

- [ ] **Step 3: Verify early-level steering view with Playwright**

Run:

```bash
node /Users/davidbachman/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173/ --actions-file /Users/davidbachman/Documents/FRENETic/test-actions/steer-right.json --iterations 1 --pause-ms 250 --screenshot-dir /Users/davidbachman/Documents/FRENETic/output/web-game/cinematic-hud-steer
```

Expected: command exits 0, no console errors are reported, and the screenshot shows visible top meters, cyan tunnel rings, minimap pod, radar pod, and lower console rail.

- [ ] **Step 4: Verify later knot level with Playwright**

Run:

```bash
node /Users/davidbachman/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173/ --actions-file /Users/davidbachman/Documents/FRENETic/test-actions/level-cycle.json --iterations 1 --pause-ms 250 --screenshot-dir /Users/davidbachman/Documents/FRENETic/output/web-game/cinematic-hud-level-cycle
```

Expected: command exits 0, no console errors are reported, and the screenshot shows a later knot level with the cinematic HUD still readable.

- [ ] **Step 5: Inspect browser state payloads**

For each Playwright run, inspect the client output and confirm the text state includes:

```json
{
  "mode": "playing",
  "hud": {
    "minimapVisible": true,
    "radarVisible": true,
    "curvatureMeterColor": "blue",
    "torsionMeterColor": "green"
  }
}
```

Expected: the exact numeric values may vary, but the HUD fields above match the existing text-state contract.

- [ ] **Step 6: Commit visual verification fixes**

If Tasks 1-4 already pass and screenshots are clean, no files are changed in this step. If verification exposes text overlap or unreadable density, adjust only `src/game/rendering/hud.ts` or `src/game/rendering/tunnel.ts`, rerun Steps 1-4, then commit:

```bash
git add src/game/rendering/hud.ts src/game/rendering/tunnel.ts src/game/rendering/hud.test.ts src/game/rendering/tunnel.test.ts
git commit -m "fix: polish cinematic HUD verification"
```

---

## Completion Criteria

- The HUD uses blue curvature and green torsion top meters with large numeric values, safe bands, and angular cockpit frames.
- The tunnel rings appear thicker and glowier while preserving the existing ring count and preallocated geometry model.
- The minimap and radar sit in lower angular pods connected by a subtle lower rail.
- No gameplay, math, input, or level behavior changes.
- `npm run typecheck`, `npm run test:run`, and `npm run build` pass.
- Desktop and later-level browser screenshots show no blank canvas, console errors, major text overlap, or core HUD clipping.
