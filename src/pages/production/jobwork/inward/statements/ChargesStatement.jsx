import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Col, DatePicker, Row, Select, Space, Table, Typography,
} from 'antd';
import { AuditOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { listCharges } from '../../../../../services/production/jobwork/jobWorkPrincipalReturnApi';
import { downloadCsv } from '../../../../../utils/download';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { hasPermission } from '../../../../../utils/permissions';
import { TALLY_STATUS_LABEL, toOptions } from '../../../../../utils/jobWorkInward/inwardConstants';
import { TallyTag } from '../components/InwardTags';
import TallyInvoiceModal from './TallyInvoiceModal';
import { fmtDate, fmtMoney, fmtQty } from '../../jwFormat';

const { Text } = Typography;
const money = (k, title) => ({ title, dataIndex: k, width: 110, align: 'right', render: (v) => (v ? fmtMoney(v) : '—') });

/** Job charges per return, as the accountant needs them for the Tally invoice (decision 4). */
const ChargesStatement = ({ options, refresh, onChanged }) => {
  const { message } = App.useApp();
  const [principalId, setPrincipalId] = useState();
  const [month, setMonth] = useState(null);
  const [tally, setTally] = useState('PENDING');
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    let alive = true;
    listCharges({ principalId, month, tally }).then((r) => { if (alive) { setRows(r); setSelected([]); } }).catch((e) => toastUnlessHandled(message, e));
    return () => { alive = false; };
  }, [principalId, month, tally, refresh, message]);

  const picked = rows.filter((r) => selected.includes(r.returnId));
  const onePrincipal = new Set(picked.map((r) => r.principalId)).size === 1;
  const total = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const csv = () => downloadCsv([
    ['Date', 'Return', 'Our challan', 'Principal', 'GSTIN', 'Order', 'Style', 'SAC', 'Pieces', 'Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Tally invoice'],
    ...rows.map((r) => [r.date, r.returnNo, r.ourChallanNo, r.principalName, r.gstin || 'Unregistered', r.orderNo, r.styleNo, r.sacCode, r.pieces, r.rate, r.taxable, r.cgst, r.sgst, r.igst, r.total, r.tally?.invoiceNo || '']),
  ], `job-charges${month ? `-${month}` : ''}.csv`);

  const columns = [
    { title: 'Return', dataIndex: 'returnNo', width: 150, render: (v, r) => <><Text strong style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.date)} · {r.ourChallanNo}</Text></> },
    { title: 'Principal', dataIndex: 'principalName', width: 180, render: (v, r) => <>{v}<br /><Text type="secondary" style={{ fontSize: 11 }}>{r.gstin || 'Unregistered'}</Text></> },
    { title: 'Order / style', key: 'os', width: 170, render: (_, r) => `${r.orderNo} · ${r.styleNo}` },
    { title: 'Pieces', dataIndex: 'pieces', width: 80, align: 'right', render: fmtQty },
    { title: 'Rate', dataIndex: 'rate', width: 80, align: 'right', render: fmtMoney },
    money('taxable', 'Taxable'), money('cgst', 'CGST'), money('sgst', 'SGST'), money('igst', 'IGST'), money('total', 'Total'),
    { title: 'Tally', key: 't', width: 170, render: (_, r) => <TallyTag tally={r.tally} overdue={r.overdue} /> },
  ];
  return (
    <>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={24} md={6}><Select name="chPrincipal" allowClear style={{ width: '100%' }} placeholder="All principals" value={principalId} options={options.principals} onChange={setPrincipalId} /></Col>
        <Col xs={12} md={5}><DatePicker name="chMonth" picker="month" style={{ width: '100%' }} placeholder="All months" value={month ? dayjs(`${month}-01`) : null} onChange={(d) => setMonth(d ? d.format('YYYY-MM') : null)} /></Col>
        <Col xs={12} md={5}><Select name="chTally" allowClear style={{ width: '100%' }} placeholder="Billed or not" value={tally} options={toOptions(TALLY_STATUS_LABEL)} onChange={setTally} /></Col>
        <Col xs={24} md={8} style={{ textAlign: 'right' }}>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={csv} disabled={!rows.length}>CSV for Tally</Button>
            <Button type="primary" icon={<AuditOutlined />} disabled={!picked.length || !onePrincipal || !hasPermission('production-job-work', 'add')} onClick={() => setRecording(true)}>Record Tally invoice</Button>
          </Space>
        </Col>
      </Row>
      {picked.length > 0 && !onePrincipal && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="One Tally invoice covers one principal: pick returns of one principal." />}
      <Table rowKey="returnId" size="small" pagination={false} columns={columns} dataSource={rows} scroll={{ x: 1450, y: 'calc(100vh - 470px)' }}
        rowSelection={{ selectedRowKeys: selected, onChange: setSelected, getCheckboxProps: (r) => ({ disabled: !!r.tally }) }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4}><Text strong>Total ({rows.length} returns)</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">{fmtQty(total('pieces'))}</Table.Summary.Cell>
              <Table.Summary.Cell index={5} />
              {['taxable', 'cgst', 'sgst', 'igst', 'total'].map((k, i) => <Table.Summary.Cell key={k} index={6 + i} align="right"><Text strong>{fmtMoney(total(k))}</Text></Table.Summary.Cell>)}
              <Table.Summary.Cell index={11} />
            </Table.Summary.Row>
          </Table.Summary>
        )} />
      {recording && <TallyInvoiceModal rows={picked} onClose={() => setRecording(false)} onSaved={() => { setRecording(false); onChanged(); }} />}
    </>
  );
};

export default ChargesStatement;
