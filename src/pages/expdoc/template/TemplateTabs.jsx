import {
  Alert, Button, Card, Checkbox, Col, Empty, Input, InputNumber, Row, Space, Switch,
  Table, Tag, Tooltip, Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { integerInputProps } from '../../../utils/inputHelpers';
import {
  DOC_TYPE, LINE_GRAIN, LINE_GRAIN_LABELS, PACKING_TYPE, PACKING_TYPE_LABELS,
  FACE_RENDER, PAPER_LIST,
} from '../../../utils/expDocConstants';
import FieldBindingPicker from './FieldBindingPicker';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * The builder's tab bodies.
 *
 * Tabs rather than steps: configuring a template is not linear — an admin jumps to
 * the sticker faces, back to the columns, then to the declarations. Steps would
 * impose an order that does not exist.
 *
 * Every editor works on an ordered list, so all of them share one row-mover.
 *
 * `listEditor` is a plain factory, not a hook — it holds no state, and naming it
 * `use…` would both mislead and trip the rules-of-hooks check where a face maps
 * over its lines.
 */
const listEditor = (list, onChange) => ({
  add: (item) => onChange([...(list || []), item]),
  set: (i, changes) => onChange((list || []).map((x, n) => (n === i ? { ...x, ...changes } : x))),
  remove: (i) => onChange((list || []).filter((_, n) => n !== i)),
  move: (i, delta) => {
    const next = [...(list || [])];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  },
});

/*
 * AntD 6 deprecates the index parameter of rowKey, and an index is the only stable
 * identity these ordered lists have — a seeded column carries no id. So the index is
 * stamped onto a render-only copy instead; the stored template is untouched.
 */
const withRowKeys = (list) => (list || []).map((row, i) => ({ ...row, __row: i }));

const RowTools = ({ index, count, list, disabled }) => (
  <Space size={0}>
    <Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={disabled || index === 0} onClick={() => list.move(index, -1)} />
    <Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={disabled || index === count - 1} onClick={() => list.move(index, 1)} />
    <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={disabled} onClick={() => list.remove(index)} />
  </Space>
);

// ─── Identity ───────────────────────────────────────────────────────────────────

export const TabIdentity = ({ tpl, patch, locked, buyers }) => {
  const subClients = buyers.find((b) => b.value === tpl.buyerCode)?.subClients || [];
  const identity = tpl.identity || {};
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card size="small" title="Identity">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Template code</Text>
              <Input value={tpl.templateCode} disabled />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Shared by every version of this template and never changes.
              </Text>
            </div>
            <div>
              <Text type="secondary">Name</Text>
              <Input value={tpl.name || ''} disabled={locked} onChange={(e) => patch({ name: e.target.value })} />
            </div>
            <div>
              <Text type="secondary">Document type</Text>
              <Input value={tpl.docType} disabled />
            </div>
            <Row gutter={8}>
              <Col span={12}>
                <Text type="secondary">Buyer</Text>
                <FormSelect
                  variant="default"
                  style={{ width: '100%' }}
                  disabled={locked}
                  value={tpl.buyerCode || undefined}
                  onChange={(v) => patch({ buyerCode: v || null, subClientCode: null })}
                  options={buyers}
                  placeholder="Generic"
                />
              </Col>
              <Col span={12}>
                <Text type="secondary">Sub-client</Text>
                <FormSelect
                  variant="default"
                  style={{ width: '100%' }}
                  disabled={locked || !subClients.length}
                  value={tpl.subClientCode || undefined}
                  onChange={(v) => patch({ subClientCode: v || null })}
                  options={subClients}
                  placeholder={subClients.length ? 'Optional' : 'None'}
                />
              </Col>
            </Row>
            <Alert
              type="info"
              showIcon
              title="How this template gets used"
              description="A document resolves its template by buyer, then sub-client, then document type. The most specific active version wins; no user picks one."
            />
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card size="small" title="Page and title">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Printed title</Text>
              <Input
                value={identity.titleText || ''}
                disabled={locked}
                placeholder="e.g. PACKING LIST"
                onChange={(e) => patch({ identity: { ...identity, titleText: e.target.value } })}
              />
            </div>
            <Space>
              <Switch
                checked={identity.showLogo !== false}
                disabled={locked}
                onChange={(v) => patch({ identity: { ...identity, showLogo: v } })}
              />
              <Text>Show the exporter logo</Text>
            </Space>
            <Row gutter={8}>
              <Col span={12}>
                <Text type="secondary">Paper</Text>
                <FormSelect
                  variant="default"
                  allowClear={false}
                  style={{ width: '100%' }}
                  disabled={locked}
                  value={identity.paper || 'A4'}
                  onChange={(v) => patch({ identity: { ...identity, paper: v } })}
                  options={[{ value: 'A4', label: 'A4' }, { value: 'A3', label: 'A3' }, { value: 'LETTER', label: 'Letter' }]}
                />
              </Col>
              <Col span={12}>
                <Text type="secondary">Orientation</Text>
                <FormSelect
                  variant="default"
                  allowClear={false}
                  style={{ width: '100%' }}
                  disabled={locked}
                  value={identity.orientation || 'PORTRAIT'}
                  onChange={(v) => patch({ identity: { ...identity, orientation: v } })}
                  options={[{ value: 'PORTRAIT', label: 'Portrait' }, { value: 'LANDSCAPE', label: 'Landscape' }]}
                />
              </Col>
            </Row>
          </Space>
        </Card>
      </Col>
    </Row>
  );
};

