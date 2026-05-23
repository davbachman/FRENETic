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
