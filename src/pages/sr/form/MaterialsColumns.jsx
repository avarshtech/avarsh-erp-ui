import { Input, Tag, Switch, Tooltip, Button, Typography } from 'antd';
import { LockOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { isColourEditable, isMandatoryToggleEnabled } from '../../../utils/sampleFabricRules';
import { computeSampleQtyRequired } from '../../../utils/sampleBomMapper';

const { Text } = Typography;

const STOCK_TAG = {
  IN_STOCK: { color: 'green', label: 'In Stock' },
  SHORTFALL: { color: 'red', label: 'Shortfall' },
  OUT_OF_STOCK: { color: 'red', label: 'Out of Stock' },
};

const lockedCell = (value) => (
  <Tooltip title="Locked to BOM — spec fields are never editable on an SR">
    <Text type="secondary"><LockOutlined style={{ marginInlineEnd: 4, fontSize: 11 }} />{value ?? '—'}</Text>
  </Tooltip>
);

/**
 * Section D columns (PRD v3 §8.2 D). Spec columns are always locked to BOM;
 * only Colour/Design unlocks when substitution is allowed AND the line is not
 * a mandatory trim (per-line override, OQ2). Raise PO is available on every
 * line — primary on shortfall lines — because stock status is indicative only.
 */
export const buildMaterialsColumns = ({
  sr, sampleQty, sizes, readOnly = false,
  onColourChange, onMandatoryChange, onRaisePo, poAllowed = true,
}) => [
  { title: 'Line', dataIndex: 'lineNo', key: 'lineNo', width: 52, align: 'center' },
  { title: 'Fabric Type', dataIndex: 'fabricType', key: 'fabricType', width: 110, render: lockedCell },
  { title: 'Classification', dataIndex: 'classification', key: 'classification', width: 130, render: lockedCell },
  { title: 'Description', dataIndex: 'description', key: 'description', width: 190, render: lockedCell },
  { title: 'Width Std', dataIndex: 'width', key: 'width', width: 90, align: 'center', render: (v) => lockedCell(v || '—') },
  { title: 'Cons.', dataIndex: 'consumption', key: 'consumption', width: 80, align: 'right', render: (v) => lockedCell(v ?? '—') },
  { title: 'UOM', dataIndex: 'uom', key: 'uom', width: 70, align: 'center', render: lockedCell },
  {
    title: 'Colour / Design',
    dataIndex: 'colourDesign',
    key: 'colourDesign',
    width: 180,
    render: (value, line) => {
      const editable = !readOnly && isColourEditable(sr, line);
      if (!editable) {
        const reason = line.section === 'TRIM' && line.mandatory && sr?.colourSubstitutionAllowed
          ? 'Mandatory trim — must match the specified item even though substitution is allowed'
          : 'Substitution not allowed — locked to BOM value';
        return (
          <Tooltip title={reason}>
            <Text type="secondary"><LockOutlined style={{ marginInlineEnd: 4, fontSize: 11 }} />{value || '—'}</Text>
          </Tooltip>
        );
      }
      return (
        <Input
          size="small"
          value={value}
          placeholder="Any available stock"
          onChange={(e) => onColourChange(line.lineNo, e.target.value)}
        />
      );
    },
  },
  {
    title: 'Sample Qty Req.',
    key: 'sampleQtyRequired',
    width: 120,
    align: 'right',
    render: (_, line) => {
      const qty = computeSampleQtyRequired(line, sampleQty, sizes);
      return <Text strong>{qty ? qty.toLocaleString() : '—'}</Text>;
    },
  },
  {
    title: 'Substitution',
    key: 'substitution',
    width: 110,
    align: 'center',
    render: (_, line) => {
      const allowed = isColourEditable(sr, line);
      return <Tag color={allowed ? 'green' : 'default'}>{allowed ? 'Allowed' : 'Not allowed'}</Tag>;
    },
  },
  {
    title: (
      <Tooltip title="Mandatory trims stay locked to spec even when substitution is allowed (e.g. specified Sewing Thread)">
        Mandatory
      </Tooltip>
    ),
    key: 'mandatory',
    width: 90,
    align: 'center',
    render: (_, line) => {
      if (line.section !== 'TRIM') return <Text type="secondary">—</Text>;
      return (
        <Switch
          size="small"
          checked={Boolean(line.mandatory)}
          disabled={readOnly || !isMandatoryToggleEnabled(sr, line, sr?.status || 'DRAFT')}
          onChange={(checked) => onMandatoryChange(line.lineNo, checked)}
        />
      );
    },
  },
  {
    title: 'Stock',
    key: 'stock',
    width: 115,
    align: 'center',
    render: (_, line) => {
      const cfg = STOCK_TAG[line.stockStatus] || { color: 'default', label: '—' };
      return (
        <Tooltip title="Indicative only — no live stock check in v1">
          <Tag color={cfg.color}>{cfg.label}</Tag>
        </Tooltip>
      );
    },
  },
  {
    title: 'Action',
    key: 'action',
    width: 215,
    render: (_, line) => {
      if (line.poRef) {
        // "PO Pending · SPO/26-27/1001" stays on one line — the column is wide
        // enough and the table scrolls horizontally
        return (
          <Tag
            color={line.poRef.status === 'RECEIVED' ? 'green' : 'blue'}
            style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}
          >
            {line.poRef.status === 'RECEIVED' ? 'Received' : 'PO Pending'} · {line.poRef.poNo}
          </Tag>
        );
      }
      if (!poAllowed) {
        return (
          <Tooltip title="POs can be raised only up to Dispatched — this sample has been assessed">
            <Button size="small" disabled icon={<ShoppingCartOutlined />}>Raise PO</Button>
          </Tooltip>
        );
      }
      const shortfall = line.stockStatus && line.stockStatus !== 'IN_STOCK';
      return (
        <Button
          size="small"
          type={shortfall ? 'primary' : 'default'}
          icon={<ShoppingCartOutlined />}
          onClick={() => onRaisePo(line)}
        >
          Raise PO
        </Button>
      );
    },
  },
];

export default buildMaterialsColumns;
