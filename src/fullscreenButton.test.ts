import { describe, expect, it, vi } from 'vitest';
import { wireFullscreenButton } from './fullscreenButton';

function buttonElement(): HTMLButtonElement {
  const listeners = new Map<string, EventListener>();
  return {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener);
    }),
    removeEventListener: vi.fn(),
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    dispatch: (type: string) => listeners.get(type)?.({ type } as Event),
  } as unknown as HTMLButtonElement & { dispatch(type: string): void };
}

function classListStub(): DOMTokenList {
  const tokens = new Set<string>();
  return {
    add: vi.fn((token: string) => {
      tokens.add(token);
    }),
    remove: vi.fn((token: string) => {
      tokens.delete(token);
    }),
    contains: vi.fn((token: string) => tokens.has(token)),
  } as unknown as DOMTokenList;
}

describe('fullscreen button', () => {
  it('requests fullscreen on the app shell when inactive', () => {
    const button = buttonElement() as HTMLButtonElement & { dispatch(type: string): void };
    const target = {
      requestFullscreen: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLElement;
    const fullscreenRoot = {
      requestFullscreen: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLElement;
    const doc = {
      documentElement: fullscreenRoot,
      fullscreenElement: null,
      exitFullscreen: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Document;

    wireFullscreenButton(button, target, doc);
    button.dispatch('click');

    expect(target.requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
    expect(fullscreenRoot.requestFullscreen).not.toHaveBeenCalled();
    expect(doc.exitFullscreen).not.toHaveBeenCalled();
  });

  it('falls back to the document root when the app shell cannot request fullscreen', () => {
    const button = buttonElement() as HTMLButtonElement & { dispatch(type: string): void };
    const target = {} as unknown as HTMLElement;
    const fullscreenRoot = {
      requestFullscreen: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLElement;
    const doc = {
      documentElement: fullscreenRoot,
      fullscreenElement: null,
      exitFullscreen: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Document;

    wireFullscreenButton(button, target, doc);
    button.dispatch('click');

    expect(fullscreenRoot.requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });

  it('runs the fullscreen change callback when Chrome changes fullscreen state', () => {
    const button = buttonElement() as HTMLButtonElement & { dispatch(type: string): void };
    const target = {
      requestFullscreen: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLElement;
    const fullscreenListeners = new Map<string, EventListener>();
    const onFullscreenChange = vi.fn();
    const doc = {
      documentElement: target,
      fullscreenElement: target,
      exitFullscreen: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        fullscreenListeners.set(type, listener);
      }),
      removeEventListener: vi.fn(),
    } as unknown as Document;

    wireFullscreenButton(button, target, doc, { onFullscreenChange });
    fullscreenListeners.get('fullscreenchange')?.({ type: 'fullscreenchange' } as Event);

    expect(onFullscreenChange).toHaveBeenCalledOnce();
    expect(button.setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'true');
  });

  it('runs the fullscreen change callback when Chrome resolves the request promise', async () => {
    const button = buttonElement() as HTMLButtonElement & { dispatch(type: string): void };
    const requestPromise = Promise.resolve();
    const target = {
      requestFullscreen: vi.fn().mockReturnValue(requestPromise),
    } as unknown as HTMLElement;
    const onFullscreenChange = vi.fn();
    const doc = {
      documentElement: target,
      fullscreenElement: target,
      exitFullscreen: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Document;

    wireFullscreenButton(button, target, doc, { onFullscreenChange });
    button.dispatch('click');
    await requestPromise;
    await Promise.resolve();

    expect(onFullscreenChange).toHaveBeenCalled();
    expect(button.setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'true');
  });

  it('exits fullscreen when already fullscreen', () => {
    const button = buttonElement() as HTMLButtonElement & { dispatch(type: string): void };
    const target = {
      requestFullscreen: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLElement;
    const doc = {
      fullscreenElement: target,
      exitFullscreen: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Document;

    wireFullscreenButton(button, target, doc);
    button.dispatch('click');

    expect(doc.exitFullscreen).toHaveBeenCalledOnce();
    expect(target.requestFullscreen).not.toHaveBeenCalled();
  });

  it('keeps aria pressed state synced with fullscreen changes', () => {
    const button = buttonElement() as HTMLButtonElement & { dispatch(type: string): void };
    const target = {
      requestFullscreen: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLElement;
    const fullscreenListeners = new Map<string, EventListener>();
    const doc = {
      fullscreenElement: target,
      exitFullscreen: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        fullscreenListeners.set(type, listener);
      }),
      removeEventListener: vi.fn(),
    } as unknown as Document;

    const cleanup = wireFullscreenButton(button, target, doc);
    fullscreenListeners.get('fullscreenchange')?.({ type: 'fullscreenchange' } as Event);
    cleanup();

    expect(button.setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
    expect(doc.removeEventListener).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
  });

  it('uses a CSS fallback when the browser does not expose fullscreen APIs', () => {
    const button = buttonElement() as HTMLButtonElement & { dispatch(type: string): void };
    const target = {
      classList: classListStub(),
    } as unknown as HTMLElement;
    const doc = {
      fullscreenElement: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Document;

    wireFullscreenButton(button, target, doc);
    button.dispatch('click');

    expect(target.classList.add).toHaveBeenCalledWith('is-fullscreen-fallback');
    expect(button.setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'true');
  });
});
