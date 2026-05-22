import type { Vec2 } from '../simulation/types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getRadarRect(width: number, height: number): Rect {
  const size = Math.max(168, Math.min(300, Math.min(width, height) * 0.27));
  const margin = Math.max(18, Math.min(width, height) * 0.035);
  return {
    x: width - size - margin,
    y: height - size - margin,
    width: size,
    height: size,
  };
}

export function normalizePointerToTrackpad(localX: number, localY: number, rect: Rect): Vec2 {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const radius = rect.width / 2;
  const raw = {
    x: (localX - centerX) / radius,
    y: (centerY - localY) / radius,
  };
  const length = Math.hypot(raw.x, raw.y);

  if (length <= 1) {
    return raw;
  }

  return {
    x: raw.x / length,
    y: raw.y / length,
  };
}

export class PointerTrackpad {
  private steering: Vec2 = { x: 0, y: 0 };
  private activePointerId: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerUp);
    canvas.addEventListener('lostpointercapture', this.onLostPointerCapture);
  }

  getSteering(): Vec2 {
    return { ...this.steering };
  }

  destroy(): void {
    this.releaseActivePointerCapture();
    this.resetActivePointer();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerUp);
    this.canvas.removeEventListener('lostpointercapture', this.onLostPointerCapture);
  }

  private canvasRect(): DOMRect {
    return this.canvas.getBoundingClientRect();
  }

  private radarRect(): Rect {
    const rect = this.canvasRect();
    return getRadarRect(rect.width, rect.height);
  }

  private updateFromEvent(event: PointerEvent): void {
    const canvasRect = this.canvasRect();
    this.steering = normalizePointerToTrackpad(
      event.clientX - canvasRect.left,
      event.clientY - canvasRect.top,
      this.radarRect(),
    );
  }

  private setCanvasPointerCapture(pointerId: number): void {
    const setPointerCapture = this.canvas.setPointerCapture;

    if (typeof setPointerCapture === 'function') {
      setPointerCapture.call(this.canvas, pointerId);
    }
  }

  private releasePointerCapture(pointerId: number): void {
    const releasePointerCapture = this.canvas.releasePointerCapture;

    if (typeof releasePointerCapture !== 'function') {
      return;
    }

    const hasPointerCapture = this.canvas.hasPointerCapture;
    if (typeof hasPointerCapture === 'function' && !hasPointerCapture.call(this.canvas, pointerId)) {
      return;
    }

    releasePointerCapture.call(this.canvas, pointerId);
  }

  private releaseActivePointerCapture(): void {
    if (this.activePointerId === null) {
      return;
    }

    this.releasePointerCapture(this.activePointerId);
  }

  private resetActivePointer(): void {
    this.activePointerId = null;
    this.steering = { x: 0, y: 0 };
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null) {
      return;
    }

    const canvasRect = this.canvasRect();
    const radar = this.radarRect();
    const localX = event.clientX - canvasRect.left;
    const localY = event.clientY - canvasRect.top;
    const inside =
      localX >= radar.x &&
      localX <= radar.x + radar.width &&
      localY >= radar.y &&
      localY <= radar.y + radar.height;

    if (!inside) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.setCanvasPointerCapture(event.pointerId);
    this.updateFromEvent(event);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.updateFromEvent(event);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.releasePointerCapture(event.pointerId);
    this.resetActivePointer();
  };

  private onLostPointerCapture = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.resetActivePointer();
  };
}
