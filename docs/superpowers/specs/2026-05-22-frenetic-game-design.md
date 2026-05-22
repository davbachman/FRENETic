# FRENETic Game Design

## Purpose

FRENETic is a browser game that teaches curvature and torsion of 3D curves through embodied play. The player flies through a glowing tunnel whose centerline is an authored closed parametric curve. The game should feel like a dark spaceship HUD arcade experience first, with mathematical meaning embedded in the controls, meters, minimap, and radar rather than delivered through forced lessons or formulas.

## Project Context

The repository is currently empty except for git metadata. The first build can choose its stack cleanly. The selected approach is a Vite + TypeScript + Three.js app with one full-window WebGL canvas, authored levels, deterministic simulation hooks, and modular game systems.

## Core Experience

The screen uses a corner-instrument layout:

- The main center area is a first-person view inside a tunnel following a 3D closed curve.
- The bottom-left corner is a minimap showing the level curve projected to the screen plane, with a dot marking current progress on the tunnel centerline.
- The bottom-right corner is a visible radar/trackpad zone. Pointer position inside this zone is the steering input, with the center as neutral.
- The top-left meter is a blue curvature scale.
- The top-right meter is a green torsion scale.

The player moves forward at constant speed. Steering does not merely rotate the camera; it integrates the player's own 3D path. Pointer displacement inside the radar zone defines a desired curvature vector. Input smoothing and momentum create lag before steering affects the path. The player's path can drift away from the tunnel centerline. If the player gets too close to or beyond the tube wall, the game applies warning, damage, and recovery feedback rather than ending the run instantly.

The main flow is arcade-first. Normal gameplay avoids formulas and forced tutorial panels. Optional help, pause text, or debug overlays may expose more explicit math, but the core teaching happens through steering, tunnel geometry, HUD feedback, and level progression.

## Level Arc

The first build includes a fixed authored set of representative levels:

1. Planar wavy closed curve. This introduces curvature while staying in the minimap screen plane, so steering is mostly left and right.
2. Lifted wave with planar projection. The projection remains readable, but the curve varies off the screen plane and introduces real torsion.
3. Simple torus knot, such as a trefoil-style path. This is the first true knotted tunnel.
4. Harder torus knot. This increases curvature and torsion demands and reduces forgiveness.

Each level defines a parametric closed curve `C(t)` for `t in [0, 1)`, plus metadata: display name, target speed, tube radius, difficulty, sampling density, acceptable curvature range, acceptable torsion range, and visual tuning.

## Geometry Model

On level load, the app samples the parametric curve into a cyclic lookup table. Each sample stores:

- Position.
- Tangent.
- A frame whose up direction is tied to the minimap screen normal.
- Estimated curvature.
- Estimated torsion.
- Cumulative arc length.
- Ring placement data.

The lookup table provides consistent values for rendering, minimap progress, collision checks, and HUD meters. Sampling should preserve closed-loop continuity so the transition from `t = 1` back to `t = 0` is visually and numerically smooth.

The tunnel centerline is the level curve. The player's state is separate and includes:

- Position.
- Tangent.
- Steering frame.
- Raw pointer steering vector.
- Smoothed steering vector.
- Recent steering and path history.
- Health or integrity.
- Damage and warning state.
- Estimated progress along the tunnel centerline.
- Distance from the nearest centerline sample.

Each fixed timestep:

1. Read pointer displacement from the radar/trackpad center.
2. Clamp and normalize the displacement.
3. Smooth the desired steering with a low-pass or spring-damper momentum model.
4. Convert the smoothed 2D vector into a 3D curvature vector in the current steering frame.
5. Integrate the player's tangent and position at constant forward speed.
6. Estimate nearest centerline sample, progress, and tube-wall distance.
7. Apply warning, damage, and recovery based on distance from centerline relative to tube radius.
8. Record recent steering/path values for radar traces and derivative estimates.

## HUD Semantics

The radar/trackpad displays the last few seconds of pointer movement as a fading trace. Older points are dimmer, and the current pointer endpoint is brightest. At that endpoint:

