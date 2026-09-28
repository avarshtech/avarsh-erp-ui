import { Alert } from 'antd';
import { PROD_PO_STATUS } from '../../../utils/productionConstants';

const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB') : '');

/**
 * Why a production PO was sent back for rework — shown on its form and view while
 * it waits to be corrected and submitted again.
 */
const ReferBackNotice = ({ record }) => {
  if (record?.status !== PROD_PO_STATUS.REFERRED_BACK) return null;
  const by = record.referredBackBy ? ` by ${record.referredBackBy}` : '';
  const at = record.referredBackAt ? ` on ${fmt(record.referredBackAt)}` : '';
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      title={`Referred back${by}${at}`}
      description={record.referBackReason
        ? `Reason: ${record.referBackReason} — make the changes and submit again.`
        : 'Make the changes and submit again.'}
    />
  );
};

export default ReferBackNotice;
