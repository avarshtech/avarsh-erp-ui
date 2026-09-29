import { memo } from 'react';
import { Button, Typography } from 'antd';
import { CloseCircleOutlined, EditOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import StickyActionBar from '../../../components/StickyActionBar';
import StatusTag from '../../../components/StatusTag';
import { DeleteConfirm } from '../../../components/buttons';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import {
  getRequirementStatusLabel, isRequirementClosable, requirementBarMode, REQUIREMENT_BAR_MODE as MODE,
} from '../../../utils/requirementStatus';

const { Text } = Typography;
const Stat = ({ label, value }) => <span><Text type="secondary">{label}</Text> <strong>{value}</strong></span>;

/**
 * Section 5 — sticky action bar (PRD §8.5, no approval): live totals, then Draft: Cancel ·
 * Delete · Save Draft · Submit; Submitted with no PO placed: Back to list · Edit · Close;
 * while edited in place: Cancel edit · Save changes (it stays Submitted); otherwise Back to
 * list · Close while closable. There is no PO action anywhere on this screen. Submit needs
 * add or update (an add-only user submits their saved draft as it is).
 */
const CprActionBar = memo(function CprActionBar({ doc, totals, orderColourCount, can, editing, dirty, busy, errors, on }) {
  const mode = requirementBarMode(doc.status, doc.placedPos, editing);
  const draft = mode === MODE.DRAFT;
  const editable = draft && can.edit;
  return (
    <StickyActionBar
      errors={errors}
      summary={(
        <>
          <Stat label="Lines" value={totals.lineCount} />
          <Stat label="Colours" value={`${totals.colorCount} of ${orderColourCount}`} />
          <Stat label="Processes" value={totals.processCount} />
          <Stat label="Total" value={`${totals.totalQty.toLocaleString('en-IN')} pcs`} />
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
          {editable && doc.id && can.delete && (
            <DeleteConfirm title="Delete draft" recordLabel={doc.cprNo} onConfirm={on.remove} loading={busy === 'delete'}>
              <Button danger loading={busy === 'delete'}>Delete</Button>
            </DeleteConfirm>
          )}
          {editable && <Button icon={<SaveOutlined />} onClick={on.save} loading={busy === 'save'} disabled={Boolean(busy)}>Save Draft</Button>}
          {draft && can.submit && <Button type="primary" icon={<SendOutlined />} onClick={on.submit} loading={busy === 'submit'} disabled={Boolean(busy)}>Submit</Button>}
          {mode === MODE.IN_PLACE && can.edit && <Button icon={<EditOutlined />} onClick={on.edit} disabled={Boolean(busy)}>Edit</Button>}
          {can.close && isRequirementClosable(doc.status) && (
            <Button danger icon={<CloseCircleOutlined />} onClick={on.close} disabled={Boolean(busy)}>Close</Button>
          )}
        </>
      )}
    </StickyActionBar>
  );
});

export default CprActionBar;
