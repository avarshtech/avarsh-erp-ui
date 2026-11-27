/**
 * A screenshot of what the user is looking at (the visible part of the page), rendered from the DOM with
 * html-to-image. The feedback widget's own UI is left out, and password fields and anything marked
 * data-feedback-redact are blacked out before the image exists anywhere but this canvas.
 */
/** Put this attribute on any node the screenshot must not show (the widget's own UI does). */
export const IGNORE_ATTR = 'data-feedback-ignore';
const REDACT_SELECTOR = 'input[type="password"], [data-feedback-redact]';
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

function maskSensitive(canvas, pixelRatio) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  document.querySelectorAll(REDACT_SELECTOR).forEach((element) => {
    const r = element.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      ctx.fillRect(r.x * pixelRatio, r.y * pixelRatio, r.width * pixelRatio, r.height * pixelRatio);
    }
  });
}

/**
 * @returns {Promise<{dataUrl: string, pixelRatio: number}>} PNG data URL of the viewport.
 */
export async function captureViewport() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  // Loaded on first use, so it stays out of the app's initial bundle.
  const { toCanvas } = await import('html-to-image');
  const canvas = await toCanvas(document.body, {
    width,
    height,
    pixelRatio,
    skipFonts: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
    style: { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)` },
    filter: (node) => !(node instanceof Element && node.hasAttribute(IGNORE_ATTR)),
  });
  maskSensitive(canvas, pixelRatio);
  return { dataUrl: canvas.toDataURL('image/png'), pixelRatio };
}

const canvasBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the screenshot'))), type, quality);
  });

/** PNG, or JPEG when the PNG would be too big to upload. */
export async function canvasToUploadBlob(canvas) {
  const png = await canvasBlob(canvas, 'image/png');
  if (png.size <= MAX_UPLOAD_BYTES) return png;
  return canvasBlob(canvas, 'image/jpeg', 0.8);
}

export async function dataUrlToUploadBlob(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvasToUploadBlob(canvas);
}
