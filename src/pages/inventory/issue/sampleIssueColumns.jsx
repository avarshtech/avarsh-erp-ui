import { Space, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import RecordLink from '../../../components/RecordLink';
import { ActionButton } from '../../../components/buttons';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

/**
 * Columns for the two sides of the Sample Request Issue register.
 *
 * Rows are MaterialIssueResponse — the same records the bulk registers read —
 * so these mirror FabricIssueList / AccessoriesIssueList, swapping the Cutting
 * PO and Work Order columns for the sample request and adding the request's
 * identity (sample type, garment, buyer) that the register groups by.
 */

const statusColumn = {
  title: 'Status', dataIndex: 'status', key: 'status', width: 110, align: 'center',
  render: (s) => (s === 'CANCELLED'
    ? <Tag color="default" style={{ textDecoration: 'line-through' }}>Cancelled</Tag>
    : <Tag color="success">Completed</Tag>),
};

/** Distinct shade lots across the issued rolls — the dye-lot trail on one line. */
const shadeLots = (record) => {
  const lots = [...new Set((record.rolls || []).map((r) => r.shadeLot).filter(Boolean))];
  return lots.length ? lots.join(' · ') : '—';
};

/** Trims can mix UOMs on one document, so the total is reported per UOM. */
const totalQtyByUom = (record) => {
  const byUom = (record.items || []).reduce((acc, it) => {
    const uom = it.uom || '';
    acc[uom] = (acc[uom] || 0) + (Number(it.issuedQty) || 0);
    return acc;
  }, {});
  const entries = Object.entries(byUom);
  if (!entries.length) return formatNumber(record.totalQty);
  return entries.map(([uom, qty]) => `${formatNumber(qty)} ${uom}`.trim()).join(' · ');
};

const identityColumns = ({ showType, onView, onOpenSr }) => [
  {
    title: 'Issue #', dataIndex: 'issueNumber', key: 'issueNumber', width: 150, fixed: 'left', align: 'center',
    render: (v, r) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        <RecordLink text={v} onClick={() => onView(r)} />
      </span>
    ),
  },
  {
    title: 'Issued On', dataIndex: 'issueDate', key: 'issueDate', width: 120, align: 'center',
    render: (v) => (v ? dayjs(v).format('DD-MMM-YYYY') : '—'),
  },
  {
    title: 'Sample Request', dataIndex: 'sampleRequestNo', key: 'sampleRequestNo', width: 155,
    render: (v, r) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        <RecordLink text={v} onClick={() => onOpenSr(r)} />
      </span>
    ),
  },
  // Redundant once a sample-type tab is chosen — the tab already says which
  ...(showType ? [{
    title: 'Sample Type', dataIndex: 'sampleTypeName', key: 'sampleTypeName', width: 170,
    render: (v) => <Tag color="purple" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>{v || '—'}</Tag>,
  }] : []),
  {
    title: 'Style / Garment', key: 'style', width: 220,
    render: (_, r) => (
      <>
        <Text strong>{r.style || '—'}</Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>{r.garmentName}</Text>
      </>
    ),
  },
  { title: 'Buyer', dataIndex: 'buyerName', key: 'buyerName', width: 140, ellipsis: true },
];

const actionsColumn = ({ onView, onPrint, onCancel, canCancel }) => ({
  title: 'Actions', key: 'actions', width: 120, fixed: 'right', align: 'center',
  render: (_, record) => (
    <Space size={4}>
      <ActionButton action="view" size="small" onClick={() => onView(record)} />
      {record.status !== 'CANCELLED' && (
        <ActionButton action="print" size="small" onClick={() => onPrint(record)} />
      )}
      {record.status !== 'CANCELLED' && canCancel && (
        <ActionButton action="cancel" size="small" onClick={() => onCancel(record)} />
      )}
    </Space>
  ),
});

export const fabricIssueColumns = (opts) => [
  ...identityColumns(opts),
  { title: 'Fabric', dataIndex: 'fabric', key: 'fabric', width: 180, ellipsis: true },
  { title: 'Rolls', dataIndex: 'rollsIssued', key: 'rollsIssued', width: 80, align: 'center' },
  {
    title: 'Issued Qty', dataIndex: 'totalWeight', key: 'totalWeight', width: 130, align: 'center',
    render: (v, r) => `${formatNumber(v, 1)} ${r.uom || 'kg'}`,
  },
  {
    title: 'Shade Lots', key: 'shadeLots', width: 150, ellipsis: true,
    render: (_, r) => {
      const lots = shadeLots(r);
      return <Tooltip title={lots === '—' ? null : lots}>{lots}</Tooltip>;
    },
  },
  { title: 'Received By', dataIndex: 'receivedBy', key: 'receivedBy', width: 140, ellipsis: true },
  statusColumn,
  actionsColumn(opts),
];

export const trimsIssueColumns = (opts) => [
  ...identityColumns(opts),
  { title: 'Items', dataIndex: 'itemsCount', key: 'itemsCount', width: 80, align: 'center' },
  {
    title: 'Total Qty', dataIndex: 'totalQty', key: 'totalQty', width: 170, align: 'center',
    render: (_, r) => totalQtyByUom(r),
  },
  { title: 'Received By', dataIndex: 'receivedBy', key: 'receivedBy', width: 140, ellipsis: true },
  statusColumn,
  actionsColumn(opts),
];

/** Widths the two sides scroll at — the type column only shows on the All tab. */
export const SAMPLE_ISSUE_SCROLL_X = {
  FABRIC: { withType: 1670, withoutType: 1500 },
  ACCESSORY: { withType: 1340, withoutType: 1170 },
};
