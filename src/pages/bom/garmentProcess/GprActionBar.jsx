import { memo } from 'react';
import { Button, Typography } from 'antd';
import { SaveOutlined, SendOutlined } from '@ant-design/icons';
import StickyActionBar from '../shared/StickyActionBar';
import StatusTag from '../../../components/StatusTag';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getRequirementStatusLabel } from '../../../utils/requirementStatus';
import { gprFlowLabel } from '../../../utils/garmentProcessCalc';

const { Text } = Typography;

/**
 * Sticky action bar (PRD §6/§13): message area, Cancel, Save draft, Submit. Line totals
 * are never combined (PRD §11), so the bar shows the process count and the flow.
 * Reopen and Close are page-head actions, not here.
 */
const GprActionBar = memo(function GprActionBar({ doc, editable, busy, errors, on }) {
  const flow = gprFlowLabel(doc.lines);
  return (
    <StickyActionBar
      errors={errors}
      summary={(
        <>
          <span><Text type="secondary">Processes</Text> <strong>{doc.lines.length}</strong></span>
          {flow && <span><Text type="secondary">Flow</Text> <strong>{flow}</strong></span>}
          <StatusTag status={doc.status} config={REQUIREMENT_STATUS_CONFIG} getLabel={getRequirementStatusLabel} />
        </>
      )}
    >
      <Button onClick={on.cancel}>{editable ? 'Cancel' : 'Back to list'}</Button>
      {editable && <Button icon={<SaveOutlined />} onClick={on.save} loading={busy === 'save'} disabled={Boolean(busy)}>Save draft</Button>}
      {editable && <Button type="primary" icon={<SendOutlined />} onClick={on.submit} loading={busy === 'submit'} disabled={Boolean(busy)}>Submit</Button>}
    </StickyActionBar>
  );
});

export default GprActionBar;
