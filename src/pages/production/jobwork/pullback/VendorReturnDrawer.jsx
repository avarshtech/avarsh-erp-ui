import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Col, DatePicker, Drawer, Input, InputNumber, Row, Skeleton, Space, Table, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { getJobMaterials, postVendorReturn } from '../../../../services/production/jobwork/jobWorkMaterialsApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { DATE_FORMAT } from '../../../../utils/uiConstants';
import { MATERIAL_CONDITION, MATERIAL_KIND_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { fmtQty } from '../jwFormat';

const { Text } = Typography;
const { GOOD, DAMAGED } = MATERIAL_CONDITION;

/**
 * Fabric, trims or packing back from a vendor, per issue line: good goes back onto the roll or lot it
 * left from, damaged is recorded only. At integration this is Material Issue → Vendor Returns.
 */
const VendorReturnDrawer = ({ jobId, pullBackId = null, title, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState(null);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [dc, setDc] = useState('');
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getJobMaterials(jobId).then((m) => setRows(m.rows.filter((r) => r.atVendor > 0))).catch((e) => toastUnlessHandled(message, e));
  }, [jobId, message]);

  const asked = (r) => (qty[`${r.id}|${GOOD}`] || 0) + (qty[`${r.id}|${DAMAGED}`] || 0);
  const over = (rows || []).filter((r) => asked(r) > r.atVendor).map((r) => r.id);
  const lines = Object.entries(qty).filter(([, q]) => q > 0).map(([k, q]) => {
    const [materialId, condition] = k.split('|');
    return { materialId: Number(materialId), qty: q, condition };
  });

  const submit = async () => {
    setBusy(true);
    try {
      const res = await postVendorReturn(jobId, { date, vendorDcNo: dc, pullBackId, lines });
      message.success(`${res.vmrNo} posted: good material is back on its lot.`);
      onSaved();
      onClose();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };

  const input = (r, condition) => (
    <InputNumber name={`vmr-${r.id}-${condition}`} size="small" min={0} controls={false} style={{ width: '100%' }}
      status={over.includes(r.id) ? 'error' : undefined} value={qty[`${r.id}|${condition}`]}
      onChange={(v) => setQty((q) => ({ ...q, [`${r.id}|${condition}`]: v || 0 }))} />
  );
  const columns = [
    {
      title: 'Material', dataIndex: 'itemName',
      render: (v, r) => <><Text strong style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{MATERIAL_KIND_LABEL[r.kind]} · {r.misNo} · {r.docNo}</Text></>,
    },
    { title: 'Sent', dataIndex: 'qty', align: 'right', width: 100, render: (v, r) => `${fmtQty(v)} ${r.uom}` },
    { title: 'Back so far', key: 'back', align: 'right', width: 100, render: (_, r) => fmtQty(r.returnedGood + r.returnedDamaged) },
    { title: 'At vendor', dataIndex: 'atVendor', align: 'right', width: 100, render: (v, r) => <Text type={over.includes(r.id) ? 'danger' : undefined}>{fmtQty(v)} {r.uom}</Text> },
    { title: 'Good back', key: 'g', width: 100, render: (_, r) => input(r, GOOD) },
    { title: 'Damaged', key: 'd', width: 100, render: (_, r) => input(r, DAMAGED) },
  ];

  return (
    <Drawer open size={880} destroyOnHidden onClose={onClose} title={title || 'Vendor material return'}
      extra={(
        <Space>
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" loading={busy} disabled={!lines.length || !dc.trim() || over.length > 0} onClick={submit}>Post return</Button>
        </Space>
      )}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        title="Good material goes back onto the roll or lot it was issued from; damaged material is recorded only." />
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={12} md={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>Arrived on</Text>
          <DatePicker name="vmrDate" style={{ width: '100%' }} format={DATE_FORMAT} allowClear={false} value={dayjs(date)}
            disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(d) => setDate(d.format('YYYY-MM-DD'))} />
        </Col>
        <Col xs={12} md={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>Vendor DC no.</Text>
          <Input name="vmrDc" value={dc} onChange={(e) => setDc(e.target.value)} placeholder="As printed on the vendor's challan" />
        </Col>
      </Row>
      {!rows ? <Skeleton active /> : (
        <Table rowKey="id" size="small" pagination={false} columns={columns} dataSource={rows} scroll={{ x: 780, y: 420 }}
          locale={{ emptyText: 'Nothing is left at the vendor on this job.' }} />
      )}
    </Drawer>
  );
};

export default VendorReturnDrawer;
