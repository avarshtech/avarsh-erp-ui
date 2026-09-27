import { useEffect, useState } from 'react';
import { Button, Drawer, Select, Space, Table, Typography } from 'antd';
import dayjs from 'dayjs';
import StatusTag from '../../../../components/StatusTag';
import { COSTING_STATUS_CONFIG } from '../../../../utils/statusConfig';
import { getStatusLabel } from '../../../../utils/costingConstants';
import { getRecentCostings } from '../../../../services/costing/costingPriceService';
import { useSheet } from '../CostingSheetContext';
import useStartFrom from './useStartFrom';

/**
 * A previous costing to start from — the buyer's own by default. The copy keeps its rows
 * (re-priced), margins and currencies but never its style: one costing per style.
 */
export default function CopyCostingDrawer({ open, onClose }) {
  const { form, masters } = useSheet();
  const { copyCosting } = useStartFrom();
  const [buyerId, setBuyerId] = useState(() => form.getFieldValue('buyerId') ?? null);
  const [list, setList] = useState({ buyerId: undefined, rows: [] });
  const [copying, setCopying] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    getRecentCostings({ buyerId: buyerId ?? undefined, limit: 20 })
      .then((rows) => { if (!cancelled) setList({ buyerId, rows }); })
      .catch(() => { if (!cancelled) setList({ buyerId, rows: [] }); });
    return () => { cancelled = true; };
  }, [open, buyerId]);

  const copy = async (id) => {
    setCopying(id);
    try { await copyCosting(id); onClose(); } finally { setCopying(null); }
  };

  const columns = [
    { title: 'Costing', dataIndex: 'costingId', render: (v) => <Typography.Text strong>{v}</Typography.Text> },
    { title: 'Style', dataIndex: 'styleNo', render: (v, r) => <span>{v}<br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.garmentName}</Typography.Text></span> },
    { title: 'Buyer', dataIndex: 'buyerName' },
    { title: 'Status', dataIndex: 'status', render: (s) => <StatusTag status={s} config={COSTING_STATUS_CONFIG} getLabel={getStatusLabel} size="small" /> },
    { title: 'Created', dataIndex: 'createdAt', render: (d) => (d ? dayjs(d).format('DD MMM YY') : '') },
    { key: 'copy', render: (_, r) => <Button size="small" type="primary" loading={copying === r.id} onClick={() => copy(r.id)}>Copy</Button> },
  ];

  return (
    <Drawer open={open} onClose={onClose} title="Copy a previous costing" size={720} destroyOnHidden>
      <Space style={{ marginBottom: 12 }}>
        <Typography.Text>Buyer</Typography.Text>
        <Select allowClear placeholder="All buyers" style={{ width: 260 }} value={buyerId ?? undefined}
          showSearch={{ optionFilterProp: 'label' }} options={masters.buyerOptions} onChange={(v) => setBuyerId(v ?? null)} />
      </Space>
      <Table rowKey="id" size="small" pagination={false} columns={columns} dataSource={list.rows}
        loading={list.buyerId !== buyerId} locale={{ emptyText: 'No costings yet for this buyer.' }} />
    </Drawer>
  );
}
