import { describe, expect, it } from 'vitest';
import { getRadarRect, normalizePointerToTrackpad, PointerTrackpad } from './pointerTrackpad';

type PointerListener = (event: PointerEvent) => void;

class FakeCanvas {
  readonly capturedPointerIds = new Set<number>();
  readonly releasedPointerIds: number[] = [];
  private readonly listeners = new Map<string, Set<PointerListener>>();

  constructor(private readonly rect: DOMRect) {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== 'function') {
      throw new Error('FakeCanvas only supports function listeners');
    }

    const listeners = this.listeners.get(type) ?? new Set<PointerListener>();
    listeners.add(listener as PointerListener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== 'function') {
      return;
    }

    this.listeners.get(type)?.delete(listener as PointerListener);
  }

  getBoundingClientRect(): DOMRect {
    return this.rect;
  }

  setPointerCapture(pointerId: number): void {
    this.capturedPointerIds.add(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.releasedPointerIds.push(pointerId);
    this.capturedPointerIds.delete(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.capturedPointerIds.has(pointerId);
  }

  dispatchPointer(type: string, init: { pointerId: number; clientX: number; clientY: number }): void {
    const event = init as PointerEvent;
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  asCanvas(): HTMLCanvasElement {
    return this as unknown as HTMLCanvasElement;
  }
}

function createDomRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  };
}

function createTrackpad(width = 1000, height = 700): {
  canvas: FakeCanvas;
  radar: ReturnType<typeof getRadarRect>;
  trackpad: PointerTrackpad;
} {
  const canvas = new FakeCanvas(createDomRect(width, height));
  const trackpad = new PointerTrackpad(canvas.asCanvas());
  return {
    canvas,
    radar: getRadarRect(width, height),
    trackpad,
  };
}

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

  it('does not expose mutable steering state through the getter', () => {
    const { canvas, radar, trackpad } = createTrackpad();
    canvas.dispatchPointer('pointerdown', {
      pointerId: 1,
      clientX: radar.x + radar.width,
      clientY: radar.y,
    });

    const returned = trackpad.getSteering();
    returned.x = -1;
    returned.y = -1;

    const later = trackpad.getSteering();
    expect(later.x).toBeGreaterThan(0.6);
    expect(later.y).toBeGreaterThan(0.6);
    expect(later).not.toBe(returned);
  });

  it('only starts steering from pointerdown inside the radar', () => {
    const { canvas, radar, trackpad } = createTrackpad();
    canvas.dispatchPointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    canvas.dispatchPointer('pointermove', {
      pointerId: 1,
      clientX: radar.x + radar.width,
      clientY: radar.y,
    });

    expect(canvas.capturedPointerIds.has(1)).toBe(false);
    expect(trackpad.getSteering()).toEqual({ x: 0, y: 0 });

    canvas.dispatchPointer('pointerdown', {
      pointerId: 2,
      clientX: radar.x + radar.width,
      clientY: radar.y,
    });

    expect(canvas.capturedPointerIds.has(2)).toBe(true);
    expect(trackpad.getSteering().x).toBeGreaterThan(0.6);
    expect(trackpad.getSteering().y).toBeGreaterThan(0.6);
  });

  it('ignores pointerdown and pointermove from non-active pointers', () => {
    const { canvas, radar, trackpad } = createTrackpad();
    canvas.dispatchPointer('pointerdown', {
      pointerId: 1,
      clientX: radar.x + radar.width / 2,
      clientY: radar.y + radar.height / 2,
    });

    canvas.dispatchPointer('pointerdown', {
      pointerId: 2,
      clientX: radar.x + radar.width,
      clientY: radar.y,
    });
    canvas.dispatchPointer('pointermove', {
      pointerId: 2,
      clientX: radar.x + radar.width,
      clientY: radar.y,
    });

    expect(canvas.capturedPointerIds.has(1)).toBe(true);
    expect(canvas.capturedPointerIds.has(2)).toBe(false);
    expect(trackpad.getSteering().x).toBeCloseTo(0);
    expect(trackpad.getSteering().y).toBeCloseTo(0);

    canvas.dispatchPointer('pointermove', {
      pointerId: 1,
      clientX: radar.x + radar.width,
      clientY: radar.y,
    });

    expect(trackpad.getSteering().x).toBeGreaterThan(0.6);
    expect(trackpad.getSteering().y).toBeGreaterThan(0.6);
  });

  it.each(['pointerup', 'pointercancel', 'pointerleave'])('releases capture and resets on %s', (type) => {
    const { canvas, radar, trackpad } = createTrackpad();
    canvas.dispatchPointer('pointerdown', {
      pointerId: 1,
      clientX: radar.x + radar.width,
      clientY: radar.y,
    });

    canvas.dispatchPointer(type, {
      pointerId: 1,
      clientX: radar.x + radar.width,
      clientY: radar.y,
    });

    expect(canvas.capturedPointerIds.has(1)).toBe(false);
    expect(canvas.releasedPointerIds).toEqual([1]);
    expect(trackpad.getSteering()).toEqual({ x: 0, y: 0 });
  });

  it('resets when pointer capture is lost', () => {
    const { canvas, radar, trackpad } = createTrackpad();
    canvas.dispatchPointer('pointerdown', {
      pointerId: 1,
      clientX: radar.x + radar.width,
      clientY: radar.y,
    });
    canvas.capturedPointerIds.delete(1);

    canvas.dispatchPointer('lostpointercapture', {
      pointerId: 1,
      clientX: radar.x + radar.width,
      clientY: radar.y,
    });

    expect(trackpad.getSteering()).toEqual({ x: 0, y: 0 });
  });

  it('releases active capture and resets when destroyed', () => {
    const { canvas, radar, trackpad } = createTrackpad();
    canvas.dispatchPointer('pointerdown', {
      pointerId: 1,
      clientX: radar.x + radar.width,
      clientY: radar.y,
    });

    trackpad.destroy();

    expect(canvas.capturedPointerIds.has(1)).toBe(false);
    expect(canvas.releasedPointerIds).toEqual([1]);
    expect(trackpad.getSteering()).toEqual({ x: 0, y: 0 });
    expect(canvas.listenerCount('pointerdown')).toBe(0);
    expect(canvas.listenerCount('lostpointercapture')).toBe(0);
  });
});
