import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  App, Form, Input, DatePicker, Card, Row, Col, Button, Space, Popconfirm, Tag, Alert,
} from 'antd';
import { SaveOutlined, CheckCircleOutlined, CloseCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  getBatch, createDraftBatch, updateDraftBatch, postBatch, cancelBatch,
} from '../../../services/inventory/openingStockService';
import {
  OPENING_STOCK_BATCH_STATUS,
  OPENING_STOCK_STATUS_COLOR,
  OPENING_STOCK_STATUS_LABEL,
} from '../../../utils/openingStockConstants';
import { hasPermission } from '../../../utils/permissions';
import CsvUploadCard from './CsvUploadCard';
import OpeningStockFabricRollTable from './OpeningStockFabricRollTable';
import OpeningStockAccessoriesItemTable from './OpeningStockAccessoriesItemTable';
import { BatchFormSkeleton } from './OpeningStockSkeletons';

const { TextArea } = Input;

/**
 * Shared batch form — handles both FABRIC and ACCESSORIES via the batchType
 * route segment. Read-only when the loaded batch is POSTED or CANCELLED.
 *
 * State contract:
 *   batch: { id, batchNumber, status, referenceDate, notes, ... } | null
 *   rows:  array of line DTOs (fabric or accessories depending on type)
 */
