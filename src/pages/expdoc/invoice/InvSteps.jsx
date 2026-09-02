import {
  Alert, Card, Checkbox, Col, Descriptions, Divider, Input, InputNumber, Row, Space,
  Table, Tag, Tooltip, Typography,
} from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { integerInputProps, numericInputProps } from '../../../utils/inputHelpers';
import { LINE_GRAIN, LINE_GRAIN_LABELS } from '../../../utils/expDocConstants';
import { amountInWords } from '../../../utils/amountInWords';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const money = (v, dp = 2) => (v === null || v === undefined || v === ''
  ? '—'
  : Number(v).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
const int = (v) => (Number(v) || 0).toLocaleString('en-IN');

/**
 * Field classification made visible (PRD §11.3).
 *
 * An auto-filled value the user may not change is rendered as text with a padlock
 * and its source named, rather than as a disabled input — a greyed-out box invites
 * a click and then refuses it.
 */
export const ReadCell = ({ value, source, dp }) => (
  <Tooltip title={source ? `From ${source}` : undefined}>
    <Space size={4}>
      <Text type="secondary" style={{ fontStyle: 'italic' }}>
        {typeof value === 'number' ? money(value, dp ?? 2) : (value || '—')}
      </Text>
      {source && <LockOutlined style={{ fontSize: 10, color: 'var(--text-secondary)' }} />}
    </Space>
  </Tooltip>
);

// ─── Step 1: source ─────────────────────────────────────────────────────────────

export const InvStepSource = ({ inv }) => (
  <Space orientation="vertical" size={16} style={{ width: '100%' }}>
    <Alert
      type="info"
      showIcon
      title="Everything below came from the packing list"
      description="Nothing in this step is typed. If a figure is wrong, correct it in the packing entry and refresh the packing list — the invoice follows."
    />
    <Table
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={inv.packingLists || []}
      columns={[
        { title: 'PL No', dataIndex: 'plNo', width: 180 },
        { title: 'Status', dataIndex: 'status', width: 120, render: (s) => <Tag>{s}</Tag> },
        { title: 'Cartons', dataIndex: 'cartonRangeLabel', width: 160, ellipsis: true },
        { title: 'Pieces', key: 'p', width: 110, align: 'right', render: (_, r) => int(r.totals?.pieces) },
        { title: 'Net kg', key: 'n', width: 110, align: 'right', render: (_, r) => money(r.totals?.netWeightKg, 3) },
        { title: 'Gross kg', key: 'g', width: 110, align: 'right', render: (_, r) => money(r.totals?.grossWeightKg, 3) },
        { title: 'CBM', key: 'c', width: 100, align: 'right', render: (_, r) => money(r.totals?.cbm, 3) },
      ]}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={3}><Text strong>Invoice totals</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={3} align="right"><Text strong>{int(inv.plTotals?.pieces)}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right"><Text strong>{money(inv.plTotals?.netWeightKg, 3)}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={5} align="right"><Text strong>{money(inv.plTotals?.grossWeightKg, 3)}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={6} align="right"><Text strong>{money(inv.plTotals?.cbm, 3)}</Text></Table.Summary.Cell>
        </Table.Summary.Row>
      )}
    />
    <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
      <Descriptions.Item label="Buyer">{inv.buyerName || '—'}</Descriptions.Item>
      <Descriptions.Item label="Sub-client">{inv.subClientCode || '—'}</Descriptions.Item>
      <Descriptions.Item label="Shipment">{inv.shipmentNo || '—'}</Descriptions.Item>
      <Descriptions.Item label="Marks &amp; Nos">{inv.marksAndNos || '—'}</Descriptions.Item>
      <Descriptions.Item label="Cartons">{int(inv.plTotals?.cartons)}</Descriptions.Item>
      <Descriptions.Item label="Template">
        <Space size={4} wrap>
          <Text>{inv.template?.name || 'None'}</Text>
          {inv.template && <Tag>v{inv.template.version}</Tag>}
          {inv.templateIsFallback && (
            <Tooltip title="No invoice template is configured for this buyer, so the generic Indian export layout is being used.">
              <Tag color="gold">generic fallback</Tag>
            </Tooltip>
          )}
        </Space>
      </Descriptions.Item>
    </Descriptions>
  </Space>
);

