import { memo, useMemo } from 'react';
import { Table, Tag, Typography } from 'antd';
import { MATERIAL_KIND_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { fmtDate, fmtQty } from '../jwFormat';

const { Text } = Typography;
const KIND_COLOR = { FABRIC: 'blue', TRIM: 'purple', PACKING: 'gold' };

/** What we sent the vendor (Material Issues) and what came back, per issue line. */
const JobMaterialsCard = memo(function JobMaterialsCard({ rows = [], loading }) {
  const columns = useMemo(() => [
    { title: 'Issue', dataIndex: 'misNo', width: 150, render: (v, r) => <><Text style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.date)} · {r.docNo}</Text></> },
    { title: 'Kind', dataIndex: 'kind', width: 90, render: (k) => <Tag color={KIND_COLOR[k]}>{MATERIAL_KIND_LABEL[k]}</Tag> },
    { title: 'Item', dataIndex: 'itemName', render: (v, r) => <><Text>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{r.itemCode}</Text></> },
    { title: 'Sent', key: 'qty', align: 'right', width: 110, render: (_, r) => `${fmtQty(r.qty)} ${r.uom}` },
    { title: 'Back (good)', key: 'good', align: 'right', width: 110, render: (_, r) => (r.returnedGood ? `${fmtQty(r.returnedGood)} ${r.uom}` : '—') },
    { title: 'Back (damaged)', key: 'dmg', align: 'right', width: 120, render: (_, r) => (r.returnedDamaged ? `${fmtQty(r.returnedDamaged)} ${r.uom}` : '—') },
    { title: 'At vendor', key: 'at', align: 'right', width: 110, render: (_, r) => <Text strong>{fmtQty(r.atVendor)} {r.uom}</Text> },
  ], []);
  return (
    <Table
      rowKey="id"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 860 }}
      locale={{ emptyText: 'Nothing issued to this vendor for this job yet.' }}
    />
  );
});

export default JobMaterialsCard;
