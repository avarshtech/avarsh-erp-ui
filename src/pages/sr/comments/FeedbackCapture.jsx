import { useState, useEffect, useImperativeHandle } from 'react';
import {
  App, Card, Form, DatePicker, Input, Select, Upload, Button, Table, Checkbox,
  Tag, Alert, Space, Typography, Steps, Row, Col, Spin,
} from 'antd';
import { UploadOutlined, FileSearchOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  recordFeedback, saveFeedbackDraft, listRejectionReasons,
  getFeedbackCategoryLabels, parseCommentSheet,
} from '../../../services/sr/srService';
import {
  FEEDBACK_DECISIONS, FEEDBACK_DECISION_OPTIONS, FEEDBACK_DECISION_LABELS,
  SR_STATUS, getSrStatusLabel,
} from '../../../utils/sampleRequestConstants';

const { Text } = Typography;
const { TextArea } = Input;

const CONFIDENCE_TAG = {
  HIGH: { color: 'green', label: 'High' },
  MEDIUM: { color: 'gold', label: 'Medium — mapped' },
  LOW: { color: 'orange', label: 'Low — please confirm' },
  UNMAPPED: { color: 'red', label: 'Unmapped' },
};

const DECISION_TAG_COLOR = {
  [FEEDBACK_DECISIONS.APPROVED]: 'green',
  [FEEDBACK_DECISIONS.APPROVED_WITH_COMMENTS]: 'green',
  [FEEDBACK_DECISIONS.REJECTED]: 'red',
  [FEEDBACK_DECISIONS.REVISION_REQUIRED]: 'orange',
};

