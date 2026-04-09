import { memo } from 'react';
import { Card, Tag, Tooltip, Space } from 'antd';
import { BugOutlined, DashboardOutlined } from '@ant-design/icons';
import FabricQCDefectTable from './FabricQCDefectTable';
import { FABRIC_QC_DEFECT_FAIL_THRESHOLD } from '../../../utils/inventoryConstants';

const FabricQCDefectAnalysis = memo(function FabricQCDefectAnalysis({
  defects,
  rollOptions,
  defectTypeOptions,
  onDefectChange,
  onAddDefect,
  onRemoveDefect,
  readOnly = false,
}) {
  return (
    <Card
      size="small"
      title={
        <Space>
          <BugOutlined />
          <span>Defect Analysis</span>
        </Space>
      }
      extra={
        <Tooltip title={`A roll fails if the total defect count for that roll exceeds the threshold (${FABRIC_QC_DEFECT_FAIL_THRESHOLD}).`}>
          <Tag color="blue" icon={<DashboardOutlined />}>
            Threshold: {FABRIC_QC_DEFECT_FAIL_THRESHOLD} defects / roll
          </Tag>
        </Tooltip>
      }
    >
      <FabricQCDefectTable
        defects={defects}
        rollOptions={rollOptions}
        defectTypeOptions={defectTypeOptions}
        onDefectChange={onDefectChange}
        onAddDefect={onAddDefect}
        onRemoveDefect={onRemoveDefect}
        readOnly={readOnly}
      />
    </Card>
  );
});

export default FabricQCDefectAnalysis;
