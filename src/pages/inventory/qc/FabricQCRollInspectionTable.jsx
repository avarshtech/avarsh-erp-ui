import { memo, useMemo } from 'react';
import { Alert, Table, InputNumber, Select, Typography, Empty } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { isWithinTolerance } from '../../../utils/qcValidation';
import { FABRIC_QC_TOLERANCE_PCT, ROLL_RESULT } from '../../../utils/inventoryConstants';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const cellStatus = (ok) =>
  ok
    ? { background: 'rgba(82, 196, 26, 0.10)', borderRadius: 'var(--radius-sm)' }
    : { background: 'rgba(255, 77, 79, 0.10)', borderRadius: 'var(--radius-sm)' };

// Colour lives on the option label: antd renders the selected option's label inside
// the closed selector, so a long roll list still scans for FAILs at a glance without
// needing a CSS override on .ant-select-selector.
const RESULT_OPTIONS = [
  { value: ROLL_RESULT.PASS, label: <Text style={{ color: 'var(--success-color, #52c41a)', fontWeight: 600 }}>Pass</Text> },
  { value: ROLL_RESULT.FAIL, label: <Text style={{ color: 'var(--error-color, #ff4d4f)', fontWeight: 600 }}>Fail</Text> },
];

const FabricQCRollInspectionTable = memo(function FabricQCRollInspectionTable({
  rolls = [],
  onRollChange,
  readOnly = false,
}) {
  const columns = useMemo(
    () => [
      { title: '#', key: 'idx', align: 'center', width: 50, render: (_, __, i) => i + 1 },
      { title: 'Roll #', dataIndex: 'rollNumber', align: 'center', width: 100, render: (v) => <Text strong>{v}</Text> },
      { title: 'Item Code', dataIndex: 'itemCode', align: 'center', width: 140, render: (v, r) => <Text code style={{ fontSize: 12 }}>{r.variantCode || v || '—'}</Text> },
      { title: 'Description', dataIndex: 'description', align: 'center', ellipsis: true },
      {
        title: 'Qty',
        dataIndex: 'qty',
        align: 'center',
        width: 90,
        render: (v, r) => `${formatNumber(v, 1)} ${r.uom || ''}`,
      },
      { title: 'Width', dataIndex: 'stdWidth', align: 'center', width: 100, render: (v) => v ?? '—' },
      { title: 'GSM', dataIndex: 'stdGsm', align: 'center', width: 100, render: (v) => v ?? '—' },
      {
        title: 'Actual Width',
        dataIndex: 'actualWidth',
        align: 'center',
        width: 130,
        render: (val, _, i) => {
          const ok = isWithinTolerance(val, rolls[i]?.stdWidth);
          return (
            <InputNumber
              size="small"
              min={0}
              precision={2}
              value={val}
              controls={false}
              disabled={readOnly}
              style={{ width: '100%', ...(val != null ? cellStatus(ok) : {}) }}
              onChange={(v) => onRollChange?.(i, 'actualWidth', v)}
            />
          );
        },
      },
      {
        title: 'Actual GSM',
        dataIndex: 'actualGsm',
        align: 'center',
        width: 130,
        render: (val, _, i) => {
          const ok = isWithinTolerance(val, rolls[i]?.stdGsm);
          return (
            <InputNumber
              size="small"
              min={0}
              precision={2}
              value={val}
              controls={false}
              disabled={readOnly}
              style={{ width: '100%', ...(val != null ? cellStatus(ok) : {}) }}
              onChange={(v) => onRollChange?.(i, 'actualGsm', v)}
            />
          );
        },
      },
      {
        // Set by the inspector, not derived: a roll inside tolerance can still be
        // rejected for a bad shade band, and one outside it can still be usable.
        title: 'Result',
        dataIndex: 'result',
        key: 'result',
        align: 'center',
        width: 120,
        render: (val, _, i) => (
          <Select
            size="small"
            allowClear
            placeholder="Select"
            value={val ?? undefined}
            options={RESULT_OPTIONS}
            disabled={readOnly}
            style={{ width: '100%' }}
            onChange={(v) => onRollChange?.(i, 'result', v ?? null)}
          />
        ),
      },
    ],
    [rolls, readOnly, onRollChange],
  );

  return (
    <>
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 12, borderRadius: 'var(--radius-md)' }}
        message={
          <Text style={{ fontSize: 12 }}>
            <Text strong>For reference:</Text> width and GSM within −{FABRIC_QC_TOLERANCE_PCT}% to +{FABRIC_QC_TOLERANCE_PCT}% of standard are highlighted green, outside red.
            {' '}The result for each roll is set by the inspector.
          </Text>
        }
      />
      <Table
        rowKey={(r, i) => `${r.rollNumber}-${i}`}
        columns={columns}
        dataSource={rolls}
        pagination={false}
        size="small"
        scroll={{ x: 1220 }}
        locale={{
          emptyText: <Empty description="Pick a PO line item to load rolls from the GRN." />,
        }}
      />
    </>
  );
});

export default FabricQCRollInspectionTable;
