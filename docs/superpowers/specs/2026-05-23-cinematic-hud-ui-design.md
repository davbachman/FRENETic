# Cinematic HUD UI Design

## Purpose

This pass upgrades FRENETic's visual language from a sparse prototype HUD to a dark, cinematic spaceship cockpit. The goal is stronger atmosphere and clearer instrument identity without changing gameplay, math, input, level progression, collision, momentum, or simulation semantics.

The selected direction is a focused cinematic HUD pass:

- Hybrid maximal top meters with large numeric readouts, explicit safe bands, angular frames, and glow detail.
- Volumetric cyan tunnel rings with thicker rims, bloom-like glow, and shaded depth.
- Integrated lower console pods for the minimap and radar, connected by a subtle bottom rail.

## Scope

The implementation should stay inside the existing rendering boundary:

- `src/game/rendering/tunnel.ts`: upgrade the ring visuals while preserving the existing sampled-curve update model.
- `src/game/rendering/hud.ts`: rebuild canvas HUD drawing helpers for angular meters, lower console pods, minimap, radar, and cockpit ornamentation.
- `src/game/rendering/colors.ts`: expand the palette for blue curvature, green torsion, cyan tunnel glow, magenta cockpit accents, amber warning ranges, red danger ranges, and dim glass panels.
- `src/game/rendering/gameRenderer.ts`: only minor renderer tuning if needed for opacity, antialiasing, or bloom-like material presentation.

This pass should not add new state, settings, gameplay rules, controls, levels, tutorial content, or math behavior.

## Visual Direction

The app should read as a dense sci-fi cockpit while keeping the main tunnel view dominant. The reference feel is high-contrast neon instrumentation on a near-black background: cyan, blue, green, and magenta glows; angular panel framing; subtle grid marks; and strong depth in the tunnel.

Decorative detail is allowed, but it must not cover the center play area. Core information always takes priority over ornamentation.

## Top Meters

The curvature meter remains on the top left and uses blue as its primary accent. The torsion meter remains on the top right and uses green as its primary accent.

Each meter should use the hybrid maximal bar style:

- Angular cockpit frame rather than a plain rounded rectangle.
- Large numeric value near the left side of the panel.
- Clear label text: `CURVATURE` and `TORSION`.
- Horizontal safe range band that remains easy to read.
- White or bright pointer indicator for the current value.
- Subtle arc, tick, or bracket detail on the right side of the meter.
- Cyan or magenta secondary linework that visually ties both meters into the cockpit.

The safe range should remain explicit because it is part of the teaching model. The implementation can improve the band styling with red, amber, and green regions, but it must preserve the current normalized meter semantics.

## Tunnel Rings

The tunnel should use volumetric glow rings:

- Continuous circular cyan rings, not dashed rings.
- Thicker near rings and softer far rings.
- Stronger opacity and glow on nearby rings, fading into depth.
- A clean center view so the player can read the tunnel direction at speed.
- Shaded depth or layered materials that suggest tunnel walls without filling the center with clutter.

The implementation should preserve preallocated ring geometry and avoid per-frame allocations. If multiple visual layers are needed, they should be constructed once and updated in place.

## Bottom Console

The minimap and radar should become angular pods anchored in the lower corners and connected by a subtle lower console rail.

The minimap pod keeps the projected curve and current-position dot. It can add a dashed circular frame, corner brackets, dim grid ticks, and stronger cyan glow.

The radar pod keeps the existing teaching semantics:

- Fading steering trace, with current endpoint brightest.
- Blue tangent arrow whose length follows steering magnitude.
- Red orthogonal arrow from the tangent endpoint.
- Green circular torsion arrow whose direction shows torsion sign and brightness shows torsion magnitude.

The radar should feel more instrument-like through circular grid rings, angular pod framing, glow, and tick marks. These additions must not obscure the trace or arrows.

The lower console rail can use magenta/cyan accent lines and small angular bracket details, but it should stay low enough that the central tunnel remains visible.

## Responsiveness

Desktop should show both top meters side by side and the lower pods in opposite corners. The central tunnel view should remain the primary visual mass.

On narrow screens, core HUD data should remain legible before decorative detail:

- Numeric meter values and safe bands stay visible.
- Minimap curve and player dot stay visible.
- Radar trace and arrows stay visible.
- Nonessential ticks, rails, and accent brackets may shrink or disappear.

The layout should continue using deterministic rectangle calculations so tests can assert bounds and non-overlap. Text must stay inside panels across desktop and mobile viewports.

## Architecture

The existing rendering separation remains the right boundary:

- `TunnelRings` owns tunnel ring geometry, materials, and per-frame position updates.
- `HudOverlay` owns canvas HUD layout and drawing.
- `GameRenderer` composes the scene and HUD without taking ownership of HUD logic.

Within `hud.ts`, helper functions should keep the file understandable:

- Layout helpers for meter and bottom pod rectangles.
- Shape helpers for angular panels and glow strokes.
- Meter helpers for numeric readouts, safe bands, and indicators.
- Minimap and radar helpers for instrument frames and data overlays.

No HUD drawing helper should change simulation state. Rendering should remain a consumer of `GameState` and `SimulationState`.

## Testing And Verification

Unit tests should be updated or added for:

- Responsive HUD layout bounds and non-overlap.
- Meter geometry normalization for curvature and signed torsion.
- Radar vector calculations and torsion arc behavior.
- Tunnel ring geometry/material update behavior after the visual layering changes.

Verification commands:

- `npm run typecheck`
- `npm run test:run`
- `npm run build`

Browser verification should include desktop and mobile screenshots for:

- Normal play on an early level.
- A later knot level.
- Visible tunnel rings, minimap, radar, curvature meter, torsion meter, and status text.
- No obvious text overlap, clipped core data, blank canvas, or console errors.

## Risks

Performance is the main risk. Thicker and glowier rings can become expensive if implemented with many new meshes or per-frame allocations. The design should keep geometry preallocated and reuse materials.

Readability is the second risk. The selected style is intentionally dense, so decorative cockpit detail must collapse before core data on small screens and must not intrude into the center tunnel view.

The implementation should treat this as a visual upgrade, not a gameplay rewrite.
