/**
 * A downloaded file's blob, safe to open in this app's origin.
 *
 * A blob takes the Content-Type the server sent, and a blob URL renders in the app's own origin. A
 * file declared as text/html (or SVG, XML…) would run its script as the user who opened it. The
 * types below cannot run script, and they keep their type, so PDFs, photos, audio and office files
 * open exactly as before; anything else becomes application/octet-stream, which the browser
 * downloads instead of rendering.
 */
const INERT_TYPES = [
  /^application\/pdf$/,
  /^image\/(png|jpe?g|gif|webp|bmp|heic|heif)$/,
  /^(audio|video)\/[\w.+-]+$/,
  /^text\/(plain|csv)$/,
  /^application\/(octet-stream|zip|x-zip-compressed|msword|vnd\.ms-[\w.+-]+|vnd\.openxmlformats-officedocument\.[\w.+-]+|acad|dxf|x-dxf|x-dwg|dwg)$/,
  /^image\/vnd\.(dxf|dwg)$/,
];

export const inertBlob = (blob) => {
  if (!(blob instanceof Blob)) return blob;
  const type = (blob.type || '').split(';')[0].trim().toLowerCase();
  return INERT_TYPES.some((pattern) => pattern.test(type))
    ? blob
    : new Blob([blob], { type: 'application/octet-stream' });
};
