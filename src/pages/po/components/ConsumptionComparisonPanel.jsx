import { useState } from 'react';
import { Table, InputNumber, Tag, Typography, Input, Button, Space, Alert } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { numericInputProps } from '../../../utils/inputHelpers';
import EmptyState from '../../../components/EmptyState';
import { computeVariancePercent, getVarianceStatus, VARIANCE_THRESHOLD } from '../../../utils/productionConstants';

const { Text } = Typography;

/**
 * BOM vs CAD consumption comparison (PRD §4.3 / §5.3).
 * mode: 'editable' (Cutting PO — CAD entered/uploaded), 'inherited' (Work Order —
 * read-only, override allowed with mandatory justification), 'view' (read-only).
 */
const ConsumptionComparisonPanel = ({
  rows = [], mode = 'editable', onChange, justification = '', onJustificationChange,
}) => {
  const [overriding, setOverriding] = useState(false);
  const cadEditable = mode === 'editable' || (mode === 'inherited' && overriding);

  const handleCad = (index, value) => {
    const updated = rows.map((r, i) => (i === index ? { ...r, cadPerPc: value } : r));
    onChange?.(updated);
  };

  const columns = [
    { title: 'Fabric Item', key: 'item', width: 220,
      render: (_, r) => (<div><Text strong>{r.itemCode}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.itemName}</Text></div>) },
    { title: 'UOM', dataIndex: 'uom', width: 70, align: 'center' },
    { title: 'BOM /Pc', dataIndex: 'bomPerPc', width: 90, align: 'right', render: (v) => (v || 0).toFixed(3) },
    { title: 'CAD /Pc', key: 'cad', width: 120, align: 'right',
      render: (_, r, index) => cadEditable
        ? <InputNumber size="small" min={0} precision={3} value={r.cadPerPc} onChange={(v) => handleCad(index, v)} style={{ width: 100 }} {...numericInputProps} />
        : (r.cadPerPc || 0).toFixed(3) },
    { title: 'Variance %', key: 'variance', width: 120, align: 'right',
      render: (_, r) => {
        const v = computeVariancePercent(r.cadPerPc, r.bomPerPc);
        const s = getVarianceStatus(v);
        return <Text style={{ color: s.textColor, fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</Text>;
      } },
    { title: 'Status', key: 'status', width: 150, align: 'center',
      render: (_, r) => {
        const s = getVarianceStatus(computeVariancePercent(r.cadPerPc, r.bomPerPc));
        return <Tag color={s.tagColor}>{s.label}</Tag>;
      } },
    { title: 'Total BOM', key: 'tbom', width: 110, align: 'right', render: (_, r) => ((r.bomPerPc || 0) * (r.plannedQty || 0)).toFixed(2) },
    { title: 'Total CAD', key: 'tcad', width: 110, align: 'right', render: (_, r) => <Text strong>{((r.cadPerPc || 0) * (r.plannedQty || 0)).toFixed(2)}</Text> },
  ];

  const hasEscalation = rows.some((r) => Math.abs(computeVariancePercent(r.cadPerPc, r.bomPerPc)) > VARIANCE_THRESHOLD.YELLOW);

  return (
    <div>
      {hasEscalation && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="Consumption variance exceeds 5%"
          description="One or more fabric items have CAD consumption more than 5% off BOM. This requires escalation and Production Manager review — Merchandiser will be notified on submission (PRD §4.3 / §7.4)."
        />
      )}
      {mode === 'inherited' && (
        <Space style={{ marginBottom: 12 }} wrap>
          <Text type="secondary">CAD consumption inherited from the linked Cutting PO.</Text>
          {!overriding && (
            <Button size="small" icon={<EditOutlined />} onClick={() => setOverriding(true)}>
              Override with justification
            </Button>
          )}
        </Space>
      )}
      <Table
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={false}
        size="small"
        scroll={{ x: 900 }}
        locale={{ emptyText: <EmptyState title="No BOM items to compare" description="Select an order and BOM to see fabric consumption vs CAD" /> }}
      />
      {mode === 'inherited' && overriding && (
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ fontSize: 13 }}>Override justification <span style={{ color: 'var(--error-color)' }}>*</span></Text>
          <Input.TextArea
            rows={3}
            value={justification}
            onChange={(e) => onJustificationChange?.(e.target.value)}
            placeholder="Explain why CAD consumption is being overridden (audited)…"
            maxLength={300}
            showCount
            style={{ marginTop: 6 }}
          />
        </div>
      )}
    </div>
  );
};

export default ConsumptionComparisonPanel;
