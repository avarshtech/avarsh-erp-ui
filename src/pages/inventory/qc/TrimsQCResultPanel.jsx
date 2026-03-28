import { memo } from 'react';
import { Card, Descriptions, Divider, Tag, Button, Input, Space, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;
const { TextArea } = Input;

const RESULT_CONFIG = {
  Pass: { color: 'green', label: 'ACCEPTED' },
  'Conditional Pass': { color: 'orange', label: 'CONDITIONAL' },
  Fail: { color: 'red', label: 'REJECTED' },
  Pending: { color: 'default', label: 'PENDING' },
};

const TrimsQCResultPanel = memo(function TrimsQCResultPanel({
  overallResult = 'Pending',
  totalDefects = 0,
  majorDefects = 0,
  minorDefects = 0,
  aqlLevel = '2.5',
  lotSize = 0,
  sampleSize = 0,
  approvalStatus = 'Pending',
  onApprove,
  onReject,
  readOnly = false,
  approver,
  approvalRemarks,
}) {
  const resultCfg = RESULT_CONFIG[overallResult] || RESULT_CONFIG.Pending;

  return (
    <Card title="AQL Inspection Result" size="small" style={{ height: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Tag
          color={resultCfg.color}
          style={{ fontSize: 18, padding: '8px 24px', fontWeight: 700, borderRadius: 'var(--radius-full)' }}
        >
          {resultCfg.label}
        </Tag>
      </div>

      <Descriptions column={1} size="small" labelStyle={{ fontSize: 13 }} contentStyle={{ fontSize: 13, fontWeight: 600 }}>
        <Descriptions.Item label="AQL Level">{aqlLevel}</Descriptions.Item>
        <Descriptions.Item label="Lot Size">{formatNumber(lotSize)}</Descriptions.Item>
        <Descriptions.Item label="Sample Size">{formatNumber(sampleSize)}</Descriptions.Item>
        <Descriptions.Item label="Total Defects">{totalDefects}</Descriptions.Item>
        <Descriptions.Item label="Major Defects">
          <Text style={{ color: majorDefects > 0 ? 'var(--error-color)' : undefined }}>{majorDefects}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Minor Defects">
          <Text style={{ color: minorDefects > 0 ? 'var(--warning-color)' : undefined }}>{minorDefects}</Text>
        </Descriptions.Item>
      </Descriptions>

      <Divider style={{ margin: '12px 0' }} />

      <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>Asst. Merchandiser Approval</Text>

      {approvalStatus === 'Approved' || approvalStatus === 'Rejected' ? (
        <div>
          <Tag color={approvalStatus === 'Approved' ? 'green' : 'red'}>{approvalStatus}</Tag>
          {approver && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>By: {approver}</Text>}
          {approvalRemarks && <Text style={{ fontSize: 12, display: 'block', marginTop: 4, fontStyle: 'italic' }}>{approvalRemarks}</Text>}
        </div>
      ) : !readOnly ? (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <TextArea placeholder="Approval remarks..." rows={2} id="trims-approval-remarks" />
          <Space>
            <Button type="primary" icon={<CheckCircleOutlined />} size="small" onClick={onApprove}>Approve</Button>
            <Button danger icon={<CloseCircleOutlined />} size="small" onClick={onReject}>Reject</Button>
          </Space>
        </Space>
      ) : (
        <Tag color="blue">Pending Approval</Tag>
      )}
    </Card>
  );
});

export default TrimsQCResultPanel;
