import { memo } from 'react';
import { Button, Typography } from 'antd';
import { CloseCircleOutlined, EditOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import StickyActionBar from '../../../components/StickyActionBar';
import StatusTag from '../../../components/StatusTag';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getRequirementStatusLabel, isRequirementClosable, requirementBarMode, REQUIREMENT_BAR_MODE as MODE } from '../../../utils/requirementStatus';
import { gprFlowLabel } from '../../../utils/garmentProcessCalc';

const { Text } = Typography;

/**
 * Sticky action bar (PRD §6/§13): message area, then Draft: Cancel · Save draft · Submit;
 * Submitted with no PO placed: Back to list · Edit; while edited in place: Cancel edit · Save
 * changes (it stays Submitted); otherwise Back to list. Line totals are never combined (PRD
 * §11), so the bar shows the process count and the flow. Close sits here while the requirement is
 * closable, as on the Cut Panel Requirement.
 * Submit needs add or update (an add-only user submits their saved draft as it is).
 */
const GprActionBar = memo(function GprActionBar({ doc, can, editing, dirty, busy, errors, on }) {
  const flow = gprFlowLabel(doc.lines);
  const mode = requirementBarMode(doc.status, doc.placedPos, editing);
  const editable = mode === MODE.DRAFT && can.edit;
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
      {mode === MODE.EDITING ? (
        <>
          <Button onClick={on.cancelEdit} disabled={Boolean(busy)}>Cancel edit</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={on.saveChanges} loading={busy === 'revise'} disabled={!dirty || Boolean(busy)}>Save changes</Button>
        </>
      ) : (
        <>
          <Button onClick={on.cancel}>{editable ? 'Cancel' : 'Back to list'}</Button>
          {editable && <Button icon={<SaveOutlined />} onClick={on.save} loading={busy === 'save'} disabled={Boolean(busy)}>Save draft</Button>}
          {mode === MODE.DRAFT && can.submit && (
            <Button type="primary" icon={<SendOutlined />} onClick={on.submit} loading={busy === 'submit'} disabled={Boolean(busy)}>Submit</Button>
          )}
          {mode === MODE.IN_PLACE && can.edit && <Button icon={<EditOutlined />} onClick={on.edit} disabled={Boolean(busy)}>Edit</Button>}
          {can.close && isRequirementClosable(doc.status) && (
            <Button danger icon={<CloseCircleOutlined />} onClick={on.close} disabled={Boolean(busy)}>Close</Button>
          )}
        </>
      )}
    </StickyActionBar>
  );
});

export default GprActionBar;
