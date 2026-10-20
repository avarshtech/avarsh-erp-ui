import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal, Space, Spin, Upload } from 'antd';
import { assetCodeFrom } from '../../../utils/qrSvg';

/**
 * Reading an asset label with the camera.
 *
 * <p>The labels this module prints are QR codes carrying a URL. A laser
 * barcode scanner cannot read a QR at all, and the browser's own
 * BarcodeDetector is not implemented in Chrome or Edge on Windows, so the
 * decoder is a library - loaded only when somebody opens this dialog, because
 * nobody else in the app pays for a decoder they never use.</p>
 *
 * <p>The camera needs a secure context: HTTPS, or localhost. Over a LAN address
 * the browser refuses access and says nothing useful, so that case is named
 * here rather than left as a dead button, and uploading a photo still works.</p>
 */
const QrScanDialog = ({ open, onClose, onRead }) => {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const readerRef = useRef(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  const secure = window.isSecureContext;

  /** Stop the camera. Called on close, on a successful read, and on unmount. */
  const stop = useCallback(() => {
    try { controlsRef.current?.stop(); } catch { /* already gone */ }
    controlsRef.current = null;
  }, []);

  const accept = useCallback((text) => {
    const code = assetCodeFrom(text);
    if (!code) return;
    stop();
    onRead(code);
  }, [onRead, stop]);

  useEffect(() => {
    if (!open || !secure) return undefined;
    let cancelled = false;

    (async () => {
      setStarting(true);
      setError(null);
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (cancelled) return;
        const reader = new BrowserQRCodeReader();
        readerRef.current = reader;
        // undefined deviceId lets the browser pick, which on a phone is the
        // back camera - the one pointed at the machine.
        controlsRef.current = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => { if (result && !cancelled) accept(result.getText()); },
        );
      } catch (e) {
        if (!cancelled) {
          setError(e?.name === 'NotAllowedError'
            ? 'The browser blocked the camera. Allow it for this site and open this again.'
            : 'No camera could be started. Upload a photo of the label instead.');
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => { cancelled = true; stop(); };
  }, [open, secure, accept, stop]);

  /** Decode a still photo - the way in when there is no usable camera. */
  const readFile = async (file) => {
    setError(null);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      accept(result.getText());
    } catch {
      setError('No QR code could be read in that image. Try a straighter, closer photo.');
    } finally {
      URL.revokeObjectURL(url);
    }
    return false;
  };

  return (
    <Modal
      title="Scan an asset label"
      open={open}
      onCancel={() => { stop(); onClose(); }}
      footer={<Button onClick={() => { stop(); onClose(); }}>Close</Button>}
      destroyOnHidden
    >
      {!secure && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title="The camera needs a secure address"
          description="Browsers only allow the camera over HTTPS or on localhost. Open the deployed site to scan, or upload a photo of the label below."
        />
      )}
      {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={error} />}

      {secure && (
        <Spin spinning={starting} tip="Starting the camera">
          <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
            <video ref={videoRef} style={{ width: '100%', display: 'block' }} muted playsInline />
          </div>
          <p style={{ opacity: 0.65, fontSize: 12, marginTop: 8 }}>
            Hold the label in the frame. It reads on its own — there is nothing to press.
          </p>
        </Spin>
      )}

      <Space style={{ marginTop: 8 }}>
        <Upload accept="image/*" showUploadList={false} beforeUpload={readFile}>
          <Button>Upload a photo of a label</Button>
        </Upload>
      </Space>
    </Modal>
  );
};

export default QrScanDialog;
