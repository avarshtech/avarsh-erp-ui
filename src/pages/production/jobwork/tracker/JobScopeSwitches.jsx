import { memo, useEffect, useState } from 'react';
import {
  App, Button, Card, Checkbox, Space, Tooltip, Typography,
} from 'antd';
import { updateJobScope } from '../../../../services/production/jobwork/jobWorkTrackerApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { FINISHING_STAGES, STAGE_LABEL } from '../../../../utils/jobWorkTracker/constants';

const { Text } = Typography;

/**
 * Which finishing stages a vendor Work Order job tracks (decision 6: a CMT rate includes finishing up
 * to packing). A stage that already has progress or receipts cannot be switched off.
 */
const JobScopeSwitches = memo(function JobScopeSwitches({ jobId, finishing, canEdit, onSaved }) {
  const { message } = App.useApp();
  const [scope, setScope] = useState(finishing.scope);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setScope(finishing.scope); }, [finishing.scope]);
  const dirty = scope.length !== finishing.scope.length || scope.some((s) => !finishing.scope.includes(s));
  const save = async () => {
    setSaving(true);
    try {
      await updateJobScope(jobId, { stages: scope });
      message.success('Finishing scope saved.');
      onSaved();
    } catch (e) { toastUnlessHandled(message, e, 'Could not save the scope.'); } finally { setSaving(false); }
  };
  return (
    <Card size="small" title="Finishing done by this vendor" style={{ marginBottom: 12 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Switch off the stages done in-house; a stage that already has progress or receipts stays on. With none on, the job ends at Stitched.
      </Text>
      <Space wrap>
        {FINISHING_STAGES.map((st) => {
          const locked = finishing.locked.includes(st);
          return (
            <Tooltip key={st} title={locked ? 'Has progress or receipts already' : undefined}>
              <Checkbox
                name={`scope-${st}`}
                checked={scope.includes(st)}
                disabled={!canEdit || locked}
                onChange={(e) => setScope((s) => (e.target.checked ? [...s, st] : s.filter((x) => x !== st)))}
              >
                {STAGE_LABEL[st]}
              </Checkbox>
            </Tooltip>
          );
        })}
        <Button type="primary" size="small" onClick={save} loading={saving} disabled={!canEdit || !dirty}>Save scope</Button>
      </Space>
    </Card>
  );
});

export default JobScopeSwitches;