// ─── Header fields and address blocks ───────────────────────────────────────────

export const TabHeader = ({ tpl, patch, locked }) => {
  const fields = listEditor(tpl.headerFields, (v) => patch({ headerFields: v }));
  const blocks = listEditor(tpl.addressBlocks, (v) => patch({ addressBlocks: v }));

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Card
        size="small"
        title="Header fields"
        extra={!locked && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => fields.add({ key: `f${Date.now()}`, label: '', binding: undefined, mandatory: false })}>
            Add field
          </Button>
        )}
      >
        <Table
          size="small"
          rowKey="__row"
          pagination={false}
          dataSource={withRowKeys(tpl.headerFields)}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No header fields. The document prints its title and address blocks only." /> }}
          columns={[
            {
              title: 'Label',
              width: 220,
              render: (_, r, i) => (
                <Input size="small" value={r.label || ''} disabled={locked} onChange={(e) => fields.set(i, { label: e.target.value })} />
              ),
            },
            {
              title: 'Bound to',
              render: (_, r, i) => (
                <FieldBindingPicker value={r.binding} disabled={locked} onChange={(b) => fields.set(i, { binding: b })} />
              ),
            },
            {
              title: 'Mandatory',
              width: 110,
              align: 'center',
              render: (_, r, i) => (
                <Tooltip title="A mandatory field that is empty blocks submission (V-12).">
                  <Checkbox checked={Boolean(r.mandatory)} disabled={locked} onChange={(e) => fields.set(i, { mandatory: e.target.checked })} />
                </Tooltip>
              ),
            },
            {
              title: '',
              width: 110,
              render: (_, __, i) => <RowTools index={i} count={(tpl.headerFields || []).length} list={fields} disabled={locked} />,
            },
          ]}
        />
      </Card>

      <Card
        size="small"
        title="Address blocks"
        extra={!locked && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => blocks.add({ key: `b${Date.now()}`, label: '', binding: undefined })}>
            Add block
          </Button>
        )}
      >
        <Table
          size="small"
          rowKey="__row"
          pagination={false}
          dataSource={withRowKeys(tpl.addressBlocks)}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No address blocks configured." /> }}
          columns={[
            {
              title: 'Label',
              width: 220,
              render: (_, r, i) => (
                <Input size="small" value={r.label || ''} disabled={locked} onChange={(e) => blocks.set(i, { label: e.target.value })} />
              ),
            },
            {
              title: 'Bound to',
              render: (_, r, i) => (
                <FieldBindingPicker
                  value={r.binding}
                  disabled={locked}
                  categories={['EXPORTER', 'BUYER', 'INVOICE', 'SHIPMENT']}
                  onChange={(b) => blocks.set(i, { binding: b })}
                />
              ),
            },
            {
              title: '',
              width: 110,
              render: (_, __, i) => <RowTools index={i} count={(tpl.addressBlocks || []).length} list={blocks} disabled={locked} />,
            },
          ]}
        />
      </Card>
    </Space>
  );
};

// ─── Columns and sheets (packing list) ──────────────────────────────────────────

