import './style.css';
import { FreneticApp } from './game/app';
import { GameRenderer } from './game/rendering/gameRenderer';

declare global {
  interface Window {
    advanceTime?: (ms: number) => void;
    render_game_to_text?: () => string;
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!canvas) {
  throw new Error('FRENETic requires a #game-canvas element.');
}

const app = new FreneticApp(canvas, new GameRenderer(canvas));

window.advanceTime = (ms: number) => app.advanceTime(ms);
window.render_game_to_text = () => app.renderGameToText();

app.start();
