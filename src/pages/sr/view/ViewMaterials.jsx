import { useMemo, useCallback } from 'react';
import { Card, Table, Typography } from 'antd';
import { buildMaterialsColumns } from '../form/MaterialsColumns';
import { canRaisePo } from '../../../services/sr/srService';

const { Text, Title } = Typography;

/** Read-only Section D on the detail view; Raise PO stays available up to Dispatched. */
const ViewMaterials = ({ sr, onRaisePo }) => {
  const poAllowed = canRaisePo(sr.status);
  const noop = useCallback(() => {}, []);
  const columns = useMemo(() => buildMaterialsColumns({
    sr,
    sampleQty: sr.sampleQty,
    sizes: sr.sizes || [],
    readOnly: true,
    onColourChange: noop,
    onMandatoryChange: noop,
    onRaisePo,
    poAllowed,
  }), [sr, onRaisePo, poAllowed, noop]);

  const fabric = useMemo(() => (sr.materials || []).filter((l) => l.section === 'FABRIC'), [sr.materials]);
  const trims = useMemo(() => (sr.materials || []).filter((l) => l.section !== 'FABRIC'), [sr.materials]);

  return (
    <Card size="small" style={{ marginTop: 16 }} title={<Title level={5} style={{ margin: 0 }}>Materials Required</Title>}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Fabric</Text>
      <Table rowKey="lineNo" size="small" columns={columns} dataSource={fabric} pagination={false} scroll={{ x: 1600 }} style={{ marginBottom: 16 }} />
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Trims &amp; Accessories</Text>
      <Table rowKey="lineNo" size="small" columns={columns} dataSource={trims} pagination={false} scroll={{ x: 1600 }} />
    </Card>
  );
};

export default ViewMaterials;
