import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

export const TONES = {
  green: '#2fbf71', amber: '#f2b33d', red: '#e5484d', down: '#e5484d', idle: '#8a96a3',
  new: '#6366f1', neutral: '#6b7a8c', busy: '#2fbf71', alert: '#e5484d', locked: '#8a96a3', maintenance: '#3b82f6',
};
const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

const canvasOf = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')];
};

const finish = (canvas, { repeat } = {}) => {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  }
  return texture;
};

const rounded = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const fit = (ctx, text, maxWidth) => {
  let s = String(text ?? '');
  while (s.length > 3 && ctx.measureText(s).width > maxWidth) s = `${s.slice(0, -2)}…`;
  return s;
};

const BOARD_PX = { line: [768, 448], small: [512, 288], wide: [1024, 512] };

/** A blank board texture of one size, painted (and repainted in place) by drawBoard. */
export const boardTexture = (size = 'line') => finish(canvasOf(...BOARD_PX[size])[0]);

/** Paints a line board / table tag / order board into its texture: a dark display with a status strip and figures. */
export const drawBoard = (texture, { title, subtitle, rows = [], tone = 'neutral', badge }) => {
  const canvas = texture.image;
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const pad = w * 0.06;
  ctx.clearRect(0, 0, w, h);
  rounded(ctx, 0, 0, w, h, 26);
  ctx.fillStyle = '#16202b';
  ctx.fill();
  ctx.fillStyle = TONES[tone] || TONES.neutral;
  ctx.fillRect(0, 0, w, h * 0.06);
  ctx.fillStyle = '#f4f7fb';
  ctx.font = `700 ${Math.round(h * 0.13)}px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText(fit(ctx, title, w - pad * 2 - (badge ? w * 0.36 : 0)), pad, h * 0.11);
  ctx.fillStyle = '#9fb0c2';
  ctx.font = `500 ${Math.round(h * 0.075)}px ${FONT}`;
  ctx.fillText(fit(ctx, subtitle, w - pad * 2), pad, h * 0.27);
  const rowH = (h * 0.6) / Math.max(3, rows.length);
  rows.forEach(([label, value], i) => {
    const y = h * 0.39 + i * rowH;
    ctx.fillStyle = '#8b9aab';
    ctx.font = `500 ${Math.round(rowH * 0.42)}px ${FONT}`;
    ctx.fillText(fit(ctx, label, w * 0.42), pad, y + rowH * 0.18);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(rowH * 0.52)}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(fit(ctx, value, w * 0.5), w - pad, y + rowH * 0.12);
    ctx.textAlign = 'left';
  });
  if (badge) {
    ctx.font = `800 ${Math.round(h * 0.07)}px ${FONT}`;
    const bw = ctx.measureText(badge).width + pad;
    rounded(ctx, w - pad - bw, h * 0.11, bw, h * 0.11, 18);
    ctx.fillStyle = TONES.red;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(badge, w - pad - bw + pad / 2, h * 0.135);
  }
  texture.needsUpdate = true;
};

/** A hanging zone sign: light panel, accent edge, zone name and one live figure. */
export const signTexture = ({ label, metric, accent, tone, chip }) => {
  const [canvas, ctx] = canvasOf(1024, 256);
  rounded(ctx, 0, 0, 1024, 256, 30);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = tone === 'alert' ? TONES.red : accent;
  ctx.fillRect(0, 0, 22, 256);
  ctx.fillStyle = '#1d2733';
  ctx.font = `700 78px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText(fit(ctx, label, chip ? 640 : 900), 60, 36);
  ctx.fillStyle = tone === 'alert' ? '#c4353a' : '#5d6b7b';
  ctx.font = `500 50px ${FONT}`;
  ctx.fillText(fit(ctx, metric, 920), 60, 150);
  if (chip) {
    ctx.font = `700 40px ${FONT}`;
    const cw = ctx.measureText(chip).width + 44;
    rounded(ctx, 1024 - cw - 34, 44, cw, 62, 31);
    ctx.fillStyle = chip === 'Demo data' ? '#fdf0d5' : '#e8ebef';
    ctx.fill();
    ctx.fillStyle = chip === 'Demo data' ? '#9a6a00' : '#5d6b7b';
    ctx.fillText(chip, 1024 - cw - 12, 56);
  }
  return finish(canvas);
};

/** A document card in flight: a purchase order or a customer order, as a paper ticket. */
export const docTexture = ({ label, title, detail, icon }) => {
  const [canvas, ctx] = canvasOf(512, 320);
  rounded(ctx, 0, 0, 512, 320, 22);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#6366f1';
  ctx.fillRect(0, 0, 512, 54);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 30px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(fit(ctx, `${icon || ''} ${label}`, 470), 24, 28);
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#1d2733';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(fit(ctx, title, 470), 24, 82);
  ctx.fillStyle = '#5d6b7b';
  ctx.font = `500 28px ${FONT}`;
  const words = String(detail || '').split(' · ');
  words.slice(0, 3).forEach((w, i) => ctx.fillText(fit(ctx, w, 470), 24, 146 + i * 42));
  ctx.strokeStyle = '#d7dbe2';
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(18, 286);
  ctx.lineTo(494, 286);
  ctx.stroke();
  return finish(canvas);
};

const once = new Map();
const cached = (key, draw) => {
  if (!once.has(key)) once.set(key, draw());
  return once.get(key);
};

/** Marker paper laid on a cut lay: a dot grid with pattern pieces outlined in pencil blue. */
export const markerTexture = () => cached('marker', () => {
  const [canvas, ctx] = canvasOf(1024, 256);
  ctx.fillStyle = '#f7f7f4';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#d4d8e2';
  for (let x = 8; x < 1024; x += 16) for (let y = 8; y < 256; y += 16) ctx.fillRect(x, y, 2, 2);
  ctx.strokeStyle = '#5b6fb5';
  ctx.lineWidth = 3;
  for (let i = 0; i < 9; i += 1) {
    const x = 20 + i * 112;
    ctx.beginPath();
    ctx.moveTo(x, 30); ctx.lineTo(x + 70, 22); ctx.lineTo(x + 92, 70); ctx.lineTo(x + 84, 220); ctx.lineTo(x + 8, 228); ctx.lineTo(x - 4, 80);
    ctx.closePath();
    ctx.stroke();
  }
  const texture = finish(canvas, { repeat: true });
  texture.repeat.set(2.5, 1);
  return texture;
});

/** The edge of a fabric lay: the plies show as fine bands. */
export const plyTexture = () => cached('plies', () => {
  const [canvas, ctx] = canvasOf(64, 64);
  for (let y = 0; y < 64; y += 4) {
    ctx.fillStyle = y % 8 ? '#ffffff' : '#c9ccd2';
    ctx.fillRect(0, y, 64, 4);
  }
  return finish(canvas, { repeat: true });
});

/** Kraft carton with brown tape and a white shipping label. */
export const cartonTexture = () => cached('carton', () => {
  const [canvas, ctx] = canvasOf(128, 128);
  ctx.fillStyle = '#c99d6b';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#b4874f';
  ctx.fillRect(56, 0, 16, 128);
  ctx.fillStyle = '#f5f2ea';
  ctx.fillRect(14, 70, 34, 24);
  return finish(canvas);
});
