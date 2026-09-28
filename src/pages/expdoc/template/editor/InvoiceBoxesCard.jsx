import { Card, Input, Switch, Table, Typography } from 'antd';
import { INVOICE_BOXES } from '../../../../utils/expDocConstants';
import FieldBindingPicker from '../FieldBindingPicker';
import { EvidenceTag } from './EditorParts';

const { Text } = Typography;

/**
 * The standard export invoice header, box by box. A buyer's form usually keeps the
 * grid and changes words ("SELLER" for "Exporter"), content (a bank named as the
 * consignee), or drops a box — so each box can be relabelled, bound to something else,
 * or hidden. An untouched box prints exactly as the standard invoice does.
 */
const InvoiceBoxesCard = ({ tpl, patch, locked, meta, onEvidence }) => {
  const boxes = tpl.invoiceHeader?.boxes || {};

  const setBox = (key, changes) => {
    const next = { ...(boxes[key] || {}), ...changes };
    Object.keys(next).forEach((k) => { if (next[k] === undefined || next[k] === '' || next[k] === false) delete next[k]; });
    const all = { ...boxes, [key]: next };
    if (!Object.keys(next).length) delete all[key];
    patch({ invoiceHeader: { ...(tpl.invoiceHeader || {}), boxes: all } });
  };

  return (
    <Card size="small" title="Invoice header boxes">
      <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
        Change a label, bind a box to other content, or hide a box the buyer&apos;s form does not have.
        Leave a row alone to print the standard box.
      </Text>
      <Table
        size="small"
        rowKey="key"
        pagination={false}
        scroll={{ x: 980 }}
        dataSource={INVOICE_BOXES}
        columns={[
          {
            title: 'Standard box',
            width: 210,
            render: (_, b) => (
              <>
                <Text>{b.label}</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{b.content}</Text>
              </>
            ),
          },
          {
            title: 'Printed label',
            width: 220,
            render: (_, b) => (
              <Input size="small" name={`box-label-${b.key}`} disabled={locked || boxes[b.key]?.hidden}
                placeholder={b.label} value={boxes[b.key]?.label || ''}
                onChange={(e) => setBox(b.key, { label: e.target.value || undefined })} />
            ),
          },
          {
            title: 'Content',
            render: (_, b) => (
              <FieldBindingPicker
                value={boxes[b.key]?.binding} disabled={locked || boxes[b.key]?.hidden}
                placeholder="Standard content"
                onChange={(v) => setBox(b.key, { binding: v || undefined })}
              />
            ),
          },
          {
            title: 'Hidden',
            width: 80,
            align: 'center',
            render: (_, b) => (
              <Switch size="small" disabled={locked} checked={Boolean(boxes[b.key]?.hidden)}
                onChange={(v) => setBox(b.key, { hidden: v || undefined })} />
            ),
          },
          ...(meta && Object.keys(meta).length ? [{
            title: 'Source',
            width: 120,
            render: (_, b) => <EvidenceTag meta={meta[`invoiceHeader.boxes:${b.key}`]} onEvidence={onEvidence} />,
          }] : []),
        ]}
      />
    </Card>
  );
};

export default InvoiceBoxesCard;