const OpeningStockBatchForm = ({ batchType }) => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [batch, setBatch] = useState(null);
  const [rows, setRows] = useState([]);

  const isEdit = Boolean(id);
  const status = batch?.status;
  const terminal = status === OPENING_STOCK_BATCH_STATUS.POSTED
                || status === OPENING_STOCK_BATCH_STATUS.CANCELLED;

  // Per-operation gates. Admins get everything via isAdminRole() bypass;
  // staff need each op granted explicitly in role config.
  const canAdd    = hasPermission('opening-stock', 'add');
  const canUpdate = hasPermission('opening-stock', 'update');
  const canPost   = hasPermission('opening-stock', 'post');

  // User can still edit the form only if batch isn't terminal AND they have
  // either add (new batch) or update (existing draft) permission.
  const writable = !terminal && (isEdit ? canUpdate : canAdd);
  const readOnly = !writable;

  // ─── Load existing batch ────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const b = await getBatch(id);
        setBatch(b);
        form.setFieldsValue({
          referenceDate: b.referenceDate ? dayjs(b.referenceDate) : null,
          notes: b.notes,
        });
        setRows(batchType === 'FABRIC' ? (b.fabricLines || []) : (b.accessoriesLines || []));
      } catch (err) {
        message.error(err?.response?.data?.message || 'Failed to load batch');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, batchType, form, message]);

  // ─── Row mutators ───────────────────────────────────────────────────────
  const patchRow = useCallback((idx, changes) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...changes } : r));
  }, []);

  const addRow = useCallback(() => {
    const blank = batchType === 'FABRIC'
      ? { rollNumber: '', quantity: null, unitCost: 0 }
      : { size: '', color: '', quantity: null, unitCost: 0 };
    setRows((prev) => [...prev, blank]);
  }, [batchType]);

  const removeRow = useCallback((idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleCsvLoad = useCallback((lines) => {
    setRows((prev) => [...prev, ...(lines || [])]);
  }, []);

  // ─── Validation ─────────────────────────────────────────────────────────
  const validateRows = useCallback(() => {
    if (rows.length === 0) {
      throw new Error('At least one row is required before saving.');
    }
    rows.forEach((r, i) => {
      if (!r.itemId || !r.itemCode) {
        throw new Error(`Row ${i + 1}: item is required`);
      }
      if (!(Number(r.quantity) > 0)) {
        throw new Error(`Row ${i + 1}: quantity must be > 0`);
      }
      if (batchType === 'FABRIC' && !r.rollNumber) {
        throw new Error(`Row ${i + 1}: roll number is required`);
      }
    });
  }, [rows, batchType]);

  // ─── Save draft / Post / Cancel ────────────────────────────────────────
  const buildPayload = () => {
    const values = form.getFieldsValue();
    return {
      batchType,
      referenceDate: values.referenceDate ? values.referenceDate.format('YYYY-MM-DD') : null,
      notes: values.notes,
      fabricLines: batchType === 'FABRIC' ? rows : [],
      accessoriesLines: batchType === 'ACCESSORIES' ? rows : [],
    };
  };

  const handleSaveDraft = async () => {
    try { validateRows(); } catch (e) { return message.warning(e.message); }
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = batch?.id
        ? await updateDraftBatch(batch.id, payload)
        : await createDraftBatch(payload);
      setBatch(saved);
      setRows(batchType === 'FABRIC' ? (saved.fabricLines || []) : (saved.accessoriesLines || []));
      message.success(`Batch ${saved.batchNumber} saved as draft`);
      if (!batch?.id) {
        navigate(`/inventory/opening-stock/${batchType.toLowerCase()}/${saved.id}`, { replace: true });
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    try { validateRows(); } catch (e) { return message.warning(e.message); }
    modal.confirm({
      title: 'Post Opening Stock Batch?',
      content: (
        <div>
          <p>This will write <strong>{rows.length} row(s)</strong> into the stock register with
             source <strong>OPENING_BALANCE</strong>. Posted batches cannot be reversed through this screen.</p>
          <p>Any corrections must go through Stock Adjustment later.</p>
        </div>
      ),
      okText: 'Post',
      okButtonProps: { type: 'primary' },
      onOk: async () => {
        // Save first to persist any edits, then post.
        setPosting(true);
        try {
          const payload = buildPayload();
          const saved = batch?.id
            ? await updateDraftBatch(batch.id, payload)
            : await createDraftBatch(payload);
          const posted = await postBatch(saved.id);
          setBatch(posted);
          setRows(batchType === 'FABRIC' ? (posted.fabricLines || []) : (posted.accessoriesLines || []));
          message.success(`Batch ${posted.batchNumber} posted — ${posted.totalRows} row(s) added to stock`);
        } catch (err) {
          message.error(err?.response?.data?.message || 'Failed to post batch');
        } finally {
          setPosting(false);
        }
      },
    });
  };

  const handleCancel = async () => {
    if (!batch?.id) return;
    try {
      const cancelled = await cancelBatch(batch.id);
      setBatch(cancelled);
      message.success(`Batch ${cancelled.batchNumber} cancelled`);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to cancel batch');
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  const title = useMemo(() => {
    const typeName = batchType === 'FABRIC' ? 'Fabric' : 'Accessories';
    if (batch?.batchNumber) return `${typeName} Opening Stock — ${batch.batchNumber}`;
    return `New ${typeName} Opening Stock Batch`;
  }, [batch, batchType]);

  // Edit/view mode initial load — show the structural skeleton rather than a
  // bare spinner. Lets the user perceive the form shape while the batch loads.
  if (loading) {
    return <BatchFormSkeleton />;
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={title}
        onBack={() => navigate('/inventory/opening-stock')}
        extra={status && (
          <Tag color={OPENING_STOCK_STATUS_COLOR[status]}>
            {OPENING_STOCK_STATUS_LABEL[status]}
          </Tag>
        )}
      />

      {readOnly && (
        <Alert
          type={status === OPENING_STOCK_BATCH_STATUS.POSTED ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
          message={status === OPENING_STOCK_BATCH_STATUS.POSTED
            ? `This batch has been posted to stock. ${batch?.totalRows} row(s), total qty ${batch?.totalQuantity}, total value ₹${batch?.totalValue}.`
            : 'This batch was cancelled.'}
        />
      )}

      <Card title="Batch Details" size="small" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={readOnly}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="referenceDate"
                label="As-of Date"
                rules={[{ required: true, message: 'Reference date is required' }]}
                initialValue={dayjs()}
              >
                <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={2} placeholder="Optional — source system, stockroom section, etc." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {!readOnly && <CsvUploadCard batchType={batchType} onLoad={handleCsvLoad} disabled={readOnly} />}

      <Card title={`${batchType === 'FABRIC' ? 'Rolls' : 'Variants'}`} size="small" style={{ marginBottom: 16 }}>
        {batchType === 'FABRIC' ? (
          <OpeningStockFabricRollTable
            rows={rows} onChange={patchRow} onAdd={addRow} onRemove={removeRow}
            readOnly={readOnly}
          />
        ) : (
          <OpeningStockAccessoriesItemTable
            rows={rows} onChange={patchRow} onAdd={addRow} onRemove={removeRow}
            readOnly={readOnly}
          />
        )}
      </Card>

      {!readOnly && (
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inventory/opening-stock')}>
            Back
          </Button>
          <Button icon={<SaveOutlined />} onClick={handleSaveDraft} loading={saving}>
            Save Draft
          </Button>
          {canPost && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handlePost}
              loading={posting}
            >
              Post Batch
            </Button>
          )}
          {batch?.id && canUpdate && (
            <Popconfirm
              title="Cancel this draft?"
              description="This marks the batch as cancelled. Rows will not be written to stock."
              okText="Yes, Cancel"
              onConfirm={handleCancel}
            >
              <Button danger icon={<CloseCircleOutlined />}>Cancel Batch</Button>
            </Popconfirm>
          )}
        </Space>
      )}
    </div>
  );
};

export default OpeningStockBatchForm;
