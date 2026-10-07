import { Badge, Tag } from 'antd';
import { SafetyOutlined, StopOutlined } from '@ant-design/icons';
import DetailCard from '../../../../components/DetailCard';
import EmptyState from '../../../../components/EmptyState';
import AccessGrid from './AccessGrid';
import SectionIcon from './SectionIcon';
import { buildRows, screenCount } from './accessGridModel';

/**
 * The view dialog's Access block, laid out as POView's "Line Items": every section the role can
 * open as a titled card of ticks — in the editor's columns — then one card naming the sections it
 * cannot. The whole role reads on one scroll; nothing to click into.
 */
const RoleAccessSummary = ({ sections, permissions, screens, superuser, onEdit }) => {
  const cards = sections.map((section) => ({
    section,
    rows: buildRows(section, permissions, '', 'granted'),
    count: screenCount(permissions, section.screens),
  }));
  const open = cards.filter((c) => c.rows.length > 0);
  const closed = cards.filter((c) => c.rows.length === 0);

  return (
    <div>
      <div className="ag-summary-head">
        <SafetyOutlined style={{ color: 'var(--primary-color)' }} />
        <span className="ag-summary-title">Access</span>
        <Badge count={screens.granted} showZero overflowCount={999} style={{ backgroundColor: 'var(--primary-color)' }} />
      </div>

      {open.length === 0 && !superuser && (
        <EmptyState description="This role can't open anything yet" actionLabel="Edit role" onAction={onEdit} />
      )}

      {open.map(({ section, rows, count }) => (
        <DetailCard
          key={section.key}
          title={section.label}
          icon={<SectionIcon name={section.icon} />}
          count={`${count.granted} of ${count.total}`}
          bare
          style={{ marginBottom: 16 }}
        >
          <AccessGrid mode="view" section={section} rows={rows} permissions={permissions} />
        </DetailCard>
      ))}

      {open.length > 0 && closed.length > 0 && (
        <DetailCard title="No access" icon={<StopOutlined />} bare>
          <div className="ag-chips">
            {closed.map(({ section }) => <Tag key={section.key}>{section.label}</Tag>)}
          </div>
        </DetailCard>
      )}
    </div>
  );
};

export default RoleAccessSummary;
