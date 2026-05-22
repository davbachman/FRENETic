# FRENETic Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first playable FRENETic web game: a Vite + TypeScript + Three.js arcade tunnel game that teaches curvature and torsion through steering, HUD feedback, and four authored closed-curve levels.

**Architecture:** Use one full-window WebGL canvas with a fixed-step simulation, pure testable curve/math modules, authored level definitions, a player path integrator, pointer-as-trackpad input, Three.js tunnel rendering, and a canvas-texture HUD overlay rendered through the same WebGL renderer. Runtime modules communicate through plain state objects so tests can validate math and game behavior without WebGL.

**Tech Stack:** Vite, TypeScript, Three.js, Vitest, Playwright via the existing `develop-web-game` skill client.

---

## Execution Notes

When implementation starts, also use the `develop-web-game` skill. Create and maintain `progress.md` at the repository root with the original prompt recorded at the top. After meaningful changes, run unit tests. After visual gameplay slices, run the web-game Playwright client, inspect screenshots, inspect `window.render_game_to_text()`, and fix console errors before proceeding.

## File Structure

Create this project structure:

- `package.json`: scripts and dependencies.
- `tsconfig.json`: strict TypeScript settings.
- `vite.config.ts`: Vite development and build config.
- `vitest.config.ts`: Vitest config.
- `index.html`: app mount point.
- `src/style.css`: global canvas layout and dark background.
- `src/main.ts`: app bootstrap.
- `src/game/app.ts`: owns lifecycle, fixed timestep, mode transitions, renderer calls, and test hooks.
- `src/game/curves/types.ts`: level and sampled-curve types.
- `src/game/curves/levels.ts`: four authored closed curves.
- `src/game/curves/sampler.ts`: cyclic sampling, frames, curvature, torsion, arc length.
- `src/game/curves/nearest.ts`: nearest-sample lookup and progress helpers.
- `src/game/simulation/types.ts`: player and simulation state types.
- `src/game/simulation/smoothing.ts`: pointer steering smoothing.
- `src/game/simulation/player.ts`: player initialization and fixed-step update.
- `src/game/simulation/collision.ts`: tube distance, warning, damage, recovery.
- `src/game/input/pointerTrackpad.ts`: radar rectangle, pointer normalization, controller.
- `src/game/state/gameState.ts`: start, playing, pause, complete, failed, restart, next level.
- `src/game/rendering/gameRenderer.ts`: Three.js renderer, scenes, cameras, render orchestration.
- `src/game/rendering/tunnel.ts`: glowing ring geometry and update logic.
- `src/game/rendering/hud.ts`: offscreen HUD canvas, texture, minimap, radar, meters.
- `src/game/rendering/colors.ts`: HUD and tunnel colors.
- `src/game/testing/textState.ts`: `render_game_to_text()` payload builder.
- `src/test/setup.ts`: test setup.
- `test-actions/steer-right.json`: deterministic Playwright input burst.
- `test-actions/level-cycle.json`: deterministic level cycling burst.
- `progress.md`: ongoing implementation notes for the web-game workflow.

---

### Task 1: Scaffold Tooling And Empty App Shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/style.css`
- Create: `src/main.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke.test.ts`
- Create: `progress.md`

- [ ] **Step 1: Create `progress.md`**

```markdown
Original prompt: Build a new web app game that teaches users about curvature and torsion of 3D curves. The app shows a minimap closed curve, a first-person tunnel following that curve, pointer-as-trackpad steering, radar history with curvature/torsion arrows, blue curvature and green torsion meters, authored levels from planar waves to torus knots, momentum in steering, and a dark spaceship HUD motif.

Implementation notes:
- Use Vite + TypeScript + Three.js.
- Maintain deterministic hooks: window.advanceTime(ms) and window.render_game_to_text().
```

- [ ] **Step 2: Create package and config files**

`package.json`:

```json
{
  "name": "frenetic",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "three": "^0.165.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.4.5",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

`src/test/setup.ts`:

```ts
import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});
```

`src/test/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs Vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Create static app shell**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FRENETic</title>
  </head>
  <body>
    <canvas id="game-canvas" aria-label="FRENETic game canvas"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/style.css`:

```css
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #02040a;
  color: #d9fbff;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

#game-canvas {
  display: block;
  width: 100vw;
  height: 100vh;
  touch-action: none;
}
```

`src/main.ts`:

```ts
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!canvas) {
  throw new Error('FRENETic requires a #game-canvas element.');
}

const context = canvas.getContext('2d');

if (context) {
  context.fillStyle = '#02040a';
  context.fillRect(0, 0, canvas.clientWidth || 800, canvas.clientHeight || 600);
  context.fillStyle = '#36f3ff';
  context.font = '20px sans-serif';
  context.fillText('FRENETic loading...', 32, 48);
}
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits with code 0.

- [ ] **Step 5: Verify scaffold**

Run:

```bash
npm run typecheck
npm run test:run
npm run build
```

Expected: typecheck passes, Vitest reports the smoke test passing, and Vite emits `dist/`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts index.html src/style.css src/main.ts src/test/setup.ts src/test/smoke.test.ts progress.md
git commit -m "chore: scaffold FRENETic web app"
```

---

### Task 2: Add Curve Types, Authored Levels, And Sampler Tests

**Files:**
- Create: `src/game/curves/types.ts`
- Create: `src/game/curves/levels.ts`
- Create: `src/game/curves/sampler.ts`
- Create: `src/game/curves/sampler.test.ts`

- [ ] **Step 1: Write failing tests**

`src/game/curves/sampler.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { authoredLevels } from './levels';
import { sampleLevelCurve } from './sampler';

