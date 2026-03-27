import { memo, useMemo } from 'react';
import { Table, Select, Input, Tag, Badge, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ActionButton } from '../../../components/buttons';
import { DEFECT_TYPES, DEFECT_SIZES } from '../../../utils/inventoryConstants';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const DEFECT_TYPE_OPTIONS = DEFECT_TYPES.map((t) => ({ label: t, value: t }));
const DEFECT_SIZE_OPTIONS = DEFECT_SIZES.map((s) => ({ label: s.label, value: s.value }));

const getPointsForSize = (sizeValue) => {
  const found = DEFECT_SIZES.find((s) => s.value === sizeValue);
  return found ? found.points : 0;
};

const getThresholdColor = (points) => {
  if (points <= 28) return 'var(--success-color)';
  if (points <= 40) return 'var(--warning-color)';
  return 'var(--error-color)';
};

const getThresholdTag = (points) => {
  if (points <= 28) return <Tag color="green">Pass</Tag>;
  if (points <= 40) return <Tag color="orange">Conditional</Tag>;
  return <Tag color="red">Fail</Tag>;
};

const FabricQCDefectTable = memo(function FabricQCDefectTable({
  defects = [],
  onDefectChange,
  onAddDefect,
  onRemoveDefect,
  totalPoints = 0,
  pointsPer100SqYd = 0,
}) {
  const columns = useMemo(
    () => [
      {
        title: 'Roll #', dataIndex: 'rollNumber', key: 'rollNumber', width: 110,
        render: (val, _, idx) => (
          <Input size="small" value={val} placeholder="e.g. R001" onChange={(e) => onDefectChange?.(idx, 'rollNumber', e.target.value)} />
        ),
      },
      {
        title: 'Defect Type', dataIndex: 'defectType', key: 'defectType', width: 160,
        render: (val, _, idx) => (
          <Select size="small" style={{ width: '100%' }} value={val} options={DEFECT_TYPE_OPTIONS} onChange={(v) => onDefectChange?.(idx, 'defectType', v)} />
        ),
      },
      {
        title: 'Defect Size', dataIndex: 'defectSize', key: 'defectSize', width: 160,
        render: (val, _, idx) => (
          <Select
            size="small" style={{ width: '100%' }} value={val} options={DEFECT_SIZE_OPTIONS}
            onChange={(v) => {
              onDefectChange?.(idx, 'defectSize', v);
              onDefectChange?.(idx, 'points', getPointsForSize(v));
            }}
          />
        ),
      },
      { title: 'Points', dataIndex: 'points', key: 'points', width: 70, align: 'center', render: (val) => <Text strong>{val || 0}</Text> },
      {
        title: 'Location', dataIndex: 'location', key: 'location', width: 140,
        render: (val, _, idx) => <Input size="small" value={val} placeholder="Center / Selvage" onChange={(e) => onDefectChange?.(idx, 'location', e.target.value)} />,
      },
      {
        title: 'Remarks', dataIndex: 'remarks', key: 'remarks', width: 160,
        render: (val, _, idx) => <Input size="small" value={val} onChange={(e) => onDefectChange?.(idx, 'remarks', e.target.value)} />,
      },
      {
        title: '', key: 'actions', width: 50, align: 'center',
        render: (_, __, idx) => <ActionButton action="delete" onClick={() => onRemoveDefect?.(idx)} />,
      },
    ],
    [onDefectChange, onRemoveDefect],
  );

  return (
    <>
      <Table rowKey={(_, idx) => idx} columns={columns} dataSource={defects} pagination={false} scroll={{ x: 850 }} size="small" />
      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <ActionButton action="create" text="Add Defect" icon={<PlusOutlined />} onClick={onAddDefect} />
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <Space size={8}>
          <Text type="secondary">Total Defect Points:</Text>
          <Badge count={totalPoints} showZero style={{ backgroundColor: getThresholdColor(pointsPer100SqYd) }} overflowCount={999} />
        </Space>
        <Space size={8}>
          <Text type="secondary">Points / 100 sq yd:</Text>
          <Text strong style={{ color: getThresholdColor(pointsPer100SqYd) }}>{formatNumber(pointsPer100SqYd, 1)}</Text>
        </Space>
        <Space size={8}>
          <Text type="secondary">Threshold (per 100 sq yd):</Text>
          {getThresholdTag(pointsPer100SqYd)}
        </Space>
      </div>
    </>
  );
});

export default FabricQCDefectTable;
