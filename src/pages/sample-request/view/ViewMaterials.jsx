import { useMemo, useCallback } from 'react';
import { Card, Table, Typography } from 'antd';
import { buildMaterialsColumns } from '../form/MaterialsColumns';

const { Text, Title } = Typography;

/** Read-only Section D on the detail view. */
const ViewMaterials = ({ sr }) => {
  const noop = useCallback(() => {}, []);
  const columns = useMemo(() => buildMaterialsColumns({
    sr,
    sampleQty: sr.sampleQty,
    sizes: sr.sizes || [],
    readOnly: true,
    onColourChange: noop,
    onMandatoryChange: noop,
  }), [sr, noop]);

  const fabric = useMemo(() => (sr.materials || []).filter((l) => l.section === 'FABRIC'), [sr.materials]);
  const trims = useMemo(() => (sr.materials || []).filter((l) => l.section !== 'FABRIC'), [sr.materials]);

  return (
    <Card size="small" style={{ marginTop: 16 }} title={<Title level={5} style={{ margin: 0 }}>Materials Required</Title>}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Fabric</Text>
      <Table rowKey="lineNo" size="small" columns={columns} dataSource={fabric} pagination={false} scroll={{ x: 1400 }} style={{ marginBottom: 16 }} />
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Trims &amp; Accessories</Text>
      <Table rowKey="lineNo" size="small" columns={columns} dataSource={trims} pagination={false} scroll={{ x: 1400 }} />
    </Card>
  );
};

export default ViewMaterials;
