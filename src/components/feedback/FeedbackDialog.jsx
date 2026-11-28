import { useEffect, useRef, useState } from 'react';
import { App, Button, Form, Modal, Result } from 'antd';
import FeedbackForm from './FeedbackForm';
import CapturePanel from './CapturePanel';
import { buildIssuePayload } from '../../services/feedback/captureContext';
import { describeSubmitError, loadReporterDetails, submitIssue } from '../../services/feedback/feedbackApi';
import { detectBuildEnvironment } from '../../services/feedback/environment';
import { dataUrlToUploadBlob } from '../../services/feedback/screenshot';
import './feedback.css';

const BUILD_ENVIRONMENT = detectBuildEnvironment();

/** What the "Details sent" panel shows: the captured context, without the user's own text. */
function previewContext(element, details, chosenEnvironment) {
  const { module, moduleSection, pageUrl, context } = buildIssuePayload({
    values: { type: 'BUG', title: '', description: '', priority: 'MEDIUM' },
    element,
  });
  const environment = details.serverEnvironment || chosenEnvironment;
  const reportedBy = details.reporter
    ? { name: details.reporter.name, username: details.reporter.username, role: details.reporter.role, email: details.reporter.email }
    : undefined;
  return JSON.stringify({ environment, reportedBy, module, moduleSection, pageUrl, ...context }, null, 2);
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
  // Who the report will be filed as and the ERP server's environment; asked for once, on first open.
  const [details, setDetails] = useState({ status: 'loading', serverEnvironment: null, reporter: null });
  const detailsRequested = useRef(false);

  useEffect(() => {
    if (!open || detailsRequested.current) return;
    detailsRequested.current = true;
    loadReporterDetails()
      .then(({ environment, reporter }) => setDetails({ status: 'ready', serverEnvironment: environment, reporter }))
      .catch(() => setDetails({ status: 'failed', serverEnvironment: null, reporter: null }));
  }, [open]);

  const submit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // the form shows what is missing
    }
    setSubmitting(true);
    try {
      const issue = buildIssuePayload({
        values,
        element: capture?.element,
        environment: { serverEnvironment: details.serverEnvironment, buildEnvironment: BUILD_ENVIRONMENT },
      });
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
          <FeedbackForm form={form} details={details} buildEnvironment={BUILD_ENVIRONMENT} />
          <CapturePanel
            capture={capture}
            busy={busy}
            annotatorRef={annotatorRef}
            contextPreview={() => previewContext(capture?.element, details, form.getFieldValue('environment'))}
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
