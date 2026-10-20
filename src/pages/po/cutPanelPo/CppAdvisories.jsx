import { memo } from 'react';
import { Alert, Input, Space, Typography } from 'antd';

const { Text } = Typography;

const REASON_FIELD = { LATE_DELIVERY: 'lateDeliveryReason', DUPLICATE_PO: 'duplicateReason' };

/**
 * The checks that warn and need a reason instead of blocking (PRD house rule, §16.4):
 * late delivery (VR-08), duplicate PO (VR-14) — reasons recorded here — and rate variance
 * (VR-12), whose reason goes on its line. The approver sees them with the reasons given.
 */
const CppAdvisories = memo(function CppAdvisories({ doc, advisories, editable, onPatch }) {
  if (!advisories?.length) return null;
  return (
    <Alert
      type="warning" showIcon style={{ marginBottom: 16 }} title="Needs a reason, then proceeds"
      description={(
        <Space orientation="vertical" style={{ width: '100%' }}>
          {advisories.map((a) => {
            const field = REASON_FIELD[a.code];
            return (
              <div key={`${a.code}-${a.lineKey || ''}`}>
                <Text>{a.msg}</Text>
                {field ? (
                  <Input
                    name={field} aria-label="Reason" style={{ marginTop: 4 }} placeholder="Reason" disabled={!editable}
                    status={String(doc[field] || '').trim() ? undefined : 'warning'} value={doc[field] || ''}
                    onChange={(e) => onPatch({ [field]: e.target.value })}
                  />
                ) : <Text type="secondary"> {a.resolved ? '— reason recorded on the line.' : '— give the reason on the line.'}</Text>}
              </div>
            );
          })}
        </Space>
      )}
    />
  );
});

export default CppAdvisories;
