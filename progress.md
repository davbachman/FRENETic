Original prompt: Build a new web app game that teaches users about curvature and torsion of 3D curves. The app shows a minimap closed curve, a first-person tunnel following that curve, pointer-as-trackpad steering, radar history with curvature/torsion arrows, blue curvature and green torsion meters, authored levels from planar waves to torus knots, momentum in steering, and a dark spaceship HUD motif.

Implementation notes:
- Use Vite + TypeScript + Three.js.
- Maintain deterministic hooks: window.advanceTime(ms) and window.render_game_to_text().
