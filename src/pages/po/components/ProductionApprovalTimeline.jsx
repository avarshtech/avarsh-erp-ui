import { useMemo } from 'react';
import { Timeline, Typography, Empty } from 'antd';
import {
  FileAddOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
  RollbackOutlined, StopOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const ACTION_META = {
  CREATED:    { color: 'gray',   icon: <FileAddOutlined />,    label: 'Created' },
  SUBMIT:     { color: 'blue',   icon: <SendOutlined />,       label: 'Submitted for approval' },
  APPROVE:    { color: 'green',  icon: <CheckCircleOutlined />, label: 'Approved' },
  REJECT:     { color: 'red',    icon: <CloseCircleOutlined />, label: 'Rejected' },
  REFER_BACK: { color: 'orange', icon: <RollbackOutlined />,    label: 'Referred back' },
  CANCEL:     { color: 'red',    icon: <StopOutlined />,        label: 'Cancelled' },
};

const fmt = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };

/** Approval / status history timeline (PRD §11 auditability). */
const ProductionApprovalTimeline = ({ history = [] }) => {
  const items = useMemo(() => history.map((h) => {
    const meta = ACTION_META[h.action] || ACTION_META.CREATED;
    return {
      color: meta.color,
      dot: meta.icon,
      children: (
        <div>
          <Text strong>{meta.label}</Text>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{fmt(h.at)}</Text>
          <div style={{ fontSize: 13 }}>{h.actor}</div>
          {h.comment && <Text type="secondary" style={{ fontSize: 12 }}>{h.comment}</Text>}
        </div>
      ),
    };
  }), [history]);

  if (!history.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No history yet" />;

  return <Timeline items={items} style={{ marginTop: 8 }} />;
};

export default ProductionApprovalTimeline;