const IMPORT_EXTENSIONS = ['xlsx', 'xls', 'pdf'];
const ATTACHMENT_EXTENSIONS = ['xlsx', 'xls', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'];
const extOf = (name) => String(name || '').split('.').pop().toLowerCase();

/**
 * Customer Comments capture (R2) — rendered inside the Customer Comments page
 * dialog. Two routes into the same fields: the manual form, or importing the
 * buyer's Excel/PDF comment sheet with a review-before-apply step. Decisions
 * are TERMINAL — no next round is ever created (the buyer's spec sheet means
 * ~95% of samples are never redone).
 *
 * Saving is driven from the dialog footer, so the two actions are exposed on a
 * ref instead of being rendered here; the caller awaits them for its own
 * button loading state.
 */
const FeedbackCapture = ({ sr, onChanged, onClose, canUpdate = true, ref }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [reasons, setReasons] = useState([]);
  const [labels, setLabels] = useState({ fit: 'Fit', fabricShade: 'Fabric / Shade', measurement: 'Measurement', workmanship: 'Workmanship' });
  const [attachments, setAttachments] = useState(sr.feedback?.attachments || []);
  const [importStep, setImportStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [ticked, setTicked] = useState({});
  const [importSource, setImportSource] = useState(sr.feedback?.importSource || null);
  const [unmappedValues, setUnmappedValues] = useState(sr.feedback?.unmappedValues || []);

  const decision = Form.useWatch('decision', form);
  // Comments can be logged from Dispatched, or completed (decision recorded)
  // while the SR rests at Feedback Received — terminal statuses are read-only,
  // as is the whole form for a reader without sample-comments update rights
  // (the dialog footer hides its save actions on the same condition).
  const editable = canUpdate && [SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED].includes(sr.status);

  useEffect(() => {
    listRejectionReasons().then(setReasons).catch(() => {});
    getFeedbackCategoryLabels(sr.buyerName).then(setLabels).catch(() => {});
  }, [sr.buyerName]);

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

  const handleParse = async (file) => {
    if (!IMPORT_EXTENSIONS.includes(extOf(file.name))) {
      message.error(`${file.name}: only Excel (.xlsx / .xls) or PDF comment sheets can be imported`);
      return Upload.LIST_IGNORE;
    }
    if (file.size > 5 * 1024 * 1024) { message.error(`${file.name} exceeds 5 MB`); return Upload.LIST_IGNORE; }
    setParsing(true);
    try {
      const result = await parseCommentSheet(file);
      setParsed(result);
      // High + Medium pre-ticked; Low + Unmapped confirmed deliberately
      const init = {};
      result.rows.forEach((r) => { init[r.key] = r.confidence === 'HIGH' || r.confidence === 'MEDIUM'; });
      setTicked(init);
      setImportStep(1);
      // The original file always attaches — the source of record is never the parse
      setAttachments((prev) => (prev.some((a) => a.name === file.name)
        ? prev : [...prev, { name: file.name, size: file.size, type: file.type, sourceOfImport: true }]));
    } catch (e) { message.error(e.message || 'Failed to parse'); } finally { setParsing(false); }
    return false;
  };

  const applyExtraction = () => {
    const patch = {};
    parsed.rows.forEach((r) => {
      if (!ticked[r.key] || !r.targetField || r.confidence === 'UNMAPPED') return;
      if (r.targetField.startsWith('comments.')) patch[r.targetField.split('.')[1]] = r.value;
      else if (r.targetField === 'date') patch.date = dayjs(r.value);
      else patch[r.targetField] = r.value;
    });
    form.setFieldsValue(patch);
    setImportSource(parsed.fileName);
    // Unmapped values are never silently dropped — retained on the record and
    // written to the Activity Log at save
    setUnmappedValues(parsed.rows
      .filter((r) => r.confidence === 'UNMAPPED')
      .map((r) => ({ label: r.label, value: Array.isArray(r.value) ? r.value.join(', ') : String(r.value), sourceRef: r.sourceRef })));
    setImportStep(0);
    message.success(`Applied ${Object.keys(patch).length} field(s) from ${parsed.fileName} — review below, nothing is saved yet`);
  };

  const buildDto = (v) => ({
    date: v.date ? v.date.format('YYYY-MM-DD') : null,
    from: v.from || '',
    decision: v.decision || null,
    rejectionReasonCodes: v.rejectionReasonCodes || [],
    comments: {
      fit: v.fit || '', fabricShade: v.fabricShade || '', measurement: v.measurement || '',
      workmanship: v.workmanship || '', additional: v.additional || '',
    },
    attachments,
    importSource,
    unmappedValues,
  });

  const handleSaveDraft = async () => {
    try {
      await saveFeedbackDraft(sr.id, buildDto(form.getFieldsValue()));
      message.success('Comment record saved — status unchanged');
      onChanged?.();
    } catch (e) {
      message.error(e.message || 'Failed to save');
    }
  };

  // Decisions are terminal (R2) — no round creation, so no special confirm
  const handleSave = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }
    try {
      const { sampleRequest } = await recordFeedback(sr.id, buildDto(values));
      message.success(`Comments saved — ${sampleRequest.srNo} is now ${getSrStatusLabel(sampleRequest.status)}`);
      onChanged?.();
      onClose?.();
    } catch (e) { message.error(e.message || 'Failed to save comments'); }
  };

  // The dialog footer owns the buttons and awaits these for its loading state
  useImperativeHandle(ref, () => ({ saveDraft: handleSaveDraft, save: handleSave }));

  // Read-only rendering once a terminal decision is committed
  if (!editable) {
    const f = sr.feedback;
    if (!f) return <Text type="secondary">No customer comments were recorded for this sample request.</Text>;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong>Recorded Feedback</Text>
          <Tag color={DECISION_TAG_COLOR[f.decision] || 'default'} style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>
            {FEEDBACK_DECISION_LABELS[f.decision] || 'Draft — decision pending'}
          </Tag>
        </div>
        <Row gutter={[16, 8]}>
          <Col xs={12} sm={6}><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Received</Text><Text strong>{f.date}</Text></Col>
          <Col xs={12} sm={6}><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>From</Text><Text strong>{f.from}</Text></Col>
          {(f.rejectionReasonCodes || []).length > 0 && (
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Reason Codes</Text>
              {f.rejectionReasonCodes.map((c) => <Tag key={c}>{c.replace(/_/g, ' ')}</Tag>)}
            </Col>
          )}
        </Row>
        {Object.entries(f.comments || {}).filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ marginTop: 8 }}>
            <Text strong>{labels[k] || (k === 'additional' ? 'Additional' : k)}: </Text><Text>{v}</Text>
          </div>
        ))}
        {(f.attachments || []).length > 0 && (
          <div style={{ marginTop: 8 }}>
            {f.attachments.map((a) => (
              <Tag key={a.name}>{a.name}{a.sourceOfImport ? ' · source of import' : ''}</Tag>
            ))}
          </div>
        )}
      </div>
    );
  }

  const reviewColumns = [
    {
      title: 'Use', key: 'use', width: 50,
      render: (_, r) => (
        <Checkbox
          checked={Boolean(ticked[r.key])}
          disabled={r.confidence === 'UNMAPPED'}
          onChange={(e) => setTicked((s) => ({ ...s, [r.key]: e.target.checked }))}
        />
      ),
    },
    { title: 'Target field', dataIndex: 'label', key: 'label', width: 170 },
    {
      title: 'Extracted value', dataIndex: 'value', key: 'value', ellipsis: true,
      render: (v) => (Array.isArray(v) ? v.map((x) => <Tag key={x}>{x.replace(/_/g, ' ')}</Tag>) : String(v)),
    },
    { title: 'Source in file', dataIndex: 'sourceRef', key: 'sourceRef', width: 220, ellipsis: true, render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
    {
      title: 'Confidence', dataIndex: 'confidence', key: 'confidence', width: 165,
      render: (c) => {
        const cfg = CONFIDENCE_TAG[c];
        return <Tag color={cfg.color} style={{ whiteSpace: 'nowrap' }}>{cfg.label}</Tag>;
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>{sr.status === SR_STATUS.FEEDBACK_RECEIVED ? 'Customer comments — decision pending' : 'Log customer comments'}</Text>
        <Tag color={sr.status === SR_STATUS.FEEDBACK_RECEIVED ? 'geekblue' : 'cyan'} style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>
          {sr.status === SR_STATUS.FEEDBACK_RECEIVED ? 'Feedback Received · Merchandiser' : 'Dispatched · Merchandiser'}
        </Tag>
      </div>

      {/* ── Importer ── */}
      <Card size="small" style={{ marginBottom: 16 }} title="Import from buyer comment sheet">
        <Steps
          size="small"
          current={importStep}
          items={[{ title: 'Upload' }, { title: 'Review & apply' }]}
          style={{ marginBottom: 12 }}
        />
        {importStep === 0 && (
          <Spin spinning={parsing} tip="Parsing comment sheet…">
            <Upload.Dragger
              accept=".xlsx,.xls,.pdf"
              multiple={false}
              showUploadList={false}
              beforeUpload={handleParse}
              disabled={parsing}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Drop the buyer&apos;s Excel or PDF comment sheet here</p>
              <p className="ant-upload-hint">.xlsx · .xls · .pdf — max 5 MB · scanned PDFs are OCR&apos;d · nothing is written until you press Apply</p>
            </Upload.Dragger>
          </Spin>
        )}
        {importStep === 1 && parsed && (
          <>
            <Alert
              type="info" showIcon icon={<FileSearchOutlined />}
              style={{ marginBottom: 8 }}
              message={`Parsed ${parsed.fileName} — ${parsed.summary}. Nothing is written to the form until you press Apply.`}
            />
            <Table rowKey="key" size="small" columns={reviewColumns} dataSource={parsed.rows} pagination={false} scroll={{ x: 800 }} />
            <Text type="secondary" style={{ display: 'block', margin: '8px 0' }}>
              Unticked rows are not applied. Unmapped values stay on the attachment record and in the Activity Log — never silently dropped.
            </Text>
            <Space>
              <Button onClick={() => setImportStep(0)}>← Back</Button>
              <Button onClick={() => { setParsed(null); setImportStep(0); }}>Discard extraction</Button>
              <Button type="primary" onClick={applyExtraction}>
                Apply {parsed.rows.filter((r) => ticked[r.key] && r.confidence !== 'UNMAPPED').length} fields to form ↓
              </Button>
            </Space>
          </>
        )}
      </Card>

      {/* ── Manual form (either route reaches the same fields) ── */}
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="date" label={<>{'Feedback Received Date'}{importSource && <Tag style={{ marginInlineStart: 6 }} color="blue">imported</Tag>}</>} rules={[{ required: true, message: 'Enter received date' }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="from" label="Feedback From" rules={[{ required: true, message: 'Buyer contact name' }]}>
              <Input placeholder="Buyer contact name" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="decision" label="Overall Decision" rules={[{ required: true, message: 'Select decision' }]}>
              <Select options={FEEDBACK_DECISION_OPTIONS} placeholder="Select decision" />
            </Form.Item>
          </Col>
        </Row>
        {[FEEDBACK_DECISIONS.REJECTED, FEEDBACK_DECISIONS.REVISION_REQUIRED].includes(decision) && (
          <Form.Item name="rejectionReasonCodes" label="Rejection Reason Codes">
            <Select
              mode="multiple"
              placeholder="Multi-select from Master Data"
              options={reasons.map((r) => ({ value: r.code, label: r.label }))}
            />
          </Form.Item>
        )}
        <Row gutter={16}>
          <Col xs={24} sm={12}><Form.Item name="fit" label={`${labels.fit} Comments`}><TextArea rows={2} /></Form.Item></Col>
          <Col xs={24} sm={12}><Form.Item name="fabricShade" label={`${labels.fabricShade} Comments`}><TextArea rows={2} /></Form.Item></Col>
          <Col xs={24} sm={12}><Form.Item name="measurement" label={`${labels.measurement} Comments`}><TextArea rows={2} /></Form.Item></Col>
          <Col xs={24} sm={12}><Form.Item name="workmanship" label={`${labels.workmanship} Comments`}><TextArea rows={2} /></Form.Item></Col>
        </Row>
        <Form.Item name="additional" label="Additional Comments"><TextArea rows={1} placeholder="Anything not covered above…" /></Form.Item>
        <Form.Item label="Attachments" extra="Buyer comment sheets or annotated photos · Excel, PDF or images · max 5 MB per file">
          <Upload
            multiple
            accept=".xlsx,.xls,.pdf,image/*"
            beforeUpload={(file) => {
              if (!ATTACHMENT_EXTENSIONS.includes(extOf(file.name))) {
                message.error('Only Excel, PDF or image files are allowed');
                return Upload.LIST_IGNORE;
              }
              if (file.size > 5 * 1024 * 1024) { message.error(`${file.name} exceeds 5 MB`); return Upload.LIST_IGNORE; }
              setAttachments((prev) => [...prev, { name: file.name, size: file.size, type: file.type }]);
              return false;
            }}
            onRemove={(file) => setAttachments((prev) => prev.filter((f) => f.name !== file.name))}
            fileList={attachments.map((f, i) => ({ uid: String(i), name: f.name, status: 'done' }))}
          >
            <Button icon={<UploadOutlined />}>Add attachment</Button>
          </Upload>
        </Form.Item>
      </Form>
    </div>
  );
};

export default FeedbackCapture;
