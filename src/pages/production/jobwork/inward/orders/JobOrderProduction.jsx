import { memo } from 'react';
import {
  Alert, Button, Card, Table, Tag, Timeline, Typography,
} from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { SCOPE } from '../../../../../utils/jobWorkInward/inwardConstants';
import { fmtDate, fmtQty } from '../../jwFormat';

const { Text } = Typography;

/** Our in-house documents for the order, process work at our vendors (decision 21), and the history. */
const JobOrderProduction = memo(function JobOrderProduction({ view, onOpenOutwardJob }) {
  const { production: pr, jo } = view;
  const docs = [
    ...pr.cuttingPos.map((c) => ({ docNo: c.docNo, type: 'Cutting PO (in-house)', detail: `${c.colour} · Unit 1 · Cutting` })),
    ...(pr.workOrderNo ? [{ docNo: pr.workOrderNo, type: 'Work Order (in-house)', detail: `${pr.unit}${jo.scope === SCOPE.STITCHING ? ' — from the principal\'s cut panels, no Cutting PO' : ''}` }] : []),
    ...(pr.finishingPoNo ? [{ docNo: pr.finishingPoNo, type: 'Finishing PO (in-house)', detail: 'Unit 1 · Finishing' }] : []),
  ];
  const history = [
    { at: jo.orderDate, text: `Order received — their ref ${jo.principalRef}` },
    ...view.inwards.map((i) => ({ at: i.date, text: `Material in ${i.inwardNo} on their challan ${i.theirDcNo}${i.status === 'CANCELLED' ? ' (cancelled)' : ''}` })),
    ...view.returns.map((r) => ({ at: r.date, text: `Returned ${fmtQty(r.pieces + r.rejectPieces)} pieces on challan ${r.ourChallanNo} (${r.returnNo})${r.status === 'CANCELLED' ? ' — cancelled' : ''}` })),
    ...jo.events.map((e) => ({ at: e.at, text: e.text, by: e.by })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <>
      {!docs.length && <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Our Cutting PO, Work Order and Finishing PO are raised from this order as usual once the material arrives." />}
      {docs.length > 0 && (
        <Table rowKey="docNo" size="small" pagination={false} style={{ marginBottom: 12 }} dataSource={docs} columns={[
          { title: 'Our document', dataIndex: 'type', width: 200 },
          { title: 'No.', dataIndex: 'docNo', width: 170, render: (v) => <Text strong>{v}</Text> },
          { title: 'Where', dataIndex: 'detail' },
        ]} />
      )}
      {pr.processDocs.length > 0 && (
        <Card size="small" title="Process work at our vendors" style={{ marginBottom: 12 }}>
          {pr.processDocs.map((d) => (
            <div key={d.docNo} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Text strong>{d.docNo}</Text>
              <Text>{d.vendorName} — {d.process}</Text>
              <Tag color="purple">{fmtQty(d.atVendor)} sets still at the vendor</Tag>
              <Button size="small" icon={<ExportOutlined />} onClick={() => onOpenOutwardJob(d.outwardJobId)}>Open on the Outward side</Button>
            </div>
          ))}
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            Printing, embroidery and washing may go to our process vendors; their daily status is tracked on the Outward side, tagged as the principal&apos;s goods.
          </Text>
        </Card>
      )}
      <Card size="small" title="History">
        <Timeline items={history.map((h, i) => ({ key: `${h.at}-${i}`, color: 'blue', title: `${fmtDate(h.at)}${h.by ? ` · ${h.by}` : ''}`, content: h.text }))} />
      </Card>
    </>
  );
});

export default JobOrderProduction;
