import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Col, DatePicker, Drawer, InputNumber, Row, Select, Space, Table, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { getPackingTargets, issuePacking, PACKING_ITEMS } from '../../../../services/production/jobwork/jobWorkMaterialsApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { DATE_FORMAT } from '../../../../utils/uiConstants';
import { DOC_TYPE_LABEL } from '../../../../utils/jobWorkTracker/constants';

const { Text } = Typography;

/**
 * Packing material to a vendor (plan 1d): against an outsourced Finishing PO with Packing, or a vendor
 * Work Order whose job packs. At integration this is Material Issue → Packing, lines from the BOM.
 */
const PackingIssueDrawer = ({ jobId: givenJobId, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [targets, setTargets] = useState(null);
  const [jobId, setJobId] = useState(givenJobId ?? null);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPackingTargets().then(setTargets).catch((e) => toastUnlessHandled(message, e)); }, [message]);

  const target = targets?.find((t) => t.jobId === jobId);
  const lines = PACKING_ITEMS.filter((i) => (qty[i.itemCode] || 0) > 0).map((i) => ({ itemCode: i.itemCode, qty: qty[i.itemCode] }));
  const submit = async () => {
    setBusy(true);
    try {
      const res = await issuePacking(jobId, { date, lines });
      message.success(`${res.misNo} issued to ${target.vendorName} against ${target.docNo}.`);
      onSaved();
      onClose();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };

  const columns = [
    { title: 'Item', dataIndex: 'itemName', render: (v, i) => <><Text>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{i.itemCode}</Text></> },
    { title: 'UOM', dataIndex: 'uom', width: 80 },
    {
      title: 'Issue qty', key: 'q', width: 140,
      render: (_, i) => (
        <InputNumber name={`pack-${i.itemCode}`} size="small" min={0} precision={0} controls={false} style={{ width: '100%' }}
          value={qty[i.itemCode]} onChange={(v) => setQty((q) => ({ ...q, [i.itemCode]: v || 0 }))} />
      ),
    },
  ];

  return (
    <Drawer open size={720} destroyOnHidden onClose={onClose} title="Issue packing material to a vendor"
      extra={(
        <Space>
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" loading={busy} disabled={!target || !lines.length} onClick={submit}>Issue</Button>
        </Space>
      )}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        title="Only jobs that pack are listed: an outsourced Finishing PO with Packing, or a vendor Work Order whose job includes Packed." />
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={24} md={16}>
          <Text type="secondary" style={{ fontSize: 12 }}>Job</Text>
          <Select name="packJob" showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Which job?" loading={!targets}
            value={jobId} onChange={setJobId}
            options={(targets || []).map((t) => ({ value: t.jobId, label: `${t.jobNo} — ${t.vendorName} — ${t.orderNo} ${t.styleNo} (${DOC_TYPE_LABEL[t.docType]} ${t.docNo})` }))} />
        </Col>
        <Col xs={24} md={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>Issue date</Text>
          <DatePicker name="packDate" style={{ width: '100%' }} format={DATE_FORMAT} allowClear={false} value={dayjs(date)}
            disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(d) => setDate(d.format('YYYY-MM-DD'))} />
        </Col>
      </Row>
      {givenJobId && targets && !target && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="This job does not pack, so packing material cannot be issued to it." />}
      <Table rowKey="itemCode" size="small" pagination={false} columns={columns} dataSource={PACKING_ITEMS} />
    </Drawer>
  );
};

export default PackingIssueDrawer;