describe('sampleLevelCurve', () => {
  it('samples every authored level as a closed cyclic curve', () => {
    for (const level of authoredLevels) {
      const sampled = sampleLevelCurve(level);
      expect(sampled.samples).toHaveLength(level.sampleCount);
      expect(sampled.totalLength).toBeGreaterThan(10);

      const first = sampled.samples[0].position;
      const lastParam = level.curve(1);
      expect(first.distanceTo(lastParam)).toBeLessThan(1e-6);
    }
  });

  it('keeps planar level torsion near zero', () => {
    const planar = authoredLevels.find((level) => level.id === 'planar-wave');
    expect(planar).toBeDefined();

    const sampled = sampleLevelCurve(planar!);
    const maxTorsion = Math.max(...sampled.samples.map((sample) => Math.abs(sample.torsion)));
    expect(maxTorsion).toBeLessThan(0.05);
  });

  it('detects nonzero torsion in lifted and knotted levels', () => {
    for (const id of ['lifted-wave', 'trefoil-knot', 'cinquefoil-knot']) {
      const level = authoredLevels.find((candidate) => candidate.id === id);
      expect(level).toBeDefined();

      const sampled = sampleLevelCurve(level!);
      const averageTorsion =
        sampled.samples.reduce((sum, sample) => sum + Math.abs(sample.torsion), 0) /
        sampled.samples.length;
      expect(averageTorsion).toBeGreaterThan(0.01);
    }
  });

  it('builds unit tangents and frames orthogonal to tangents', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);

    for (const sample of sampled.samples.filter((_, index) => index % 37 === 0)) {
      expect(sample.tangent.length()).toBeCloseTo(1, 4);
      expect(sample.normal.length()).toBeCloseTo(1, 4);
      expect(sample.binormal.length()).toBeCloseTo(1, 4);
      expect(Math.abs(sample.tangent.dot(sample.normal))).toBeLessThan(1e-4);
      expect(Math.abs(sample.tangent.dot(sample.binormal))).toBeLessThan(1e-4);
    }
  });

  it('approximates a unit circle curvature near one', () => {
    const unitCircle = {
      id: 'unit-circle',
      name: 'Unit Circle',
      speed: 1,
      tubeRadius: 0.5,
      sampleCount: 360,
      acceptableCurvature: [0.8, 1.2] as [number, number],
      acceptableTorsion: [-0.1, 0.1] as [number, number],
      curve: (t: number) => {
        const a = t * Math.PI * 2;
        return new Vector3(Math.cos(a), Math.sin(a), 0);
      },
      visual: { ringColor: '#36f3ff', fogColor: '#02040a' },
    };

    const sampled = sampleLevelCurve(unitCircle);
    const averageCurvature =
      sampled.samples.reduce((sum, sample) => sum + sample.curvature, 0) /
      sampled.samples.length;

    expect(averageCurvature).toBeGreaterThan(0.95);
    expect(averageCurvature).toBeLessThan(1.05);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:run -- src/game/curves/sampler.test.ts
```

Expected: FAIL because `./levels` and `./sampler` do not exist.

- [ ] **Step 3: Implement level and sampler modules**

`src/game/curves/types.ts`:

```ts
import { Vector3 } from 'three';

export type CurveFunction = (t: number) => Vector3;

export interface LevelVisuals {
  ringColor: string;
  fogColor: string;
}

export interface LevelDefinition {
  id: string;
  name: string;
  speed: number;
  tubeRadius: number;
  sampleCount: number;
  acceptableCurvature: [number, number];
  acceptableTorsion: [number, number];
  curve: CurveFunction;
  visual: LevelVisuals;
}

export interface CurveSample {
  index: number;
  t: number;
  position: Vector3;
  tangent: Vector3;
  normal: Vector3;
  binormal: Vector3;
  curvature: number;
  torsion: number;
  arcLength: number;
}

export interface SampledCurve {
  level: LevelDefinition;
  samples: CurveSample[];
  totalLength: number;
}
```

`src/game/curves/levels.ts`:

```ts
import { Vector3 } from 'three';
import type { LevelDefinition } from './types';

const TAU = Math.PI * 2;

function planarWave(t: number): Vector3 {
  const a = TAU * t;
  const radius = 8 + 1.1 * Math.sin(5 * a);
  return new Vector3(radius * Math.cos(a), radius * Math.sin(a), 0);
}

function liftedWave(t: number): Vector3 {
  const a = TAU * t;
  const radius = 8 + 0.9 * Math.sin(4 * a);
  return new Vector3(
    radius * Math.cos(a),
    radius * Math.sin(a),
    1.8 * Math.sin(3 * a + 0.35 * Math.sin(2 * a)),
  );
}

function torusKnot(t: number, p: number, q: number, major = 6, minor = 2): Vector3 {
  const a = TAU * t;
  const tube = major + minor * Math.cos(q * a);
  return new Vector3(
    tube * Math.cos(p * a),
    tube * Math.sin(p * a),
    minor * Math.sin(q * a),
  );
}

export const authoredLevels: LevelDefinition[] = [
  {
    id: 'planar-wave',
    name: 'Planar Wave',
    speed: 7,
    tubeRadius: 1.8,
    sampleCount: 720,
    acceptableCurvature: [0.03, 0.42],
    acceptableTorsion: [-0.05, 0.05],
    curve: planarWave,
    visual: { ringColor: '#36f3ff', fogColor: '#02040a' },
  },
  {
    id: 'lifted-wave',
    name: 'Lifted Wave',
    speed: 7.4,
    tubeRadius: 1.65,
    sampleCount: 840,
    acceptableCurvature: [0.04, 0.5],
    acceptableTorsion: [-0.28, 0.28],
    curve: liftedWave,
    visual: { ringColor: '#57f5ff', fogColor: '#02040a' },
  },
  {
    id: 'trefoil-knot',
    name: 'Trefoil Knot',
    speed: 7.8,
    tubeRadius: 1.45,
    sampleCount: 960,
    acceptableCurvature: [0.06, 0.62],
    acceptableTorsion: [-0.46, 0.46],
    curve: (t) => torusKnot(t, 2, 3, 5.8, 2.1),
    visual: { ringColor: '#7cfff0', fogColor: '#02040a' },
  },
  {
    id: 'cinquefoil-knot',
    name: 'Cinquefoil Knot',
    speed: 8.2,
    tubeRadius: 1.25,
    sampleCount: 1200,
    acceptableCurvature: [0.08, 0.75],
    acceptableTorsion: [-0.65, 0.65],
    curve: (t) => torusKnot(t, 2, 5, 5.4, 2.0),
    visual: { ringColor: '#9dffb0', fogColor: '#02040a' },
  },
];
```

`src/game/curves/sampler.ts`:

```ts
import { Vector3 } from 'three';
import type { CurveSample, LevelDefinition, SampledCurve } from './types';

const SCREEN_UP = new Vector3(0, 0, 1);
const FALLBACK_UP = new Vector3(0, 1, 0);

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function frameNormalFor(tangent: Vector3, previousNormal?: Vector3): Vector3 {
  const source = Math.abs(tangent.dot(SCREEN_UP)) > 0.96 ? FALLBACK_UP : SCREEN_UP;
  const normal = source.clone().sub(tangent.clone().multiplyScalar(source.dot(tangent)));

  if (normal.lengthSq() < 1e-8 && previousNormal) {
    return previousNormal.clone();
  }

  return normal.normalize();
}

export function sampleLevelCurve(level: LevelDefinition): SampledCurve {
  const count = level.sampleCount;
  const positions = Array.from({ length: count }, (_, index) => level.curve(index / count));
  const segmentLengths = positions.map((position, index) =>
    position.distanceTo(positions[wrap(index + 1, count)]),
  );

  const arcLengths: number[] = [];
  let runningLength = 0;
  for (let index = 0; index < count; index += 1) {
    arcLengths[index] = runningLength;
    runningLength += segmentLengths[index];
  }

  const tangents = positions.map((_, index) =>
    positions[wrap(index + 1, count)].clone().sub(positions[wrap(index - 1, count)]).normalize(),
  );

  const normals: Vector3[] = [];
  const binormals: Vector3[] = [];

  for (let index = 0; index < count; index += 1) {
    const normal = frameNormalFor(tangents[index], normals[wrap(index - 1, count)]);
    const binormal = tangents[index].clone().cross(normal).normalize();
    normals[index] = normal;
    binormals[index] = binormal;
  }

  const dt = 1 / count;

  const samples: CurveSample[] = positions.map((position, index) => {
    const prev = wrap(index - 1, count);
    const next = wrap(index + 1, count);
    const prev2 = wrap(index - 2, count);
    const next2 = wrap(index + 2, count);

    const r1 = positions[next].clone().sub(positions[prev]).multiplyScalar(1 / (2 * dt));
    const r2 = positions[next]
      .clone()
      .sub(position.clone().multiplyScalar(2))
      .add(positions[prev])
      .multiplyScalar(1 / (dt * dt));
    const r3 = positions[next2]
      .clone()
      .sub(positions[next].clone().multiplyScalar(2))
      .add(positions[prev].clone().multiplyScalar(2))
      .sub(positions[prev2])
      .multiplyScalar(1 / (2 * dt * dt * dt));
    const cross = r1.clone().cross(r2);
    const curvature = cross.length() / Math.max(r1.length() ** 3, 1e-6);
    const torsion = cross.lengthSq() < 1e-8 ? 0 : cross.dot(r3) / cross.lengthSq();

    return {
      index,
      t: index / count,
      position: position.clone(),
      tangent: tangents[index].clone(),
      normal: normals[index].clone(),
      binormal: binormals[index].clone(),
      curvature,
      torsion,
      arcLength: arcLengths[index],
    };
  });

  return {
    level,
    samples,
    totalLength: runningLength,
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:run -- src/game/curves/sampler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/curves/types.ts src/game/curves/levels.ts src/game/curves/sampler.ts src/game/curves/sampler.test.ts
git commit -m "feat: add authored curve sampling"
```

---

### Task 3: Add Nearest-Centerline Lookup

**Files:**
- Create: `src/game/curves/nearest.ts`
- Create: `src/game/curves/nearest.test.ts`

- [ ] **Step 1: Write failing tests**

`src/game/curves/nearest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { authoredLevels } from './levels';
import { findNearestSample, progressRatioForSample } from './nearest';
import { sampleLevelCurve } from './sampler';

describe('nearest centerline lookup', () => {
  it('finds exact sampled positions', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const target = sampled.samples[123];
    const nearest = findNearestSample(sampled, target.position.clone());

    expect(nearest.index).toBe(123);
    expect(nearest.distance).toBeLessThan(1e-6);
    expect(nearest.sample.position.distanceTo(target.position)).toBeLessThan(1e-6);
  });

  it('reports distance from an offset point', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const sample = sampled.samples[20];
    const point = sample.position.clone().add(new Vector3(0, 0, 0.75));
    const nearest = findNearestSample(sampled, point);

    expect(nearest.distance).toBeGreaterThan(0.7);
    expect(nearest.distance).toBeLessThan(0.8);
  });

  it('maps sample arc length to progress ratio', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    expect(progressRatioForSample(sampled, sampled.samples[0])).toBeCloseTo(0);
    expect(progressRatioForSample(sampled, sampled.samples[Math.floor(sampled.samples.length / 2)])).toBeGreaterThan(0.45);
    expect(progressRatioForSample(sampled, sampled.samples[Math.floor(sampled.samples.length / 2)])).toBeLessThan(0.55);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:run -- src/game/curves/nearest.test.ts
```

Expected: FAIL because `nearest.ts` does not exist.

- [ ] **Step 3: Implement nearest lookup**

`src/game/curves/nearest.ts`:

```ts
import { Vector3 } from 'three';
import type { CurveSample, SampledCurve } from './types';

export interface NearestSampleResult {
  sample: CurveSample;
  index: number;
  distance: number;
}

export function findNearestSample(sampled: SampledCurve, point: Vector3): NearestSampleResult {
  let best = sampled.samples[0];
  let bestDistanceSq = best.position.distanceToSquared(point);

  for (let index = 1; index < sampled.samples.length; index += 1) {
    const sample = sampled.samples[index];
    const distanceSq = sample.position.distanceToSquared(point);
    if (distanceSq < bestDistanceSq) {
      best = sample;
      bestDistanceSq = distanceSq;
    }
  }

  return {
    sample: best,
    index: best.index,
    distance: Math.sqrt(bestDistanceSq),
  };
}

export function progressRatioForSample(sampled: SampledCurve, sample: CurveSample): number {
  return sample.arcLength / sampled.totalLength;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:run -- src/game/curves/nearest.test.ts src/game/curves/sampler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/curves/nearest.ts src/game/curves/nearest.test.ts
git commit -m "feat: add centerline nearest lookup"
```

---

### Task 4: Add Steering Smoothing

**Files:**
- Create: `src/game/simulation/types.ts`
- Create: `src/game/simulation/smoothing.ts`
- Create: `src/game/simulation/smoothing.test.ts`

- [ ] **Step 1: Write failing tests**

`src/game/simulation/smoothing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { smoothSteering } from './smoothing';

describe('smoothSteering', () => {
  it('lags behind a sudden target change', () => {
    const result = smoothSteering({ x: 0, y: 0 }, { x: 1, y: 0 }, 1 / 60, 0.18);
    expect(result.x).toBeGreaterThan(0);
    expect(result.x).toBeLessThan(0.2);
    expect(result.y).toBe(0);
  });

  it('approaches the target after repeated updates', () => {
    let current = { x: 0, y: 0 };
    for (let i = 0; i < 80; i += 1) {
      current = smoothSteering(current, { x: 0.8, y: -0.4 }, 1 / 60, 0.18);
    }

    expect(current.x).toBeCloseTo(0.8, 2);
    expect(current.y).toBeCloseTo(-0.4, 2);
  });

  it('returns toward neutral when target is neutral', () => {
    const result = smoothSteering({ x: 0.7, y: -0.2 }, { x: 0, y: 0 }, 1 / 12, 0.18);
    expect(result.x).toBeLessThan(0.7);
    expect(result.y).toBeGreaterThan(-0.2);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:run -- src/game/simulation/smoothing.test.ts
```

Expected: FAIL because `smoothing.ts` does not exist.

- [ ] **Step 3: Implement simulation types and smoothing**

`src/game/simulation/types.ts`:

```ts
import { Vector3 } from 'three';
import type { CurveSample, SampledCurve } from '../curves/types';

export interface Vec2 {
  x: number;
  y: number;
}

export interface SteeringHistoryPoint {
  age: number;
  raw: Vec2;
  smoothed: Vec2;
  curvature: number;
  torsion: number;
}

export interface PlayerState {
  position: Vector3;
  tangent: Vector3;
  normal: Vector3;
  binormal: Vector3;
  rawSteering: Vec2;
  smoothedSteering: Vec2;
  currentCurvature: number;
  currentTorsion: number;
  previousCurvatureDirection: Vec2;
  health: number;
  warning: number;
  damageFlash: number;
  progress: number;
  nearestSample: CurveSample;
  distanceFromCenterline: number;
  steeringHistory: SteeringHistoryPoint[];
}

export interface SimulationConfig {
  steeringResponseSeconds: number;
  maxCurvature: number;
  maxHistorySeconds: number;
  recoveryPerSecond: number;
  damagePerSecond: number;
  warningDistanceRatio: number;
}

export interface SimulationState {
  sampled: SampledCurve;
  player: PlayerState;
  elapsed: number;
}
```

`src/game/simulation/smoothing.ts`:

```ts
import type { Vec2 } from './types';

export function smoothSteering(current: Vec2, target: Vec2, dt: number, responseSeconds: number): Vec2 {
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
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:run -- src/game/simulation/smoothing.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/simulation/types.ts src/game/simulation/smoothing.ts src/game/simulation/smoothing.test.ts
git commit -m "feat: add steering smoothing"
```

---

### Task 5: Add Player Integration And Collision

**Files:**
- Create: `src/game/simulation/player.ts`
- Create: `src/game/simulation/collision.ts`
- Create: `src/game/simulation/player.test.ts`

- [ ] **Step 1: Write failing tests**

`src/game/simulation/player.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { authoredLevels } from '../curves/levels';
import { sampleLevelCurve } from '../curves/sampler';
import { createSimulationState, updateSimulation } from './player';

const config = {
  steeringResponseSeconds: 0.18,
  maxCurvature: 0.75,
  maxHistorySeconds: 3,
  recoveryPerSecond: 0.12,
  damagePerSecond: 0.45,
  warningDistanceRatio: 0.72,
};

describe('player simulation', () => {
  it('moves the player at constant speed when steering is neutral', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);
    const start = state.player.position.clone();

    updateSimulation(state, { x: 0, y: 0 }, 1, config);

    const distance = state.player.position.distanceTo(start);
    expect(distance).toBeGreaterThan(sampled.level.speed * 0.95);
    expect(distance).toBeLessThan(sampled.level.speed * 1.05);
    expect(state.player.currentCurvature).toBeLessThan(0.01);
  });

  it('turns tangent when steering has curvature', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);
    const startTangent = state.player.tangent.clone();

    for (let i = 0; i < 30; i += 1) {
      updateSimulation(state, { x: 1, y: 0 }, 1 / 60, config);
    }

    expect(state.player.tangent.angleTo(startTangent)).toBeGreaterThan(0.02);
    expect(state.player.currentCurvature).toBeGreaterThan(0.1);
  });

  it('records recent steering history and expires old points', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);

    for (let i = 0; i < 300; i += 1) {
      updateSimulation(state, { x: 0.5, y: 0.2 }, 1 / 60, config);
    }

    expect(state.player.steeringHistory.length).toBeGreaterThan(10);
    expect(Math.max(...state.player.steeringHistory.map((point) => point.age))).toBeLessThanOrEqual(
      config.maxHistorySeconds,
    );
  });

  it('applies warning and damage when outside the tube', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);
    state.player.position.add(state.player.normal.clone().multiplyScalar(sampled.level.tubeRadius * 1.2));

    updateSimulation(state, { x: 0, y: 0 }, 1 / 10, config);

    expect(state.player.warning).toBeGreaterThan(0);
    expect(state.player.health).toBeLessThan(1);
    expect(state.player.damageFlash).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:run -- src/game/simulation/player.test.ts
```

Expected: FAIL because `player.ts` does not exist.

- [ ] **Step 3: Implement collision helpers**

`src/game/simulation/collision.ts`:

```ts
import type { SampledCurve } from '../curves/types';
import { findNearestSample, progressRatioForSample } from '../curves/nearest';
import type { PlayerState, SimulationConfig } from './types';

export function updateCollision(player: PlayerState, sampled: SampledCurve, dt: number, config: SimulationConfig): void {
  const nearest = findNearestSample(sampled, player.position);
  const warningDistance = sampled.level.tubeRadius * config.warningDistanceRatio;

  player.nearestSample = nearest.sample;
  player.distanceFromCenterline = nearest.distance;
  player.progress = progressRatioForSample(sampled, nearest.sample);
  player.warning = nearest.distance >= warningDistance ? Math.min(1, nearest.distance / sampled.level.tubeRadius) : 0;

  if (nearest.distance > sampled.level.tubeRadius) {
    const overage = nearest.distance / sampled.level.tubeRadius - 1;
    player.health = Math.max(0, player.health - config.damagePerSecond * (1 + overage) * dt);
    player.damageFlash = 1;
  } else {
    player.health = Math.min(1, player.health + config.recoveryPerSecond * dt);
    player.damageFlash = Math.max(0, player.damageFlash - dt * 2.5);
  }
}
```

- [ ] **Step 4: Implement player integration**

`src/game/simulation/player.ts`:

```ts
import { Vector3 } from 'three';
import type { SampledCurve } from '../curves/types';
import { clampSteering, smoothSteering } from './smoothing';
import { updateCollision } from './collision';
import type { SimulationConfig, SimulationState, Vec2 } from './types';

function signedSteeringTurn(previous: Vec2, current: Vec2, dt: number): number {
  const previousLength = Math.hypot(previous.x, previous.y);
  const currentLength = Math.hypot(current.x, current.y);

  if (previousLength < 1e-4 || currentLength < 1e-4) {
    return 0;
  }

  const dot = (previous.x * current.x + previous.y * current.y) / (previousLength * currentLength);
  const cross = previous.x * current.y - previous.y * current.x;
  const angle = Math.atan2(cross, Math.max(-1, Math.min(1, dot)));
  return angle / Math.max(dt, 1e-6);
}

function rebuildFrame(state: SimulationState): void {
  const screenUp = new Vector3(0, 0, 1);
  const fallback = new Vector3(0, 1, 0);
  const source = Math.abs(state.player.tangent.dot(screenUp)) > 0.96 ? fallback : screenUp;
  state.player.normal.copy(source.sub(state.player.tangent.clone().multiplyScalar(source.dot(state.player.tangent))).normalize());
  state.player.binormal.copy(state.player.tangent.clone().cross(state.player.normal).normalize());
}

export function createSimulationState(sampled: SampledCurve): SimulationState {
  const first = sampled.samples[0];
  return {
    sampled,
    elapsed: 0,
    player: {
      position: first.position.clone(),
      tangent: first.tangent.clone(),
      normal: first.normal.clone(),
      binormal: first.binormal.clone(),
      rawSteering: { x: 0, y: 0 },
      smoothedSteering: { x: 0, y: 0 },
      currentCurvature: 0,
      currentTorsion: 0,
      previousCurvatureDirection: { x: 0, y: 0 },
      health: 1,
      warning: 0,
      damageFlash: 0,
      progress: 0,
      nearestSample: first,
      distanceFromCenterline: 0,
      steeringHistory: [],
    },
  };
}

export function updateSimulation(
  state: SimulationState,
  rawSteering: Vec2,
  dt: number,
  config: SimulationConfig,
): void {
  const clamped = clampSteering(rawSteering);
  const previousSmoothed = state.player.smoothedSteering;
  const smoothed = smoothSteering(
    previousSmoothed,
    clamped,
    dt,
    config.steeringResponseSeconds,
  );

  state.player.rawSteering = clamped;
  state.player.smoothedSteering = smoothed;
  state.player.currentCurvature = Math.hypot(smoothed.x, smoothed.y) * config.maxCurvature;
  state.player.currentTorsion = signedSteeringTurn(
    state.player.previousCurvatureDirection,
    smoothed,
    dt,
  );
  state.player.previousCurvatureDirection = smoothed;

  const curvatureDirection = state.player.binormal
    .clone()
    .multiplyScalar(smoothed.x)
    .add(state.player.normal.clone().multiplyScalar(smoothed.y));

  if (curvatureDirection.lengthSq() > 1e-8) {
    curvatureDirection.normalize().multiplyScalar(state.player.currentCurvature * state.sampled.level.speed * dt);
    state.player.tangent.add(curvatureDirection).normalize();
    rebuildFrame(state);
  }

  state.player.position.add(state.player.tangent.clone().multiplyScalar(state.sampled.level.speed * dt));
  state.elapsed += dt;

  updateCollision(state.player, state.sampled, dt, config);

  state.player.steeringHistory.unshift({
    age: 0,
    raw: clamped,
    smoothed,
    curvature: state.player.currentCurvature,
    torsion: state.player.currentTorsion,
  });

  for (const point of state.player.steeringHistory) {
    point.age += dt;
  }

  state.player.steeringHistory = state.player.steeringHistory.filter(
    (point) => point.age <= config.maxHistorySeconds,
  );
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test:run -- src/game/simulation/player.test.ts src/game/simulation/smoothing.test.ts src/game/curves/nearest.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/simulation/player.ts src/game/simulation/collision.ts src/game/simulation/player.test.ts
git commit -m "feat: add player path simulation"
```

---

### Task 6: Add Pointer Trackpad Mapping

**Files:**
- Create: `src/game/input/pointerTrackpad.ts`
- Create: `src/game/input/pointerTrackpad.test.ts`

- [ ] **Step 1: Write failing tests**

`src/game/input/pointerTrackpad.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getRadarRect, normalizePointerToTrackpad } from './pointerTrackpad';

describe('pointer trackpad mapping', () => {
  it('places the radar in the bottom-right corner', () => {
    const rect = getRadarRect(1200, 800);
    expect(rect.x).toBeGreaterThan(800);
    expect(rect.y).toBeGreaterThan(500);
    expect(rect.width).toBe(rect.height);
  });

  it('maps the center to neutral steering', () => {
    const rect = getRadarRect(1000, 700);
    const steering = normalizePointerToTrackpad(rect.x + rect.width / 2, rect.y + rect.height / 2, rect);
    expect(steering.x).toBeCloseTo(0);
    expect(steering.y).toBeCloseTo(0);
  });

  it('maps right and up to positive x and positive y steering', () => {
    const rect = getRadarRect(1000, 700);
    const steering = normalizePointerToTrackpad(rect.x + rect.width, rect.y, rect);
    expect(steering.x).toBeGreaterThan(0.6);
    expect(steering.y).toBeGreaterThan(0.6);
    expect(Math.hypot(steering.x, steering.y)).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:run -- src/game/input/pointerTrackpad.test.ts
```

Expected: FAIL because `pointerTrackpad.ts` does not exist.

- [ ] **Step 3: Implement pointer mapping and controller**

`src/game/input/pointerTrackpad.ts`:

```ts
import type { Vec2 } from '../simulation/types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getRadarRect(width: number, height: number): Rect {
  const size = Math.max(168, Math.min(300, Math.min(width, height) * 0.27));
  const margin = Math.max(18, Math.min(width, height) * 0.035);
  return {
    x: width - size - margin,
    y: height - size - margin,
    width: size,
    height: size,
  };
}

export function normalizePointerToTrackpad(clientX: number, clientY: number, rect: Rect): Vec2 {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const radius = rect.width / 2;
  const raw = {
    x: (clientX - centerX) / radius,
    y: (centerY - clientY) / radius,
  };
  const length = Math.hypot(raw.x, raw.y);

  if (length <= 1) {
    return raw;
  }

  return {
    x: raw.x / length,
    y: raw.y / length,
  };
}

export class PointerTrackpad {
  private steering: Vec2 = { x: 0, y: 0 };
  private activePointerId: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerUp);
  }

  getSteering(): Vec2 {
    return this.steering;
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerUp);
  }

  private canvasRect(): DOMRect {
    return this.canvas.getBoundingClientRect();
  }

  private radarRect(): Rect {
    const rect = this.canvasRect();
    return getRadarRect(rect.width, rect.height);
  }

  private updateFromEvent(event: PointerEvent): void {
    const canvasRect = this.canvasRect();
    this.steering = normalizePointerToTrackpad(
      event.clientX - canvasRect.left,
      event.clientY - canvasRect.top,
      this.radarRect(),
    );
  }

  private onPointerDown = (event: PointerEvent): void => {
    const canvasRect = this.canvasRect();
    const radar = this.radarRect();
    const localX = event.clientX - canvasRect.left;
    const localY = event.clientY - canvasRect.top;
    const inside =
      localX >= radar.x &&
      localX <= radar.x + radar.width &&
      localY >= radar.y &&
      localY <= radar.y + radar.height;

    if (!inside) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.updateFromEvent(event);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.updateFromEvent(event);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.activePointerId = null;
    this.steering = { x: 0, y: 0 };
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:run -- src/game/input/pointerTrackpad.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/input/pointerTrackpad.ts src/game/input/pointerTrackpad.test.ts
git commit -m "feat: add pointer trackpad input"
```

---

### Task 7: Add Game State And Text-State Hooks

**Files:**
- Create: `src/game/state/gameState.ts`
- Create: `src/game/testing/textState.ts`
- Create: `src/game/state/gameState.test.ts`

- [ ] **Step 1: Write failing tests**

`src/game/state/gameState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { authoredLevels } from '../curves/levels';
import { sampleLevelCurve } from '../curves/sampler';
import { createSimulationState } from '../simulation/player';
import { buildTextState } from '../testing/textState';
import { createGameState, nextLevel, restartLevel, setMode, updateProgressMode } from './gameState';

describe('game state', () => {
  it('starts on the first authored level', () => {
    const state = createGameState(authoredLevels);
    expect(state.mode).toBe('start');
    expect(state.levelIndex).toBe(0);
    expect(state.level.id).toBe('planar-wave');
  });

  it('restarts the current level without changing level index', () => {
    const state = createGameState(authoredLevels);
    state.levelIndex = 2;
    restartLevel(state);
    expect(state.levelIndex).toBe(2);
    expect(state.mode).toBe('playing');
  });

  it('advances to the next level and wraps at the end', () => {
    const state = createGameState(authoredLevels);
    nextLevel(state);
    expect(state.level.id).toBe('lifted-wave');

    state.levelIndex = authoredLevels.length - 1;
    nextLevel(state);
    expect(state.level.id).toBe('planar-wave');
  });

  it('marks level complete near the end of the loop', () => {
    const state = createGameState(authoredLevels);
    setMode(state, 'playing');
    updateProgressMode(state, 0.995, 0.8);
    expect(state.mode).toBe('complete');
  });

  it('marks failed when health reaches zero', () => {
    const state = createGameState(authoredLevels);
    setMode(state, 'playing');
    updateProgressMode(state, 0.2, 0);
    expect(state.mode).toBe('failed');
  });

  it('builds concise render_game_to_text payload', () => {
    const game = createGameState(authoredLevels);
    const sampled = sampleLevelCurve(game.level);
    const simulation = createSimulationState(sampled);
    const payload = JSON.parse(buildTextState(game, simulation));

    expect(payload.mode).toBe('start');
    expect(payload.level.id).toBe('planar-wave');
    expect(payload.player.health).toBe(1);
    expect(payload.hud.curvatureMeterColor).toBe('blue');
    expect(payload.hud.torsionMeterColor).toBe('green');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:run -- src/game/state/gameState.test.ts
```

Expected: FAIL because `gameState.ts` does not exist.

- [ ] **Step 3: Implement game state**

`src/game/state/gameState.ts`:

```ts
import type { LevelDefinition } from '../curves/types';

export type GameMode = 'start' | 'playing' | 'paused' | 'complete' | 'failed';

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

  return {
    mode: 'start',
    levels,
    levelIndex: 0,
    level: levels[0],
  };
}

export function setMode(state: GameState, mode: GameMode): void {
  state.mode = mode;
}

export function restartLevel(state: GameState): void {
  state.level = state.levels[state.levelIndex];
  state.mode = 'playing';
}

export function nextLevel(state: GameState): void {
  state.levelIndex = (state.levelIndex + 1) % state.levels.length;
  state.level = state.levels[state.levelIndex];
  state.mode = 'playing';
}

export function updateProgressMode(state: GameState, progress: number, health: number): void {
  if (state.mode !== 'playing') {
    return;
  }

  if (health <= 0) {
    state.mode = 'failed';
    return;
  }

  if (progress >= 0.99) {
    state.mode = 'complete';
  }
}
```

- [ ] **Step 4: Implement text-state payload**

`src/game/testing/textState.ts`:

```ts
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
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test:run -- src/game/state/gameState.test.ts src/game/simulation/player.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/state/gameState.ts src/game/testing/textState.ts src/game/state/gameState.test.ts
git commit -m "feat: add game state text hooks"
```

---

### Task 8: Wire App Loop And Deterministic Hooks

**Files:**
- Create: `src/game/app.ts`
- Modify: `src/main.ts`
- Create: `src/game/app.test.ts`

- [ ] **Step 1: Write failing tests**

`src/game/app.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FreneticApp } from './app';

class NullRenderer {
  resize(): void {}
  render(): void {}
  dispose(): void {}
}

describe('FreneticApp', () => {
  it('advances simulation through deterministic time steps', () => {
    const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
    const app = new FreneticApp(canvas, new NullRenderer());
    const before = JSON.parse(app.renderGameToText());

    app.startPlaying();
    app.advanceTime(1000);
    const after = JSON.parse(app.renderGameToText());

    expect(after.mode).toBe('playing');
    expect(after.player.progress).toBeGreaterThanOrEqual(before.player.progress);
    expect(after.player.health).toBeGreaterThan(0);
  });

  it('resets simulation when advancing level', () => {
    const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
    const app = new FreneticApp(canvas, new NullRenderer());
    app.nextLevel();
    const payload = JSON.parse(app.renderGameToText());
    expect(payload.level.id).toBe('lifted-wave');
    expect(payload.mode).toBe('playing');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:run -- src/game/app.test.ts
```

Expected: FAIL because `app.ts` does not exist.

- [ ] **Step 3: Implement `FreneticApp`**

`src/game/app.ts`:

```ts
import { authoredLevels } from './curves/levels';
import { sampleLevelCurve } from './curves/sampler';
import { PointerTrackpad } from './input/pointerTrackpad';
import { createSimulationState, updateSimulation } from './simulation/player';
import type { SimulationConfig, SimulationState } from './simulation/types';
import { createGameState, nextLevel, restartLevel, setMode, updateProgressMode } from './state/gameState';
import type { GameState } from './state/gameState';
import { buildTextState } from './testing/textState';

export interface RendererLike {
  resize(width: number, height: number): void;
  render(game: GameState, simulation: SimulationState): void;
  dispose(): void;
}

const FIXED_STEP = 1 / 60;

const DEFAULT_CONFIG: SimulationConfig = {
  steeringResponseSeconds: 0.18,
  maxCurvature: 0.75,
  maxHistorySeconds: 3,
  recoveryPerSecond: 0.12,
  damagePerSecond: 0.45,
  warningDistanceRatio: 0.72,
};

export class FreneticApp {
  private readonly game = createGameState(authoredLevels);
  private sampled = sampleLevelCurve(this.game.level);
  private simulation = createSimulationState(this.sampled);
  private accumulator = 0;
  private running = false;
  private lastTime = 0;
  private trackpad: PointerTrackpad | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: RendererLike,
    private readonly config: SimulationConfig = DEFAULT_CONFIG,
  ) {
    if (typeof window !== 'undefined' && 'addEventListener' in canvas) {
      this.trackpad = new PointerTrackpad(canvas);
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('resize', this.onResize);
    }
    this.onResize();
  }

  start(): void {
    this.running = true;
    this.lastTime = typeof performance === 'undefined' ? 0 : performance.now();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(this.frame);
    }
  }

  startPlaying(): void {
    setMode(this.game, 'playing');
  }

  restartLevel(): void {
    restartLevel(this.game);
    this.resetSimulation();
  }

  nextLevel(): void {
    nextLevel(this.game);
    this.resetSimulation();
  }

  advanceTime(ms: number): void {
    const steps = Math.max(1, Math.round(ms / (FIXED_STEP * 1000)));
    for (let i = 0; i < steps; i += 1) {
      this.step(FIXED_STEP);
    }
    this.renderer.render(this.game, this.simulation);
  }

  renderGameToText(): string {
    return buildTextState(this.game, this.simulation);
  }

  dispose(): void {
    this.running = false;
    this.trackpad?.destroy();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('resize', this.onResize);
    }
    this.renderer.dispose();
  }

  private resetSimulation(): void {
    this.sampled = sampleLevelCurve(this.game.level);
    this.simulation = createSimulationState(this.sampled);
  }

  private step(dt: number): void {
    if (this.game.mode === 'playing') {
      updateSimulation(this.simulation, this.trackpad?.getSteering() ?? { x: 0, y: 0 }, dt, this.config);
      updateProgressMode(this.game, this.simulation.player.progress, this.simulation.player.health);
    }
  }

  private frame = (time: number): void => {
    if (!this.running) {
      return;
    }

    const dt = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.accumulator += dt;

    while (this.accumulator >= FIXED_STEP) {
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }

    this.renderer.render(this.game, this.simulation);
    requestAnimationFrame(this.frame);
  };

  private onResize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth || (typeof window === 'undefined' ? 800 : window.innerWidth));
    const height = Math.max(1, this.canvas.clientHeight || (typeof window === 'undefined' ? 600 : window.innerHeight));
    this.renderer.resize(width, height);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && this.game.mode === 'start') {
      this.startPlaying();
    } else if (event.key.toLowerCase() === 'r') {
      this.restartLevel();
    } else if (event.key.toLowerCase() === 'n') {
      this.nextLevel();
    } else if (event.key.toLowerCase() === 'p') {
      setMode(this.game, this.game.mode === 'paused' ? 'playing' : 'paused');
    } else if (event.key.toLowerCase() === 'f') {
      void this.canvas.requestFullscreen?.();
    }
  };
}
```

- [ ] **Step 4: Temporarily adapt `main.ts` to instantiate after renderer task**

Do not wire Three.js yet. Keep the existing `main.ts` until Task 9 creates `GameRenderer`. This task only proves app logic with a null renderer.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test:run -- src/game/app.test.ts src/game/state/gameState.test.ts src/game/simulation/player.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/app.ts src/game/app.test.ts
git commit -m "feat: add deterministic app loop"
```

---

### Task 9: Add Three.js Renderer And Tunnel Rings

**Files:**
- Create: `src/game/rendering/colors.ts`
- Create: `src/game/rendering/tunnel.ts`
- Create: `src/game/rendering/gameRenderer.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add renderer colors**

`src/game/rendering/colors.ts`:

```ts
export const hudColors = {
  cyan: '#36f3ff',
  cyanDim: '#1c7f8f',
  blue: '#3492ff',
  green: '#70ff9d',
  red: '#ff4d61',
  amber: '#ffd166',
  background: '#02040a',
};
```

- [ ] **Step 2: Implement tunnel ring renderer**

`src/game/rendering/tunnel.ts`:

```ts
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Vector3,
} from 'three';
import type { SimulationState } from '../simulation/types';

const RING_SEGMENTS = 64;
const RING_COUNT = 46;

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function makeRingGeometry(center: Vector3, normal: Vector3, binormal: Vector3, radius: number): BufferGeometry {
  const vertices: number[] = [];
  for (let i = 0; i < RING_SEGMENTS; i += 1) {
    const angle = (i / RING_SEGMENTS) * Math.PI * 2;
    const point = center
      .clone()
      .add(normal.clone().multiplyScalar(Math.cos(angle) * radius))
      .add(binormal.clone().multiplyScalar(Math.sin(angle) * radius));
    vertices.push(point.x, point.y, point.z);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  return geometry;
}

export class TunnelRings {
  readonly group = new Group();
  private readonly rings: LineLoop[] = [];

  constructor() {
    for (let i = 0; i < RING_COUNT; i += 1) {
      const material = new LineBasicMaterial({
        color: new Color('#36f3ff'),
        transparent: true,
        opacity: 1 - i / RING_COUNT,
      });
      const ring = new LineLoop(new BufferGeometry(), material);
      this.rings.push(ring);
      this.group.add(ring);
    }
  }

  update(simulation: SimulationState): void {
    const { sampled, player } = simulation;
    const startIndex = player.nearestSample.index;
    const stride = Math.max(1, Math.floor(sampled.samples.length / 180));

    for (let i = 0; i < this.rings.length; i += 1) {
      const sample = sampled.samples[wrap(startIndex + i * stride, sampled.samples.length)];
      const ring = this.rings[i];
      ring.geometry.dispose();
      ring.geometry = makeRingGeometry(sample.position, sample.normal, sample.binormal, sampled.level.tubeRadius);
      const material = ring.material as LineBasicMaterial;
      material.color.set(sampled.level.visual.ringColor);
      material.opacity = Math.max(0.08, 1 - i / this.rings.length);
    }
  }

  dispose(): void {
    for (const ring of this.rings) {
      ring.geometry.dispose();
      (ring.material as LineBasicMaterial).dispose();
    }
  }
}
```

- [ ] **Step 3: Implement Three.js game renderer**

`src/game/rendering/gameRenderer.ts`:

```ts
import {
  AmbientLight,
  Color,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { RendererLike } from '../app';
import type { GameState } from '../state/gameState';
import type { SimulationState } from '../simulation/types';
import { hudColors } from './colors';
import { TunnelRings } from './tunnel';

export class GameRenderer implements RendererLike {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(72, 1, 0.05, 240);
  private readonly tunnel = new TunnelRings();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setClearColor(new Color(hudColors.background), 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.add(new AmbientLight(0xffffff, 1));
    this.scene.add(this.tunnel.group);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(_game: GameState, simulation: SimulationState): void {
    const { player } = simulation;
    this.tunnel.update(simulation);

    const eye = player.position.clone();
    const look = player.position.clone().add(player.tangent.clone().multiplyScalar(4));
    this.camera.position.copy(eye);
    this.camera.up.copy(new Vector3(0, 0, 1));
    this.camera.lookAt(look);

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.tunnel.dispose();
    this.renderer.dispose();
  }
}
```

- [ ] **Step 4: Wire renderer in `main.ts`**

`src/main.ts`:

```ts
import './style.css';
import { FreneticApp } from './game/app';
import { GameRenderer } from './game/rendering/gameRenderer';

declare global {
  interface Window {
    advanceTime?: (ms: number) => void;
    render_game_to_text?: () => string;
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!canvas) {
  throw new Error('FRENETic requires a #game-canvas element.');
}

const app = new FreneticApp(canvas, new GameRenderer(canvas));

window.advanceTime = (ms: number) => app.advanceTime(ms);
window.render_game_to_text = () => app.renderGameToText();

app.start();
```

- [ ] **Step 5: Verify build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: PASS and `dist/` is emitted.

- [ ] **Step 6: Commit**

```bash
git add src/game/rendering/colors.ts src/game/rendering/tunnel.ts src/game/rendering/gameRenderer.ts src/main.ts
git commit -m "feat: render tunnel rings"
```

---

### Task 10: Add HUD Overlay For Minimap, Radar, And Meters

**Files:**
- Create: `src/game/rendering/hud.ts`
- Modify: `src/game/rendering/gameRenderer.ts`

- [ ] **Step 1: Implement HUD overlay**

`src/game/rendering/hud.ts`:

```ts
import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
} from 'three';
import { getRadarRect } from '../input/pointerTrackpad';
import type { GameState } from '../state/gameState';
import type { SimulationState } from '../simulation/types';
import { hudColors } from './colors';

export class HudOverlay {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly canvas = document.createElement('canvas');
  private readonly context = this.canvas.getContext('2d')!;
  private readonly texture = new CanvasTexture(this.canvas);
  private readonly mesh = new Mesh(
    new PlaneGeometry(2, 2),
    new MeshBasicMaterial({ map: this.texture, transparent: true }),
  );

  constructor() {
    this.scene.add(this.mesh);
  }

  resize(width: number, height: number): void {
    this.canvas.width = Math.max(1, Math.floor(width));
    this.canvas.height = Math.max(1, Math.floor(height));
  }

  draw(game: GameState, simulation: SimulationState): void {
    const ctx = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);
    this.drawMeters(ctx, width, simulation);
    this.drawMinimap(ctx, width, height, simulation);
    this.drawRadar(ctx, width, height, simulation);
    this.drawStatus(ctx, width, height, game, simulation);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }

  private panel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(54, 243, 255, 0.72)';
    ctx.fillStyle = 'rgba(2, 8, 18, 0.38)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(54, 243, 255, 0.55)';
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }

  private drawMeters(ctx: CanvasRenderingContext2D, width: number, simulation: SimulationState): void {
    this.drawMeter(ctx, 32, 24, width * 0.32, 'CURVATURE', hudColors.blue, simulation.player.currentCurvature, simulation.sampled.level.acceptableCurvature);
    this.drawMeter(ctx, width - width * 0.32 - 32, 24, width * 0.32, 'TORSION', hudColors.green, simulation.player.currentTorsion, simulation.sampled.level.acceptableTorsion);
  }

  private drawMeter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    label: string,
    color: string,
    value: number,
    range: [number, number],
  ): void {
    const height = 32;
    this.panel(ctx, x, y, width, height);
    ctx.fillStyle = '#d9fbff';
    ctx.font = '11px sans-serif';
    ctx.fillText(label, x + 10, y + 20);

    const trackX = x + 92;
    const trackWidth = width - 112;
    const trackY = y + 12;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(trackX, trackY);
    ctx.lineTo(trackX + trackWidth, trackY);
    ctx.stroke();

    ctx.strokeStyle = hudColors.green;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(trackX + trackWidth * 0.28, trackY);
    ctx.lineTo(trackX + trackWidth * 0.72, trackY);
    ctx.stroke();

    const maxMagnitude = Math.max(Math.abs(range[0]), Math.abs(range[1]), 0.1);
    const normalized = Math.max(-1, Math.min(1, value / maxMagnitude));
    const indicatorX = trackX + ((normalized + 1) / 2) * trackWidth;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(indicatorX, trackY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, _width: number, height: number, simulation: SimulationState): void {
    const size = Math.max(168, Math.min(300, Math.min(this.canvas.width, height) * 0.27));
    const margin = Math.max(18, Math.min(this.canvas.width, height) * 0.035);
    const x = margin;
    const y = height - size - margin;
    this.panel(ctx, x, y, size, size);

    const samples = simulation.sampled.samples;
    const bounds = samples.reduce(
      (box, sample) => ({
        minX: Math.min(box.minX, sample.position.x),
        maxX: Math.max(box.maxX, sample.position.x),
        minY: Math.min(box.minY, sample.position.y),
        maxY: Math.max(box.maxY, sample.position.y),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    );
    const scale = (size * 0.78) / Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

    ctx.strokeStyle = 'rgba(54, 243, 255, 0.85)';
    ctx.beginPath();
    samples.forEach((sample, index) => {
      const px = x + size / 2 + (sample.position.x - (bounds.minX + bounds.maxX) / 2) * scale;
      const py = y + size / 2 - (sample.position.y - (bounds.minY + bounds.maxY) / 2) * scale;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();

    const target = simulation.player.nearestSample.position;
    const dotX = x + size / 2 + (target.x - (bounds.minX + bounds.maxX) / 2) * scale;
    const dotY = y + size / 2 - (target.y - (bounds.minY + bounds.maxY) / 2) * scale;
    ctx.fillStyle = hudColors.green;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRadar(ctx: CanvasRenderingContext2D, width: number, height: number, simulation: SimulationState): void {
    const rect = getRadarRect(width, height);
    this.panel(ctx, rect.x, rect.y, rect.width, rect.height);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const radius = rect.width / 2;

    ctx.strokeStyle = 'rgba(54, 243, 255, 0.32)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    for (const point of simulation.player.steeringHistory) {
      const alpha = Math.max(0, 1 - point.age / 3);
      ctx.fillStyle = `rgba(54, 243, 255, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(centerX + point.smoothed.x * radius * 0.72, centerY - point.smoothed.y * radius * 0.72, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const steering = simulation.player.smoothedSteering;
    const endX = centerX + steering.x * radius * 0.72;
    const endY = centerY - steering.y * radius * 0.72;
    this.arrow(ctx, endX, endY, steering.x * 42, -steering.y * 42, hudColors.blue);
    this.arrow(ctx, endX, endY, -steering.y * 28, -steering.x * 28, hudColors.red);

    const torsionAlpha = Math.max(0.18, Math.min(1, Math.abs(simulation.player.currentTorsion) / 2));
    ctx.strokeStyle = `rgba(112, 255, 157, ${torsionAlpha})`;
    ctx.beginPath();
    ctx.arc(endX, endY, 18, simulation.player.currentTorsion >= 0 ? 0.2 : 2.8, simulation.player.currentTorsion >= 0 ? 5.2 : -2.2, simulation.player.currentTorsion < 0);
    ctx.stroke();
  }

  private drawStatus(ctx: CanvasRenderingContext2D, width: number, height: number, game: GameState, simulation: SimulationState): void {
    ctx.fillStyle = '#d9fbff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${game.levelIndex + 1}/${game.levels.length} ${game.level.name}`, 32, height - 22);
    ctx.fillText(`Integrity ${Math.round(simulation.player.health * 100)}%`, width / 2 - 48, 28);

    if (game.mode !== 'playing') {
      ctx.fillStyle = 'rgba(2, 8, 18, 0.62)';
      ctx.fillRect(width / 2 - 180, height / 2 - 48, 360, 96);
      ctx.strokeStyle = 'rgba(54, 243, 255, 0.8)';
      ctx.strokeRect(width / 2 - 180, height / 2 - 48, 360, 96);
      ctx.fillStyle = '#d9fbff';
      ctx.font = '18px sans-serif';
      const message = game.mode === 'start' ? 'Press Enter to start' : game.mode === 'complete' ? 'Level complete: press N' : game.mode === 'failed' ? 'Integrity lost: press R' : 'Paused';
      ctx.fillText(message, width / 2 - 112, height / 2 + 6);
    }
  }

  private arrow(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

- [ ] **Step 2: Update renderer to draw HUD in same WebGL canvas**

Modify `src/game/rendering/gameRenderer.ts`:

```ts
import {
  AmbientLight,
  Color,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { RendererLike } from '../app';
import type { GameState } from '../state/gameState';
import type { SimulationState } from '../simulation/types';
import { hudColors } from './colors';
import { HudOverlay } from './hud';
import { TunnelRings } from './tunnel';

export class GameRenderer implements RendererLike {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(72, 1, 0.05, 240);
  private readonly tunnel = new TunnelRings();
  private readonly hud = new HudOverlay();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(new Color(hudColors.background), 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.add(new AmbientLight(0xffffff, 1));
    this.scene.add(this.tunnel.group);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.hud.resize(width, height);
  }

  render(game: GameState, simulation: SimulationState): void {
    const { player } = simulation;
    this.tunnel.update(simulation);

    const eye = player.position.clone();
    const look = player.position.clone().add(player.tangent.clone().multiplyScalar(4));
    this.camera.position.copy(eye);
    this.camera.up.copy(new Vector3(0, 0, 1));
    this.camera.lookAt(look);

    this.hud.draw(game, simulation);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.hud.scene, this.hud.camera);
  }

  dispose(): void {
    this.hud.dispose();
    this.tunnel.dispose();
    this.renderer.dispose();
  }
}
```

- [ ] **Step 3: Verify build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/rendering/hud.ts src/game/rendering/gameRenderer.ts
git commit -m "feat: add spaceship hud overlay"
```

---

### Task 11: Add Starfield, Level Controls, And Fullscreen Polish

**Files:**
- Create: `src/game/rendering/starfield.ts`
- Modify: `src/game/rendering/gameRenderer.ts`
- Modify: `src/game/app.ts`

- [ ] **Step 1: Implement starfield**

`src/game/rendering/starfield.ts`:

```ts
import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
} from 'three';

export class Starfield {
  readonly points: Points;

  constructor(count = 900, radius = 120) {
    const vertices: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.45 + Math.random() * 0.55);
      vertices.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      );
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    const material = new PointsMaterial({
      color: '#d9fbff',
      size: 0.09,
      transparent: true,
      opacity: 0.72,
    });
    this.points = new Points(geometry, material);
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as PointsMaterial).dispose();
  }
}
```

- [ ] **Step 2: Add starfield to renderer**

Update `src/game/rendering/gameRenderer.ts` by importing and owning `Starfield`:

```ts
import { Starfield } from './starfield';

// Inside class fields:
private readonly starfield = new Starfield();

// Inside constructor after scene creation:
this.scene.add(this.starfield.points);

// Inside render before rendering the scene:
this.starfield.points.position.copy(player.position);

// Inside dispose:
this.starfield.dispose();
```

- [ ] **Step 3: Refine keyboard handling**

Modify `src/game/app.ts` key handling so `Escape` exits fullscreen or pause, `Enter` starts, `R` restarts, `N` advances, `P` pauses, and `F` toggles fullscreen:

```ts
private onKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter' && this.game.mode === 'start') {
    this.startPlaying();
  } else if (event.key === 'Escape') {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (this.game.mode === 'paused') {
      setMode(this.game, 'playing');
    }
  } else if (event.key.toLowerCase() === 'r') {
    this.restartLevel();
  } else if (event.key.toLowerCase() === 'n') {
    this.nextLevel();
  } else if (event.key.toLowerCase() === 'p') {
    setMode(this.game, this.game.mode === 'paused' ? 'playing' : 'paused');
  } else if (event.key.toLowerCase() === 'f') {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void this.canvas.requestFullscreen?.();
    }
  }
};
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/rendering/starfield.ts src/game/rendering/gameRenderer.ts src/game/app.ts
git commit -m "feat: add space scene polish"
```

---

### Task 12: Add Browser Verification Actions And Run Web-Game Checks

**Files:**
- Create: `test-actions/steer-right.json`
- Create: `test-actions/level-cycle.json`
- Modify: `progress.md`

- [ ] **Step 1: Create steering action payload**

`test-actions/steer-right.json`:

```json
{
  "steps": [
    { "buttons": [], "frames": 2 },
    { "buttons": ["enter"], "frames": 3 },
    { "buttons": ["left_mouse_button"], "mouse_x": 1120, "mouse_y": 660, "frames": 20 },
    { "buttons": ["left_mouse_button"], "mouse_x": 1180, "mouse_y": 620, "frames": 30 },
    { "buttons": [], "frames": 20 }
  ]
}
```

- [ ] **Step 2: Create level cycling payload**

`test-actions/level-cycle.json`:

```json
{
  "steps": [
    { "buttons": ["enter"], "frames": 4 },
    { "buttons": ["n"], "frames": 4 },
    { "buttons": ["n"], "frames": 4 },
    { "buttons": ["n"], "frames": 4 },
    { "buttons": ["n"], "frames": 4 },
    { "buttons": [], "frames": 8 }
  ]
}
```

- [ ] **Step 3: Run all automated checks**

Run:

```bash
npm run test:run
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 4: Start dev server**

Run:

```bash
npm run dev
```

Expected: Vite serves the app at `http://127.0.0.1:5173/`.

- [ ] **Step 5: Run web-game Playwright steering check**

In a second terminal, run:

```bash
node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" \
  --url http://127.0.0.1:5173/ \
  --actions-file /Users/davidbachman/Documents/FRENETic/test-actions/steer-right.json \
  --iterations 1 \
  --pause-ms 250 \
  --screenshot-dir /Users/davidbachman/Documents/FRENETic/output/web-game/steer-right
```

Expected:
- No console errors.
- Screenshot shows nonblank tunnel rings, bottom-left minimap, bottom-right radar, blue top-left curvature meter, green top-right torsion meter.
- `render_game_to_text()` reports `mode: "playing"`, nonzero steering trace count, and smoothed steering changed from neutral.

- [ ] **Step 6: Run web-game level cycling check**

Run:

```bash
node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" \
  --url http://127.0.0.1:5173/ \
  --actions-file /Users/davidbachman/Documents/FRENETic/test-actions/level-cycle.json \
  --iterations 1 \
  --pause-ms 250 \
  --screenshot-dir /Users/davidbachman/Documents/FRENETic/output/web-game/level-cycle
```

Expected:
- No console errors.
- Screenshots show the app still rendering after level cycling.
- `render_game_to_text()` reaches a valid authored level and reports HUD panels visible.

- [ ] **Step 7: Inspect screenshots**

Open the latest screenshots in:

```text
/Users/davidbachman/Documents/FRENETic/output/web-game/steer-right
/Users/davidbachman/Documents/FRENETic/output/web-game/level-cycle
```

Confirm visually:
- Main tunnel is visible and centered.
- Minimap curve is readable.
- Radar trace appears in the bottom-right panel.
- Curvature meter is blue.
- Torsion meter is green.
- Text fits inside panels at desktop size.

- [ ] **Step 8: Update progress notes**

Append to `progress.md`:

```markdown

Verification:
- npm run test:run passed.
- npm run typecheck passed.
- npm run build passed.
- Web-game steering check rendered tunnel, minimap, radar, blue curvature meter, and green torsion meter.
- Web-game level cycling check loaded authored levels without console errors.
```

- [ ] **Step 9: Commit**

```bash
git add test-actions/steer-right.json test-actions/level-cycle.json progress.md
git commit -m "test: add web game verification actions"
```

---

## Final Verification

Before declaring the implementation complete, run:

```bash
npm run test:run
npm run typecheck
npm run build
```

Then run both web-game Playwright checks from Task 12 and inspect the screenshots. The app is complete for this plan only when all checks pass, the screenshots show all required HUD regions, and `window.render_game_to_text()` reports the same state visible on screen.
