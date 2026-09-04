import { useMemo, useState } from 'react';
import { Table, Alert, Typography, Button, Popover, InputNumber, Space } from 'antd';
import { ScissorOutlined } from '@ant-design/icons';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

// Sub-roll split popover — anchored to the row's Split button.
// Store keeper enters the qty being issued; remainder stays in stock.
const SplitPopover = ({ roll, uom, onSplit }) => {
  const [open, setOpen] = useState(false);
  const [issueQty, setIssueQty] = useState(() => Number((roll.weight / 2).toFixed(1)));

  const confirm = () => {
    const qty = Number(issueQty);
    if (qty > 0 && qty < roll.weight) {
      onSplit(roll.id, qty);
      setOpen(false);
    }
  };

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="left"
      content={
        <Space direction="vertical" size={8} style={{ minWidth: 220, maxWidth: '90vw' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Split <Text strong>{roll.rollNumber}</Text> ({formatNumber(roll.weight, 1)} {uom})
          </Text>
          <InputNumber
            value={issueQty}
            onChange={setIssueQty}
            addonAfter={uom}
            controls={false}
            min={0.1}
            max={Number((roll.weight - 0.1).toFixed(1))}
            style={{ width: '100%' }}
            {...numericInputProps}
          />
          <Space wrap>
            <Button size="small" type="primary" onClick={confirm}>Split</Button>
            <Button size="small" onClick={() => setOpen(false)}>Cancel</Button>
          </Space>
        </Space>
      }
    >
      <Button size="small" icon={<ScissorOutlined />}>Split</Button>
    </Popover>
  );
};

const FabricIssueRollPicker = ({
  availableRolls = [],
  selectedRollIds = [],
  onSelectionChange,
  rollSplits = {},
  onSplit,
  onCancelSplit,
  bomRequired = 0,
  uom = 'kg',
  uomMismatch = false,
  // Sample issues are raised against a sample request, not a Cutting PO, so the
  // one sentence that names the source document is the caller's to supply.
  uomMismatchMessage = 'UOM mismatch between Cutting PO and available stock rolls — cannot proceed with this issue',
}) => {
  // Garments-industry split model: the ORIGINAL roll number stays in stock
  // carrying the remnant qty. A NEW sub-roll with a derived suffix
  // (e.g. R003 → R003-A) is created for the issued qty and goes out with this ticket.
  const effectiveRolls = useMemo(() => {
    const out = [];
    availableRolls.forEach((roll) => {
      const split = rollSplits[roll.id];
      if (split) {
        // Remnant — keeps the ORIGINAL roll number, stays in stock.
        out.push({
          ...roll,
          id: `${roll.id}::remnant`,
          rollNumber: roll.rollNumber,
          weight: split.remainingQty,
          isSplitChild: true,
          splitParentId: roll.id,
          splitVariant: 'remnant',
        });
        // Issued slice — NEW sub-roll with -A suffix, selectable for this issue.
        out.push({
          ...roll,
          id: `${roll.id}::issued`,
          rollNumber: `${roll.rollNumber}-A`,
          weight: split.issueQty,
          isSplitChild: true,
          splitParentId: roll.id,
          splitVariant: 'issued',
        });
      } else {
        out.push(roll);
      }
    });
    return out;
  }, [availableRolls, rollSplits]);

  const selectedQty = useMemo(
    () => effectiveRolls
      .filter((r) => selectedRollIds.includes(r.id))
      .reduce((sum, r) => sum + (Number(r.weight) || 0), 0),
    [effectiveRolls, selectedRollIds],
  );

  const columns = useMemo(() => [
    { title: 'Roll #', dataIndex: 'rollNumber', key: 'rollNumber', width: 120, align: 'center' },
    { title: 'Fabric', dataIndex: 'fabricDescription', key: 'fabricDescription', width: 200, ellipsis: true, align: 'center' },
    { title: 'Width (in)', dataIndex: 'width', key: 'width', width: 90, align: 'center' },
    { title: 'GSM', dataIndex: 'gsm', key: 'gsm', width: 70, align: 'center' },
    {
      title: 'Qty', dataIndex: 'weight', key: 'qty', width: 120, align: 'center',
      render: (v, row) => `${formatNumber(v, 1)} ${row.uom || uom}`,
    },
    { title: 'Shade Lot', dataIndex: 'shadeLot', key: 'shadeLot', width: 110, align: 'center' },
    {
      title: 'Action', key: 'action', width: 110, align: 'center', fixed: 'right',
      render: (_, row) => {
        if (row.isSplitChild) {
          return row.splitVariant === 'issued' ? (
            <Button size="small" danger onClick={() => onCancelSplit(row.splitParentId)}>Rejoin</Button>
          ) : null;
        }
        return <SplitPopover roll={row} uom={row.uom || uom} onSplit={onSplit} />;
      },
    },
  ], [uom, onSplit, onCancelSplit]);

  const rowSelection = useMemo(() => ({
    selectedRowKeys: selectedRollIds,
    onChange: onSelectionChange,
    getCheckboxProps: (row) => ({
      // Remnant sub-roll stays in stock — cannot be issued in the same ticket.
      disabled: (row.isSplitChild && row.splitVariant === 'remnant') || uomMismatch,
    }),
  }), [selectedRollIds, onSelectionChange, uomMismatch]);

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
        <Text>BOM Required: <Text strong>{formatNumber(bomRequired, 1)} {uom}</Text></Text>
        <Text>Selected: <Text strong>{formatNumber(selectedQty, 1)} {uom}</Text></Text>
      </div>
      {uomMismatch && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={uomMismatchMessage}
        />
      )}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={effectiveRolls}
        rowSelection={rowSelection}
        pagination={false}
        scroll={{ x: 820 }}
        size="small"
      />
    </>
  );
};

export default FabricIssueRollPicker;
