import { BufferGeometry, PointsMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Starfield } from './starfield';

describe('Starfield', () => {
  it('creates translucent cyan points distributed within the configured shell', () => {
    const starfield = new Starfield(12, 10);
    const geometry = starfield.points.geometry as BufferGeometry;
    const position = geometry.getAttribute('position');
    const material = starfield.points.material as PointsMaterial;

    expect(starfield.points.type).toBe('Points');
    expect(position.count).toBe(12);
    expect(material.color.getStyle()).toBe('rgb(217,251,255)');
    expect(material.size).toBe(0.09);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.72);

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const distance = Math.hypot(x, y, z);
      expect(distance).toBeGreaterThanOrEqual(4.5);
      expect(distance).toBeLessThanOrEqual(10);
    }

    starfield.dispose();
  });

  it('disposes geometry and material resources', () => {
    const starfield = new Starfield(3, 5);
    const geometryDispose = vi.spyOn(starfield.points.geometry, 'dispose');
    const materialDispose = vi.spyOn(starfield.points.material as PointsMaterial, 'dispose');

    starfield.dispose();

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });
});
