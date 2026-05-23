Original prompt: Build a new web app game that teaches users about curvature and torsion of 3D curves. The app shows a minimap closed curve, a first-person tunnel following that curve, pointer-as-trackpad steering, radar history with curvature/torsion arrows, blue curvature and green torsion meters, authored levels from planar waves to torus knots, momentum in steering, and a dark spaceship HUD motif.

Implementation notes:
- Use Vite + TypeScript + Three.js.
- Maintain deterministic hooks: window.advanceTime(ms) and window.render_game_to_text().

Task 9 notes:
- Added a focused TunnelRings TDD test first; initial run failed because src/game/rendering/tunnel.ts did not exist.
- Implemented colors, TunnelRings, GameRenderer, and main.ts app wiring. Targeted tunnel test now passes.
- Browser check used the develop-web-game Playwright client against Vite on 127.0.0.1:4174. Start-mode screenshot shows cyan tunnel rings and render_game_to_text() returns mode/level/player state.
- Note: when entering play mode with no steering for several frames, the existing simulation quickly leaves the centerline and the first-person camera can point away from the sampled tunnel; steering/HUD work is expected in later tasks.
- Task 9 review fix: added a failing test for stable ring position attribute/array identity across repeated TunnelRings.update() calls, then changed TunnelRings to preallocate position buffers and mutate them in place without per-segment Vector3 allocations.

Task 10 notes:
- Added focused HUD helper tests first. Initial targeted run fails because src/game/rendering/hud.ts is not implemented yet, establishing the RED step for Task 10.
- Implemented HudOverlay with canvas texture, top blue/green meters, bottom-left minimap, pointer-aligned radar, compact status text, and renderer same-canvas overlay pass.
- Verification: targeted HUD tests, full Vitest suite, typecheck, and production build pass. Playwright screenshots written under /private/tmp/frenetic-task10-hud and /private/tmp/frenetic-task10-hud-playing.
- Browser note: start-mode screenshot shows tunnel rings plus HUD. Playing-mode HUD remains visible and reports steering history; the pre-existing Task 9 camera/simulation drift can still leave the tunnel out of view after several frames.
- Task 10 review fix: preserved signed torsion in the top-right meter, kept mobile HUD panels/text separated at 320x568 without changing pointer-aligned radar coordinates, and anchored the red radar vector at the current steering endpoint. Added helper tests for each review finding.

Task 11 notes:
- Added a Starfield points shell to the scene that follows the player/camera, plus fullscreen-aware F/Escape keyboard handling.
- Added focused tests for Starfield geometry/material/disposal and fullscreen/Escape keyboard behavior.
- Verification: targeted Starfield/app tests, full Vitest suite, typecheck, and production build pass. Playwright screenshots written under /private/tmp/frenetic-task11-start and /private/tmp/frenetic-task11-playing; start shows tunnel rings, HUD, and stars, while playing shows the expected carry-forward no-steering tunnel drift with HUD/starfield still visible.
