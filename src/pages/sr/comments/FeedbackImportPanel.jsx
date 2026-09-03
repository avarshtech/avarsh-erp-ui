import { useState } from 'react';
import { App, Card, Upload, Button, Table, Alert, Space, Typography, Steps, Spin } from 'antd';
import { FileSearchOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { parseCommentSheet } from '../../../services/sr/srService';
import { toastUnlessHandled, errorText } from '../../../utils/apiError';
import feedbackImportColumns from './feedbackImportColumns';

const { Text } = Typography;

// The sheet is kept as an attachment as well as read, so this is limited to
// what file storage accepts rather than to everything the extractor can read
const EXTENSIONS = ['xlsx', 'xls', 'pdf', 'png', 'jpg', 'jpeg'];
const extOf = (name) => String(name || '').split('.').pop().toLowerCase();
const usable = (r, ticked) => ticked[r.key] && r.targetField && r.confidence !== 'UNMAPPED';

/**
 * Reading the buyer's comment sheet, with a review step before anything lands.
 *
 * The server extracts and returns candidates; it writes nothing. Apply only
 * fills the form above, so a machine's reading of a buyer's handwriting never
 * reaches the record without someone having agreed to it. Low-confidence and
 * unmapped rows arrive unticked for the same reason.
 */
const FeedbackImportPanel = ({ srId, onApply, onSourceFile }) => {
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [ticked, setTicked] = useState({});
  const [unavailable, setUnavailable] = useState(null);

  const handleParse = async (file) => {
    if (!EXTENSIONS.includes(extOf(file.name))) {
      message.error(`${file.name}: import an Excel, PDF or image comment sheet`);
      return Upload.LIST_IGNORE;
    }
    if (file.size > 5 * 1024 * 1024) { message.error(`${file.name} exceeds 5 MB`); return Upload.LIST_IGNORE; }
    setParsing(true);
    try {
      const result = await parseCommentSheet(srId, file);
      setParsed(result);
      // High + Medium pre-ticked; Low + Unmapped confirmed deliberately
      setTicked(Object.fromEntries(result.rows.map((r) => [r.key, ['HIGH', 'MEDIUM'].includes(r.confidence)])));
      setStep(1);
      setUnavailable(null);
      // The source of record is the file, never the parse — it attaches either way
      onSourceFile?.(file);
    } catch (e) {
      // Nothing to retry against when the extractor is not configured, so it is
      // said once and left on screen; the manual form below still works.
      if (e?.response?.data?.error === 'AI_NOT_CONFIGURED') setUnavailable(errorText(e));
      else toastUnlessHandled(message, e, 'Failed to read the comment sheet');
    } finally { setParsing(false); }
    return false;
  };

  const apply = () => {
    const patch = {};
    parsed.rows.forEach((r) => {
      if (!usable(r, ticked)) return;
      if (r.targetField.startsWith('comments.')) patch[r.targetField.split('.')[1]] = r.value;
      else if (r.targetField === 'date') patch.date = dayjs(r.value);
      else patch[r.targetField] = r.value;
    });
    // Unmapped values are never silently dropped — they ride on the record and
    // are written to the Activity Log at save
    onApply(patch, parsed.fileName, parsed.rows
      .filter((r) => r.confidence === 'UNMAPPED')
      .map((r) => ({ label: r.label, value: Array.isArray(r.value) ? r.value.join(', ') : String(r.value), sourceRef: r.sourceRef })));
    setStep(0);
    message.success(`Applied ${Object.keys(patch).length} field(s) from ${parsed.fileName} — review below, nothing is saved yet`);
  };

  return (
    <Card size="small" style={{ marginBottom: 16 }} title="Import from buyer comment sheet">
      {unavailable && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Import unavailable" description={unavailable} />}
      <Steps size="small" current={step} items={[{ title: 'Upload' }, { title: 'Review & apply' }]} style={{ marginBottom: 12 }} />
      {step === 0 && (
        <Spin spinning={parsing} tip="Reading comment sheet…">
          <Upload.Dragger
            accept=".xlsx,.xls,.pdf,.png,.jpg,.jpeg"
            multiple={false}
            showUploadList={false}
            beforeUpload={handleParse}
            disabled={parsing}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Drop the buyer&apos;s Excel, PDF or scanned comment sheet here</p>
            <p className="ant-upload-hint">.xlsx · .xls · .pdf · .png · .jpg — max 5 MB · nothing is written until you press Apply</p>
          </Upload.Dragger>
        </Spin>
      )}
      {step === 1 && parsed && (
        <>
          <Alert
            type="info"
            showIcon
            icon={<FileSearchOutlined />}
            style={{ marginBottom: 8 }}
            message={`Read ${parsed.fileName} — ${parsed.summary}. Nothing is written to the form until you press Apply.`}
          />
          <Table rowKey="key" size="small" columns={feedbackImportColumns(ticked, setTicked)} dataSource={parsed.rows} pagination={false} scroll={{ x: 800 }} />
          <Text type="secondary" style={{ display: 'block', margin: '8px 0' }}>
            Unticked rows are not applied. Unmapped values stay on the record and in the Activity Log — never silently dropped.
          </Text>
          <Space>
            <Button onClick={() => setStep(0)}>← Back</Button>
            <Button onClick={() => { setParsed(null); setStep(0); }}>Discard extraction</Button>
            <Button type="primary" onClick={apply}>
              Apply {parsed.rows.filter((r) => usable(r, ticked)).length} fields to form ↓
            </Button>
          </Space>
        </>
      )}
    </Card>
  );
};

export default FeedbackImportPanel;
