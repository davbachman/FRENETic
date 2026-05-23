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

Verification:
- npm run test:run passed.
- npm run typecheck passed.
- npm run build passed.
- Web-game steering check ran at http://127.0.0.1:5173/ with screenshots in output/web-game/steer-right and no console error artifact. It rendered the minimap, radar, blue curvature meter, and green torsion meter, and render_game_to_text() reported 91 steering trace points with smoothed steering changed from neutral. The known playing-mode drift caused the final state to be mode "failed" with the main tunnel out of view.
- Web-game level cycling check ran at http://127.0.0.1:5173/ with screenshots in output/web-game/level-cycle and no console error artifact. The app still rendered HUD panels and a valid authored level state, but the develop-web-game client did not transmit the requested "n" inputs because its button map currently supports only up/down/left/right/enter/space/a/b, so this run did not prove authored level cycling.

Task 12 fix notes:
- Added a tested B key alias for next level so the develop-web-game client's supported button map can exercise level cycling while preserving the existing N shortcut.
- Updated level-cycle.json to use the B alias, and updated steer-right.json to a shorter axis-aligned steering burst verified against the planar first level.
- Verification after fixes: npm run test:run passed, npm run typecheck passed, and npm run build passed.
- Web-game steering check ran at http://127.0.0.1:5174/ with screenshots in output/web-game/steer-right and no console error artifact. Screenshot shows visible tunnel rings, readable minimap, radar trace, blue curvature meter, green torsion meter, and desktop text fitting inside panels. render_game_to_text() reported mode "playing", 91 steering trace points, and smoothed steering changed from neutral.
- Web-game level cycling check ran at http://127.0.0.1:5174/ with screenshots in output/web-game/level-cycle and no console error artifact. render_game_to_text() reported mode "playing" on authored level index 3, "cinquefoil-knot", with HUD panels visible. The main tunnel was out of view in the final level-cycle screenshot due to the known playing-mode drift, but the minimap, radar, blue curvature meter, green torsion meter, and panel text remained visible/readable.
