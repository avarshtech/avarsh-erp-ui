import { memo, useState } from 'react';
import { App, Button, Input, InputNumber, Popconfirm, Space, Tag, Typography } from 'antd';
import { CalculatorOutlined, DeleteOutlined, EditOutlined, PercentageOutlined } from '@ant-design/icons';
import usePaintedWork from '../../../hooks/usePaintedWork';

const { Text } = Typography;

/**
 * Grid toolbar (PRD §8.3): Recalculate from Order Qty (clears every manual override
 * after confirmation), Apply allowance to all (edited lines only when the user says
 * so, §9.4), one reason for every deviating line (lines with their own reason only when the
 * user says so) and Remove selected. Each re-renders the whole grid, so each spins until it
 * has: a Popconfirm's OK button through its returned promise, the others through usePaintedWork.
 * `deviation` = { count, withReason } — lines whose quantity or allowance needs a reason.
 */
const CprGridToolbar = memo(function CprGridToolbar({
  defaultAllowance, overriddenCount, selectedCount, deviation, onRecalcAll, onApplyAllowance, onApplyReason, onRemoveSelected,
}) {
  const { modal } = App.useApp();
  const [pct, setPct] = useState(defaultAllowance);
  const [reason, setReason] = useState('');
  const [applying, runApply] = usePaintedWork();
  const [reasoning, runReason] = usePaintedWork();
  const [, runGrid] = usePaintedWork();

  /** Three answers: include the lines already set, skip them, or Cancel / Esc — nothing changes. */
  const askIncluding = ({ title, content, skip, include }, onAnswer) => {
    const answer = (including) => { dialog.destroy(); if (including !== null) onAnswer(including); };
    const dialog = modal.confirm({
      title,
      content,
      footer: (
        <Space style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Button onClick={() => answer(null)}>Cancel</Button>
          <Button onClick={() => answer(false)}>{skip}</Button>
          <Button type="primary" onClick={() => answer(true)}>{include}</Button>
        </Space>
      ),
    });
  };

  const apply = () => {
    if (pct == null) return;
    if (!overriddenCount) { runApply(() => onApplyAllowance(pct, false)); return; }
    askIncluding({
      title: `${overriddenCount} line(s) have edited quantities`,
      content: `Apply ${Number(pct).toFixed(2)}% to them as well? Their edited quantities will be replaced by the calculation.`,
      skip: 'Skip edited lines',
      include: 'Include edited lines',
    }, (including) => runApply(() => onApplyAllowance(pct, including)));
  };

  const applyReason = () => {
    const text = reason.trim();
    if (!text) return;
    if (!deviation.withReason) { runReason(() => onApplyReason(text, false)); return; }
    askIncluding({
      title: `${deviation.withReason} of ${deviation.count} line(s) already have a reason`,
      content: 'Replace their reason with this one as well?',
      skip: 'Keep their reasons',
      include: 'Replace them too',
    }, (replacing) => runReason(() => onApplyReason(text, replacing)));
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <Space wrap>
        <Popconfirm title="Recalculate every line from the order quantity?" description="All manual quantity edits are replaced." okText="Recalculate" onConfirm={() => runGrid(onRecalcAll)}>
          <Button icon={<CalculatorOutlined />}>Recalculate from Order Qty</Button>
        </Popconfirm>
        <Space.Compact>
          <InputNumber name="apply-allowance" aria-label="Allowance to apply to all lines" min={0} max={100} precision={2} value={pct} onChange={setPct} suffix="%" style={{ width: 110 }} />
          <Button icon={<PercentageOutlined />} loading={applying} onClick={apply}>Apply allowance to all</Button>
        </Space.Compact>
        {deviation.count > 0 && (
          <Space.Compact>
            <Input
              name="apply-reason" aria-label="Reason to apply to every line that deviates" maxLength={300} style={{ width: 280 }}
              placeholder={`Reason for the ${deviation.count} deviating line(s)`} value={reason}
              onChange={(e) => setReason(e.target.value)} onPressEnter={applyReason}
            />
            <Button icon={<EditOutlined />} loading={reasoning} disabled={!reason.trim()} onClick={applyReason}>Apply reason to all</Button>
          </Space.Compact>
        )}
        <Popconfirm title={`Remove ${selectedCount} selected line(s)?`} okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => runGrid(onRemoveSelected)} disabled={!selectedCount}>
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
