import { Descriptions, Divider, Space, Tag, Typography } from 'antd';
import { jobWorkApproval } from '../../../utils/vendorEligibility';

const { Text } = Typography;

/** The job-work section of the vendor drawer: the approval and the processes it does. */
const VendorApprovalDetails = ({ vendor, nameOf }) => {
  const approval = jobWorkApproval(vendor.jobWorkApprovedUntil);
  const ids = vendor.processIds || [];

  return (
    <>
      <Divider titlePlacement="start">Job Work</Divider>
      <Descriptions column={1} size="small" styles={{ label: { width: 140 } }} items={[
        { key: 'approval', label: 'Approval', children: <Tag color={approval.color}>{approval.label}</Tag> },
        {
          key: 'processes',
          label: 'Processes',
          children: ids.length
            ? <Space size={4} wrap>{ids.map((id) => <Tag key={id}>{nameOf(id)}</Tag>)}</Space>
            : <Text type="secondary">None yet: pick at least one on the next edit</Text>,
        },
      ]} />
    </>
  );
};

export default VendorApprovalDetails;
