import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Card, Form, Input, InputNumber, Select, Table, Space, Tag, Typography, Descriptions, Skeleton, Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import PermissionGuard from '../../../components/PermissionGuard';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import { FormDatePicker } from '../../../components/form';
import useBusyAction from '../../../hooks/useBusyAction';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { useBranch } from '../../../context/BranchContext';
import { getAdjustmentMetaData } from '../../../services/inventory/inventoryService';
import {
  getTransfer, getTransferableItems, createTransfer, updateTransfer, dispatchTransfer, receiveTransfer, cancelTransfer,
} from '../../../services/inventory/stockTransferService';
import { formatNumber } from '../../../utils/formatters';
import AdjustmentFilterCard from '../adjustment/AdjustmentFilterCard';
import { TRANSFER_STATUS, TRANSFER_STATUS_CONFIG, getTransferStatusLabel } from './transferConstants';

const { Text } = Typography;

const errMsg = (e, fallback) => e?.response?.data?.message || e?.message || fallback;

/** A count-sheet row becomes a transfer line: a roll for fabric, a variant aggregate for accessories. */
const toLine = (row, qty) => ({
  key: row.rowId,
  lineType: row.fabricStockId ? 'FABRIC' : 'ACCESSORIES',
  fabricStockId: row.fabricStockId || null,
  itemId: row.itemId,
  size: row.size || null,
  color: row.color || null,
  itemCode: row.variantCode || row.itemCode,
  description: row.itemName,
  variantLabel: row.variantLabel,
  rollNumber: row.rollNumber,
  uom: row.uom,
  availableQty: row.inStockQty,
  qty,
});

/**
 * New / edit / view of one inter-branch stock transfer.
 *   DRAFT      — header and lines editable; Dispatch moves the goods out.
 *   DISPATCHED — read-only; Receive lands them at the destination.
 *   RECEIVED / CANCELLED — read-only.
 */
