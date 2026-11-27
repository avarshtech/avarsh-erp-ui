/** Drawing the screenshot annotations (arrow, rectangle, text) onto a canvas, in image pixels. */

export const ANNOTATION_COLOR = '#f5222d';

export const lineWidthFor = (imageWidth) => Math.max(3, Math.round(imageWidth / 400));

/** A shape too small to be deliberate (a click without a drag) is dropped. */
export function isMeaningful(shape) {
  if (shape.type === 'rect') return Math.abs(shape.w) > 4 && Math.abs(shape.h) > 4;
  if (shape.type === 'arrow') return Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) > 8;
  return Boolean(shape.text);
}

function drawArrow(ctx, { x1, y1, x2, y2 }, width) {
  const head = width * 5;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 7), y2 - head * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 7), y2 - head * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

function drawText(ctx, { x, y, text }, width) {
  const size = width * 7;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  const padding = size * 0.3;
  const metrics = ctx.measureText(text);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillRect(x - padding, y - padding, metrics.width + padding * 2, size + padding * 2);
  ctx.fillStyle = ANNOTATION_COLOR;
  ctx.fillText(text, x, y);
}

export function drawAnnotations(canvas, image, shapes) {
  const ctx = canvas.getContext('2d');
  const width = lineWidthFor(canvas.width);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const shape of shapes) {
    ctx.strokeStyle = ANNOTATION_COLOR;
    ctx.fillStyle = ANNOTATION_COLOR;
    if (shape.type === 'rect') ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
    else if (shape.type === 'arrow') drawArrow(ctx, shape, width);
    else if (shape.type === 'text') drawText(ctx, shape, width);
  }
}

/** Pointer position in image pixels (the canvas is displayed scaled down to fit the dialog). */
export function toImagePoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * canvas.width) / rect.width,
    y: ((event.clientY - rect.top) * canvas.height) / rect.height,
  };
}
