import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import ApprovalHistoryTimeline from '../../../components/approval/ApprovalHistoryTimeline';
import ProductionApprovalTimeline from './ProductionApprovalTimeline';
import { getApprovalHistory } from '../../../services/core/approvalFlowService';

/**
 * Engine-backed approval history for production POs, with the legacy flattened
 * timeline as fallback for records that predate the centralised approval engine.
 */
const ProductionEngineHistory = ({ entityType, entityId, legacyHistory = [] }) => {
  const [requests, setRequests] = useState(null);

  useEffect(() => {
    if (!entityType || !entityId) {
      setRequests([]);
      return undefined;
    }
    let active = true;
    setRequests(null);
    getApprovalHistory(entityType, entityId)
      .then((data) => active && setRequests(data || []))
      .catch(() => active && setRequests([]));
    return () => { active = false; };
  }, [entityType, entityId]);

  if (requests === null) return <Spin size="small" />;
  if (!requests.length) return <ProductionApprovalTimeline history={legacyHistory} />;
  return <ApprovalHistoryTimeline requests={requests} />;
};

export default ProductionEngineHistory;