const COLUMN_TYPES = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'SIZE_GRID', label: 'Size grid (one column per size)' },
];

export const TabColumns = ({ tpl, patch, locked }) => {
  const cols = listEditor(tpl.columns, (v) => patch({ columns: v }));
  const sheets = listEditor(tpl.sheets, (v) => patch({ sheets: v }));

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        title="One column set, two places"
        description="These columns are what the workspace grid shows AND what the printed document prints, so the two cannot disagree. A SIZE_GRID column expands to one column per size, in the frozen preset order."
      />
      <Card
        size="small"
        title="Grid columns"
        extra={!locked && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => cols.add({ key: `c${Date.now()}`, label: '', binding: undefined, type: 'TEXT', align: 'left', width: 100 })}>
            Add column
          </Button>
        )}
      >
        <Table
          size="small"
          rowKey="__row"
          pagination={false}
          scroll={{ x: 900 }}
          dataSource={withRowKeys(tpl.columns)}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No columns configured." /> }}
          columns={[
            { title: '#', width: 44, align: 'center', render: (_, __, i) => i + 1 },
            {
              title: 'Label',
              width: 180,
              render: (_, r, i) => <Input size="small" value={r.label || ''} disabled={locked} onChange={(e) => cols.set(i, { label: e.target.value })} />,
            },
            {
              title: 'Type',
              width: 200,
              render: (_, r, i) => (
                <FormSelect
                  variant="default"
                  allowClear={false}
                  size="small"
                  style={{ width: '100%' }}
                  disabled={locked}
                  value={r.type || 'TEXT'}
                  onChange={(v) => cols.set(i, { type: v })}
                  options={COLUMN_TYPES}
                />
              ),
            },
            {
              title: 'Bound to',
              render: (_, r, i) => (r.type === 'SIZE_GRID'
                ? <Text type="secondary" style={{ fontSize: 12 }}>Expands from the document&apos;s size set</Text>
                : (
                  <FieldBindingPicker
                    value={r.binding}
                    disabled={locked}
                    categories={['ROW', 'CALC', 'STYLE', 'PL']}
                    onChange={(b) => cols.set(i, { binding: b })}
                  />
                )),
            },
            {
              title: 'Width',
              width: 90,
              render: (_, r, i) => (
                <InputNumber {...integerInputProps} size="small" min={40} style={{ width: '100%' }} disabled={locked} value={r.width} onChange={(v) => cols.set(i, { width: v })} />
              ),
            },
            {
              title: '',
              width: 110,
              render: (_, __, i) => <RowTools index={i} count={(tpl.columns || []).length} list={cols} disabled={locked} />,
            },
          ]}
        />
      </Card>

      <Card
        size="small"
        title="Sheets"
        extra={!locked && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => sheets.add({ key: `s${Date.now()}`, title: '', include: ['MAIN'], type: 'GRID' })}>
            Add sheet
          </Button>
        )}
      >
        <Table
          size="small"
          rowKey="__row"
          pagination={false}
          dataSource={withRowKeys(tpl.sheets)}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="One sheet is produced, holding the main section." /> }}
          columns={[
            {
              title: 'Title',
              width: 220,
              render: (_, r, i) => <Input size="small" value={r.title || ''} disabled={locked} onChange={(e) => sheets.set(i, { title: e.target.value })} />,
            },
            {
              title: 'Sections included',
              render: (_, r, i) => (
                <FormSelect
                  variant="multi"
                  size="small"
                  style={{ width: '100%' }}
                  disabled={locked || r.type === 'SUMMARY'}
                  value={r.include || []}
                  onChange={(v) => sheets.set(i, { include: v })}
                  options={[{ value: 'MAIN', label: 'Main cartons' }, { value: 'EXTRA', label: 'Extra carton' }]}
                />
              ),
            },
            {
              title: 'Kind',
              width: 150,
              render: (_, r, i) => (
                <FormSelect
                  variant="default"
                  allowClear={false}
                  size="small"
                  style={{ width: '100%' }}
                  disabled={locked}
                  value={r.type || 'GRID'}
                  onChange={(v) => sheets.set(i, { type: v })}
                  options={[{ value: 'GRID', label: 'Carton grid' }, { value: 'SUMMARY', label: 'Order vs shipped' }]}
                />
              ),
            },
            {
              title: '',
              width: 110,
              render: (_, __, i) => <RowTools index={i} count={(tpl.sheets || []).length} list={sheets} disabled={locked} />,
            },
          ]}
        />
      </Card>

      <Card size="small" title="Packing types allowed">
        <Checkbox.Group
          disabled={locked}
          value={tpl.packingTypesAllowed || Object.values(PACKING_TYPE)}
          onChange={(v) => patch({ packingTypesAllowed: v })}
          options={Object.values(PACKING_TYPE).map((p) => ({ value: p, label: PACKING_TYPE_LABELS[p] }))}
        />
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          Narrows what the packing entry offers for this buyer. VGT packs solid and mixed only; JOMO uses all five.
        </Paragraph>
      </Card>
    </Space>
  );
};

