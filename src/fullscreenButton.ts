const FALLBACK_FULLSCREEN_CLASS = 'is-fullscreen-fallback';

type FullscreenTarget = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type OptionalFullscreenMethods = {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

interface FullscreenButtonOptions {
  onFullscreenChange?: () => void;
}

export function wireFullscreenButton(
  button: HTMLButtonElement,
  target: FullscreenTarget,
  doc: Document = document,
  options: FullscreenButtonOptions = {},
): () => void {
  const fullscreenDoc = doc as FullscreenDocument;
  const fullscreenElement = (): Element | null =>
    doc.fullscreenElement ?? fullscreenDoc.webkitFullscreenElement ?? null;
  const fullscreenRequestTarget = (): FullscreenTarget => {
    const targetMethods = target as OptionalFullscreenMethods;
    const root = doc.documentElement as (FullscreenTarget & OptionalFullscreenMethods) | null;
    if (targetMethods.requestFullscreen || targetMethods.webkitRequestFullscreen) {
      return target;
    }
    return root ?? target;
  };
  const isFallbackFullscreen = (): boolean =>
    target.classList?.contains(FALLBACK_FULLSCREEN_CLASS) ?? false;
  const isNativeFullscreen = (): boolean => {
    const activeElement = fullscreenElement();
    return activeElement === target || activeElement === fullscreenRequestTarget();
  };
  const isActive = (): boolean => isNativeFullscreen() || isFallbackFullscreen();
  const syncPressed = (): void => {
    button.setAttribute('aria-pressed', isActive() ? 'true' : 'false');
  };
  const handleFullscreenChange = (): void => {
    syncPressed();
    options.onFullscreenChange?.();
  };
  const requestFullscreen = (): Promise<void> | void => {
    const requestTarget = fullscreenRequestTarget();
    const requestTargetMethods = requestTarget as OptionalFullscreenMethods;
    if (requestTargetMethods.requestFullscreen) {
      return requestTargetMethods.requestFullscreen.call(requestTarget, { navigationUI: 'hide' });
    }
    return requestTargetMethods.webkitRequestFullscreen?.call(requestTarget);
  };
  const exitFullscreen = (): Promise<void> | void => {
    if (doc.exitFullscreen) {
      return doc.exitFullscreen();
    }
    return fullscreenDoc.webkitExitFullscreen?.();
  };
  const enterFallbackFullscreen = (): void => {
    target.classList?.add(FALLBACK_FULLSCREEN_CLASS);
    handleFullscreenChange();
  };
  const leaveFallbackFullscreen = (): void => {
    target.classList?.remove(FALLBACK_FULLSCREEN_CLASS);
    handleFullscreenChange();
  };

  const toggleFullscreen = (): void => {
    if (isActive()) {
      if (isNativeFullscreen()) {
        void exitFullscreen();
      }
      leaveFallbackFullscreen();
      return;
    }

    const request = requestFullscreen();
    if (request && typeof request.catch === 'function') {
      void request.then(handleFullscreenChange).catch(enterFallbackFullscreen);
      return;
    }
    if (!request) {
      enterFallbackFullscreen();
      return;
    }
    handleFullscreenChange();
  };

  button.addEventListener('click', toggleFullscreen);
  doc.addEventListener('fullscreenchange', handleFullscreenChange);
  doc.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  syncPressed();

  return () => {
    button.removeEventListener('click', toggleFullscreen);
    doc.removeEventListener('fullscreenchange', handleFullscreenChange);
    doc.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
  };
}
