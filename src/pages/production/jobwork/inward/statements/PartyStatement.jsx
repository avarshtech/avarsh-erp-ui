import { useEffect, useState } from 'react';
import {
  App, Button, Card, Col, Empty, Row, Select, Skeleton, Table, Typography,
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { getPartyStatement } from '../../../../../services/production/jobwork/jobWorkPrincipalReturnApi';
import { downloadCsv } from '../../../../../utils/download';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { AgeTag } from '../components/InwardTags';
import { fmtDate, fmtQty } from '../../jwFormat';

const { Text } = Typography;

/** The principal's material account: what is with us by lot, every movement, and each fabric account. */
const PartyStatement = ({ options, refresh }) => {
  const { message } = App.useApp();
  const [principalId, setPrincipalId] = useState(options.principals[0]?.value);
  const [jobOrderId, setJobOrderId] = useState();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!principalId) return undefined;
    let alive = true;
    getPartyStatement({ principalId, jobOrderId }).then((d) => { if (alive) setData(d); }).catch((e) => toastUnlessHandled(message, e));
    return () => { alive = false; };
  }, [principalId, jobOrderId, refresh, message]);

  const csv = () => downloadCsv([
    ['Date', 'Document', 'Order', 'What', 'Material', 'Lot', 'In', 'Out', 'Unit'],
    ...data.rows.map((r) => [r.date, r.docNo, r.orderNo, r.text, r.itemName, r.lotNo || '', r.qtyIn || '', r.qtyOut || '', r.uom]),
  ], `party-statement-${data.principal.name.replace(/\W+/g, '-')}.csv`);

  return (
    <>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={24} md={8}><Select name="psPrincipal" style={{ width: '100%' }} value={principalId} options={options.principals} onChange={(v) => { setPrincipalId(v); setJobOrderId(undefined); setData(null); }} /></Col>
        <Col xs={24} md={10}><Select name="psOrder" allowClear style={{ width: '100%' }} placeholder="All their orders" value={jobOrderId} onChange={setJobOrderId} options={options.jobOrders.filter((o) => o.principalId === principalId)} /></Col>
        <Col xs={24} md={6} style={{ textAlign: 'right' }}><Button icon={<DownloadOutlined />} disabled={!data} onClick={csv}>Download CSV</Button></Col>
      </Row>
      {!data && principalId && <Skeleton active />}
      {!principalId && <Empty description="Pick a principal." />}
      {data && (
        <>
          <Card size="small" title="Their material, lot by lot" style={{ marginBottom: 12 }}>
            <Table rowKey="lotNo" size="small" pagination={false} scroll={{ x: 900, y: 260 }} dataSource={data.summary} columns={[
              { title: 'Order', dataIndex: 'orderNo', width: 140 }, { title: 'Lot', dataIndex: 'lotNo', width: 110 },
              { title: 'Material', dataIndex: 'itemName' }, { title: 'Their challan', dataIndex: 'theirDcNo', width: 130 },
              { title: 'Received', key: 'r', width: 110, align: 'right', render: (_, l) => `${fmtQty(l.received)} ${l.uom}` },
              { title: 'In store', key: 's', width: 100, align: 'right', render: (_, l) => fmtQty(l.inStore) },
              { title: 'Not yet accounted', key: 'o', width: 130, align: 'right', render: (_, l) => <Text strong>{fmtQty(l.outstanding)}</Text> },
              { title: 'Age', key: 'a', width: 110, render: (_, l) => (l.ageLevel ? <AgeTag level={l.ageLevel} days={l.ageDays} /> : `${l.ageDays} days`) },
            ]} />
          </Card>
          <Card size="small" title="Every movement" style={{ marginBottom: 12 }}>
            <Table rowKey="key" size="small" pagination={{ pageSize: 15, hideOnSinglePage: true, showSizeChanger: false }} scroll={{ x: 1000 }} dataSource={data.rows} columns={[
              { title: 'Date', dataIndex: 'date', width: 110, render: fmtDate }, { title: 'Document', dataIndex: 'docNo', width: 150 },
              { title: 'What', dataIndex: 'text' }, { title: 'Material', dataIndex: 'itemName', width: 230 },
              { title: 'In', dataIndex: 'qtyIn', width: 90, align: 'right', render: (v) => (v ? fmtQty(v) : '') },
              { title: 'Out', dataIndex: 'qtyOut', width: 90, align: 'right', render: (v) => (v ? fmtQty(v) : '') }, { title: 'Unit', dataIndex: 'uom', width: 60 },
            ]} />
          </Card>
          {data.accounts.length > 0 && (
            <Card size="small" title="Fabric accounts (kg)">
              <Table rowKey={(a) => `${a.orderNo}|${a.materialId}`} size="small" pagination={false} scroll={{ x: 1000 }} dataSource={data.accounts} columns={[
                { title: 'Order', dataIndex: 'orderNo', width: 140 }, { title: 'Fabric', dataIndex: 'itemName' },
                ...['received', 'usedInLays', 'inStore', 'returned', 'variance', 'outstanding'].map((k) => ({
                  title: { received: 'Received', usedInLays: 'Used in lays', inStore: 'In store', returned: 'Returned', variance: 'Variance', outstanding: 'Not yet accounted' }[k], dataIndex: k, width: 110, align: 'right', render: fmtQty,
                })),
                { title: 'Waste (back / sold)', key: 'w', width: 140, align: 'right', render: (_, a) => `${fmtQty(a.waste.returned)} / ${fmtQty(a.waste.sold)}` },
              ]} />
            </Card>
          )}
        </>
      )}
    </>
  );
};

export default PartyStatement;
