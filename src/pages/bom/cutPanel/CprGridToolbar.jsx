import { memo, useState } from 'react';
import { App, Button, InputNumber, Popconfirm, Space, Tag, Typography } from 'antd';
import { CalculatorOutlined, DeleteOutlined, PercentageOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * Grid toolbar (PRD §8.3): Recalculate from Order Qty (clears every manual override
 * after confirmation), Apply allowance to all (edited lines only when the user says
 * so, §9.4) and Remove selected.
 */
const CprGridToolbar = memo(function CprGridToolbar({ defaultAllowance, overriddenCount, selectedCount, onRecalcAll, onApplyAllowance, onRemoveSelected }) {
  const { modal } = App.useApp();
  const [pct, setPct] = useState(defaultAllowance);

  const apply = () => {
    if (pct == null) return;
    if (!overriddenCount) { onApplyAllowance(pct, false); return; }
    modal.confirm({
      title: `${overriddenCount} line(s) have edited quantities`,
      content: `Apply ${Number(pct).toFixed(2)}% to them as well? Their edited quantities will be replaced by the calculation.`,
      okText: 'Include edited lines',
      cancelText: 'Skip edited lines',
      onOk: () => onApplyAllowance(pct, true),
      onCancel: () => onApplyAllowance(pct, false),
    });
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <Space wrap>
        <Popconfirm title="Recalculate every line from the order quantity?" description="All manual quantity edits are replaced." okText="Recalculate" onConfirm={onRecalcAll}>
          <Button icon={<CalculatorOutlined />}>Recalculate from Order Qty</Button>
        </Popconfirm>
        <Space.Compact>
          <InputNumber name="apply-allowance" aria-label="Allowance to apply to all lines" min={0} max={100} precision={2} value={pct} onChange={setPct} suffix="%" style={{ width: 110 }} />
          <Button icon={<PercentageOutlined />} onClick={apply}>Apply allowance to all</Button>
        </Space.Compact>
        <Popconfirm title={`Remove ${selectedCount} selected line(s)?`} okText="Remove" okButtonProps={{ danger: true }} onConfirm={onRemoveSelected} disabled={!selectedCount}>
          <Button danger icon={<DeleteOutlined />} disabled={!selectedCount}>Remove selected{selectedCount ? ` (${selectedCount})` : ''}</Button>
        </Popconfirm>
      </Space>
      <Space size={4}>
        <Tag color="warning">Edited</Tag><Text type="secondary" style={{ fontSize: 12 }}>quantity differs from the calculation · Enter moves to the next size</Text>
      </Space>
    </div>
  );
});

export default CprGridToolbar;
