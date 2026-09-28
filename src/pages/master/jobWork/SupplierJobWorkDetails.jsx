import { Descriptions, Divider, Space, Tag, Typography } from 'antd';
import { jobWorkApproval } from '../../../utils/vendorEligibility';

const { Text } = Typography;

/** The job-work section of the supplier view drawer; nothing for a supplier that is not a job worker. */
const SupplierJobWorkDetails = ({ supplier, processes }) => {
  if (!supplier?.jobWorker) return null;
  const approval = jobWorkApproval(supplier.jobWorkApprovedUntil);
  const ids = supplier.processIds || [];

  return (
    <>
      <Divider titlePlacement="start">Job Work</Divider>
      <Descriptions column={1} size="small" styles={{ label: { width: 140 } }} items={[
        { key: 'approval', label: 'Approval', children: <Tag color={approval.color}>{approval.label}</Tag> },
        {
          key: 'processes',
          label: 'Processes',
          children: ids.length
            ? <Space size={4} wrap>{ids.map((id) => <Tag key={id}>{processes.nameOf(id)}</Tag>)}</Space>
            : <Text type="secondary">None</Text>,
        },
      ]} />
    </>
  );
};

export default SupplierJobWorkDetails;
