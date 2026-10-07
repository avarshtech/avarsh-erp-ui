import { Col, Row, Tag } from 'antd';
import DetailCard from '../../../../components/DetailCard';
import { formatDate } from '../../../../utils/formatters';
import { usersLabel } from './roleGuards';
import './accessGrid.css';

const LINES = [
  ['view', 'View', 'screens'],
  ['add', 'Add', 'screens'],
  ['update', 'Update', 'screens'],
  ['delete', 'Delete', 'screens'],
  ['other', 'Other rights', 'rights'],
];

/** Who holds the role: their names when the viewer may read users, else how many; null shows the dash. */
const holdersValue = (role, holders) => {
  if (holders) {
    return holders.length
      ? <span className="ag-chips">{holders.map((u) => <Tag key={u.id}>{u.name}</Tag>)}</span>
      : 'Nobody holds this role';
  }
  return role.userCount != null ? usersLabel(role.userCount) : null;
};

/** Where the role reaches, as an index of the cards below: each section with its screens granted. */
const sectionsValue = (sections) => (sections.length
  ? (
    <span className="ag-chips">
      {sections.map((s) => <Tag key={s.key}>{s.label} <span className="ag-chip-count">{s.granted}/{s.total}</span></Tag>)}
    </span>
  )
  : null);

/**
 * The Supplier PO view's detail-cards row for a role: on the left who holds it, where it reaches
 * and when it changed; on the right what it grants, closing with the primary pill where POView
 * puts its Grand Total.
 */
const RoleFactsRow = ({ role, holders, sections, summary, rights }) => (
  <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
    <Col xs={24} md={16}>
      <DetailCard style={{ height: '100%' }}>
        <DetailCard.Field span={24} label="Users" value={holdersValue(role, holders)} />
        <DetailCard.Field span={24} label="Sections with access" value={sectionsValue(sections)} />
        <DetailCard.Field span={12} label="Created" value={formatDate(role.createdAt, 'DD MMM YYYY')} />
        <DetailCard.Field span={12} label="Last changed" value={formatDate(role.updatedAt, 'DD MMM YYYY')} />
      </DetailCard>
    </Col>
    <Col xs={24} md={8}>
      <DetailCard title="Access summary" bare style={{ height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {LINES.map(([key, label, unit]) => (
            <div key={key} className="ag-sum-line">
              <span>{label}</span>
              <strong>{summary[key]} {unit}</strong>
            </div>
          ))}
          <div className="ag-sum-pill">
            <span>Rights granted</span>
            <strong>{rights}</strong>
          </div>
        </div>
      </DetailCard>
    </Col>
  </Row>
);

export default RoleFactsRow;
