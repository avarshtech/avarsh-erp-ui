import {
  Alert, Button, Card, Checkbox, Col, Empty, Input, InputNumber, Row, Space, Switch, Table, Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../../components/form';
import { integerInputProps } from '../../../../utils/inputHelpers';
import { LINE_GRAIN, LINE_GRAIN_LABELS } from '../../../../utils/expDocConstants';
import ColumnsEditor from './ColumnsEditor';
import { listEditor, withRowKeys, evidenceColumn } from './editorKit';
import { RowTools } from './EditorParts';

const { Text } = Typography;
const { TextArea } = Input;

/** An invoice's goods table, line grain, charges, tax, bank and declarations. */
const TabInvoice = ({ tpl, patch, locked, meta, onEvidence }) => {
  const grain = tpl.invoiceLineGrain || {};
  const charges = tpl.charges || {};
  const decls = listEditor(tpl.declarations, (v) => patch({ declarations: v }));
  const declRows = tpl.declarations || [];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24}>
        <Card size="small" title="Goods table columns">
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
            The buyer&apos;s own columns, left to right. Quantity, rate and amount always close the table.
            Leave empty to print the standard columns for the line grain below.
          </Text>
          <ColumnsEditor
            columns={tpl.invoiceColumns} onChange={(v) => patch({ invoiceColumns: v?.length ? v : null })}
            locked={locked} categories={['LINE', 'INVOICE', 'STYLE']} allowSizeGrid={false}
            meta={meta} metaList="invoiceColumns" onEvidence={onEvidence}
            emptyText="The standard columns for the line grain print." namePrefix="invcol"
          />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card size="small" title="Line grain (§8.3)">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <FormSelect
              variant="default" allowClear={false} style={{ width: '100%' }} disabled={locked}
              value={grain.mode || LINE_GRAIN.PER_STYLE_SIZE_RANGE}
              // The groupBy belongs to the mode that declared it; changing mode without
              // clearing it silently keeps the old grouping.
              onChange={(v) => patch({ invoiceLineGrain: { ...grain, mode: v, groupBy: undefined } })}
              options={Object.values(LINE_GRAIN).map((m) => ({ value: m, label: LINE_GRAIN_LABELS[m] }))}
            />
            <div>
              <Text type="secondary">Description template</Text>
              <Input
                name="descriptionTemplate" disabled={locked} value={grain.descriptionTemplate || ''}
                placeholder="{{style.garmentName}} — {{row.colorName}}"
                onChange={(e) => patch({ invoiceLineGrain: { ...grain, descriptionTemplate: e.target.value } })}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Placeholders that resolve to nothing are dropped along with their separator.
              </Text>
            </div>
            <Space>
              <Switch checked={Boolean(grain.showPackagingAttributes)} disabled={locked}
                onChange={(v) => patch({ invoiceLineGrain: { ...grain, showPackagingAttributes: v } })} />
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
                key={k} name={`charge-${k}`} disabled={locked} checked={Boolean(charges[k]?.enabled)}
                onChange={(e) => patch({ charges: { ...charges, [k]: { ...(charges[k] || {}), enabled: e.target.checked } } })}
              >
                {`Print a ${k} line`}
              </Checkbox>
            ))}
            <Space>
              <Switch checked={tpl.igst?.enabled !== false} disabled={locked}
                onChange={(v) => patch({ igst: { ...(tpl.igst || {}), enabled: v } })} />
              <Text>IGST block</Text>
              <InputNumber
                {...integerInputProps} size="small" min={0} max={100} style={{ width: 90 }} name="igstRate"
                disabled={locked || tpl.igst?.enabled === false} value={tpl.igst?.defaultRatePct}
                onChange={(v) => patch({ igst: { ...(tpl.igst || {}), defaultRatePct: v } })}
              />
              <Text type="secondary">% default</Text>
            </Space>
            {tpl.igst?.rates?.length > 1 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {`The buyer's form shows IGST at ${tpl.igst.rates.join('% and ')}%. Invoices compute one rate for now.`}
              </Text>
            )}
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
            <Button size="small" icon={<PlusOutlined />}
              onClick={() => decls.add({ order: declRows.length + 1, code: `D${declRows.length + 1}`, text: '' })}>
              Add declaration
            </Button>
          )}
        >
          <Alert
            type="warning" showIcon style={{ marginBottom: 12 }}
            title="Regulatory text is reproduced, never composed"
            description="These lines print verbatim in this order. The system does not validate or generate regulatory wording (§4.3)."
          />
          <Table
            size="small"
            rowKey="__row"
            pagination={false}
            scroll={{ x: 760 }}
            dataSource={withRowKeys(declRows).map((d) => ({ ...d, key: d.code }))}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No declarations configured." /> }}
            columns={[
              { title: '#', width: 44, align: 'center', render: (_, r) => r.__row + 1 },
              {
                title: 'Code',
                width: 140,
                render: (_, r) => (
                  <Input size="small" name={`decl-code-${r.__row}`} value={r.code || ''} disabled={locked}
                    onChange={(e) => decls.set(r.__row, { code: e.target.value.toUpperCase() })} />
                ),
              },
              {
                title: 'Text',
                render: (_, r) => (
                  <TextArea size="small" rows={2} name={`decl-text-${r.__row}`} value={r.text || ''} disabled={locked}
                    onChange={(e) => decls.set(r.__row, { text: e.target.value })} />
                ),
              },
              ...evidenceColumn(meta, 'declarations', onEvidence),
              { title: '', width: 110, render: (_, r) => <RowTools index={r.__row} count={declRows.length} list={decls} disabled={locked} /> },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default TabInvoice;
