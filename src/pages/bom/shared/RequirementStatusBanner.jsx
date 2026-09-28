import { Alert } from 'antd';
import StatusSteps from '../../../components/StatusSteps';
import { REQUIREMENT_STATUS_CONFIG, requirementStatusFlow } from '../../../utils/statusConfig';
import { getRequirementStatusLabel } from '../../../utils/requirementStatus';
import { formatDate } from '../../../utils/formatters';

/** A requirement's lifecycle steps and, once it is closed, who closed it, when and why. */
const RequirementStatusBanner = ({ doc }) => (
  <>
    <StatusSteps
      statusFlow={requirementStatusFlow(doc.status, doc.consumedQty)} currentStatus={doc.status}
      statusConfig={REQUIREMENT_STATUS_CONFIG} getLabel={getRequirementStatusLabel} size="small" style={{ marginBottom: 16 }}
    />
    {doc.closeReason && (
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        title={`Closed by ${doc.closedBy} on ${formatDate(doc.closedOn, 'DD-MM-YYYY')}`} description={doc.closeReason} />
    )}
  </>
);

export default RequirementStatusBanner;
