import { memo, useMemo } from 'react';
import { Table, Select, Input, InputNumber, Badge, Space, Typography, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ActionButton } from '../../../components/buttons';

const { Text } = Typography;

const FabricQCDefectTable = memo(function FabricQCDefectTable({
  defects = [],
  rollOptions = [],
  defectTypeOptions = [],
  onDefectChange,
  onAddDefect,
  onRemoveDefect,
  readOnly = false,
}) {
  const totalDefects = useMemo(() => defects.reduce((s, d) => s + (Number(d.count) || 0), 0), [defects]);

  const columns = useMemo(
    () => [
      {
        title: 'Roll #',
        dataIndex: 'rollNumber',
        key: 'rollNumber',
        align: 'center',
        width: 130,
        render: (val, _, idx) => (
          <Select
            size="small"
            style={{ width: '100%' }}
            value={val || undefined}
            placeholder="Select roll"
            options={rollOptions}
            disabled={readOnly}
            onChange={(v) => onDefectChange?.(idx, 'rollNumber', v)}
          />
        ),
      },
      {
        title: 'Defect Type',
        dataIndex: 'defectTypeId',
        key: 'defectTypeId',
        align: 'center',
        width: 180,
        render: (val, _, idx) => (
          <Select
            size="small"
            style={{ width: '100%' }}
            value={val || undefined}
            placeholder="Select defect type"
            options={defectTypeOptions}
            disabled={readOnly}
            onChange={(v, opt) => {
              onDefectChange?.(idx, 'defectTypeId', v);
              onDefectChange?.(idx, 'defectTypeName', opt?.label || '');
            }}
          />
        ),
      },
      {
        title: 'Defects',
        dataIndex: 'count',
        key: 'count',
        align: 'center',
        width: 100,
        render: (val, _, idx) => (
          <InputNumber
            size="small"
            min={1}
            precision={0}
            value={val}
            controls={false}
            placeholder="Count"
            style={{ width: '100%' }}
            disabled={readOnly}
            onChange={(v) => onDefectChange?.(idx, 'count', v)}
          />
        ),
      },
      {
        title: 'Remarks',
        dataIndex: 'remarks',
        key: 'remarks',
        align: 'center',
        render: (val, _, idx) => (
          <Input
            size="small"
            value={val}
            disabled={readOnly}
            placeholder="Optional remarks"
            onChange={(e) => onDefectChange?.(idx, 'remarks', e.target.value)}
          />
        ),
      },
      {
        title: '',
        key: 'actions',
        align: 'center',
        width: 50,
        render: (_, __, idx) => !readOnly && <ActionButton action="delete" onClick={() => onRemoveDefect?.(idx)} />,
      },
    ],
    [onDefectChange, onRemoveDefect, rollOptions, defectTypeOptions, readOnly],
  );

  return (
    <>
      <Table
        rowKey={(_, idx) => idx}
        columns={columns}
        dataSource={defects}
        pagination={false}
        scroll={{ x: 700 }}
        size="small"
        locale={{
          emptyText: (
            <Empty
              description={rollOptions.length === 0 ? 'No rolls available — pick a PO line item first.' : 'No defects logged yet. Click "Add Defect" to record one.'}
            />
          ),
        }}
      />
      {!readOnly && (
        <div style={{ marginTop: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <ActionButton action="create" text="Add Defect" icon={<PlusOutlined />} onClick={onAddDefect} disabled={rollOptions.length === 0} />
          <Space size={8}>
            <Text type="secondary">Total defects logged:</Text>
            <Badge count={totalDefects} showZero style={{ backgroundColor: 'var(--primary-color)' }} overflowCount={9999} />
          </Space>
        </div>
      )}
    </>
  );
});

export default FabricQCDefectTable;
