import { Space, Tag, Tooltip, Typography } from 'antd';
import {
  packingStatusReport, shipmentRegisterReport, invoiceRegisterReport, varianceReport,
  cartonMasterReport, templateCoverageReport, productivityReport,
} from '../../../services/expdoc/expDocService';
import { DOC_TYPE_LABELS, PACKING_TYPE_LABELS } from '../../../utils/expDocConstants';

const { Text } = Typography;

const int = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-IN'));
const dec = (v, dp = 2) => (v === null || v === undefined
  ? '—'
  : Number(v).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
const nowrap = (t) => <Text style={{ whiteSpace: 'nowrap' }}>{t || '—'}</Text>;

const varianceCell = (v) => {
  if (!v) return <Text type="secondary">—</Text>;
  return <Text type={v > 0 ? 'warning' : 'danger'}>{`${v > 0 ? '+' : ''}${int(v)}`}</Text>;
};

/**
 * The seven §22 reports, declared rather than coded.
 *
 * Each is a fetcher plus a column set, so the reports page is one screen with a
 * filter bar and a table — not seven near-identical screens that drift apart. The
 * PRD asks for the same treatment on all of them (filters, server-side pagination,
 * Excel export, permission-respecting), and one definition list is how that stays true.
 */
export const buildReports = () => [
  {
    key: 'PACKING_STATUS',
    label: 'Packing status',
    blurb: 'Ordered vs packed vs shipped per style, colour and size, with the open balance.',
    fetch: packingStatusReport,
    scroll: 1280,
    filters: ['search'],
    columns: [
      { title: 'Order', dataIndex: 'orderNo', width: 150, render: nowrap },
      { title: 'Style', dataIndex: 'styleNo', width: 150 },
      { title: 'Colour', dataIndex: 'colorName', width: 190, ellipsis: true },
      { title: 'Size', dataIndex: 'size', width: 80, align: 'center' },
      { title: 'Ordered', dataIndex: 'orderQty', width: 110, align: 'right', render: int },
      { title: 'Packed', dataIndex: 'packedQty', width: 110, align: 'right', render: int },
      {
        title: 'Shipped',
        dataIndex: 'shippedQty',
        width: 110,
        align: 'right',
        render: (v, r) => (
          <Tooltip title={v === r.packedQty ? undefined : 'Packed on a list that is not approved yet.'}>
            <Text strong={v > 0}>{int(v)}</Text>
          </Tooltip>
        ),
      },
      { title: 'Balance', dataIndex: 'balance', width: 110, align: 'right', render: (v) => varianceCell(-v) },
      {
        title: 'Complete',
        dataIndex: 'completionPct',
        width: 110,
        align: 'right',
        render: (v) => (v === null ? '—' : `${dec(v, 1)}%`),
      },
    ],
  },
  {
    key: 'SHIPMENT_REGISTER',
    label: 'Shipment documents',
    blurb: 'Every packing list, invoice and sticker run per shipment, with status, version and who acted.',
    fetch: shipmentRegisterReport,
    scroll: 1570,
    filters: ['search', 'docType'],
    columns: [
      { title: 'Shipment', dataIndex: 'shipmentNo', width: 155, render: nowrap },
      { title: 'Buyer', dataIndex: 'buyerName', width: 175, ellipsis: true },
      { title: 'Document', dataIndex: 'docType', width: 135, render: (d) => <Tag>{DOC_TYPE_LABELS[d] || d}</Tag> },
      {
        title: 'No.',
        dataIndex: 'docNo',
        width: 185,
        render: (v, r) => (
          <Space size={4}>
            <Text>{v || '—'}</Text>
            {r.revision > 0 && <Tag color="orange">{`R${r.revision}`}</Tag>}
          </Space>
        ),
      },
      { title: 'Status', dataIndex: 'status', width: 120, render: (s) => <Tag>{s}</Tag> },
      { title: 'Tpl v', dataIndex: 'templateVersion', width: 75, align: 'center', render: (v) => (v ? `v${v}` : '—') },
      { title: 'Created by', dataIndex: 'createdBy', width: 130, ellipsis: true },
      { title: 'Approved', dataIndex: 'approvedAt', width: 150, render: nowrap },
      { title: 'By', dataIndex: 'approvedBy', width: 130, ellipsis: true },
      { title: 'Exported', dataIndex: 'exportedAt', width: 150, render: nowrap },
      { title: 'Detail', dataIndex: 'detail', width: 220, ellipsis: true, render: (v) => v || '—' },
    ],
  },
  {
    key: 'INVOICE_REGISTER',
    label: 'Invoice register (FY)',
    blurb: 'The approved series in number order with FX and INR values — what a GST reconciliation reads.',
    fetch: invoiceRegisterReport,
    scroll: 1520,
    filters: ['search'],
    columns: [
      { title: 'Invoice No', dataIndex: 'invoiceNo', width: 190, render: nowrap },
      { title: 'Date', dataIndex: 'invoiceDate', width: 115, render: nowrap },
      { title: 'Buyer', dataIndex: 'buyerName', width: 185, ellipsis: true },
      { title: 'Cur', dataIndex: 'currency', width: 70, align: 'center' },
      { title: 'Value', dataIndex: 'value', width: 130, align: 'right', render: (v) => dec(v) },
      {
        title: 'FX',
        dataIndex: 'fxRate',
        width: 130,
        align: 'right',
        render: (v, r) => (
          <Space size={4}>
            <Text>{dec(v, 4)}</Text>
            {r.fxSource === 'MANUAL' && (
              <Tooltip title="Overridden manually — the reason is in the audit trail."><Tag color="purple">m</Tag></Tooltip>
            )}
          </Space>
        ),
      },
      { title: 'INR value', dataIndex: 'inrValue', width: 150, align: 'right', render: (v) => dec(v) },
      { title: 'IGST', dataIndex: 'igstValue', width: 140, align: 'right', render: (v) => dec(v) },
      { title: 'Status', dataIndex: 'status', width: 120, render: (s) => <Tag>{s}</Tag> },
    ],
  },
  {
    key: 'VARIANCE',
    label: 'Excess / shortage',
    blurb: 'Every quantity variance across shipments, with the reason its approver accepted.',
    fetch: varianceReport,
    scroll: 1480,
    filters: ['search', 'outsideToleranceOnly'],
    columns: [
      { title: 'PL No', dataIndex: 'plNo', width: 175, render: nowrap },
      { title: 'Buyer', dataIndex: 'buyerName', width: 165, ellipsis: true },
      { title: 'Style', dataIndex: 'styleNo', width: 140 },
      { title: 'Colour', dataIndex: 'colorName', width: 175, ellipsis: true },
      { title: 'Size', dataIndex: 'size', width: 75, align: 'center' },
      { title: 'Ordered', dataIndex: 'orderQty', width: 100, align: 'right', render: int },
      { title: 'Shipped', dataIndex: 'shippedQty', width: 100, align: 'right', render: int },
      { title: 'Variance', dataIndex: 'variance', width: 110, align: 'right', render: varianceCell },
      {
        title: '%',
        dataIndex: 'variancePercent',
        width: 100,
        align: 'right',
        render: (v, r) => (
          <Tooltip title={r.withinTolerance ? `Inside the ${r.tolerancePercent}% tolerance` : `Outside the ${r.tolerancePercent}% tolerance`}>
            <Text type={r.withinTolerance ? 'secondary' : 'warning'}>{`${v > 0 ? '+' : ''}${dec(v, 1)}%`}</Text>
          </Tooltip>
        ),
      },
      {
        title: 'Reason accepted',
        dataIndex: 'reason',
        width: 300,
        ellipsis: true,
        render: (v, r) => (v
          ? <Tooltip title={`${v} — ${r.acknowledgedBy}`}><Text>{v}</Text></Tooltip>
          : <Text type="secondary">not acknowledged</Text>),
      },
    ],
  },
  {
    key: 'CARTON_MASTER',
    label: 'Carton master list',
    blurb: 'Every carton of a shipment, one row each. Paged at the source — a shipment of any size opens instantly.',
    fetch: cartonMasterReport,
    scroll: 1400,
    filters: ['shipment'],
    requiresShipment: true,
    columns: [
      {
        title: 'Carton',
        dataIndex: 'cartonNo',
        width: 110,
        render: (v, r) => <Text strong>{`${v} of ${int(r.ofTotal)}`}</Text>,
      },
      { title: 'PL No', dataIndex: 'plNo', width: 170, render: nowrap },
      { title: 'Style', dataIndex: 'styleNo', width: 150 },
      { title: 'Colour', dataIndex: 'colorName', width: 180, ellipsis: true },
      { title: 'Packing', dataIndex: 'packingType', width: 130, render: (p) => <Tag>{PACKING_TYPE_LABELS[p] || p}</Tag> },
      { title: 'Pieces', dataIndex: 'pieces', width: 95, align: 'right', render: int },
      { title: 'Net kg', dataIndex: 'netWeightKg', width: 105, align: 'right', render: (v) => dec(v, 3) },
      { title: 'Gross kg', dataIndex: 'grossWeightKg', width: 105, align: 'right', render: (v) => dec(v, 3) },
      { title: 'L × B × H', dataIndex: 'dimensions', width: 140, render: nowrap },
      { title: 'CBM', dataIndex: 'cbm', width: 100, align: 'right', render: (v) => dec(v, 3) },
      {
        title: 'Stickers',
        dataIndex: 'printCount',
        width: 100,
        align: 'right',
        render: (v) => (v ? <Text>{`${v}×`}</Text> : <Text type="secondary">not printed</Text>),
      },
    ],
  },
  {
    key: 'TEMPLATE_COVERAGE',
    label: 'Template coverage',
    blurb: 'Which buyers have their own layout for each document, and which fall back to the generic set.',
    fetch: templateCoverageReport,
    scroll: 1100,
    filters: ['search', 'gapsOnly'],
    columns: [
      { title: 'Buyer', dataIndex: 'buyerName', width: 230, ellipsis: true },
      { title: 'Code', dataIndex: 'buyerCode', width: 120 },
      { title: 'Document', dataIndex: 'docType', width: 150, render: (d) => <Tag>{DOC_TYPE_LABELS[d] || d}</Tag> },
      { title: 'Template', dataIndex: 'templateCode', width: 210, render: (v) => v || <Text type="secondary">none</Text> },
      { title: 'Version', dataIndex: 'version', width: 90, align: 'center', render: (v) => (v ? `v${v}` : '—') },
      {
        title: 'Coverage',
        dataIndex: 'covered',
        width: 200,
        render: (covered, r) => (covered
          ? <Tag color="green">buyer-specific</Tag>
          : (
            <Tooltip title="Documents still generate, using the standard Indian export layout — but they will not match this buyer's own format.">
              <Tag color="gold">{r.templateCode ? 'generic fallback' : 'no template'}</Tag>
            </Tooltip>
          )),
      },
    ],
  },
  {
    key: 'PRODUCTIVITY',
    label: 'Productivity',
    blurb: 'Documents produced per user, how long they take to approve, and how often a warning is overridden.',
    fetch: productivityReport,
    scroll: 1080,
    filters: ['search'],
    columns: [
      { title: 'User', dataIndex: 'user', width: 200, ellipsis: true },
      { title: 'Documents', dataIndex: 'documents', width: 120, align: 'right', render: int },
      { title: 'Packing lists', dataIndex: 'packingLists', width: 130, align: 'right', render: int },
      { title: 'Invoices', dataIndex: 'invoices', width: 110, align: 'right', render: int },
      { title: 'Sticker runs', dataIndex: 'stickerRuns', width: 130, align: 'right', render: int },
      { title: 'Approvals', dataIndex: 'approvals', width: 115, align: 'right', render: int },
      {
        title: 'Draft → approval',
        dataIndex: 'avgHoursToApproval',
        width: 160,
        align: 'right',
        render: (v) => (v === null
          ? <Tooltip title="Nothing approved yet — not an instant approval."><Text type="secondary">—</Text></Tooltip>
          : `${dec(v, 1)} h`),
      },
      {
        title: 'Overrides / doc',
        dataIndex: 'overrideRate',
        width: 150,
        align: 'right',
        render: (v) => (v === null ? '—' : dec(v, 2)),
      },
    ],
  },
];

export default buildReports;
