import { memo } from 'react';
import { Alert, Col, Drawer, Row, Skeleton, Statistic, Table, Typography } from 'antd';
import useRequirementAllocation from './useRequirementAllocation';
import { stepColumns, poColumns } from './requirementAllocationColumns';
import { coveragePct } from '../../../utils/jobWorkAllocation';

const { Title, Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');

const TOTALS = [
  ['Required', 'required'], ['In draft PO', 'inDraft'], ["PO'd", 'allocated'],
  ['Completed', 'completed'], ['Released', 'released'], ['Balance', 'balance'],
];

const AllocationContent = ({ source, docId, load }) => {
  const { data, rows, failed, loading } = useRequirementAllocation(source, docId, load);
  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (failed) return <Alert type="error" showIcon title="Could not load the PO allocation." />;
  const { totals } = data.usage;
  return (
    <>
      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        {TOTALS.map(([label, key]) => (
          <Col key={key} xs={8} md={4}><Statistic title={label} value={n(totals[key])} /></Col>
        ))}
      </Row>
      <Text type="secondary">
        Coverage {coveragePct(totals)}% · balance is required less PO'd; a draft PO shows here but reserves nothing.
      </Text>
      <Title level={5} style={{ marginTop: 16 }}>{source === 'GPR' ? 'By process line' : 'By process step'}</Title>
      <Table
        size="small" rowKey="key" pagination={false} dataSource={rows} columns={stepColumns(source)}
        scroll={{ x: 1000 }} expandable={{ defaultExpandAllRows: false }}
      />
      <Title level={5} style={{ marginTop: 20 }}>Purchase orders</Title>
      <Table
        size="small" rowKey="poNo" pagination={false} dataSource={data.pos} columns={poColumns} scroll={{ x: 900 }}
        locale={{ emptyText: 'No job-work PO has been raised against this requirement yet.' }}
      />
    </>
  );
};

/**
 * Requirement → PO allocation (Cut Panel PO PRD FR-27, Garment Process PO PRD FR-20):
 * the ledger's view of one requirement, reachable from the requirement itself. Read-only;
 * the requirement module holds no PO fields of its own.
 */
const RequirementAllocationDrawer = memo(function RequirementAllocationDrawer({ open, onClose, source, docId, docNo, load }) {
  return (
    <Drawer title={`PO allocation — ${docNo || ''}`} open={open} onClose={onClose} size={1080} destroyOnHidden>
      {open && docId ? <AllocationContent source={source} docId={docId} load={load} /> : null}
    </Drawer>
  );
});

export default RequirementAllocationDrawer;
