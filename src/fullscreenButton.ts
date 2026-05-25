const FALLBACK_FULLSCREEN_CLASS = 'is-fullscreen-fallback';

type FullscreenTarget = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
};

type OptionalFullscreenMethods = {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
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

  const fullscreenRequestTargets = (): FullscreenTarget[] => {
    const root = doc.documentElement as FullscreenTarget | null;
    const body = doc.body as FullscreenTarget | null;
    const candidates = [target, root, body].filter(
      (candidate): candidate is FullscreenTarget => candidate !== null && candidate !== undefined,
    );
    return candidates.filter((candidate, index) => candidates.indexOf(candidate) === index);
  };

  const fullscreenRequestMethod = (
    requestTarget: FullscreenTarget,
  ): (() => Promise<void> | void) | undefined => {
    const requestTargetMethods = requestTarget as OptionalFullscreenMethods;
    if (requestTargetMethods.requestFullscreen) {
      return () => requestTargetMethods.requestFullscreen?.call(requestTarget);
    }
    if (requestTargetMethods.webkitRequestFullscreen) {
      return () => requestTargetMethods.webkitRequestFullscreen?.call(requestTarget);
    }
    if (requestTargetMethods.webkitRequestFullScreen) {
      return () => requestTargetMethods.webkitRequestFullScreen?.call(requestTarget);
    }
    return undefined;
  };

  const isFallbackFullscreen = (): boolean =>
    target.classList?.contains(FALLBACK_FULLSCREEN_CLASS) ?? false;
  const isNativeFullscreen = (): boolean => {
    const activeElement = fullscreenElement();
    return activeElement !== null && fullscreenRequestTargets().includes(activeElement as FullscreenTarget);
  };
  const isActive = (): boolean => isNativeFullscreen() || isFallbackFullscreen();
  const syncPressed = (): void => {
    button.setAttribute('aria-pressed', isActive() ? 'true' : 'false');
  };
  const handleFullscreenChange = (): void => {
    syncPressed();
    options.onFullscreenChange?.();
  };
  const requestFullscreen = (): Promise<void> | undefined => {
    const candidates = fullscreenRequestTargets().filter((candidate) =>
      Boolean(fullscreenRequestMethod(candidate)),
    );
    if (candidates.length === 0) {
      return undefined;
    }
    const tryCandidate = (index: number, previousError?: unknown): Promise<void> => {
      const candidate = candidates[index];
      if (!candidate) {
        return Promise.reject(previousError ?? new Error('Fullscreen API unavailable.'));
      }
      const request = fullscreenRequestMethod(candidate);
      if (!request) {
        return tryCandidate(index + 1, previousError);
      }

      try {
        return Promise.resolve(request()).catch((error: unknown) =>
          tryCandidate(index + 1, error),
        );
      } catch (error) {
        return tryCandidate(index + 1, error);
      }
    };

    return tryCandidate(0);
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
