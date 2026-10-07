import { memo } from 'react';
import {
  App, Button, Card, Space, Table, Tag, Typography,
} from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { getInwardReport } from '../../../../../services/production/jobwork/jobWorkPartyStockApi';
import { getReturnPrint } from '../../../../../services/production/jobwork/jobWorkPrincipalReturnApi';
import { buildReturnChallanHtml, buildShortageReportHtml } from '../../../../../utils/jobWorkInward/inwardPrint';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { DocStatusTag, TallyTag } from '../components/InwardTags';
import { fmtDate, fmtMoney, fmtQty } from '../../jwFormat';

const { Text } = Typography;
const summaryText = (s) => [s.rolls ? `${s.rolls} rolls · ${fmtQty(s.fabricKg)} kg` : null, s.panelSets ? `${fmtQty(s.panelSets)} panel sets` : null, s.trimLines ? `${s.trimLines} trim lines` : null].filter(Boolean).join(' · ');

/** Material In documents and returns of one job order, with their prints and job charges. */
const JobOrderDocs = memo(function JobOrderDocs({ view, openPrint }) {
  const { message } = App.useApp();
  const printReport = async (id) => {
    try { const d = await getInwardReport(id); openPrint({ title: `Shortage & defect report — ${d.doc.inwardNo}`, html: buildShortageReportHtml(d) }); } catch (e) { toastUnlessHandled(message, e); }
  };
  const printChallan = async (id) => {
    try { const d = await getReturnPrint(id); openPrint({ title: `Return challan — ${d.ret.ourChallanNo}`, html: buildReturnChallanHtml(d) }); } catch (e) { toastUnlessHandled(message, e); }
  };
  const inwardColumns = [
    { title: 'Material In', dataIndex: 'inwardNo', render: (v, i) => <><Text strong style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(i.date)}</Text></> },
    { title: 'Their challan', dataIndex: 'theirDcNo', render: (v, i) => <>{v}<br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(i.theirDcDate)} · {i.dispatchedFrom}</Text></> },
    { title: 'What came', dataIndex: 'summary', render: summaryText },
    { title: 'Inspection', key: 'insp', render: (_, i) => (i.shortLines || i.defectCount ? <Space size={4}>{i.shortLines > 0 && <Tag color="orange">{i.shortLines} short</Tag>}{i.defectCount > 0 && <Tag color="red">{i.defectCount} defects</Tag>}</Space> : <Tag color="green">OK</Tag>) },
    { title: 'Status', dataIndex: 'status', render: (s) => <DocStatusTag status={s} /> },
    { title: '', key: 'p', width: 90, render: (_, i) => <Button size="small" icon={<PrinterOutlined />} onClick={() => printReport(i.id)}>Report</Button> },
  ];
  const returnColumns = [
    { title: 'Return', dataIndex: 'returnNo', render: (v, r) => <><Text strong style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.date)} · challan {r.ourChallanNo}</Text></> },
    { title: 'Pieces', key: 'pcs', render: (_, r) => `${fmtQty(r.pieces)} good${r.rejectPieces ? ` · ${fmtQty(r.rejectPieces)} rejected` : ''}${r.lotLines.length ? ` · ${r.lotLines.length} material lines` : ''}${r.wasteKg ? ` · ${fmtQty(r.wasteKg)} kg waste` : ''}` },
    { title: 'Settles their challans', dataIndex: 'settles', render: (s) => <Text type="secondary" style={{ fontSize: 12 }}>{s.join(', ') || '—'}</Text> },
    { title: 'Job charges', key: 'ch', align: 'right', render: (_, r) => (r.charge ? fmtMoney(r.charge.total) : '—') },
    { title: 'Tally', key: 't', render: (_, r) => (r.status === 'DISPATCHED' ? <TallyTag tally={r.tally} overdue={r.charge?.overdue} /> : <DocStatusTag status={r.status} />) },
    { title: '', key: 'p', width: 90, render: (_, r) => <Button size="small" icon={<PrinterOutlined />} onClick={() => printChallan(r.id)}>Challan</Button> },
  ];
  return (
    <>
      <Card size="small" title="Material in on their challans" style={{ marginBottom: 12 }}>
        <Table rowKey="id" size="small" pagination={false} columns={inwardColumns} dataSource={view.inwards} scroll={{ x: 900 }} locale={{ emptyText: 'Nothing received from the principal yet.' }} />
      </Card>
      <Card size="small" title="Returns on our challans" extra={<Text>Job charges {fmtMoney(view.charges.total)}{view.charges.unbilled > 0 && <Text type="warning"> · {fmtMoney(view.charges.unbilled)} not in Tally</Text>}</Text>}>
        <Table rowKey="id" size="small" pagination={false} columns={returnColumns} dataSource={view.returns} scroll={{ x: 980 }} locale={{ emptyText: 'Nothing returned yet.' }} />
      </Card>
    </>
  );
});

export default JobOrderDocs;
