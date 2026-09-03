import { memo, useCallback, useMemo, useState } from 'react';
import { App, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import ActionButton from '../../../components/buttons/ActionButton';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import EmptyState from '../../../components/EmptyState';
import { formatCurrency, formatNumber } from '../../../utils/formatters';
import { numericInputProps } from '../../../utils/inputHelpers';
import { billLinesWithGrn, round2 } from '../../../utils/billPassingCalc';
import {
  DEBIT_ORIGIN, DEBIT_ORIGIN_LABEL, DEBIT_STATUS, DEBIT_STATUS_COLOR, GST_TREATMENT,
} from '../../../utils/billPassingConstants';

const { Text } = Typography;
const { TextArea } = Input;

const dash = <Text style={{ color: 'var(--text-secondary)' }}>-</Text>;

const LINKED_HINT =
  'Recovered through Return to Supplier. Shown here so the same rejection is not debited twice.';

const ORIGIN_COLOR = {
  [DEBIT_ORIGIN.LINKED_DEBIT_NOTE]: 'red',
  [DEBIT_ORIGIN.SYSTEM_PROPOSED]: 'blue',
  [DEBIT_ORIGIN.MANUAL]: 'default',
};

const lineLabel = (l) =>
  l ? [l.grnNumber, l.itemCode, l.color, l.size].filter(Boolean).join(' · ') : '';

/** FR-BP-501/502/503 — every deduction on the bill; only CONFIRMED ones reduce Net Payable. */
const BpDebitTable = memo(function BpDebitTable({
  bill, debitTypes = [], readOnly, onSave, onSetStatus, onDelete, onRefreshProposals,
}) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(null);     // null = editor closed, {} = new row
  const [dropTarget, setDropTarget] = useState(null);
  const [dropReason, setDropReason] = useState('');

  const debits = useMemo(() => bill?.debits || [], [bill]);
  const lines = useMemo(() => billLinesWithGrn(bill), [bill]);
  const lineById = useMemo(() => new Map(lines.map((l) => [l.grnLineItemId, l])), [lines]);
  const typeByCode = useMemo(() => new Map(debitTypes.map((t) => [t.code, t])), [debitTypes]);
  const typeName = useCallback((code) => typeByCode.get(code)?.name || code || '-', [typeByCode]);

  const confirmedTotal = useMemo(
    () => round2(debits.filter((d) => d.status === DEBIT_STATUS.CONFIRMED)
      .reduce((s, d) => s + (Number(d.debitAmount) || 0), 0)),
    [debits],
  );

  // ── Editor ────────────────────────────────────────────────────────────────
  const watchedType = Form.useWatch('debitTypeCode', form);
  const watchedQty = Form.useWatch('debitQty', form);
  const watchedRate = Form.useWatch('rate', form);
  const selectedType = typeByCode.get(watchedType);
  const quantityBased = Boolean(selectedType?.quantityBased);
  const computedAmount = round2((Number(watchedQty) || 0) * (Number(watchedRate) || 0));

  const initialValues = useMemo(() => ({
    debitTypeCode: editing?.debitTypeCode,
    grnLineItemId: editing?.grnLineItemId,
    qcNumber: lineById.get(editing?.grnLineItemId)?.qcNumber,
    debitQty: editing?.debitQty ?? null,
    rate: editing?.rate ?? null,
    debitAmount: editing?.debitAmount ?? null,
    reasonText: editing?.reasonText || '',
    remarks: editing?.remarks || '',
    gstTreatment: editing?.gstTreatment || GST_TREATMENT.WITHOUT_GST,
  }), [editing, lineById]);

  // Picking the reference line carries its QC number and GRN rate across.
  const onLinePicked = useCallback((grnLineItemId) => {
    const line = lineById.get(grnLineItemId);
    form.setFieldsValue({
      qcNumber: line?.qcNumber || undefined,
      rate: form.getFieldValue('rate') ?? (line?.rate ?? null),
    });
  }, [form, lineById]);

  const submitEditor = useCallback(async () => {
    try {
      const v = await form.validateFields();
      const line = lineById.get(v.grnLineItemId);
      const type = typeByCode.get(v.debitTypeCode);
      const qty = type?.quantityBased ? Number(v.debitQty) || 0 : 0;
      const rate = type?.quantityBased ? Number(v.rate) || 0 : 0;
      const payload = {
        debitTypeCode: v.debitTypeCode,
        grnId: line?.grnId ?? null,
        grnLineItemId: line?.grnLineItemId ?? null,
        qcId: line?.qcId ?? null,
        debitQty: qty,
        rate,
        debitAmount: type?.quantityBased ? round2(qty * rate) : round2(v.debitAmount),
        reasonCode: v.debitTypeCode,
        reasonText: (v.reasonText || '').trim(),
        remarks: (v.remarks || '').trim(),
        gstTreatment: v.gstTreatment,
      };
      if (editing?.id) payload.id = editing.id;
      setEditing(null);
      onSave?.(payload);
    } catch {
      // validateFields already marks the offending fields inline
    }
  }, [form, lineById, typeByCode, editing, onSave]);

  const submitDrop = useCallback(() => {
    if (dropReason.trim().length < 5) {
      message.error('A reason is required to drop a debit.');
      return;
    }
    onSetStatus?.(dropTarget.id, DEBIT_STATUS.DROPPED, dropReason.trim());
    setDropTarget(null);
    setDropReason('');
  }, [dropReason, dropTarget, onSetStatus, message]);

  const confirmDelete = useCallback((row) => {
    modal.confirm({
      title: 'Remove this debit?',
      content: `${typeName(row.debitTypeCode)} — ${formatCurrency(row.debitAmount)} will no longer be deducted from this bill.`,
      okText: 'Remove',
      okButtonProps: { danger: true },
      cancelText: 'Keep',
      onOk: () => onDelete?.(row.id),
    });
  }, [modal, onDelete, typeName]);

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = useMemo(() => {
    const base = [
      {
        title: 'Debit Type', dataIndex: 'debitTypeCode', key: 'debitTypeCode', width: 200, fixed: 'left',
        render: (v) => <Text strong style={{ fontSize: 12 }}>{typeName(v)}</Text>,
      },
      {
        title: 'Reference', dataIndex: 'grnLineItemId', key: 'reference', width: 210, ellipsis: true,
        render: (v) => {
          const line = lineById.get(v);
          if (!line) return dash;
          return (
            <Tooltip title={lineLabel(line)}>
              <div style={{ lineHeight: 1.3 }}>
                <Text style={{ fontSize: 12 }}>{line.grnNumber}</Text>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{line.itemCode}</div>
              </div>
            </Tooltip>
          );
        },
      },
      {
        title: 'QC Ref', dataIndex: 'grnLineItemId', key: 'qcRef', width: 130,
        render: (v, r) => lineById.get(v)?.qcNumber || (r.qcId ? `QC-${r.qcId}` : dash),
      },
      {
        title: 'Qty', dataIndex: 'debitQty', key: 'debitQty', width: 100, align: 'center',
        render: (v) => (Number(v) ? formatNumber(v, 3) : dash),
      },
      {
        title: 'Rate', dataIndex: 'rate', key: 'rate', width: 110, align: 'right',
        render: (v) => (Number(v) ? formatNumber(v, 2) : dash),
      },
      {
        title: 'Amount', dataIndex: 'debitAmount', key: 'debitAmount', width: 140, align: 'right',
        render: (v) => <CurrencyDisplay amount={v} currency="INR" color="var(--error-color)" />,
      },
      {
        title: 'Reason', dataIndex: 'reasonText', key: 'reasonText', width: 220, ellipsis: true,
        render: (v, r) => (v || r.remarks
          ? <Tooltip title={[v, r.remarks].filter(Boolean).join(' — ')}><Text style={{ fontSize: 12 }}>{v || r.remarks}</Text></Tooltip>
          : dash),
      },
      {
        title: 'Origin', dataIndex: 'origin', key: 'origin', width: 150,
        render: (v, r) => (v === DEBIT_ORIGIN.LINKED_DEBIT_NOTE ? (
          <Tooltip title={LINKED_HINT}>
            <div style={{ lineHeight: 1.6 }}>
              <Tag color="red">{DEBIT_ORIGIN_LABEL[v]}</Tag>
              {r.debitNoteNumber && <Tag color="red" style={{ marginTop: 2 }}>{r.debitNoteNumber}</Tag>}
            </div>
          </Tooltip>
        ) : (
          <Tag color={ORIGIN_COLOR[v] || 'default'}>{DEBIT_ORIGIN_LABEL[v] || v || '-'}</Tag>
        )),
      },
      {
        title: 'Status', dataIndex: 'status', key: 'status', width: 120, align: 'center',
        render: (v) => <Tag color={DEBIT_STATUS_COLOR[v] || 'default'}>{v || '-'}</Tag>,
      },
      {
        title: 'Actions', key: 'actions', width: 190, align: 'center', fixed: 'right',
        render: (_, r) => {
          if (r.origin === DEBIT_ORIGIN.LINKED_DEBIT_NOTE) {
            return <Tooltip title={LINKED_HINT}><Text style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Maintained on the debit note</Text></Tooltip>;
          }
          return (
            <Space size={0}>
              {r.status === DEBIT_STATUS.PROPOSED && (
                <ActionButton action="approve" text="Confirm" size="small" disabled={readOnly}
                  tooltip="Count this debit against Net Payable"
                  onClick={() => onSetStatus?.(r.id, DEBIT_STATUS.CONFIRMED)} />
              )}
              {r.status === DEBIT_STATUS.PROPOSED && (
                <ActionButton action="reject" text="Drop" size="small" disabled={readOnly}
                  tooltip="Drop this debit with a reason"
                  onClick={() => { setDropTarget(r); setDropReason(''); }} />
              )}
              <ActionButton action="edit" tooltip="Edit debit" disabled={readOnly} onClick={() => setEditing(r)} />
              <ActionButton action="delete" tooltip="Remove debit" disabled={readOnly} onClick={() => confirmDelete(r)} />
            </Space>
          );
        },
      },
    ];
    // Linked-debit-note rows are tinted cell by cell — the repo has no row-tint class.
    return base.map((c) => ({
      ...c,
      onCell: (r) => (r.origin === DEBIT_ORIGIN.LINKED_DEBIT_NOTE
        ? { style: { background: 'var(--bg-secondary)' } } : {}),
    }));
  }, [lineById, typeName, readOnly, onSetStatus, confirmDelete]);

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <ActionButton action="refresh" text="Propose from QC" disabled={readOnly}
          tooltip="Re-read QC rejections and shortages and propose the debits they justify"
          onClick={() => onRefreshProposals?.()} />
        <ActionButton action="create" text="Add Debit" disabled={readOnly}
          onClick={() => setEditing({})} />
      </Space>

      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={debits}
        pagination={false}
        scroll={{ x: 1570 }}
        footer={() => (
          <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Only confirmed debits reduce Net Payable. Proposed and dropped lines are kept for the audit trail.
          </Text>
        )}
        locale={{
          emptyText: (
            <EmptyState
              title="No debits on this bill"
              description="Propose debits from the QC result, or add a deduction such as freight recovery or a late-delivery penalty."
            />
          ),
        }}
        summary={() => (debits.length ? (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={5}>
                <Text strong>Confirmed debit total</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <CurrencyDisplay amount={confirmedTotal} currency="INR" color="var(--error-color)" />
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} colSpan={4} />
            </Table.Summary.Row>
          </Table.Summary>
        ) : null)}
      />

      <Modal
        open={Boolean(editing)}
        title={editing?.id ? 'Edit debit' : 'Add debit'}
        width={720}
        destroyOnHidden
        okText={editing?.id ? 'Update debit' : 'Add debit'}
        onOk={submitEditor}
        onCancel={() => setEditing(null)}
      >
        <Form form={form} layout="vertical" initialValues={initialValues} preserve={false}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Debit Type" name="debitTypeCode"
                rules={[{ required: true, message: 'Pick the debit type' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select debit type"
                  options={debitTypes.map((t) => ({ value: t.code, label: t.name }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Reference GRN Line" name="grnLineItemId"
                rules={[{ required: true, message: 'A reference GRN line is mandatory on every debit' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select the GRN line being debited"
                  onChange={onLinePicked}
                  options={lines.map((l) => ({ value: l.grnLineItemId, label: lineLabel(l) }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="QC Reference" name="qcNumber"
                extra={selectedType?.requiresQc ? 'This is a quality debit, so the line must be QC inspected.' : null}
                rules={[{ required: Boolean(selectedType?.requiresQc), message: 'Pick a QC-inspected line for a quality debit' }]}>
                <Input disabled placeholder="Filled from the selected line" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="GST Treatment" name="gstTreatment"
                rules={[{ required: true, message: 'Choose how GST is treated' }]}>
                <Select options={[
                  { value: GST_TREATMENT.WITH_GST, label: 'With GST' },
                  { value: GST_TREATMENT.WITHOUT_GST, label: 'Without GST' },
                ]} />
              </Form.Item>
            </Col>
            {quantityBased && (
              <>
                <Col xs={24} md={8}>
                  <Form.Item label="Qty" name="debitQty"
                    rules={[{ required: true, message: 'Enter the quantity being debited' },
                      { type: 'number', min: 0.001, message: 'Quantity must be greater than zero' }]}>
                    <InputNumber style={{ width: '100%' }} controls={false} precision={3} min={0} {...numericInputProps} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Rate" name="rate"
                    rules={[{ required: true, message: 'Enter the rate' },
                      { type: 'number', min: 0.01, message: 'Rate must be greater than zero' }]}>
                    <InputNumber style={{ width: '100%' }} controls={false} precision={2} min={0} {...numericInputProps} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Amount">
                    <Input disabled value={formatCurrency(computedAmount)} />
                  </Form.Item>
                </Col>
              </>
            )}
            {!quantityBased && (
              <Col xs={24} md={8}>
                <Form.Item label="Amount" name="debitAmount"
                  rules={[{ required: true, message: 'Enter the debit amount' },
                    { type: 'number', min: 0.01, message: 'Amount must be greater than zero' }]}>
                  <InputNumber style={{ width: '100%' }} controls={false} precision={2} min={0} {...numericInputProps} />
                </Form.Item>
              </Col>
            )}
            <Col xs={24}>
              <Form.Item label="Reason" name="reasonText"
                rules={[{ required: true, message: 'A reason is mandatory on every debit' }]}>
                <TextArea rows={2} maxLength={300} showCount placeholder="Why this amount is being deducted from the supplier invoice" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Remarks" name="remarks">
                <TextArea rows={2} maxLength={300} showCount placeholder="Optional note for the approver" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        open={Boolean(dropTarget)}
        title="Drop this debit"
        width={480}
        destroyOnHidden
        okText="Drop debit"
        okButtonProps={{ danger: true }}
        onOk={submitDrop}
        onCancel={() => { setDropTarget(null); setDropReason(''); }}
      >
        <Text style={{ color: 'var(--text-secondary)' }}>
          {`${typeName(dropTarget?.debitTypeCode)} — ${formatCurrency(dropTarget?.debitAmount)}. The line stays on the bill as dropped and the reason is recorded on the audit trail.`}
        </Text>
        <TextArea
          rows={4}
          autoFocus
          maxLength={300}
          showCount
          value={dropReason}
          style={{ marginTop: 8 }}
          placeholder="Why this debit is not being claimed"
          onChange={(e) => setDropReason(e.target.value)}
        />
      </Modal>
    </>
  );
});

export default BpDebitTable;
