import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { App, Button, Tooltip } from 'antd';
import { BugOutlined } from '@ant-design/icons';
import { isFeedbackConfigured } from '../../services/feedback/feedbackConfig';

// Everything but the button loads the first time someone uses it (dialog, annotator, picker, screenshot),
// so the widget adds next to nothing to the app's initial bundle.
const FeedbackDialog = lazy(() => import('./FeedbackDialog'));
const loadCaptureTools = () => Promise.all([
  import('./elementPicker'),
  import('../../services/feedback/elementMetadata'),
  import('../../services/feedback/screenshot'),
]).then(([picker, metadata, screenshot]) => ({
  startElementPicker: picker.startElementPicker,
  describeElement: metadata.describeElement,
  captureViewport: screenshot.captureViewport,
}));

/** Same value as screenshot.js IGNORE_ATTR, repeated so the button does not pull that module in. */
const IGNORE_ATTR = 'data-feedback-ignore';


const ignoreProps = { [IGNORE_ATTR]: '' };

// Above the Laya AI launcher (right 24, bottom 24, 60px) and below its panel and antd's overlays.
const LAUNCHER_STYLE = { position: 'fixed', right: 24, bottom: 100, zIndex: 998 };

let captureCounter = 0;

const newSubmissionKey = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

/** Lets the dialog's closing animation finish so it is not in the screenshot. */
const afterDialogCloses = () =>
  new Promise((resolve) => {
    setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 350);
  });

/** A red box around the picked element, as the first (removable) annotation. */
function highlightFor(element, pixelRatio) {
  if (!element?.rect) return [];
  const pad = 4;
  const { x, y, width, height } = element.rect;
  return [{
    type: 'rect',
    x: (x - pad) * pixelRatio,
    y: (y - pad) * pixelRatio,
    w: (width + pad * 2) * pixelRatio,
    h: (height + pad * 2) * pixelRatio,
  }];
}

/**
 * The floating "Report a problem" button and its dialog. Owns the screenshot, the selected element and
 * the idempotency key; the dialog owns the form and stays mounted once opened, so nothing typed is lost
 * while the dialog is closed to pick an element or take a screenshot.
 */
const FeedbackWidget = () => {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null); // 'picking' | 'capturing' | null
  const [capture, setCapture] = useState(null); // { key, dataUrl, pixelRatio, element, shapes }
  const [submissionKey, setSubmissionKey] = useState(newSubmissionKey);
  const [loaded, setLoaded] = useState(false); // the dialog's code is fetched on first open, then kept
  const stopPickerRef = useRef(null);

  useEffect(() => () => stopPickerRef.current?.(), []);

  const takeScreenshot = useCallback(async (element) => {
    setBusy('capturing');
    await afterDialogCloses();
    try {
      const { captureViewport } = await loadCaptureTools();
      const { dataUrl, pixelRatio } = await captureViewport();
      captureCounter += 1;
      setCapture({ key: captureCounter, dataUrl, pixelRatio, element, shapes: highlightFor(element, pixelRatio) });
    } catch {
      message.warning('The screenshot could not be taken on this screen. You can still send the report.');
      if (element) {
        captureCounter += 1;
        setCapture({ key: captureCounter, dataUrl: null, element, shapes: [] });
      }
    } finally {
      setBusy(null);
      setOpen(true);
    }
  }, [message]);

  const selectElement = useCallback(async () => {
    setOpen(false);
    setBusy('picking');
    const { startElementPicker, describeElement } = await loadCaptureTools();
    stopPickerRef.current = startElementPicker({
      onPick: (node) => {
        stopPickerRef.current = null;
        // Read the element now: the page may re-render before the screenshot is done.
        takeScreenshot(describeElement(node));
      },
      onCancel: () => {
        stopPickerRef.current = null;
        setBusy(null);
        setOpen(true);
      },
    });
  }, [takeScreenshot]);

  const captureScreen = useCallback(() => {
    setOpen(false);
    takeScreenshot(capture?.element ?? null);
  }, [takeScreenshot, capture]);

  const reset = useCallback(() => {
    setCapture(null);
    setSubmissionKey(newSubmissionKey());
  }, []);

  return (
    <>
      {!busy && !open && (
        <div {...ignoreProps} style={LAUNCHER_STYLE}>
          <Tooltip title="Report a problem" placement="left">
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={<BugOutlined />}
              aria-label="Report a problem"
              onClick={() => {
                setLoaded(true);
                setOpen(true);
              }}
            />
          </Tooltip>
        </div>
      )}
      {loaded && (
        <Suspense fallback={null}>
          <FeedbackDialog
            open={open}
            capture={capture}
            busy={busy}
            idempotencyKey={submissionKey}
            onClose={() => setOpen(false)}
            onSelectElement={selectElement}
            onCaptureScreen={captureScreen}
            onRemoveCapture={() => setCapture(null)}
            onSubmitted={() => setSubmissionKey(newSubmissionKey())}
            onReset={reset}
          />
        </Suspense>
      )}
    </>
  );
};

/** Mounted once in MainLayout. Renders nothing where no issue service is configured. */
const FeedbackMount = () => (isFeedbackConfigured() ? <FeedbackWidget /> : null);

export default FeedbackMount;
