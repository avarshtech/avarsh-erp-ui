import { useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { Form, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { SR_STATUS } from '../../../utils/sampleRequestConstants';
import useSampleMasters from '../../../hooks/useSampleMasters';
import useFeedbackSave from './useFeedbackSave';
import FeedbackImportPanel from './FeedbackImportPanel';
import FeedbackFormFields from './FeedbackFormFields';
import FeedbackRecorded from './FeedbackRecorded';

const { Text } = Typography;

// Rendered as "<label> Comments", so the four keys must always resolve — the
// server set replaces these once the masters cache fills
const DEFAULT_LABELS = { fit: 'Fit', fabricShade: 'Fabric / Shade', measurement: 'Measurement', workmanship: 'Workmanship' };

/**
 * Customer Comments capture — rendered inside the Customer Comments page
 * dialog. Two routes into the same fields: the manual form, or importing the
 * buyer's Excel/PDF comment sheet with a review-before-apply step. Decisions
 * are TERMINAL for this SR — nothing here creates a next round. A rejected
 * sample is re-made by raising a revision from the closed SR on its own screen.
 *
 * Saving is driven from the dialog footer, so the two actions are exposed on a
 * ref instead of being rendered here; the caller awaits them for its own
 * button loading state.
 */
const FeedbackCapture = ({ sr, onChanged, onClose, canUpdate = true, ref }) => {
  const [form] = Form.useForm();
  const { rejectionReasonOptions, feedbackLabels } = useSampleMasters();
  const labels = { ...DEFAULT_LABELS, ...feedbackLabels };
  // Files already in storage come back on the DTO; newly picked ones are Files
  // held here until the save gives them something to hang off
  const [attachments, setAttachments] = useState(sr.feedback?.attachments || []);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [importSource, setImportSource] = useState(sr.feedback?.importSource || null);
  const [unmappedValues, setUnmappedValues] = useState(sr.feedback?.unmappedValues || []);

  const decision = Form.useWatch('decision', form);
  // Comments can be logged from Dispatched, or completed (decision recorded)
  // while the SR rests at Feedback Received — terminal statuses are read-only,
  // as is the whole form for a reader without sample-comments update rights
  // (the dialog footer hides its save actions on the same condition).
  const editable = canUpdate && [SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED].includes(sr.status);

  useEffect(() => {
    const f = sr.feedback;
    if (!f) return;
    form.setFieldsValue({
      date: f.date ? dayjs(f.date) : undefined,
      from: f.from,
      decision: f.decision,
      rejectionReasonCodes: f.rejectionReasonCodes || [],
      fit: f.comments?.fit,
      fabricShade: f.comments?.fabricShade,
      measurement: f.comments?.measurement,
      workmanship: f.comments?.workmanship,
      additional: f.comments?.additional,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sr.id]);

  const handleApply = useCallback((patch, fileName, unmapped) => {
    form.setFieldsValue(patch);
    setImportSource(fileName);
    setUnmappedValues(unmapped);
  }, [form]);

  // The imported sheet is the source of record, so it is kept as a real file
  const stageSourceFile = useCallback((file) => {
    setPendingFiles((prev) => (prev.some((f) => f.name === file.name) ? prev : [...prev, file]));
  }, []);

  const { saveDraft, save } = useFeedbackSave({
    sr, form, importSource, unmappedValues, pendingFiles, setPendingFiles, setAttachments, onChanged, onClose,
  });

  // The dialog footer owns the buttons and awaits these for its loading state
  useImperativeHandle(ref, () => ({ saveDraft, save }));

  if (!editable) return <FeedbackRecorded feedback={sr.feedback} labels={labels} />;

  const atFeedbackReceived = sr.status === SR_STATUS.FEEDBACK_RECEIVED;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>{atFeedbackReceived ? 'Customer comments — decision pending' : 'Log customer comments'}</Text>
        <Tag color={atFeedbackReceived ? 'geekblue' : 'cyan'} style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>
          {atFeedbackReceived ? 'Feedback Received · Merchandiser' : 'Dispatched · Merchandiser'}
        </Tag>
      </div>

      <FeedbackImportPanel srId={sr.id} onApply={handleApply} onSourceFile={stageSourceFile} />

      {/* ── Manual form (either route reaches the same fields) ── */}
      <Form form={form} layout="vertical">
        <FeedbackFormFields
          labels={labels}
          decision={decision}
          rejectionReasonOptions={rejectionReasonOptions}
          importSource={importSource}
          attachments={attachments}
          pendingFiles={pendingFiles}
          setPendingFiles={setPendingFiles}
        />
      </Form>
    </div>
  );
};

export default FeedbackCapture;
