import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, App, Empty, Modal, Space, Statistic, Table, Tag, Typography } from 'antd';
import { FormSelect } from '../../../components/form';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';
import { comparePackingLists } from '../../../services/expdoc/expDocService';

const { Text } = Typography;

const KIND_COLOUR = { ADDED: 'green', REMOVED: 'red', CHANGED: 'blue' };

const show = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'object') {
    // A size map or a mixed-colour block. Rendered as its own key: value pairs so
    // the reader sees which size moved, not "[object Object]".
    const pairs = Array.isArray(v)
      ? v.map((x) => x.colorName || JSON.stringify(x))
      : Object.entries(v).filter(([, q]) => Number(q)).map(([k, q]) => `${k}: ${q}`);
    return pairs.join('  ') || '—';
  }
  return String(v);
};

/** "netWeightKg" -> "Net weight kg" — the same treatment the audit trail gives. */
const label = (field) => {
  const spaced = String(field).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/**
 * Compare two revisions of a packing list (§17).
 *
 * Any two, not only consecutive ones — the question an approver asks is "what
 * changed since the revision the buyer signed off", which may be several back.
 *
 * The diff is over ROWS, never cartons. A revised 40,000-carton shipment is still a
 * few dozen rows, and expanding both sides would make this the one screen in the
 * module whose cost follows shipment size.
 */
const PlCompareModal = ({ open, pl, onCancel }) => {
  const { message } = App.useApp();
  const revisions = useMemo(() => pl?.revisions || [], [pl]);

  // "The one before this" versus "this" is what opens, because it is what is asked
  // for. Keyed by the parent on `open`, so these lazy defaults are never stale.
  const [aId, setAId] = useState(() => {
    const idx = revisions.findIndex((r) => r.id === pl?.id);
    return revisions[idx - 1]?.id ?? revisions[0]?.id ?? pl?.id;
  });
  const [bId, setBId] = useState(() => pl?.id);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const runCompare = useCallback((a, b) => {
    if (!a || !b) return;
    comparePackingLists(a, b)
      .then((r) => { setResult(r); setLoading(false); })
      .catch((e) => { message.error(e.message || 'Could not compare'); setResult(null); setLoading(false); });
  }, [message]);

  useEffect(() => { runCompare(aId, bId); }, [runCompare, aId, bId]);

  const pick = (setter) => (v) => { setLoading(true); setter(v); };

  const options = revisions.map((r) => ({
    value: r.id,
    label: `R${r.revision} — ${String(r.status).toLowerCase()}${r.approvedAt ? ` · approved ${r.approvedAt}` : ''}`,
  }));

  // One flat table: header fields, then row changes, then added and removed rows.
  const rows = useMemo(() => {
    if (!result) return [];
    const out = [];
    result.header.forEach((h) => out.push({
      key: `h:${h.field}`, scope: 'Document', what: label(h.field), kind: 'CHANGED', from: h.from, to: h.to,
    }));
    result.rows.changed.forEach((r) => r.fields.forEach((f) => out.push({
      key: `c:${r.key}:${f.field}`, scope: r.label, what: label(f.field), kind: 'CHANGED', from: f.from, to: f.to,
    })));
    result.rows.added.forEach((r) => out.push({
      key: `a:${r.key}`, scope: r.label, what: 'Carton row', kind: 'ADDED', from: null, to: r.label,
    }));
    result.rows.removed.forEach((r) => out.push({
      key: `r:${r.key}`, scope: r.label, what: 'Carton row', kind: 'REMOVED', from: r.label, to: null,
    }));
    return out;
  }, [result]);

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={`Compare revisions — ${pl?.plNo || ''}`}
      width={MODAL_WIDTHS.LARGE}
      footer={null}
      destroyOnHidden
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap>
          <div style={{ minWidth: 240 }}>
            <Text type="secondary">From</Text>
            <FormSelect variant="default" allowClear={false} style={{ width: '100%' }} value={aId} onChange={pick(setAId)} options={options} />
          </div>
          <div style={{ minWidth: 240 }}>
            <Text type="secondary">To</Text>
            <FormSelect variant="default" allowClear={false} style={{ width: '100%' }} value={bId} onChange={pick(setBId)} options={options} />
          </div>
        </Space>

        {result?.identical && (
          <Alert type="success" showIcon title="These two revisions are identical" description="No header field, carton row or total differs." />
        )}

        {/* Totals first: an approver checks whether the shipment itself moved before
            reading which row moved it. */}
        {result?.totals?.length > 0 && (
          <Space size={24} wrap>
            {result.totals.map((t) => (
              <Statistic
                key={t.field}
                title={label(t.field)}
                value={t.to}
                precision={/Kg|cbm/i.test(t.field) ? 3 : 0}
                valueStyle={{ fontSize: 18 }}
                suffix={(
                  <Text type={t.delta > 0 ? 'success' : 'danger'} style={{ fontSize: 12 }}>
                    {`${t.delta > 0 ? '+' : ''}${t.delta}`}
                  </Text>
                )}
              />
            ))}
          </Space>
        )}

        <Table
          size="small"
          loading={loading}
          rowKey="key"
          pagination={{ pageSize: 12, size: 'small', hideOnSinglePage: true }}
          dataSource={rows}
          scroll={{ x: 860 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick two revisions to compare." /> }}
          columns={[
            { title: 'Where', dataIndex: 'scope', width: 220, ellipsis: true },
            { title: 'What changed', dataIndex: 'what', width: 170, ellipsis: true },
            { title: '', dataIndex: 'kind', width: 96, render: (k) => <Tag color={KIND_COLOUR[k]}>{k.toLowerCase()}</Tag> },
            {
              title: `R${result?.a?.revision ?? ''}`,
              dataIndex: 'from',
              ellipsis: true,
              render: (v) => <Text type="secondary">{show(v)}</Text>,
            },
            {
              title: `R${result?.b?.revision ?? ''}`,
              dataIndex: 'to',
              ellipsis: true,
              render: (v) => <Text strong>{show(v)}</Text>,
            },
          ]}
        />
        {result && !result.identical && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {`${rows.length} difference(s). R${result.a.revision} carried ${result.a.cartons} cartons and ${result.a.pieces} pieces; R${result.b.revision} carries ${result.b.cartons} and ${result.b.pieces}.`}
          </Text>
        )}
      </Space>
    </Modal>
  );
};

export default PlCompareModal;
