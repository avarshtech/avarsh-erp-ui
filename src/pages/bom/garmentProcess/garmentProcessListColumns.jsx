import StatusTag from '../../../components/StatusTag';
import RecordLink from '../../../components/RecordLink';
import { ActionButton } from '../../../components/buttons';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getRequirementStatusLabel, isRequirementEditable, isRequirementEditableInPlace } from '../../../utils/requirementStatus';
import { formatDate } from '../../../utils/formatters';

const rowAction = (r, { onOpen, onEdit, canUpdate }) => {
  if (canUpdate && isRequirementEditable(r.status)) {
    return <ActionButton action="edit" size="small" aria-label={`Edit ${r.requirementNo}`} onClick={() => onOpen(r)} />;
  }
  if (canUpdate && isRequirementEditableInPlace(r.status, r.placedPos)) {
    return <ActionButton action="edit" size="small" aria-label={`Edit ${r.requirementNo}`} onClick={() => onEdit(r)} />;
  }
  return <ActionButton action="view" size="small" aria-label={`View ${r.requirementNo}`} onClick={() => onOpen(r)} />;
};

/**
 * Columns of the Garment Process Requirement list (PRD §15). Edit opens a draft, or a
 * submitted requirement no PO is placed against yet (in edit mode).
 */
export const buildGarmentProcessListColumns = ({ onOpen, onEdit, canUpdate }) => [
  {
    title: 'Requirement No.', dataIndex: 'requirementNo', key: 'requirementNo', width: 160, fixed: 'left',
    render: (v, r) => <RecordLink text={v} onClick={() => onOpen(r)} />,
  },
  { title: 'Order No.', dataIndex: 'orderNo', key: 'orderNo', width: 140 },
  { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 110 },
  {
    title: 'Process', key: 'process', width: 280,
    render: (_, r) => r.lines.map((l) => l.label).join(' → '),
  },
  {
    title: 'Qty', key: 'qty', width: 190, align: 'right',
    render: (_, r) => (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {r.lines.map((l) => l.total.toLocaleString('en-IN')).join(' / ')}
      </span>
    ),
  },
  { title: 'Date', dataIndex: 'createdOn', key: 'createdOn', width: 120, render: (v) => formatDate(v) },
  {
    title: 'Status', dataIndex: 'status', key: 'status', width: 140, align: 'center',
    render: (s) => <StatusTag status={s} config={REQUIREMENT_STATUS_CONFIG} getLabel={getRequirementStatusLabel} />,
  },
  {
    title: 'Actions', key: 'actions', width: 90, fixed: 'right',
    render: (_, r) => rowAction(r, { onOpen, onEdit, canUpdate }),
  },
];