- A blue arrow shows the tangent direction of the pointer trace. Its length is proportional to the current smoothed steering displacement, which is also proportional to the curvature of the player's path.
- A red arrow orthogonal to the blue arrow shows the component of the derivative of curvature in the normal direction.
- A green circular arrow centered on the endpoint shows signed torsion. Clockwise or counterclockwise direction indicates torsion sign. Brightness is proportional to absolute torsion.

The top-left curvature meter is blue. It contains a green acceptable band showing the range of curvature values that keep the player safely within the current tunnel, plus a live indicator for the player's current steering curvature.

The top-right torsion meter is green. It contains an acceptable band and a live signed torsion indicator. The torsion meter should be visually distinct from the curvature meter while still belonging to the same HUD system.

## Rendering

The app uses one full-window WebGL canvas. The main scene is a dark space-like tunnel:

- Glowing circular tunnel rings sampled ahead along the level curve.
- Depth fog and subtle bloom-like glow.
- Starfield or deep-space background drawn in the scene.
- Impact flashes, tube-edge glow, or warning color shifts when the player scrapes the wall.
- Sparse in-game text limited to level/status prompts.

HUD elements are rendered in the same canvas so the game has one coordinated render loop and one deterministic visual state. The main view must remain dominant, with corner instruments sized for readability without covering the tunnel.

The first-person view uses the minimap screen normal as the global up reference. This keeps the orientation connected to the minimap and makes torsion visually meaningful without arbitrary camera roll.

## Controls

The primary control model is a visible pointer-as-trackpad zone in the bottom-right radar area:

- Pointer position inside the zone maps to desired steering.
- The center is neutral.
- Distance from center maps to steering curvature magnitude.
- Direction from center maps to steering direction.
- Releasing or leaving the zone eases steering back toward neutral.

Keyboard controls should cover restart, pause, level selection/debug cycling, and fullscreen. Fullscreen should use `f`; `Esc` exits fullscreen where the browser allows it.

## Game States

The first build should support:

- Start screen.
- Active gameplay.
- Pause/help overlay.
- Level complete screen.
- Damaged or warning state during gameplay.
- Restart current level.
- Advance to next authored level.

Damage is recoverable. A run can still fail if integrity reaches zero, but ordinary wall contact should teach through feedback and recovery rather than immediate failure.

## Architecture

The app will be organized into focused modules:

- `src/game/curves`: authored parametric levels, curve sampling, curvature estimates, torsion estimates, and cyclic lookup utilities.
- `src/game/simulation`: fixed timestep, player integration, smoothing/momentum, collision, damage, recovery, and progression.
- `src/game/rendering`: Three.js scene setup, tunnel rings, starfield, camera frame, HUD drawing helpers, and resize/fullscreen behavior.
- `src/game/input`: pointer tracking inside the radar/trackpad zone and keyboard controls.
- `src/game/state`: screen state, level transitions, pause, restart, settings, and debug toggles.
- `src/main.ts`: app bootstrap, canvas creation, render loop, and deterministic test hooks.

The code should keep curve math testable without WebGL. Rendering should consume sampled level data and simulation state rather than own game logic.

## Testing And Verification

Pure unit tests should cover:

- Closed-loop curve continuity.
- Curve sampling and arc-length lookup.
- Curvature and torsion estimate sanity for planar and non-planar curves.
- Input smoothing lag and return-to-neutral behavior.
- Player integration at constant speed.
- Collision and damage thresholds.
- Level progression state changes.

The browser build should expose:

- `window.advanceTime(ms)` to step the simulation deterministically for tests.
- `window.render_game_to_text()` to return concise JSON for current state, including mode, level, progress, health, player distance from centerline, current curvature, current torsion, steering vector, and loaded HUD panels.

Playwright-based game verification should confirm:

- The canvas renders nonblank.
- The center tunnel view, minimap, radar/trackpad, and both meters are visible.
- Pointer movement changes raw steering, smoothed steering, curvature, and radar trace.
- Input smoothing produces lag rather than instantaneous jumps.
- Wall proximity triggers warning/damage feedback.
- Each authored level loads and advances.

## Delivery

The app should run locally with `npm run dev`. It has no backend, accounts, or network dependency. The first implementation plan can stage work incrementally, but the design target includes the full four-level authored arc.
