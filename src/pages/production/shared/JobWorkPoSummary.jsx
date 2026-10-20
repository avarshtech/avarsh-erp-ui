import { memo } from 'react';
import { Descriptions } from 'antd';
import { formatDate } from '../../../utils/formatters';
import { CPP_RETURN_TO, GPO_RETURN_TO, optionLabel } from '../../../utils/jobWorkConstants';

const RETURN_TO = [...CPP_RETURN_TO, ...GPO_RETURN_TO];

/**
 * The approved job-work PO an in-house issue goes out against, read-only (D4): who does the work, when it was
 * ordered and is due back, where it returns to and the processing instructions — the issue copies them, so the
 * drawer never asks for a vendor or dates. `po` is the server's IssuablePo.
 */
const JobWorkPoSummary = memo(function JobWorkPoSummary({ po, dueLabel = 'Expected delivery' }) {
  if (!po) return null;
  const returnTo = po.returnTo === 'OTHER' ? po.returnToOther : optionLabel(RETURN_TO, po.returnTo);
  const unit = [po.returnUnitName, po.returnUnitAddress].filter(Boolean).join(', ');
  return (
    <Descriptions
      size="small" column={{ xs: 1, sm: 2 }} bordered style={{ marginBottom: 16 }}
      items={[
        { key: 'vendor', label: 'Job worker', children: po.vendorName || '—' },
        { key: 'process', label: 'Process', children: po.processLabel || '—' },
        { key: 'poDate', label: 'PO date', children: formatDate(po.poDate) },
        { key: 'due', label: dueLabel, children: formatDate(po.dueDate) },
        { key: 'returnTo', label: 'Return to', children: [returnTo, unit].filter(Boolean).join(' · ') || '—' },
        { key: 'instructions', label: 'Instructions', children: po.instructions || '—', span: 'filled' },
      ]}
    />
  );
});

export default JobWorkPoSummary;
