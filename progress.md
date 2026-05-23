Original prompt: Build a new web app game that teaches users about curvature and torsion of 3D curves. The app shows a minimap closed curve, a first-person tunnel following that curve, pointer-as-trackpad steering, radar history with curvature/torsion arrows, blue curvature and green torsion meters, authored levels from planar waves to torus knots, momentum in steering, and a dark spaceship HUD motif.

Implementation notes:
- Use Vite + TypeScript + Three.js.
- Maintain deterministic hooks: window.advanceTime(ms) and window.render_game_to_text().

Task 9 notes:
- Added a focused TunnelRings TDD test first; initial run failed because src/game/rendering/tunnel.ts did not exist.
- Implemented colors, TunnelRings, GameRenderer, and main.ts app wiring. Targeted tunnel test now passes.
- Browser check used the develop-web-game Playwright client against Vite on 127.0.0.1:4174. Start-mode screenshot shows cyan tunnel rings and render_game_to_text() returns mode/level/player state.
- Note: when entering play mode with no steering for several frames, the existing simulation quickly leaves the centerline and the first-person camera can point away from the sampled tunnel; steering/HUD work is expected in later tasks.