// ─── Step 2: header ─────────────────────────────────────────────────────────────

export const InvStepHeader = ({ inv, patch, locked, incoterms, exporter }) => (
  <Row gutter={[16, 16]}>
    <Col xs={24} lg={12}>
      <Card size="small" title="Invoice identity">
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">Invoice number</Text>
            <div>
              {inv.invoiceNo
                ? <Text strong>{inv.invoiceNo}</Text>
                : (
                  <Tooltip title="A number is allocated at approval so the approved series stays gapless (BR-02).">
                    <Text type="secondary" style={{ fontStyle: 'italic' }}>
                      {`${inv.provisionalNo} — allocated at approval`}
                    </Text>
                  </Tooltip>
                )}
            </div>
          </div>
          <div>
            <Text type="secondary">Invoice date</Text>
            <Input
              type="date"
              value={inv.invoiceDate || ''}
              disabled={locked}
              onChange={(e) => patch({ invoiceDate: e.target.value })}
            />
          </div>
          <div>
            <Text type="secondary">Buyer&apos;s order number</Text>
            <Input
              value={inv.buyerOrderNo || ''}
              disabled={locked}
              onChange={(e) => patch({ buyerOrderNo: e.target.value })}
            />
          </div>
          <div>
            <Text type="secondary">Exporter</Text>
            <div><ReadCell value={exporter?.name} source="Organisation Info" /></div>
            {exporter && !exporter.block && (
              <Text type="warning" style={{ fontSize: 12 }}>
                Organisation Info has no record, so the exporter block will print blank.
              </Text>
            )}
          </div>
        </Space>
      </Card>
    </Col>

    <Col xs={24} lg={12}>
      <Card size="small" title="Parties">
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">Consignee</Text>
            <div><ReadCell value={inv.consignee?.name} source="the shipment's consignee profile" /></div>
            <Paragraph type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {inv.consignee?.block || 'Not set — pick a consignee on the shipment.'}
            </Paragraph>
          </div>
          <div>
            <Text type="secondary">Notify party</Text>
            <Paragraph type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {inv.notify?.block || '—'}
            </Paragraph>
          </div>
        </Space>
      </Card>
    </Col>

    <Col xs={24}>
      <Card size="small" title="Terms and destination">
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8} md={5}>
            <Text type="secondary">Incoterm</Text>
            <FormSelect
              variant="default"
              allowClear={false}
              style={{ width: '100%' }}
              disabled={locked}
              value={inv.incoterm || undefined}
              onChange={(v) => patch({ incoterm: v })}
              options={(incoterms || []).map((c) => ({ value: c, label: c }))}
            />
          </Col>
          <Col xs={24} sm={16} md={7}>
            <Text type="secondary">Named place</Text>
            <Input
              value={inv.incotermPlace || ''}
              disabled={locked}
              placeholder="e.g. CHENNAI / TUTICORIN"
              onChange={(e) => patch({ incotermPlace: e.target.value })}
            />
          </Col>
          <Col xs={24} md={7}>
            <Text type="secondary">Payment terms</Text>
            <Input
              value={inv.paymentTerms || ''}
              disabled={locked}
              onChange={(e) => patch({ paymentTerms: e.target.value })}
            />
          </Col>
          <Col xs={24} md={5}>
            <Text type="secondary">Country of final destination</Text>
            <Input
              value={inv.countryOfFinalDestination || ''}
              disabled={locked}
              onChange={(e) => patch({ countryOfFinalDestination: e.target.value })}
            />
          </Col>
        </Row>
        <Divider style={{ margin: '12px 0' }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Transport details — vessel, ports, container and seal — print from the shipment record and are edited there.
        </Text>
      </Card>
    </Col>
  </Row>
);

// ─── Step 3: lines ──────────────────────────────────────────────────────────────

