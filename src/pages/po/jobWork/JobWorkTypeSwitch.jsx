import { memo } from 'react';
import { Segmented, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import { JOB_WORK_PO_PATH } from '../../../utils/jobWorkConstants';
import { JOB_WORK_PO_TYPE_LABEL } from '../../../utils/jobWorkPoStatus';

/**
 * The PO type switch of the job-work PO forms (CPP FR-01/04, GPO FR-01; deviation D1 —
 * the codebase has no Fabric / Trims PO types, so the switch is between the two job-work
 * types). Locked once the PO has lines or a number: changing type means discarding the draft.
 */
const JobWorkTypeSwitch = memo(function JobWorkTypeSwitch({ type, locked }) {
  const navigate = useNavigate();
  const control = (
    <Segmented
      value={type}
      disabled={locked}
      options={Object.entries(JOB_WORK_PO_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
      onChange={(next) => { if (next !== type) navigate(`${JOB_WORK_PO_PATH[next]}/new`); }}
    />
  );
  return locked ? <Tooltip title="The PO type is locked once the PO has lines.">{control}</Tooltip> : control;
});

export default JobWorkTypeSwitch;
