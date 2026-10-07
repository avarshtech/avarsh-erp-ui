import { memo } from 'react';
import {
  Card, Progress, Table, Tag, Tooltip, Typography,
} from 'antd';
import { MATERIAL_KIND_LABEL, SUPPLIED_BY, SUPPLIED_BY_LABEL } from '../../../../../utils/jobWorkInward/inwardConstants';
import { fmtQty } from '../../jwFormat';

const { Text } = Typography;
const KIND_COLOR = { FABRIC: 'blue', PANELS: 'purple', TRIM: 'gold' };
const unit = (v, uom) => `${fmtQty(v)} ${uom}`;

const MATERIAL_COLUMNS = [
  { title: 'Material', dataIndex: 'itemName', render: (v, m) => <><Tag color={KIND_COLOR[m.kind]}>{MATERIAL_KIND_LABEL[m.kind]}</Tag><Text>{v}</Text></> },
  { title: 'Supplied by', dataIndex: 'suppliedBy', width: 160, render: (s) => <Text type={s === SUPPLIED_BY.OWN ? 'secondary' : undefined}>{SUPPLIED_BY_LABEL[s]}</Text> },
  { title: 'Needed', dataIndex: 'required', width: 120, align: 'right', render: (v, m) => <Tooltip title={`${m.consumption} ${m.uom} a piece + ${m.allowancePct}% allowance`}>{unit(v, m.uom)}</Tooltip> },
  { title: 'Received', dataIndex: 'usable', width: 150, render: (v, m) => (m.suppliedBy === SUPPLIED_BY.OWN ? '—' : (
    <>
      <Text>{unit(v, m.uom)}</Text>{m.defective > 0 && <Text type="danger" style={{ fontSize: 11 }}> +{fmtQty(m.defective)} defective</Text>}
      <Progress percent={m.pct || 0} size={{ height: 4 }} showInfo={false} status={m.pct >= 100 ? 'success' : 'normal'} />
    </>
  )) },
  { title: 'Into production', dataIndex: 'issued', width: 130, align: 'right', render: (v, m) => (m.suppliedBy === SUPPLIED_BY.OWN ? '—' : unit(v, m.uom)) },
  { title: 'In store', dataIndex: 'inStore', width: 110, align: 'right', render: (v, m) => (m.suppliedBy === SUPPLIED_BY.OWN ? '—' : unit(v, m.uom)) },
  {
    title: 'Short', dataIndex: 'short', width: 150,
    render: (v, m) => {
      if (!v) return <Text type="secondary">—</Text>;
      return m.blocking ? <Tag color="volcano">{unit(v, m.uom)} — waiting</Tag> : <Tooltip title="Only the allowance is short; the order itself is covered."><Tag color="gold">{unit(v, m.uom)} spares</Tag></Tooltip>;
    },
  },
];

const ACCOUNT_COLUMNS = [
  { title: 'Fabric', dataIndex: 'itemName' },
  { title: 'Received', dataIndex: 'received', align: 'right', render: fmtQty },
  { title: 'Issued to cutting', dataIndex: 'issued', align: 'right', render: fmtQty },
  { title: 'Used in lays', dataIndex: 'usedInLays', align: 'right', render: fmtQty },
  { title: 'End-bits back', dataIndex: 'back', align: 'right', render: fmtQty },
  { title: 'Waste (held / back / sold)', key: 'w', align: 'right', render: (_, a) => `${fmtQty(a.waste.held)} / ${fmtQty(a.waste.returned)} / ${fmtQty(a.waste.sold)}` },
  { title: 'Variance', dataIndex: 'variance', align: 'right', render: (v, a) => <Tooltip title={`${a.issued ? ((v / a.issued) * 100).toFixed(1) : 0}% of what was issued`}><Text type={v > 0 ? 'warning' : undefined}>{fmtQty(v)}</Text></Tooltip> },
  { title: 'In store', dataIndex: 'inStore', align: 'right', render: fmtQty },
  { title: 'Returned', dataIndex: 'returned', align: 'right', render: fmtQty },
  { title: 'Not yet accounted', dataIndex: 'outstanding', align: 'right', render: (v) => <Text strong>{fmtQty(v)}</Text> },
];

/** Every material line, then the fabric account the principal will ask for at closing (kg). */
const JobOrderMaterials = memo(function JobOrderMaterials({ view }) {
  return (
    <>
      <Table rowKey="id" size="small" pagination={false} columns={MATERIAL_COLUMNS} dataSource={view.materials} scroll={{ x: 1100 }} style={{ marginBottom: 12 }} />
      {view.fabricAccount.length > 0 && (
        <Card size="small" title="Fabric account (kg)" extra={<Text type="secondary" style={{ fontSize: 12 }}>Received = in store + used in lays + waste + variance + returned</Text>}>
          <Table rowKey="materialId" size="small" pagination={false} columns={ACCOUNT_COLUMNS} dataSource={view.fabricAccount} scroll={{ x: 1100 }} />
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            Used in lays, end-bits and variance come from the cutting room&apos;s roll reconciliation. &quot;Not yet accounted&quot; settles as garments go back (pieces × the agreed consumption), oldest challan first.
          </Text>
        </Card>
      )}
    </>
  );
});

export default JobOrderMaterials;
