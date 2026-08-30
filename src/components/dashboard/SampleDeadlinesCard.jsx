import { memo } from 'react';
import { Table, Tag, Typography, Skeleton } from 'antd';
import { useNavigate } from 'react-router-dom';
import StatusTag from '../StatusTag';
import { SR_STATUS_CONFIG } from '../../utils/statusConfig';
import { getSrStatusLabel } from '../../utils/sampleRequestConstants';
import { RAG_TAG_COLOR, deadlineLabel } from '../../utils/deadlineUtils';
import { formatDate } from '../../utils/formatters';

const { Text } = Typography;

/**
 * Sample Deadline Tracker (PRD §12.3) — the "Sample Deadlines" tab content on
 * the Recent Orders panel. Sorted most urgent first, colour-coded on Days
 * Remaining with the shared thresholds.
 */
const SampleDeadlinesCard = memo(function SampleDeadlinesCard({ deadlines, loading }) {
  const navigate = useNavigate();
  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />;

  const columns = [
    {
      title: 'SR Number', dataIndex: 'srNo', key: 'srNo', width: 140,
      render: (v, r) => (
        <Text
          strong style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
          onClick={() => navigate(`/sample-requests/list?viewId=${r.id}`)}
        >
          {v}
        </Text>
      ),
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 120 },
    {
      title: 'Sample Type', dataIndex: 'sampleTypeName', key: 'sampleTypeName', width: 170,
      render: (v) => <Tag color="purple" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>{v}</Tag>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 175,
      render: (s) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          <StatusTag status={s} config={SR_STATUS_CONFIG} getLabel={getSrStatusLabel} />
        </span>
      ),
    },
    { title: 'Dispatch Deadline', dataIndex: 'dispatchDeadline', key: 'dispatchDeadline', width: 130, render: (d) => <span style={{ whiteSpace: 'nowrap' }}>{formatDate(d)}</span> },
    { title: 'Buyer Deadline', dataIndex: 'buyerApprovalDeadline', key: 'buyerApprovalDeadline', width: 130, render: (d) => <span style={{ whiteSpace: 'nowrap' }}>{formatDate(d)}</span> },
    {
      title: 'Days Remaining', key: 'days', width: 140,
      render: (_, r) => <Tag color={RAG_TAG_COLOR[r.rag] || 'default'} style={{ whiteSpace: 'nowrap' }}>{deadlineLabel(r.days)}</Tag>,
    },
  ];

  return (
    <Table
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={deadlines || []}
      pagination={false}
      scroll={{ x: 1020 }}
      locale={{ emptyText: 'No active sample deadlines' }}
    />
  );
});

export default SampleDeadlinesCard;
