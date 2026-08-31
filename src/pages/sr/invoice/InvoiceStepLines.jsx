import { Table, Input, InputNumber, Button, Alert, Typography, Space, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { INVOICE_TYPES } from '../../../utils/sampleRequestConstants';

const { Text } = Typography;

/**
 * Step 3 — line items and valuation. Quantity is DERIVED from the SR (a fact
 * the system holds); Rate is MANUAL-ONLY and blank by default. COMMERCIAL: a
 * sample's declared value is a customs judgement with no correct system
 * source. SAMPLE (chargeable): recovery pricing — typically 2× the sample
 * cost — is a WIZARD-ONLY hint; the print shows only the entered rates. A
 * blank rate blocks Issue. Manual lines (swatches, fabric costing for
 * cancelled styles) are fully editable.
 */
const InvoiceStepLines = ({ inv, patch, locked, onAddFromSr }) => {
  const isSample = inv.invoiceType === INVOICE_TYPES.SAMPLE;
  const setLine = (key, field, value) => {
    patch({ lines: inv.lines.map((l) => (l.key === key ? { ...l, [field]: value } : l)) });
  };

  const addManualLine = () => {
    patch({
      lines: [...inv.lines, {
        key: `m${Date.now()}`, srId: null, srNo: null, styleNo: null,
        hsnCode: '48211010', description: '', quantity: 1, uom: 'PCS', rate: null, manual: true,
      }],
    });
  };

  const columns = [
    { title: '#', key: 'idx', width: 40, align: 'center', render: (_, __, i) => i + 1 },
    {
      title: 'HSN Code', dataIndex: 'hsnCode', key: 'hsnCode', width: 110,
      render: (v, l) => <Input size="small" value={v} disabled={locked} onChange={(e) => setLine(l.key, 'hsnCode', e.target.value)} />,
    },
    {
      title: 'Description of Goods', dataIndex: 'description', key: 'description',
      render: (v, l) => <Input size="small" value={v} disabled={locked} onChange={(e) => setLine(l.key, 'description', e.target.value)} />,
    },
    {
      title: 'From SR', key: 'fromSr', width: 150,
      render: (_, l) => (l.srNo
        ? <Text type="secondary" style={{ fontSize: 12 }}>{l.srNo}<br />{l.styleNo}</Text>
        : <Tag>manual line</Tag>),
    },
    {
      title: 'Quantity', dataIndex: 'quantity', key: 'quantity', width: 90, align: 'right',
      render: (v, l) => (l.manual && !locked
        ? <InputNumber size="small" min={0} value={v} style={{ width: '100%' }} onChange={(val) => setLine(l.key, 'quantity', val)} />
        : <Text strong>{v}</Text>),
    },
    { title: 'UOM', dataIndex: 'uom', key: 'uom', width: 60, align: 'center' },
    {
      title: `Rate (${inv.currency || '—'})`, dataIndex: 'rate', key: 'rate', width: 110,
      render: (v, l) => (
        <InputNumber
          size="small" min={0} step={0.01} style={{ width: '100%' }}
          value={v} disabled={locked}
          placeholder="required"
          status={v == null || v === '' ? 'error' : undefined}
          onChange={(val) => setLine(l.key, 'rate', val)}
        />
      ),
    },
    {
      title: 'Amount', key: 'amount', width: 90, align: 'right',
      render: (_, l) => {
        const v = (Number(l.quantity) || 0) * (Number(l.rate) || 0);
        return l.rate == null || l.rate === '' ? <Text type="secondary">—</Text> : <Text strong>{v.toFixed(2)}</Text>;
      },
    },
    ...(!locked ? [{
      title: '', key: 'remove', width: 44,
      render: (_, l) => (
        <Button
          size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => patch({ lines: inv.lines.filter((x) => x.key !== l.key) })}
        />
      ),
    }] : []),
  ];

  const missingRates = inv.lines.some((l) => l.rate == null || l.rate === '');

  return (
    <>
      <Alert
        type={missingRates ? 'warning' : 'info'} showIcon style={{ marginBottom: 12 }}
        message={isSample
          ? 'Chargeable sample invoice — rates are entered by hand, typically 2× the sample cost for non-converted samples. This guidance never prints: the invoice shows only the rates you enter. Issue is blocked until every line carries a rate.'
          : "Values are entered by hand. Nothing is pulled from costing or the order — a sample's declared value is a customs judgement, not the commercial price. The invoice cannot be issued until every line carries a rate."}
      />
      <Table rowKey="key" size="small" columns={columns} dataSource={inv.lines} pagination={false} scroll={{ x: 900 }} />
      {!locked && (
        <Space style={{ marginTop: 12 }}>
          <Button icon={<PlusOutlined />} onClick={addManualLine}>Add manual line</Button>
          <Button icon={<PlusOutlined />} onClick={onAddFromSr}>Add from another SR</Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Removing an SR-derived line does not unselect the SR in Step 1 — re-add via “Add from another SR”.
          </Text>
        </Space>
      )}
    </>
  );
};

export default InvoiceStepLines;
