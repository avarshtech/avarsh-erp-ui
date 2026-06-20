import { useMemo } from 'react';
import { Table, Tag, Typography, Space } from 'antd';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import StatusTag from '../../../components/StatusTag';
import EmptyState from '../../../components/EmptyState';
import { PRODUCTION_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { FINISHING_PROCESSES, getStatusLabel, PROD_PO_STATUS } from '../../../utils/productionConstants';

const { Text } = Typography;

/**
 * By-order finishing process-coverage matrix (PRD §6.7 / §12.3).
 * Groups the loaded Finishing POs by order and shows, for each of the 4
 * processes, which PO covers it (vendor / in-house + status) or a red GAP.
 */
const FinishingCoverageMatrix = ({ data = [] }) => {
  const orders = useMemo(() => {
    const map = new Map();
    data.forEach((fpo) => {
      if (!map.has(fpo.orderId)) {
        map.set(fpo.orderId, { orderId: fpo.orderId, orderNo: fpo.orderNo, styleNo: fpo.styleNo, buyer: fpo.buyer, fpos: [] });
      }
      map.get(fpo.orderId).fpos.push(fpo);
    });
    return [...map.values()];
  }, [data]);

  const renderCell = (key) => (_, r) => {
    const covering = (r.fpos || []).filter(
      (f) => f.status !== PROD_PO_STATUS.CANCELLED && (f.processes || []).some((p) => p.processName === key),
    );
    if (!covering.length) return <Tag color="red" icon={<CloseCircleFilled />}>GAP</Tag>;
    return (
      <Space direction="vertical" size={2}>
        {covering.map((f) => (
          <Space key={f.id} size={4}>
            <CheckCircleFilled style={{ color: '#389e0d' }} />
            <Text style={{ fontSize: 12 }}>{f.isOutsourced ? f.vendorName : 'In-house'}</Text>
            <StatusTag status={f.status} config={PRODUCTION_PO_STATUS_CONFIG} getLabel={getStatusLabel} size="small" />
          </Space>
        ))}
      </Space>
    );
  };

  const columns = [
    { title: 'Order', key: 'order', width: 200, fixed: 'left',
      render: (_, r) => (<div><Text strong>{r.orderNo}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.styleNo} · {r.buyer}</Text></div>) },
    ...FINISHING_PROCESSES.map((p) => ({ title: p.label, key: p.key, width: 170, render: renderCell(p.key) })),
  ];

  return (
    <Table
      rowKey="orderId"
      columns={columns}
      dataSource={orders}
      pagination={false}
      size="small"
      scroll={{ x: 880 }}
      locale={{ emptyText: <EmptyState title="No Finishing POs" description="Generate Finishing POs to see per-order process coverage" /> }}
    />
  );
};

export default FinishingCoverageMatrix;
