import { useMemo } from 'react';
import { Card, Table, Alert, Typography } from 'antd';
import { substitutionBanner } from '../../../utils/sampleFabricRules';
import { computeSampleQtyRequired } from '../../../utils/sampleBomMapper';
import { getStockStatus } from '../../../services/sr/srService';
import { buildMaterialsColumns } from './MaterialsColumns';

const { Title, Text } = Typography;

/**
 * Section D — Materials Required, auto-populated from the BOM and split into
 * Fabric / Trims & Accessories sub-sections (PRD v3 §8.2 D). The banner names
 * the (user-defined) sample type; the substitution state drives the lock.
 */
const MaterialsTable = ({
  materials, sr, sampleQty, sizes, typeName,
  onColourChange, onMandatoryChange, readOnly = false,
}) => {
  const enriched = useMemo(() => (materials || []).map((line) => {
    if (line.stockStatus) return line;
    const required = computeSampleQtyRequired(line, sampleQty, sizes);
    const stock = getStockStatus(line, required);
    return { ...line, stockStatus: stock.status, stockAvailable: stock.available };
  }), [materials, sampleQty, sizes]);

  const columns = useMemo(() => buildMaterialsColumns({
    sr, sampleQty, sizes, readOnly, onColourChange, onMandatoryChange,
  }), [sr, sampleQty, sizes, readOnly, onColourChange, onMandatoryChange]);

  const fabric = useMemo(() => enriched.filter((l) => l.section === 'FABRIC'), [enriched]);
  const trims = useMemo(() => enriched.filter((l) => l.section !== 'FABRIC'), [enriched]);

  return (
    <Card size="small" style={{ marginBottom: 16 }} title={<Title level={5} style={{ margin: 0 }}>D · Materials Required — auto-populated from BOM</Title>}>
      <Alert
        style={{ marginBottom: 12 }}
        type={sr?.colourSubstitutionAllowed ? 'warning' : 'info'}
        showIcon
        message={substitutionBanner(Boolean(sr?.colourSubstitutionAllowed), typeName || '—')}
      />
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Fabric</Text>
      <Table
        rowKey="lineNo"
        size="small"
        columns={columns}
        dataSource={fabric}
        pagination={false}
        scroll={{ x: 1400 }}
        style={{ marginBottom: 16 }}
      />
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Trims &amp; Accessories</Text>
      <Table
        rowKey="lineNo"
        size="small"
        columns={columns}
        dataSource={trims}
        pagination={false}
        scroll={{ x: 1400 }}
      />
    </Card>
  );
};

export default MaterialsTable;
