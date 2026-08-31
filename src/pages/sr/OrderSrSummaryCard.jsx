import { useState, useEffect } from 'react';
import { Card, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import StatusTag from '../../components/StatusTag';
import { SR_STATUS_CONFIG } from '../../utils/statusConfig';
import { getSrStatusLabel, SR_STATUS } from '../../utils/sampleRequestConstants';
import { hasModuleAccess } from '../../utils/permissions';
import { listByOrderNo } from '../../services/sr/srService';
import DaysRemainingTag from './DaysRemainingTag';

const { Text } = Typography;

/**
 * Sample Requests summary on the Order detail: type, status and latest
 * deadline per SR, plus the total courier cost tracked against the order
 * (summed once per dispatch). Renders nothing when the module is inaccessible
 * or the order has no SRs — OrderView is unchanged for everyone else.
 */
const OrderSrSummaryCard = ({ orderNo }) => {
  const [state, setState] = useState({ rows: [], totalCourierCost: 0, loaded: false });
  const enabled = hasModuleAccess('sample-requests');

  useEffect(() => {
    if (!enabled || !orderNo) return;
    listByOrderNo(orderNo)
      .then(({ content, totalCourierCost }) => setState({ rows: content, totalCourierCost, loaded: true }))
      .catch(() => setState({ rows: [], totalCourierCost: 0, loaded: true }));
  }, [enabled, orderNo]);

  const navigate = useNavigate();
  if (!enabled || !state.loaded || state.rows.length === 0) return null;

  const columns = [
    {
      title: 'SR Number', dataIndex: 'srNo', key: 'srNo', width: 150,
      render: (v, r) => (
        <Text
          strong style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
          onClick={() => navigate(`/sample-requests/list?viewId=${r.id}`)}
        >
          {v}
        </Text>
      ),
    },
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
    {
      title: 'Latest Deadline', key: 'deadline', width: 210,
      render: (_, r) => {
        const date = r.status === SR_STATUS.DISPATCHED ? r.buyerApprovalDeadline : r.dispatchDeadline;
        return <DaysRemainingTag date={date} showDate />;
      },
    },
  ];

  return (
    <Card
      size="small"
      title="Sample Requests"
      style={{ marginTop: 16 }}
      extra={state.totalCourierCost > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Sample courier cost against this order: <Text strong>{state.totalCourierCost.toLocaleString()}</Text>
        </Text>
      )}
    >
      <Table
        rowKey="id"
        size="small"
        bordered
        columns={columns}
        dataSource={state.rows}
        pagination={false}
        scroll={{ x: 750 }}
      />
    </Card>
  );
};

export default OrderSrSummaryCard;