export const InvStepLines = ({ inv, patch, locked, onRegenerate, onChangeGrain, canOverride }) => {
  const grain = inv.template?.invoiceLineGrain?.mode || LINE_GRAIN.PER_STYLE_SIZE_RANGE;

  const setLine = (id, changes) => patch({
    lines: (inv.lines || []).map((l) => (l.id === id ? { ...l, ...changes } : l)),
  });

  // Not memoised: a handful of invoice lines, and the render closes over setLine,
  // which changes with every patch anyway.
  const columns = [
      { title: '#', dataIndex: 'seq', width: 46, align: 'center' },
      {
        title: 'Description',
        dataIndex: 'description',
        ellipsis: true,
        render: (v, r) => (
          <Space orientation="vertical" size={0}>
            <Text>{v || '—'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {[r.styleNo, r.colorName, r.sizeRange || r.size, r.buyerPoNo].filter(Boolean).join(' · ')}
            </Text>
          </Space>
        ),
      },
      {
        title: 'HS code',
        dataIndex: 'hsCode',
        width: 120,
        render: (v, r) => (locked
          ? <ReadCell value={v} source="the HS master" />
          : (
            <Input
              size="small"
              value={v || ''}
              status={!v ? 'error' : undefined}
              placeholder="required"
              onChange={(e) => setLine(r.id, { hsCode: e.target.value })}
            />
          )),
      },
      {
        title: 'Qty',
        dataIndex: 'quantity',
        width: 100,
        align: 'right',
        // §8.5: quantities reconcile to the packing list and are never typed here.
        render: (v) => <ReadCell value={int(v)} source="the packing list" />,
      },
      {
        title: 'Rate',
        dataIndex: 'rate',
        width: 130,
        align: 'right',
        render: (v, r) => (locked
          ? money(v)
          : (
            <Space size={2}>
              <InputNumber
                {...numericInputProps}
                size="small"
                min={0}
                style={{ width: 88 }}
                value={v}
                onChange={(n) => setLine(r.id, { rate: n })}
              />
              {r.rateIsBlended && (
                <Tooltip title={`The order prices these sizes differently. ${money(r.orderRate, 4)} is the quantity-weighted average.`}>
                  <Tag color="blue" style={{ marginInlineEnd: 0 }}>avg</Tag>
                </Tooltip>
              )}
            </Space>
          )),
      },
      {
        title: 'Order rate',
        dataIndex: 'orderRate',
        width: 110,
        align: 'right',
        render: (v) => <ReadCell value={v} source="the order's FOB price" dp={4} />,
      },
      {
        title: 'Amount',
        dataIndex: 'amount',
        width: 120,
        align: 'right',
        render: (v) => <Text strong>{money(v)}</Text>,
      },
  ];

  const unpriced = (inv.lines || []).filter((l) => !l.nonMerchandise && !(Number(l.rate) > 0));
  const partiallyPriced = (inv.lines || []).filter((l) => (Number(l.unpricedQty) || 0) > 0);

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Row gutter={[12, 12]} align="middle">
        <Col xs={24} md={10}>
          <Text type="secondary" style={{ display: 'block' }}>Line grain</Text>
          <Tooltip title={canOverride ? undefined : 'Changing the grain needs the override right — it changes what the buyer sees.'}>
            <span>
              <FormSelect
                variant="default"
                allowClear={false}
                style={{ width: '100%' }}
                disabled={locked || !canOverride}
                value={grain}
                onChange={onChangeGrain}
                options={Object.values(LINE_GRAIN).map((m) => ({ value: m, label: LINE_GRAIN_LABELS[m] }))}
              />
            </span>
          </Tooltip>
        </Col>
        <Col xs={24} md={14}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Lines are generated from the packing list at the buyer&apos;s grain. Rates default from the
            order and may be corrected; quantities may not.
          </Text>
        </Col>
      </Row>

      {unpriced.length > 0 && (
        <Alert
          type="error"
          showIcon
          title={`${unpriced.length} line(s) have no rate`}
          description="The order carried no price for these sizes. Enter a rate, or the invoice cannot be submitted."
        />
      )}
      {partiallyPriced.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title="Some quantities were not priced by the order"
          description={partiallyPriced
            .map((l) => `Line ${l.seq}: ${int(l.unpricedQty)} of ${int(l.quantity)} pcs`)
            .join(' · ')}
        />
      )}

      <Table
        columns={columns}
        dataSource={inv.lines || []}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 1080 }}
        summary={(rows) => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={3}><Text strong>Total</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">
              <Text strong>{int(rows.filter((r) => !r.nonMerchandise).reduce((s, r) => s + (Number(r.quantity) || 0), 0))}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} colSpan={2} />
            <Table.Summary.Cell index={6} align="right">
              <Text strong>{money(inv.totals?.linesTotal)}</Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />

      <Space>
        <Tooltip title="Rebuild every line from the packing lists as they stand now. Rates you have overridden are kept.">
          <span>
            <a onClick={locked ? undefined : onRegenerate} style={{ pointerEvents: locked ? 'none' : undefined, opacity: locked ? 0.5 : 1 }}>
              Regenerate from packing list
            </a>
          </span>
        </Tooltip>
      </Space>
    </Space>
  );
};

