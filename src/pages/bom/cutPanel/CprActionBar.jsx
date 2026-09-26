import { memo } from 'react';
import { Button, Typography } from 'antd';
import { CloseCircleOutlined, RollbackOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import StickyActionBar from '../shared/StickyActionBar';
import StatusTag from '../../../components/StatusTag';
import { DeleteConfirm } from '../../../components/buttons';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import {
  getRequirementStatusLabel, isRequirementClosable, isRequirementEditable, isRequirementReopenable,
} from '../../../utils/requirementStatus';

const { Text } = Typography;
const Stat = ({ label, value }) => <span><Text type="secondary">{label}</Text> <strong>{value}</strong></span>;

/**
 * Section 5 — sticky action bar (PRD §8.5, no approval): live totals, then
 * Draft: Cancel · Delete · Save Draft · Submit; Submitted: Reopen (nothing consumed) · Close;
 * Partially Used: Close. There is no PO action anywhere on this screen.
 */
const CprActionBar = memo(function CprActionBar({ doc, totals, orderColourCount, can, busy, errors, on }) {
  const editable = isRequirementEditable(doc.status) && can.edit;
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
      <Button onClick={on.cancel}>{editable ? 'Cancel' : 'Back to list'}</Button>
      {editable && doc.id && can.delete && (
        <DeleteConfirm title="Delete draft" recordLabel={doc.cprNo} onConfirm={on.remove} loading={busy === 'delete'}>
          <Button danger loading={busy === 'delete'}>Delete</Button>
        </DeleteConfirm>
      )}
      {editable && <Button icon={<SaveOutlined />} onClick={on.save} loading={busy === 'save'} disabled={Boolean(busy)}>Save Draft</Button>}
      {editable && <Button type="primary" icon={<SendOutlined />} onClick={on.submit} loading={busy === 'submit'} disabled={Boolean(busy)}>Submit</Button>}
      {can.reopen && isRequirementReopenable(doc.status, doc.consumedQty) && (
        <Button icon={<RollbackOutlined />} onClick={on.reopen} disabled={Boolean(busy)}>Reopen</Button>
      )}
      {can.close && isRequirementClosable(doc.status) && (
        <Button danger icon={<CloseCircleOutlined />} onClick={on.close} disabled={Boolean(busy)}>Close</Button>
      )}
    </StickyActionBar>
  );
});

export default CprActionBar;
