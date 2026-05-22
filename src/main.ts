import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!canvas) {
  throw new Error('FRENETic requires a #game-canvas element.');
}

const context = canvas.getContext('2d');

if (context) {
  context.fillStyle = '#02040a';
  context.fillRect(0, 0, canvas.clientWidth || 800, canvas.clientHeight || 600);
  context.fillStyle = '#36f3ff';
  context.font = '20px sans-serif';
  context.fillText('FRENETic loading...', 32, 48);
}
