import { memo, useCallback, useMemo } from 'react';
import { Alert, InputNumber, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import EmptyState from '../../../components/EmptyState';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import { formatNumber } from '../../../utils/formatters';
import { numericInputProps } from '../../../utils/inputHelpers';
import { round2, round3 } from '../../../utils/billPassingCalc';
import { LINE_BILLING_STATUS_COLOR, LINE_BILLING_STATUS_LABEL } from '../../../utils/billPassingConstants';

const { Text } = Typography;

const QC_APPROVED = 'Approved';
const EPS = 0.0005;
const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '-');
const qty = (v) => formatNumber(Number(v) || 0, 3);
const sub = { fontSize: 11, color: 'var(--text-secondary)' };

/**
 * FR-BP-301/303/305/306 — one row per GRN line, grouped by GRN (one GRN is one
 * supplier challan). Fully controlled: the checkbox state and every Bill Qty
 * read out of `bill.grns`, and each edit re-emits the whole bill-shaped array.
 */
const BpGrnSelectionTable = memo(function BpGrnSelectionTable({ source, bill, readOnly = false, onChange }) {
  const picked = useMemo(() => {
    const map = new Map();
    (bill?.grns || []).forEach((g) => (g.lines || []).forEach((l) => map.set(l.grnLineItemId, l)));
    return map;
  }, [bill]);

  const rows = useMemo(() => (source?.grns || []).flatMap((g) => (g.lines || []).map((l) => {
    const mine = picked.get(l.grnLineItemId);
    // pendingQty already nets off the other bills. It nets off THIS bill too when
    // the source was loaded without excludeBillId — add that back only in that case.
    const selfCounted = (l.coveringBills || []).includes(bill?.bpNumber);
    const mineQty = Number(mine?.billedQty) || 0;
    return {
      ...l,
      grnId: g.grnId,
      grnNumber: g.grnNumber,
      grnDate: g.grnDate,
      challanNo: g.challanNo,
      challanDate: g.challanDate,
      maxQty: round3(Math.max(0, (Number(l.pendingQty) || 0) + (selfCounted ? mineQty : 0))),
      billQty: mine ? mineQty : null,
    };
  })), [source, picked, bill]);

  const selectedRowKeys = useMemo(
    () => rows.filter((r) => picked.has(r.grnLineItemId)).map((r) => r.grnLineItemId),
    [rows, picked],
  );

  /** Rebuild the bill-shaped `grns` array from a grnLineItemId -> billedQty map. */
  const emit = useCallback((nextQty) => {
    const grns = [];
    (source?.grns || []).forEach((g) => {
      const lines = (g.lines || []).filter((l) => nextQty.has(l.grnLineItemId)).map((l) => {
        const prev = picked.get(l.grnLineItemId);
        const billedQty = round3(Number(nextQty.get(l.grnLineItemId)) || 0);
        const invoiceRate = prev?.invoiceRate ?? l.rate ?? 0;
        return {
          id: prev?.id ?? l.grnLineItemId,
          grnLineItemId: l.grnLineItemId,
          poLineItemId: l.poLineItemId,
          itemCode: l.itemCode,
          description: l.description,
          color: l.color,
          size: l.size,
          uom: l.uom,
          poQty: l.poQty,
          receivedQty: l.receivedQty,
          acceptedQty: l.acceptedQty,
          rejectedQty: l.rejectedQty,
          shortageQty: l.shortageQty,
          excessQty: l.excessQty,
          rate: l.rate,
          grnValue: l.grnValue,
          billedQty,
          invoiceRate,
          billedValue: round2(billedQty * invoiceRate),
          qcId: l.qcId,
          qcNumber: l.qcNumber,
          qcStatus: l.qcStatus,
          qcResult: l.qcResult,
          qtyUnquantified: l.qtyUnquantified,
        };
      });
      if (lines.length) {
        grns.push({
          id: g.grnId,
          grnId: g.grnId,
          grnNumber: g.grnNumber,
          grnType: g.grnType,
          grnDate: g.grnDate,
          challanNo: g.challanNo,
          challanDate: g.challanDate,
          lines,
        });
      }
    });
    onChange?.(grns);
  }, [source, picked, onChange]);

  /** Current selection as a map, so an edit never disturbs the other rows. */
  const currentQty = useCallback(() => {
    const m = new Map();
    rows.forEach((r) => {
      if (picked.has(r.grnLineItemId)) m.set(r.grnLineItemId, Number(picked.get(r.grnLineItemId).billedQty) || 0);
    });
    return m;
  }, [rows, picked]);

  const handleSelect = useCallback((keys) => {
    const keySet = new Set(keys);
    const m = new Map();
    rows.forEach((r) => {
      if (!keySet.has(r.grnLineItemId)) return;
      const prev = picked.get(r.grnLineItemId);
      // A newly ticked line defaults to its pending amount (billable - billed).
      m.set(r.grnLineItemId, prev ? Number(prev.billedQty) || 0 : r.maxQty);
    });
    emit(m);
  }, [rows, picked, emit]);

  const handleQty = useCallback((grnLineItemId, value) => {
    const m = currentQty();
    m.set(grnLineItemId, value == null ? 0 : Number(value));
    emit(m);
  }, [currentQty, emit]);

  const rowSelection = useMemo(() => ({
    selectedRowKeys,
    onChange: handleSelect,
    columnWidth: 46,
    getCheckboxProps: (r) => ({
      name: r.itemCode,
      disabled: readOnly || (!picked.has(r.grnLineItemId) && (Number(r.pendingQty) || 0) <= 0),
    }),
  }), [selectedRowKeys, handleSelect, readOnly, picked]);

  const columns = useMemo(() => [
    {
      title: 'GRN No', dataIndex: 'grnNumber', key: 'grnNumber', width: 150, align: 'center',
      render: (v, r) => (
        <Space size={4}>
          <Text strong style={{ fontSize: 12 }}>{v || '-'}</Text>
          {r.qcStatus !== QC_APPROVED && (
            <Tooltip title="QC pending — this bill cannot pass verification until QC completes.">
              <WarningOutlined style={{ color: 'var(--warning-color)' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Challan', dataIndex: 'challanNo', key: 'challanNo', width: 120, align: 'center',
      render: (v, r) => (
        <div>
          <div>{v || '-'}</div>
          <div style={sub}>{fmtDate(r.challanDate)}</div>
        </div>
      ),
    },
    {
      title: 'Item', dataIndex: 'itemCode', key: 'itemCode', width: 220,
      render: (v, r) => (
        <div>
          <Space size={4}>
            <Text strong style={{ fontSize: 12 }}>{v || '-'}</Text>
            {(r.linkedDebitNotes?.length > 0) && (
              <Tooltip
                title={(
                  <div>
                    <div>{r.linkedDebitNotes.map((n) => n.debitNoteNumber).join(', ')}</div>
                    <div>Already recovered through Return to Supplier — it will not be debited again here.</div>
                  </div>
                )}
              >
                <Tag color="red" style={{ marginInlineEnd: 0, fontSize: 10 }}>DBN</Tag>
              </Tooltip>
            )}
          </Space>
          <div style={sub}>{r.description || '-'}</div>
        </div>
      ),
    },
    { title: 'Colour', dataIndex: 'color', key: 'color', width: 100, align: 'center', render: (v) => v || '-' },
    { title: 'UOM', dataIndex: 'uom', key: 'uom', width: 70, align: 'center', render: (v) => v || '-' },
    { title: 'PO Qty', dataIndex: 'poQty', key: 'poQty', width: 100, align: 'center', render: (v) => qty(v) },
    { title: 'Received', dataIndex: 'receivedQty', key: 'receivedQty', width: 100, align: 'center', render: (v) => qty(v) },
    {
      title: 'Accepted', dataIndex: 'acceptedQty', key: 'acceptedQty', width: 100, align: 'center',
      render: (v) => <Text style={{ color: 'var(--success-color)' }}>{qty(v)}</Text>,
    },
    {
      title: 'Rejected', dataIndex: 'rejectedQty', key: 'rejectedQty', width: 100, align: 'center',
      render: (v) => <Text style={{ color: (Number(v) || 0) > 0 ? 'var(--error-color)' : undefined }}>{qty(v)}</Text>,
    },
    {
      title: 'Rate', dataIndex: 'rate', key: 'rate', width: 110, align: 'right',
      render: (v) => <CurrencyDisplay amount={v} currency="INR" strong={false} color="var(--text-secondary)" />,
    },
    {
      title: 'GRN Value', dataIndex: 'grnValue', key: 'grnValue', width: 130, align: 'right',
      render: (v) => <CurrencyDisplay amount={v} currency="INR" color="var(--primary-color)" />,
    },
    {
      title: 'Bill Qty', key: 'billQty', width: 150, align: 'center',
      render: (_, r) => {
        const selected = picked.has(r.grnLineItemId);
        const over = selected && (Number(r.billQty) || 0) > r.maxQty + EPS;
        const input = (
          <InputNumber
            size="small"
            controls={false}
            {...numericInputProps}
            min={0}
            precision={3}
            style={{ width: '100%' }}
            value={selected ? r.billQty : null}
            placeholder={selected ? '0.000' : '-'}
            disabled={readOnly || !selected}
            status={over ? 'error' : undefined}
            onChange={(v) => handleQty(r.grnLineItemId, v)}
          />
        );
        if (!over) return input;
        return (
          <Tooltip
            title={(
              <div>
                <div>{`Only ${qty(r.maxQty)} ${r.uom || ''} is still billable on this line.`}</div>
                <div>
                  {r.coveringBills?.length > 0
                    ? `Already billed on ${r.coveringBills.join(', ')}.`
                    : 'The balance is capped by the QC-accepted quantity.'}
                </div>
              </div>
            )}
          >
            {input}
          </Tooltip>
        );
      },
    },
    {
      title: 'Billed Value', key: 'billedValue', width: 130, align: 'right',
      render: (_, r) => {
        const rate = picked.get(r.grnLineItemId)?.invoiceRate ?? r.rate ?? 0;
        return <CurrencyDisplay amount={(Number(r.billQty) || 0) * rate} currency="INR" />;
      },
    },
    {
      title: 'Billing Status', dataIndex: 'billingStatus', key: 'billingStatus', width: 150, align: 'center',
      render: (v, r) => (
        <div>
          <Tag color={LINE_BILLING_STATUS_COLOR[v]} style={{ marginInlineEnd: 0 }}>
            {LINE_BILLING_STATUS_LABEL[v] || v || '-'}
          </Tag>
          {r.coveringBills?.length > 0 && (
            <div style={{ ...sub, marginTop: 2 }}>{r.coveringBills.join(', ')}</div>
          )}
        </div>
      ),
    },
  ], [picked, readOnly, handleQty]);

  const totals = useMemo(() => rows.reduce((t, r) => {
    const rate = picked.get(r.grnLineItemId)?.invoiceRate ?? r.rate ?? 0;
    t.received += Number(r.receivedQty) || 0;
    t.accepted += Number(r.acceptedQty) || 0;
    t.rejected += Number(r.rejectedQty) || 0;
    t.grnValue += Number(r.grnValue) || 0;
    t.billQty += Number(r.billQty) || 0;
    t.billedValue += (Number(r.billQty) || 0) * rate;
    return t;
  }, { received: 0, accepted: 0, rejected: 0, grnValue: 0, billQty: 0, billedValue: 0 }), [rows, picked]);

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="One GRN is one supplier challan — tick several challans to combine them on a single invoice, or bill only part of a line to split one challan across invoices."
      />
      <Table
        rowKey="grnLineItemId"
        size="small"
        bordered
        columns={columns}
        dataSource={rows}
        rowSelection={rowSelection}
        pagination={false}
        scroll={{ x: 1800 }}
        locale={{
          emptyText: (
            <EmptyState
              title="No GRNs to bill"
              description="This purchase order has no goods receipt with a billable quantity."
              showAction={false}
            />
          ),
        }}
        summary={() => (rows.length ? (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
              <Table.Summary.Cell index={0} colSpan={6} align="right"><Text strong>Totals:</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1} />
              <Table.Summary.Cell index={2} align="center"><Text strong>{qty(totals.received)}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="center"><Text strong style={{ color: 'var(--success-color)' }}>{qty(totals.accepted)}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="center"><Text strong style={{ color: totals.rejected > 0 ? 'var(--error-color)' : undefined }}>{qty(totals.rejected)}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={5} />
              <Table.Summary.Cell index={6} align="right"><CurrencyDisplay amount={totals.grnValue} currency="INR" color="var(--primary-color)" /></Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="center"><Text strong style={{ color: 'var(--primary-color)' }}>{qty(totals.billQty)}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="right"><CurrencyDisplay amount={totals.billedValue} currency="INR" /></Table.Summary.Cell>
              <Table.Summary.Cell index={9} />
            </Table.Summary.Row>
          </Table.Summary>
        ) : null)}
      />
    </>
  );
});

export default BpGrnSelectionTable;
