import { memo, useMemo } from 'react';
import { Alert, Table, InputNumber, Tag, Typography, Empty } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { isWithinTolerance } from '../../../utils/qcValidation';
import { FABRIC_QC_TOLERANCE_PCT, FABRIC_QC_DEFECT_FAIL_THRESHOLD } from '../../../utils/inventoryConstants';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const cellStatus = (ok) =>
  ok
    ? { background: 'rgba(82, 196, 26, 0.10)', borderRadius: 'var(--radius-sm)' }
    : { background: 'rgba(255, 77, 79, 0.10)', borderRadius: 'var(--radius-sm)' };

const FabricQCRollInspectionTable = memo(function FabricQCRollInspectionTable({
  rolls = [],
  defectsByRoll = new Map(),
  onRollChange,
  readOnly = false,
}) {
  const columns = useMemo(
    () => [
      { title: '#', key: 'idx', align: 'center', width: 50, render: (_, __, i) => i + 1 },
      { title: 'Roll #', dataIndex: 'rollNumber', align: 'center', width: 100, render: (v) => <Text strong>{v}</Text> },
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
        title: 'Result',
        key: 'result',
        align: 'center',
        width: 110,
        render: (_, r) => {
          const widthOk = isWithinTolerance(r.actualWidth, r.stdWidth);
          const gsmOk = isWithinTolerance(r.actualGsm, r.stdGsm);
          const defectCount = (defectsByRoll.get(r.rollNumber) || []).reduce((s, d) => s + (Number(d.count) || 0), 0);
          const defectsOk = defectCount <= FABRIC_QC_DEFECT_FAIL_THRESHOLD;
          if (r.actualWidth == null || r.actualGsm == null) return <Tag>Pending</Tag>;
          const pass = widthOk && gsmOk && defectsOk;
          return pass
            ? <Tag color="success" icon={<CheckCircleOutlined />}>PASS</Tag>
            : <Tag color="error" icon={<CloseCircleOutlined />}>FAIL</Tag>;
        },
      },
    ],
    [rolls, defectsByRoll, readOnly, onRollChange],
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
            <Text strong>Accepted range:</Text> −{FABRIC_QC_TOLERANCE_PCT}% to +{FABRIC_QC_TOLERANCE_PCT}% of standard on width and GSM.
          </Text>
        }
      />
      <Table
        rowKey={(r, i) => `${r.rollNumber}-${i}`}
        columns={columns}
        dataSource={rolls}
        pagination={false}
        size="small"
        scroll={{ x: 1080 }}
        locale={{
          emptyText: <Empty description="Pick a PO line item to load rolls from the GRN." />,
        }}
      />
    </>
  );
});

export default FabricQCRollInspectionTable;
