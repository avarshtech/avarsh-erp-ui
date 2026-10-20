/**
 * Browsers record WebM/Opus (Chrome, Firefox) or MP4/AAC (Safari); the AI reads WAV, MP3, OGG,
 * AAC or FLAC. Decoding the recording and re-encoding it as 16 kHz mono 16-bit WAV works in every
 * browser, needs no library, and is plenty for speech (about 1.9 MB a minute).
 */
export const SPEECH_SAMPLE_RATE = 16000;

/** A recorded Blob of any format the browser can decode → a 16 kHz mono WAV Blob. */
export async function toSpeechWav(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.max(1, Math.ceil(decoded.duration * SPEECH_SAMPLE_RATE));
    // A one-channel destination down-mixes stereo, and rendering at 16 kHz resamples.
    const offline = new OfflineAudioContext(1, frames, SPEECH_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), SPEECH_SAMPLE_RATE);
  } finally {
    ctx.close?.();
  }
}

/** Float samples in [-1, 1] → a 16-bit PCM mono WAV Blob. */
export function encodeWav(samples, sampleRate) {
  const bytes = samples.length * 2;
  const view = new DataView(new ArrayBuffer(44 + bytes));
  const text = (offset, s) => { for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i)); };

  text(0, 'RIFF');
  view.setUint32(4, 36 + bytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, bytes, true);

  for (let i = 0, offset = 44; i < samples.length; i += 1, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}
