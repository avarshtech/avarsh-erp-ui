import { useRef, useState } from 'react';
import { App, Button, Form, Modal, Result } from 'antd';
import FeedbackForm from './FeedbackForm';
import CapturePanel from './CapturePanel';
import { buildIssuePayload } from '../../services/feedback/captureContext';
import { describeSubmitError, submitIssue } from '../../services/feedback/feedbackApi';
import { dataUrlToUploadBlob } from '../../services/feedback/screenshot';
import './feedback.css';

/** What the "Details sent" panel shows: the captured context, without the user's own text. */
function previewContext(element) {
  const { module, moduleSection, pageUrl, context } = buildIssuePayload({
    values: { type: 'BUG', title: '', description: '', priority: 'MEDIUM' },
    element,
  });
  return JSON.stringify({ module, moduleSection, pageUrl, ...context }, null, 2);
}

/**
 * The report dialog. FeedbackWidget keeps it mounted once it has been opened, so closing it to pick an
 * element or take a screenshot keeps everything the user has typed; the screenshot and selected element
 * are FeedbackWidget's.
 */
const FeedbackDialog = ({
  open, capture, busy, idempotencyKey,
  onClose, onSelectElement, onCaptureScreen, onRemoveCapture, onSubmitted, onReset,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const annotatorRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // the form shows what is missing
    }
    setSubmitting(true);
    try {
      const issue = buildIssuePayload({ values, element: capture?.element });
      let screenshot;
      let annotatedScreenshot;
      if (capture?.dataUrl) {
        screenshot = await dataUrlToUploadBlob(capture.dataUrl);
        if (annotatorRef.current?.hasEdits()) annotatedScreenshot = await annotatorRef.current.toBlob();
      }
      const created = await submitIssue({ issue, screenshot, annotatedScreenshot, idempotencyKey });
      setResult(created);
      onSubmitted();
    } catch (error) {
      message.error(describeSubmitError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = () => {
    form.resetFields();
    setResult(null);
    onReset();
  };

  const close = () => {
    if (result) startOver();
    onClose();
  };

  const reportAnother = startOver;

  const footer = result
    ? null
    : [
      <Button key="cancel" onClick={close} disabled={submitting}>Cancel</Button>,
      <Button key="send" type="primary" onClick={submit} loading={submitting} disabled={Boolean(busy)}>
        Send report
      </Button>,
    ];

  return (
    <Modal
      open={open}
      title={result ? null : 'Report a problem'}
      onCancel={close}
      footer={footer}
      width={760}
      maskClosable={false}
      keyboard={!submitting}
      closable={!submitting}
      className="feedback-dialog"
    >
      {result ? (
        <Result
          status="success"
          title={`Thank you — your report ${result.issueNumber} has been sent`}
          subTitle="The team will look into it. Quote this number if you follow up."
          extra={[
            <Button key="another" onClick={reportAnother}>Report something else</Button>,
            <Button key="close" type="primary" onClick={close}>Close</Button>,
          ]}
        />
      ) : (
        <>
          <FeedbackForm form={form} />
          <CapturePanel
            capture={capture}
            busy={busy}
            annotatorRef={annotatorRef}
            contextPreview={() => previewContext(capture?.element)}
            onSelectElement={onSelectElement}
            onCaptureScreen={onCaptureScreen}
            onRemove={onRemoveCapture}
          />
        </>
      )}
    </Modal>
  );
};

export default FeedbackDialog;