// ─── Step 4: financials ─────────────────────────────────────────────────────────

export const InvStepFinancials = ({ inv, patch, locked, onOverrideFx }) => {
  const charges = inv.charges || {};
  const setCharge = (key, changes) => patch({
    charges: { ...charges, [key]: { ...(charges[key] || {}), ...changes } },
  });
  const igstOn = inv.template?.igst?.enabled !== false;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card size="small" title="Currency and exchange rate">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Currency">
                <ReadCell value={inv.currency} source="the buyer's commercial profile" />
              </Descriptions.Item>
              <Descriptions.Item label="Exchange rate">
                <Space size={6} wrap>
                  <Text strong>{money(inv.fxRate, 4)}</Text>
                  <Tooltip title={inv.fxSource === 'MANUAL'
                    ? `Overridden: ${inv.fxOverrideReason || 'no reason recorded'}`
                    : (inv.fxSource === 'MASTER_LIVE'
                      ? 'Fetched live for today.'
                      : 'From the rate master. The live rate service is unavailable, so the stored rate is used.')}
                  >
                    <Tag color={inv.fxSource === 'MANUAL' ? 'purple' : 'blue'}>
                      {inv.fxSource === 'MANUAL' ? 'manual' : (inv.fxSource === 'MASTER_LIVE' ? 'live rate' : 'rate master')}
                    </Tag>
                  </Tooltip>
                  {!locked && <a onClick={onOverrideFx}>Override</a>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Rate date">{inv.fxDate || '—'}</Descriptions.Item>
            </Descriptions>
          </Space>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card size="small" title="Charges and deductions">
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            {[
              { key: 'discount', label: 'Discount' },
              { key: 'freight', label: 'Freight' },
              { key: 'insurance', label: 'Insurance' },
              { key: 'other', label: 'Other charges' },
            ].map(({ key, label }) => {
              const c = charges[key] || {};
              return (
                <Row key={key} gutter={8} align="middle">
                  <Col span={9}>
                    <Checkbox
                      checked={Boolean(c.enabled)}
                      disabled={locked}
                      onChange={(e) => setCharge(key, { enabled: e.target.checked })}
                    >
                      {label}
                    </Checkbox>
                  </Col>
                  {key === 'discount' && (
                    <Col span={7}>
                      <FormSelect
                        variant="default"
                        allowClear={false}
                        size="small"
                        style={{ width: '100%' }}
                        disabled={locked || !c.enabled}
                        value={c.mode || 'PERCENT'}
                        onChange={(v) => setCharge(key, { mode: v })}
                        options={[{ value: 'PERCENT', label: '%' }, { value: 'AMOUNT', label: inv.currency || 'Amount' }]}
                      />
                    </Col>
                  )}
                  <Col span={key === 'discount' ? 8 : 15}>
                    <InputNumber
                      {...numericInputProps}
                      size="small"
                      min={0}
                      style={{ width: '100%' }}
                      disabled={locked || !c.enabled}
                      value={c.value}
                      onChange={(n) => setCharge(key, { value: n })}
                    />
                  </Col>
                </Row>
              );
            })}
          </Space>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card size="small" title="Totals">
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Lines">{money(inv.totals?.linesTotal)}</Descriptions.Item>
            {inv.totals?.discount ? (
              <Descriptions.Item label={inv.totals.discountPercent ? `Less discount @ ${inv.totals.discountPercent}%` : 'Less discount'}>
                {`-${money(inv.totals.discount)}`}
              </Descriptions.Item>
            ) : null}
            {inv.totals?.freight ? <Descriptions.Item label="Add freight">{money(inv.totals.freight)}</Descriptions.Item> : null}
            {inv.totals?.insurance ? <Descriptions.Item label="Add insurance">{money(inv.totals.insurance)}</Descriptions.Item> : null}
            {inv.totals?.other ? <Descriptions.Item label="Add other">{money(inv.totals.other)}</Descriptions.Item> : null}
            <Descriptions.Item label={`Total ${inv.currency || ''}`}>
              <Text strong>{money(inv.totals?.netTotal)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="In words">
              <Text type="secondary" style={{ fontSize: 12 }}>
                {amountInWords(inv.totals?.netTotal || 0, inv.currency || 'USD')}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card
          size="small"
          title="IGST — supply meant for export with payment of IGST"
          extra={igstOn ? null : <Tag>disabled by template</Tag>}
        >
          {igstOn ? (
            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
              <Row gutter={8} align="middle">
                <Col span={10}><Text type="secondary">IGST rate %</Text></Col>
                <Col span={14}>
                  <InputNumber
                    {...integerInputProps}
                    size="small"
                    min={0}
                    max={100}
                    style={{ width: '100%' }}
                    disabled={locked}
                    value={inv.igstRatePct}
                    onChange={(n) => patch({ igstRatePct: n })}
                  />
                </Col>
              </Row>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="Taxable value (INR)">
                  {inv.igst?.taxableInr === null
                    ? <Text type="danger">No exchange rate</Text>
                    : money(inv.igst?.taxableInr)}
                </Descriptions.Item>
                <Descriptions.Item label="IGST value (INR)">{money(inv.igst?.igstValue)}</Descriptions.Item>
                <Descriptions.Item label="Total taxable (INR)">
                  <Text strong>{money(inv.igst?.totalTaxableInr)}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Space>
          ) : (
            <Text type="secondary">This buyer&apos;s template prints no tax block.</Text>
          )}
        </Card>
      </Col>

      <Col xs={24}>
        <Card size="small" title="Packing-list totals (printed read-only)">
          <Descriptions size="small" column={{ xs: 1, sm: 3, md: 5 }} bordered>
            <Descriptions.Item label="Cartons">{int(inv.plTotals?.cartons)}</Descriptions.Item>
            <Descriptions.Item label="Pieces">{int(inv.plTotals?.pieces)}</Descriptions.Item>
            <Descriptions.Item label="Net kg">{money(inv.plTotals?.netWeightKg, 3)}</Descriptions.Item>
            <Descriptions.Item label="Gross kg">{money(inv.plTotals?.grossWeightKg, 3)}</Descriptions.Item>
            <Descriptions.Item label="CBM">{money(inv.plTotals?.cbm, 3)}</Descriptions.Item>
          </Descriptions>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            These come from the packing list. Overriding one raises a warning that the approver must see (V-10).
          </Text>
        </Card>
      </Col>
    </Row>
  );
};

// ─── Step 5: declarations ───────────────────────────────────────────────────────

export const InvStepDeclarations = ({ inv, patch, locked, exporter }) => {
  const declarations = (inv.template?.declarations || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card size="small" title="Declarations">
          {declarations.length ? (
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              {declarations.map((d) => (
                <div key={d.code}>
                  <Tag>{d.code}</Tag>
                  <Text style={{ fontSize: 12 }}>{d.text}</Text>
                </div>
              ))}
              <Text type="secondary" style={{ fontSize: 12 }}>
                Reproduced verbatim from the template. Regulatory text is configured, never composed here (§4.3).
              </Text>
            </Space>
          ) : <Text type="secondary">This template configures no declarations.</Text>}
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card size="small" title="Bank details">
          {inv.template?.bankBlock === false
            ? <Text type="secondary">This template prints no bank block.</Text>
            : (
              <Paragraph type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                {exporter?.bankBlock || 'No bank details on the organisation record.'}
              </Paragraph>
            )}
        </Card>
      </Col>
      <Col xs={24}>
        <Card size="small" title="Internal reference">
          <TextArea
            rows={2}
            maxLength={200}
            showCount
            disabled={locked}
            placeholder="Anything your team needs to find this invoice by. Not printed."
            value={inv.reference || ''}
            onChange={(e) => patch({ reference: e.target.value })}
          />
        </Card>
      </Col>
    </Row>
  );
};
