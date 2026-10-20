import { useCallback, useEffect, useRef, useState } from 'react';
import { toSpeechWav } from '../utils/wavEncoder';

const IDLE = { status: 'idle', seconds: 0, level: 0, error: null };

const micError = (err) => {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return 'The microphone is blocked. Allow it for this site in the browser, then try again.';
  }
  if (err?.name === 'NotFoundError') return 'No microphone was found on this device.';
  return 'The microphone could not be started.';
};

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

/**
 * Records from the microphone and hands back a 16 kHz mono WAV file (see utils/wavEncoder).
 * Shared by the costing capture and the Help Genie.
 *
 *   const rec = useWavRecorder({ maxSeconds: 300, onRecorded: (file, seconds) => … });
 *   rec.start(); rec.stop(); rec.cancel();   // rec.status: idle | recording | processing
 *
 * It stops by itself at maxSeconds and delivers the file exactly as a manual stop does.
 * `level` (0–1) drives a meter, so the speaker can see the microphone is hearing them.
 */
export default function useWavRecorder({ maxSeconds = 300, onRecorded } = {}) {
  const [state, setState] = useState(IDLE);
  const session = useRef(null);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => { onRecordedRef.current = onRecorded; }, [onRecorded]);

  const release = useCallback((s) => {
    cancelAnimationFrame(s.raf);
    clearInterval(s.timer);
    s.stream.getTracks().forEach((t) => t.stop());
    s.audio?.close?.();
    if (session.current === s) session.current = null;
  }, []);

  // Leaving the page mid-recording drops the recording and frees the microphone.
  useEffect(() => () => {
    const s = session.current;
    if (!s) return;
    s.discard = true;
    if (s.recorder.state !== 'inactive') s.recorder.stop();
    release(s);
  }, [release]);

  const meter = (s) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audio = new AudioCtx();
      const analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      audio.createMediaStreamSource(s.stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let last = 0;
      const tick = (t) => {
        if (t - last > 100) {
          last = t;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          data.forEach((v) => { const x = (v - 128) / 128; sum += x * x; });
          const level = Math.min(1, Math.sqrt(sum / data.length) * 4);
          setState((st) => (st.status === 'recording' ? { ...st, level } : st));
        }
        s.raf = requestAnimationFrame(tick);
      };
      s.audio = audio;
      s.raf = requestAnimationFrame(tick);
    } catch {
      // The meter is a nicety; recording works without it.
    }
  };

  const start = useCallback(async () => {
    if (session.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState({ ...IDLE, error: 'This browser cannot record here. Recording needs a secure (https) page — type it instead.' });
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      setState({ ...IDLE, error: micError(err) });
      return;
    }

    const recorder = new MediaRecorder(stream);
    const s = { stream, recorder, chunks: [], startedAt: Date.now(), discard: false, raf: 0, timer: 0, audio: null };
    session.current = s;
    recorder.ondataavailable = (e) => { if (e.data?.size) s.chunks.push(e.data); };
    recorder.onstop = async () => {
      const seconds = Math.round((Date.now() - s.startedAt) / 1000);
      const type = recorder.mimeType || s.chunks[0]?.type || 'audio/webm';
      release(s);
      if (s.discard) return;
      setState({ ...IDLE, status: 'processing', seconds });
      try {
        const wav = await toSpeechWav(new Blob(s.chunks, { type }));
        setState(IDLE);
        onRecordedRef.current?.(new File([wav], `voice-note-${stamp()}.wav`, { type: 'audio/wav' }), seconds);
      } catch {
        setState({ ...IDLE, error: 'The recording could not be prepared. Try again, or type it instead.' });
      }
    };

    meter(s);
    s.timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - s.startedAt) / 1000);
      setState((st) => (st.status === 'recording' ? { ...st, seconds } : st));
      if (seconds >= maxSeconds && recorder.state !== 'inactive') recorder.stop();
    }, 250);
    recorder.start(1000);
    setState({ ...IDLE, status: 'recording' });
  }, [maxSeconds, release]);

  const stop = useCallback(() => {
    const s = session.current;
    if (s && s.recorder.state !== 'inactive') s.recorder.stop();
  }, []);

  const cancel = useCallback(() => {
    const s = session.current;
    if (s) {
      s.discard = true;
      if (s.recorder.state !== 'inactive') s.recorder.stop();
      release(s);
    }
    setState(IDLE);
  }, [release]);

  return { ...state, maxSeconds, start, stop, cancel };
}
