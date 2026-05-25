import './style.css';
import { wireFullscreenButton } from './fullscreenButton';
import { FreneticApp } from './game/app';
import { GameRenderer } from './game/rendering/gameRenderer';

declare global {
  interface Window {
    advanceTime?: (ms: number) => void;
    render_game_to_text?: () => string;
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const shell = document.querySelector<HTMLElement>('#app-shell');
const fullscreenButton = document.querySelector<HTMLButtonElement>('#fullscreen-button');

if (!canvas) {
  throw new Error('FRENETic requires a #game-canvas element.');
}

if (!shell) {
  throw new Error('FRENETic requires a #app-shell element.');
}

if (!fullscreenButton) {
  throw new Error('FRENETic requires a #fullscreen-button element.');
}

const app = new FreneticApp(canvas, new GameRenderer(canvas));
wireFullscreenButton(fullscreenButton, shell, document, {
  onFullscreenChange: () => {
    app.resize();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => app.resize());
    }
  },
});

window.advanceTime = (ms: number) => app.advanceTime(ms);
window.render_game_to_text = () => app.renderGameToText();

app.start();