// ─── Invoice grain, charges and declarations ────────────────────────────────────

export const TabInvoice = ({ tpl, patch, locked }) => {
  const grain = tpl.invoiceLineGrain || {};
  const charges = tpl.charges || {};
  const decls = listEditor(tpl.declarations, (v) => patch({ declarations: v }));

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card size="small" title="Line grain (§8.3)">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <FormSelect
              variant="default"
              allowClear={false}
              style={{ width: '100%' }}
              disabled={locked}
              value={grain.mode || LINE_GRAIN.PER_STYLE_SIZE_RANGE}
              onChange={(v) => patch({
                // The groupBy belongs to the mode that declared it; changing mode
                // without clearing it silently keeps the old grouping.
                invoiceLineGrain: { ...grain, mode: v, groupBy: undefined },
              })}
              options={Object.values(LINE_GRAIN).map((m) => ({ value: m, label: LINE_GRAIN_LABELS[m] }))}
            />
            <div>
              <Text type="secondary">Description template</Text>
              <Input
                disabled={locked}
                value={grain.descriptionTemplate || ''}
                placeholder="{{style.garmentName}} — {{row.colorName}}"
                onChange={(e) => patch({ invoiceLineGrain: { ...grain, descriptionTemplate: e.target.value } })}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Placeholders that resolve to nothing are dropped along with their separator.
              </Text>
            </div>
            <Space>
              <Switch
                checked={Boolean(grain.showPackagingAttributes)}
                disabled={locked}
                onChange={(v) => patch({ invoiceLineGrain: { ...grain, showPackagingAttributes: v } })}
              />
              <Text>Show packaging attributes (Prénatal hanger / MPB column)</Text>
            </Space>
          </Space>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card size="small" title="Charges, tax and bank">
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            {['discount', 'freight', 'insurance', 'other'].map((k) => (
              <Checkbox
                key={k}
                disabled={locked}
                checked={Boolean(charges[k]?.enabled)}
                onChange={(e) => patch({ charges: { ...charges, [k]: { ...(charges[k] || {}), enabled: e.target.checked } } })}
              >
                {`Print a ${k} line`}
              </Checkbox>
            ))}
            <Space>
              <Switch
                checked={tpl.igst?.enabled !== false}
                disabled={locked}
                onChange={(v) => patch({ igst: { ...(tpl.igst || {}), enabled: v } })}
              />
              <Text>IGST block</Text>
              <InputNumber
                {...integerInputProps}
                size="small"
                min={0}
                max={100}
                style={{ width: 90 }}
                disabled={locked || tpl.igst?.enabled === false}
                value={tpl.igst?.defaultRatePct}
                onChange={(v) => patch({ igst: { ...(tpl.igst || {}), defaultRatePct: v } })}
              />
              <Text type="secondary">% default</Text>
            </Space>
            <Space>
              <Switch checked={tpl.bankBlock !== false} disabled={locked} onChange={(v) => patch({ bankBlock: v })} />
              <Text>Bank block</Text>
            </Space>
            <Space>
              <Switch checked={Boolean(tpl.ediAccounts)} disabled={locked} onChange={(v) => patch({ ediAccounts: v })} />
              <Text>EDI bank accounts per port</Text>
            </Space>
          </Space>
        </Card>
      </Col>

      <Col xs={24}>
        <Card
          size="small"
          title="Declarations"
          extra={!locked && (
            <Button size="small" icon={<PlusOutlined />} onClick={() => decls.add({ order: (tpl.declarations || []).length + 1, code: '', text: '' })}>
              Add declaration
            </Button>
          )}
        >
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            title="Regulatory text is reproduced, never composed"
            description="These lines print verbatim in this order. The system does not validate or generate regulatory wording (§4.3)."
          />
          <Table
            size="small"
            rowKey="__row"
            pagination={false}
            dataSource={withRowKeys(tpl.declarations)}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No declarations configured." /> }}
            columns={[
              { title: '#', width: 44, align: 'center', render: (_, __, i) => i + 1 },
              {
                title: 'Code',
                width: 140,
                render: (_, r, i) => <Input size="small" value={r.code || ''} disabled={locked} onChange={(e) => decls.set(i, { code: e.target.value.toUpperCase() })} />,
              },
              {
                title: 'Text',
                render: (_, r, i) => <TextArea size="small" rows={2} value={r.text || ''} disabled={locked} onChange={(e) => decls.set(i, { text: e.target.value })} />,
              },
              {
                title: '',
                width: 110,
                render: (_, __, i) => <RowTools index={i} count={(tpl.declarations || []).length} list={decls} disabled={locked} />,
              },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
};

// ─── Sticker layout ─────────────────────────────────────────────────────────────

export const TabSticker = ({ tpl, patch, locked }) => {
  const layout = tpl.stickerLayout || { layoutId: tpl.templateCode, paperDefault: 'A4_1UP', faces: [] };
  const setLayout = (changes) => patch({ stickerLayout: { ...layout, ...changes } });
  const faces = listEditor(layout.faces, (v) => setLayout({ faces: v }));

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" title="Sheet">
        <Space wrap size={16}>
          <div style={{ minWidth: 240 }}>
            <Text type="secondary">Default paper</Text>
            <FormSelect
              variant="default"
              allowClear={false}
              style={{ width: '100%' }}
              disabled={locked}
              value={layout.paperDefault || 'A4_1UP'}
              onChange={(v) => setLayout({ paperDefault: v })}
              options={PAPER_LIST}
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <Text type="secondary">Layout id</Text>
            <Input value={layout.layoutId || ''} disabled={locked} onChange={(e) => setLayout({ layoutId: e.target.value })} />
          </div>
        </Space>
      </Card>

      {(layout.faces || []).map((face, fi) => {
        const lines = listEditor(face.lines, (v) => faces.set(fi, { lines: v }));
        return (
          <Card
            key={face.key || fi}
            size="small"
            title={(
              <Space size={8}>
                <Text strong>{face.title || `Face ${fi + 1}`}</Text>
                <Tag>{face.render || FACE_RENDER.STACK}</Tag>
              </Space>
            )}
            extra={(
              <Space>
                {!locked && (
                  <Button size="small" icon={<PlusOutlined />} onClick={() => lines.add({ label: '', binding: undefined })}>
                    Add line
                  </Button>
                )}
                <RowTools index={fi} count={(layout.faces || []).length} list={faces} disabled={locked} />
              </Space>
            )}
          >
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
              <Col xs={24} sm={8}>
                <Text type="secondary">Title</Text>
                <Input size="small" value={face.title || ''} disabled={locked} onChange={(e) => faces.set(fi, { title: e.target.value })} />
              </Col>
              <Col xs={24} sm={8}>
                <Text type="secondary">Render mode</Text>
                <FormSelect
                  variant="default"
                  allowClear={false}
                  size="small"
                  style={{ width: '100%' }}
                  disabled={locked}
                  value={face.render || FACE_RENDER.STACK}
                  onChange={(v) => faces.set(fi, { render: v })}
                  options={[
                    { value: FACE_RENDER.STACK, label: 'Stack — label over value' },
                    { value: FACE_RENDER.TABLE, label: 'Table — bordered cells' },
                    { value: FACE_RENDER.TEXT_BLOCK, label: 'Text block — monospace lines' },
                  ]}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Text type="secondary">Size grid</Text>
                <FormSelect
                  variant="default"
                  size="small"
                  style={{ width: '100%' }}
                  disabled={locked}
                  value={face.sizeGrid?.source}
                  onChange={(v) => faces.set(fi, { sizeGrid: v ? { ...(face.sizeGrid || {}), source: v } : null })}
                  options={[{ value: 'SIZE_QTY', label: 'Quantities per size' }, { value: 'RATIO', label: 'Assortment ratio' }]}
                  placeholder="None"
                />
              </Col>
            </Row>
            <Table
              size="small"
              rowKey="__row"
              pagination={false}
              dataSource={withRowKeys(face.lines)}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No lines on this face." /> }}
              columns={[
                {
                  title: 'Label',
                  width: 200,
                  render: (_, r, i) => (
                    <Input
                      size="small"
                      value={r.label ?? ''}
                      disabled={locked}
                      placeholder="blank for no label"
                      onChange={(e) => lines.set(i, { label: e.target.value })}
                    />
                  ),
                },
                {
                  title: 'Bound to',
                  render: (_, r, i) => (
                    <FieldBindingPicker
                      value={r.binding}
                      disabled={locked}
                      categories={['CARTON', 'ROW', 'CALC', 'SHIPMENT', 'BUYER', 'EXPORTER', 'PL']}
                      onChange={(b) => lines.set(i, { binding: b })}
                    />
                  ),
                },
                {
                  title: '',
                  width: 110,
                  render: (_, __, i) => <RowTools index={i} count={(face.lines || []).length} list={lines} disabled={locked} />,
                },
              ]}
            />
          </Card>
        );
      })}

      {!locked && (
        <Button
          icon={<PlusOutlined />}
          onClick={() => faces.add({ key: `face${(layout.faces || []).length + 1}`, title: 'NEW FACE', render: FACE_RENDER.STACK, lines: [] })}
        >
          Add face
        </Button>
      )}
      {!(layout.faces || []).length && (
        <Alert type="info" showIcon title="No faces yet" description="A carton sticker needs at least one face. JOMO prints two — a long side and a short side." />
      )}
    </Space>
  );
};

// ─── Validation and formatting ──────────────────────────────────────────────────

export const TabRules = ({ tpl, patch, locked }) => {
  const formatting = tpl.formatting || {};
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card size="small" title="Mandatory fields">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Required before submission (V-12)</Text>
              <FormSelect
                variant="tags"
                style={{ width: '100%' }}
                disabled={locked}
                value={tpl.mandatoryForSubmit || []}
                onChange={(v) => patch({ mandatoryForSubmit: v })}
                placeholder="e.g. row.netWeightKg, invoice.consignee"
              />
            </div>
            <div>
              <Text type="secondary">Required before a document or sticker is generated (V-08)</Text>
              <FormSelect
                variant="tags"
                style={{ width: '100%' }}
                disabled={locked}
                value={tpl.mandatoryForDocGen || []}
                onChange={(v) => patch({ mandatoryForDocGen: v })}
                placeholder="e.g. carton.netWeightKg"
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                A carton missing one of these blocks its own sticker, and names itself in the error.
              </Text>
            </div>
            <Space>
              <Switch checked={tpl.printWeights !== false} disabled={locked} onChange={(v) => patch({ printWeights: v })} />
              <Text>Print weights</Text>
            </Space>
            <Space>
              <Switch checked={tpl.printDimensions !== false} disabled={locked} onChange={(v) => patch({ printDimensions: v })} />
              <Text>Print dimensions and CBM</Text>
            </Space>
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card size="small" title="Formatting">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Font</Text>
              <FormSelect
                variant="default"
                allowClear={false}
                style={{ width: '100%' }}
                disabled={locked}
                value={formatting.font || 'Arial'}
                onChange={(v) => patch({ formatting: { ...formatting, font: v } })}
                options={['Arial', 'Helvetica', 'Courier New', 'Times New Roman'].map((f) => ({ value: f, label: f }))}
              />
            </div>
            <div>
              <Text type="secondary">Base font size (pt)</Text>
              <InputNumber
                {...integerInputProps}
                min={6}
                max={14}
                style={{ width: '100%' }}
                disabled={locked}
                value={formatting.baseFontPt}
                onChange={(v) => patch({ formatting: { ...formatting, baseFontPt: v } })}
              />
            </div>
            <div>
              <Text type="secondary">Date format</Text>
              <Input
                disabled={locked}
                value={formatting.dateFormat || ''}
                placeholder="DD-MMM-YYYY"
                onChange={(e) => patch({ formatting: { ...formatting, dateFormat: e.target.value } })}
              />
            </div>
          </Space>
        </Card>
      </Col>
    </Row>
  );
};
