import { useCallback, useState } from 'react';

/**
 * Resolves once the browser has painted the current frame. A button set to `loading` before awaiting this shows its
 * spinner before a heavy synchronous update (expanding or recalculating a large grid) holds the main thread.
 */
export const afterPaint = () => new Promise((resolve) => { requestAnimationFrame(() => setTimeout(resolve, 0)); });

/**
 * [busy, run] for work done in the browser that the user waits on: `run(fn)` turns `busy` on, lets the spinner
 * paint, runs `fn` and turns `busy` off with its result — so the button spins until the grid has re-rendered.
 * `run` returns a promise, so a Popconfirm `onConfirm` or a modal `onOk` that returns it spins its own OK button too.
 */
const usePaintedWork = () => {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn) => {
    setBusy(true);
    await afterPaint();
    try {
      return fn();
    } finally {
      setBusy(false);
    }
  }, []);
  return [busy, run];
};

export default usePaintedWork;
