import { Tag, Tooltip } from 'antd';
import { ActionButton } from '../../components/buttons';
import RecordLink from '../../components/RecordLink';
import { statusMeta, conditionMeta, dash } from '../../utils/assetConstants';

/**
 * The register's columns.
 *
 * Location is one column, not four: a reader wants "where is it", and four
 * narrow columns of mostly-repeated unit and department names push the columns
 * that identify the asset off the screen.
 */
export const buildAssetListColumns = ({ onOpen, onEdit, canUpdate }) => [
  {
    title: 'Asset ID',
    dataIndex: 'assetId',
    width: 140,
    render: (value, row) => <RecordLink text={value} onClick={() => onOpen(row)} />,
  },
  { title: 'Name', dataIndex: 'name', width: 200, render: dash },
  {
    title: 'Category',
    dataIndex: 'categoryName',
    width: 170,
    render: (value, row) => (row.subCategoryName ? `${value} / ${row.subCategoryName}` : dash(value)),
  },
  {
    title: 'Make',
    dataIndex: 'brand',
    width: 150,
    render: (value, row) => [value, row.model].filter(Boolean).join(' ') || '-',
  },
  { title: 'Serial no.', dataIndex: 'serialNo', width: 140, render: dash },
  {
    title: 'Location',
    key: 'location',
    width: 240,
    render: (_, row) => {
      const parts = [row.unitName, row.departmentName, row.sectionName, row.lineName].filter(Boolean);
      const text = parts.join(' / ');
      return <Tooltip title={text}>{text || '-'}</Tooltip>;
    },
  },
  { title: 'Custodian', dataIndex: 'custodianName', width: 170, render: dash },
  {
    title: 'Status',
    dataIndex: 'status',
    width: 190,
    // The reason under the status, because a column of identical "Idle" tags
    // is the problem this whole feature exists to solve.
    render: (value, row) => (
      <>
        <Tag color={statusMeta(value).color}>{statusMeta(value).label}</Tag>
        {row.statusReasonLabel && (
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{row.statusReasonLabel}</div>
        )}
      </>
    ),
  },
  {
    title: 'Condition',
    dataIndex: 'condition',
    width: 130,
    render: (value) => <Tag color={conditionMeta(value).color}>{conditionMeta(value).label}</Tag>,
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 110,
    fixed: 'right',
    render: (_, row) => (
      <>
        <ActionButton action="view" size="small" aria-label={`View ${row.assetId}`} onClick={() => onOpen(row)} />
        {/* A disposed asset is kept for the audit trail and the server refuses an edit of it. */}
        {canUpdate && row.status !== 'DISPOSED' && (
          <ActionButton action="edit" size="small" aria-label={`Edit ${row.assetId}`} onClick={() => onEdit(row)} />
        )}
      </>
    ),
  },
];

export default buildAssetListColumns;
