# Tunnel Vectors and Tangent-Binormal Plane Design

## Goal

Move the differential-geometry vector readouts closer to the geometry they describe. The main tunnel view should show the current `T'` and `N'` vectors as near, readable vectors anchored on the tunnel centerline. The bottom-right inset should stop being a normal-plane readout and become a Tangent-Binormal plane visualization of `N'` and its component projections.

## Approved Visual Direction

The main-view vector placement follows visual mockup option A: a near readout inside the tunnel. The vector bases sit on a centerline point a short distance ahead of the camera, so the arrows feel like they are attached to the curve while remaining legible.

The bottom-right inset keeps the existing black panel, red border, and red guide curves. Its title becomes `TANGENT-BINORMAL PLANE`. The vertical axis is labeled `T`, and the horizontal axis is labeled `B`.

## Geometry

The current simulation frame already provides the centerline position, tangent `T`, normal `N`, binormal `B`, curvature `kappa`, torsion `tau`, and sampled tangent derivative data. The implementation will derive:

- `T'`: the existing sampled tangent derivative vector, scaled for display. This remains the blue vector.
- `N'`: the Frenet derivative `N' = -kappa T + tau B`. This becomes the orange vector.
- `N'` T-axis projection: `-kappa T`, shown in blue in the Tangent-Binormal inset without a label.
- `N'` B-axis projection: `tau B`, shown in green in the Tangent-Binormal inset without a label.

For the inset, screen coordinates are fixed: +T maps upward, +B maps rightward. Positive curvature therefore usually makes the blue T component point downward because its coefficient in `N'` is `-kappa`.

## Main Tunnel View

Add a small Three.js vector overlay group to the world scene, separate from the tunnel ring meshes. Each render frame:

1. Sample a centerline frame a short arc-length distance ahead of the camera.
2. Place both arrow bases at that frame position.
3. Draw `T'` in blue and `N'` in orange from the same base.
4. Clamp display lengths so extreme curvature or torsion cannot dominate the tunnel view.
5. Use simple labels near the arrow tips: `T'` and `N'`.

The arrows should be readable but not oversized. They should avoid changing thickness dramatically with value; magnitude should be expressed primarily through length.

## Bottom-Right Inset

Rename the current bottom-right HUD method conceptually from normal-plane/radar to Tangent-Binormal plane while preserving the existing layout rectangle.

The inset renders:

- Red circular guide rings and red T/B axes.
- Axis labels: `T` near the positive vertical axis and `B` near the positive horizontal axis.
- Orange `N'` vector from the origin, labeled `N'`.
- Blue T projection from the origin, unlabeled.
- Green B projection from the origin, unlabeled.

The old normal-plane `T'` vector and projected `N'` vector are removed from this inset.

## Text State

`render_game_to_text()` should report that the Tangent-Binormal plane is visible instead of the normal plane. This keeps browser/debug checks aligned with the UI.

## Error Handling and Bounds

If the current frame has near-zero vector magnitudes or non-finite values, the drawing helpers should return zero-length display vectors rather than throwing. Display vector lengths are clamped to the panel radius for the HUD inset and to a fixed world-space maximum in the tunnel scene.

## Tests

Add focused tests before implementation:

- Geometry helper tests for `N' = -kappa T + tau B`.
- Inset projection tests showing the blue component on the T axis, green component on the B axis, and orange resultant.
- Label/state tests proving the bottom-right panel is now the Tangent-Binormal plane.
- Renderer tests proving the main-view vector group is updated from current simulation frame data and remains anchored to a centerline frame ahead of the camera.

Full verification after implementation should include `npm run typecheck`, `npm run test:run`, `npm run build`, and a browser/web-game screenshot check.