const StockTransferForm = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;
  const [form] = Form.useForm();
  const { allowedBranches, branches, effectiveBranchId, loaded } = useBranch();
  const { setBusy, busyProps } = useBusyAction();

  const [record, setRecord] = useState(null);
  const [booting, setBooting] = useState(!isNew);
  const [lines, setLines] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  // picker
  const [metaData, setMetaData] = useState([]);
  const [filter, setFilter] = useState({});
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [pickQty, setPickQty] = useState({});

  const fromBranchId = Form.useWatch('fromBranchId', form);
  const status = record?.status || TRANSFER_STATUS.DRAFT;
  const editable = status === TRANSFER_STATUS.DRAFT;

  const hydrate = useCallback((t) => {
    setRecord(t);
    form.setFieldsValue({
      fromBranchId: t.fromBranchId,
      toBranchId: t.toBranchId,
      transferDate: t.transferDate ? dayjs(t.transferDate) : null,
      challanNo: t.challanNo,
      transporter: t.transporter,
      vehicleNumber: t.vehicleNumber,
      remarks: t.remarks,
    });
    setLines((t.lines || []).map((l) => ({
      key: l.id,
      lineType: l.lineType,
      fabricStockId: l.fabricStockId,
      itemId: l.itemId,
      size: l.size,
      color: l.color,
      itemCode: l.itemCode,
      description: l.description,
      variantLabel: [l.size, l.color].filter(Boolean).join(' / '),
      rollNumber: l.rollNumber,
      uom: l.uom,
      availableQty: l.availableQty,
      qty: Number(l.qty),
    })));
  }, [form]);

  useEffect(() => {
    if (isNew) return;
    getTransfer(id)
      .then(hydrate)
      .catch((e) => { message.error(errMsg(e, 'Stock transfer not found')); navigate('/inventory/transfer'); })
      .finally(() => setBooting(false));
  }, [id, isNew, hydrate, message, navigate]);

  // A new transfer starts from the working branch.
  useEffect(() => {
    if (isNew && loaded && effectiveBranchId != null && form.getFieldValue('fromBranchId') == null) {
      form.setFieldsValue({ fromBranchId: effectiveBranchId, transferDate: dayjs() });
    }
  }, [isNew, loaded, effectiveBranchId, form]);

  useEffect(() => {
    if (!editable) return;
    getAdjustmentMetaData().then(setMetaData).catch(() => message.error('Failed to load categories'));
  }, [editable, message]);

  const loadCandidates = useCallback(async (next) => {
    setFilter(next);
    if (!next.categoryId || fromBranchId == null) { setCandidates([]); return; }
    setCandidatesLoading(true);
    try {
      setCandidates(await getTransferableItems({ ...next, branchId: fromBranchId }));
    } catch (e) {
      message.error(errMsg(e, 'Failed to load stock'));
    } finally {
      setCandidatesLoading(false);
    }
  }, [fromBranchId, message]);

  // Changing the source store throws away what was picked from the old one.
  const onFromChange = () => {
    setLines([]);
    setCandidates([]);
    setFilter({});
    setPickQty({});
    setIsDirty(true);
  };

  const addLine = (row) => {
    const qty = Number(pickQty[row.rowId] ?? row.inStockQty);
    if (!(qty > 0)) { message.warning('Enter a quantity to transfer'); return; }
    if (qty > Number(row.inStockQty)) { message.warning(`Only ${formatNumber(row.inStockQty, 3)} ${row.uom || ''} available`); return; }
    setLines((prev) => [...prev.filter((l) => l.key !== row.rowId), toLine(row, qty)]);
    setIsDirty(true);
  };

  const setLineQty = (key, qty) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty } : l)));
    setIsDirty(true);
  };

  const removeLine = (key) => { setLines((prev) => prev.filter((l) => l.key !== key)); setIsDirty(true); };

  const buildPayload = async () => {
    const v = await form.validateFields();
    if (lines.length === 0) throw new Error('Add at least one line');
    const bad = lines.find((l) => !(Number(l.qty) > 0) || (l.availableQty != null && Number(l.qty) > Number(l.availableQty)));
    if (bad) throw new Error(`Check the quantity on ${bad.rollNumber || bad.itemCode}`);
    return {
      fromBranchId: v.fromBranchId,
      toBranchId: v.toBranchId,
      transferDate: v.transferDate?.format('YYYY-MM-DD'),
      challanNo: v.challanNo,
      transporter: v.transporter,
      vehicleNumber: v.vehicleNumber,
      remarks: v.remarks,
      lines: lines.map((l) => ({
        lineType: l.lineType, fabricStockId: l.fabricStockId, itemId: l.itemId, size: l.size, color: l.color, qty: l.qty,
      })),
    };
  };

  const save = async () => {
    setBusy('save');
    try {
      const payload = await buildPayload();
      const saved = isNew ? await createTransfer(payload) : await updateTransfer(id, payload);
      clearDirty();
      setIsDirty(false);
      message.success(`${saved.transferNo} saved`);
      if (isNew) navigate(`/inventory/transfer/${saved.id}`, { replace: true });
      else hydrate(saved);
    } catch (e) {
      if (!e?.errorFields) message.error(errMsg(e, 'Save failed'));
    } finally { setBusy(null); }
  };

  const transition = (key, fn, title, content, done) => {
    modal.confirm({
      title, content, okText: title, cancelText: 'Back',
      onOk: async () => {
        setBusy(key);
        try {
          const saved = await fn(id);
          hydrate(saved);
          message.success(`${saved.transferNo} ${done}`);
        } catch (e) {
          message.error(errMsg(e, `${title} failed`));
        } finally { setBusy(null); }
      },
    });
  };

  const onDispatch = async () => {
    if (isDirty) { message.warning('Save the draft before dispatching'); return; }
    transition('dispatch', dispatchTransfer, 'Dispatch',
      `Move ${lines.length} line(s) out of ${branchName(record?.fromBranchId)}? Stock there is reduced now.`, 'dispatched');
  };
  const onReceive = () => transition('receive', receiveTransfer, 'Receive',
    `Land ${lines.length} line(s) at ${branchName(record?.toBranchId)}? New lots are created there.`, 'received');

  const onCancel = () => {
    let reason = '';
    modal.confirm({
      title: 'Cancel transfer',
      okText: 'Cancel transfer', okButtonProps: { danger: true }, cancelText: 'Back',
      content: (
        <div style={{ marginTop: 12 }}>
          {status === TRANSFER_STATUS.DISPATCHED && <Text type="secondary">The goods return to the lots they left at {branchName(record?.fromBranchId)}.</Text>}
          <Input.TextArea aria-label="Reason" rows={3} maxLength={500} placeholder="Reason" style={{ marginTop: 8 }} onChange={(e) => { reason = e.target.value; }} />
        </div>
      ),
      onOk: async () => {
        setBusy('cancel');
        try {
          const saved = await cancelTransfer(id, reason);
          hydrate(saved);
          message.success(`${saved.transferNo} cancelled`);
        } catch (e) {
          message.error(errMsg(e, 'Cancel failed'));
        } finally { setBusy(null); }
      },
    });
  };

  const branchName = (bid) => branches.find((b) => b.id === bid)?.branchName || '—';
  const fromOptions = useMemo(() => allowedBranches.map((b) => ({ value: b.id, label: b.branchName })), [allowedBranches]);
  const toOptions = useMemo(() => branches.filter((b) => b.id !== fromBranchId).map((b) => ({ value: b.id, label: b.branchName })), [branches, fromBranchId]);
  const totalQty = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty) || 0), 0), [lines]);

  const candidateColumns = [
    { title: 'Item', dataIndex: 'itemCode', width: 150, render: (v, r) => r.variantCode || v },
    { title: 'Description', dataIndex: 'itemName', width: 220, ellipsis: true },
    { title: 'Variant', dataIndex: 'variantLabel', width: 150, render: (v) => v || '—' },
    { title: 'Roll #', dataIndex: 'rollNumber', width: 130, render: (v) => v || <Tag>lot</Tag> },
    { title: 'Available', dataIndex: 'inStockQty', width: 120, align: 'right', render: (q, r) => `${formatNumber(q, 3)} ${r.uom || ''}` },
    {
      title: 'Transfer Qty', key: 'qty', width: 150,
      render: (_, r) => (
        <InputNumber
          aria-label={`Quantity for ${r.rollNumber || r.itemCode}`}
          min={0} max={Number(r.inStockQty)} precision={3} style={{ width: '100%' }}
          value={pickQty[r.rowId] ?? Number(r.inStockQty)}
          onChange={(v) => setPickQty((p) => ({ ...p, [r.rowId]: v }))}
        />
      ),
    },
    {
      title: '', key: 'add', width: 90, align: 'center',
      render: (_, r) => {
        const picked = lines.some((l) => l.key === r.rowId);
        return <ActionButton action="create" text={picked ? 'Update' : 'Add'} size="small" onClick={() => addLine(r)} />;
      },
    },
  ];

  const lineColumns = [
    { title: 'Type', dataIndex: 'lineType', width: 110, render: (t) => <Tag color={t === 'FABRIC' ? 'blue' : 'purple'}>{t === 'FABRIC' ? 'Fabric' : 'Accessories'}</Tag> },
    { title: 'Item', dataIndex: 'itemCode', width: 150 },
    { title: 'Description', dataIndex: 'description', width: 220, ellipsis: true },
    { title: 'Variant', dataIndex: 'variantLabel', width: 150, render: (v) => v || '—' },
    { title: 'Roll #', dataIndex: 'rollNumber', width: 130, render: (v) => v || '—' },
    ...(editable ? [{ title: 'Available', dataIndex: 'availableQty', width: 120, align: 'right', render: (q, r) => (q == null ? '—' : `${formatNumber(q, 3)} ${r.uom || ''}`) }] : []),
    {
      title: 'Qty', dataIndex: 'qty', width: 150, align: 'right',
      render: (q, r) => (editable ? (
        <InputNumber
          aria-label={`Quantity for ${r.rollNumber || r.itemCode}`}
          min={0.001} max={r.availableQty != null ? Number(r.availableQty) : undefined} precision={3} style={{ width: '100%' }}
          value={q} onChange={(v) => setLineQty(r.key, v)}
        />
      ) : <Text strong>{formatNumber(q, 3)} {r.uom || ''}</Text>),
    },
    ...(editable ? [{ title: '', key: 'remove', width: 70, align: 'center', render: (_, r) => <ActionButton action="delete" size="small" onClick={() => removeLine(r.key)} /> }] : []),
  ];

  const title = isNew ? 'New Stock Transfer' : (
    <Space size={12} wrap>
      <span>Stock Transfer</span>
      {record?.transferNo && <Tag color="processing" style={{ margin: 0, fontSize: 13, height: 26, display: 'inline-flex', alignItems: 'center' }}>{record.transferNo}</Tag>}
      {record && <StatusTag status={record.status} config={TRANSFER_STATUS_CONFIG} getLabel={getTransferStatusLabel} />}
    </Space>
  );

  if (booting) {
    return <div className="animate-fade-in-up"><Card><Skeleton active paragraph={{ rows: 6 }} /></Card></div>;
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={title} backPath="/inventory/transfer" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        {editable && (
          <PermissionGuard module="inventory-transfer" operation={isNew ? 'add' : 'update'}>
            <ActionButton action="save" text={isNew ? 'Save Draft' : 'Save'} {...busyProps('save')} onClick={save} />
          </PermissionGuard>
        )}
        {!isNew && status === TRANSFER_STATUS.DRAFT && (
          <PermissionGuard module="inventory-transfer" operation="dispatch">
            <ActionButton action="send" text="Dispatch" {...busyProps('dispatch', lines.length === 0)} onClick={onDispatch} />
          </PermissionGuard>
        )}
        {status === TRANSFER_STATUS.DISPATCHED && (
          <PermissionGuard module="inventory-transfer" operation="receive">
            <ActionButton action="approve" text="Receive" {...busyProps('receive')} onClick={onReceive} />
          </PermissionGuard>
        )}
        {!isNew && (status === TRANSFER_STATUS.DRAFT || status === TRANSFER_STATUS.DISPATCHED) && (
          <PermissionGuard module="inventory-transfer" operation="cancel">
            <ActionButton action="cancel" text="Cancel" {...busyProps('cancel')} onClick={onCancel} />
          </PermissionGuard>
        )}
      </PageHeader>

      {record && !editable && (
        <Card size="small" style={{ marginBottom: 24 }}>
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="From">{record.fromBranchName}</Descriptions.Item>
            <Descriptions.Item label="To">{record.toBranchName}</Descriptions.Item>
            <Descriptions.Item label="Date">{record.transferDate ? dayjs(record.transferDate).format('DD-MMM-YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Challan #">{record.challanNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Transporter">{record.transporter || '—'}</Descriptions.Item>
            <Descriptions.Item label="Vehicle">{record.vehicleNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="Dispatched">{record.dispatchedOn ? `${dayjs(record.dispatchedOn).format('DD-MMM-YYYY HH:mm')} · ${record.dispatchedByName || ''}` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Received">{record.receivedOn ? `${dayjs(record.receivedOn).format('DD-MMM-YYYY HH:mm')} · ${record.receivedByName || ''}` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Remarks">{record.remarks || '—'}</Descriptions.Item>
            {record.cancelReason && <Descriptions.Item label="Cancel reason" span={3}>{record.cancelReason}</Descriptions.Item>}
          </Descriptions>
        </Card>
      )}

      {editable && (
        <Card title="Transfer" size="small" style={{ marginBottom: 24 }}>
          <Form form={form} layout="vertical" onValuesChange={() => setIsDirty(true)}>
            <Row gutter={24}>
              <Col xs={24} md={8}>
                <Form.Item name="fromBranchId" label="From (source store)" rules={[{ required: true, message: 'Required' }]}>
                  <Select options={fromOptions} placeholder="Select branch" onChange={onFromChange} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="toBranchId" label="To (receiving store)" rules={[{ required: true, message: 'Required' }]}>
                  <Select options={toOptions} placeholder="Select branch" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="transferDate" label="Date" rules={[{ required: true, message: 'Required' }]}><FormDatePicker /></Form.Item>
              </Col>
              <Col xs={24} md={8}><Form.Item name="challanNo" label="Delivery Challan #"><Input maxLength={50} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="transporter" label="Transporter"><Input maxLength={150} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="vehicleNumber" label="Vehicle #"><Input maxLength={50} /></Form.Item></Col>
              <Col xs={24}><Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} maxLength={500} /></Form.Item></Col>
            </Row>
          </Form>
        </Card>
      )}

      {editable && (
        <>
          <AdjustmentFilterCard metaData={metaData} value={filter} onChange={loadCandidates} disabled={fromBranchId == null} />
          <Card title={`Stock at ${branchName(fromBranchId)}`} size="small" style={{ marginBottom: 24 }}>
            <Table
              rowKey="rowId"
              size="small"
              loading={candidatesLoading}
              columns={candidateColumns}
              dataSource={candidates}
              scroll={{ x: 1000 }}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              locale={{ emptyText: filter.categoryId ? 'Nothing in stock for this filter' : 'Pick a category to list what this store holds' }}
            />
          </Card>
        </>
      )}

      <Card
        title={`Lines (${lines.length})`}
        size="small"
        extra={<Text strong>Total {formatNumber(totalQty, 3)}</Text>}
        style={{ marginBottom: 24 }}
      >
        <Table
          rowKey="key"
          size="small"
          columns={lineColumns}
          dataSource={lines}
          scroll={{ x: 1000 }}
          pagination={false}
          locale={{ emptyText: editable ? 'Add lines from the stock list above' : 'No lines' }}
        />
      </Card>
    </div>
  );
};

export default StockTransferForm;
