import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Card, Empty, Progress, Select, Skeleton, Table, Typography,
} from 'antd';
import { getOrderSplit, listSplitOrders } from '../../../../services/production/jobwork/jobWorkMaterialsApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { OPEN_JOB_STATUSES } from '../../../../utils/jobWorkTracker/constants';
import { JobStatusTag, RiskTag } from '../components/JwTags';
import { fmtDate, fmtQty, pct } from '../jwFormat';
import OrderSplitCard from './OrderSplitCard';

const { Text } = Typography;

const processColumns = (onOpenJob) => [
  { title: 'Job', dataIndex: 'jobNo', width: 170, render: (v, j) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onOpenJob(j.jobId)}>{v}</Button> },
  { title: 'Vendor', dataIndex: 'vendorName', width: 190 },
  { title: 'Does', key: 'does', render: (_, j) => j.processName || j.stageLabels.join(' → ') },
  {
    title: 'Progress', key: 'p', width: 170,
    render: (_, j) => {
      const last = j.stages[j.stages.length - 1];
      return <Progress percent={pct(j.totals[last], j.planTotals[last])} size="small" format={() => `${fmtQty(j.totals[last])} / ${fmtQty(j.planTotals[last])}`} />;
    },
  },
  { title: 'Status', dataIndex: 'status', width: 190, render: (s, j) => <><JobStatusTag status={s} /> <RiskTag risk={j.risk} completed={!OPEN_JOB_STATUSES.includes(s)} /></> },
];

/** Pick an order to see who makes what: vendors and in-house, per colour (preview of the Order view's Split card). */
const OrderSplitTab = ({ refresh, actions }) => {
  const { message } = App.useApp();
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState(null);
  const [split, setSplit] = useState(null);

  useEffect(() => {
    listSplitOrders().then((o) => {
      setOrders(o);
      setOrderId((id) => id ?? (o.find((x) => x.hasInhouse) || o[0])?.id ?? null);
    }).catch((e) => toastUnlessHandled(message, e));
  }, [refresh, message]);

  useEffect(() => {
    if (!orderId) return undefined;
    let alive = true;
    getOrderSplit(orderId).then((s) => { if (alive) setSplit(s); }).catch((e) => toastUnlessHandled(message, e));
    return () => { alive = false; };
  }, [orderId, refresh, message]);

  return (
    <Card size="small">
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Preview of the Split card that will sit on the Order view"
        description="One order, part made in-house and part by vendors. Pulled-back pieces move from the vendor's share to in-house." />
      <Select name="splitOrder" showSearch optionFilterProp="label" style={{ width: '100%', maxWidth: 640, marginBottom: 12 }} value={orderId} onChange={setOrderId}
        options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} — ${o.buyer} — ${o.styleNo} ${o.styleName} (${o.vendorJobs} vendor job${o.vendorJobs === 1 ? '' : 's'}${o.hasInhouse ? ', in-house too' : ''})` }))} />
      {!orderId && <Empty description="No orders yet." />}
      {orderId && !split && <Skeleton active paragraph={{ rows: 8 }} />}
      {split && (
        <>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            {split.order.orderNo} · {split.order.buyer} · {split.order.styleNo} {split.order.styleName} · ships {fmtDate(split.order.shipDate)}
          </Text>
          <OrderSplitCard split={split} onOpenJob={actions.openJob} />
          {split.processJobs.length > 0 && (
            <Card size="small" title="Process vendors on this order (they do not make the garment)" style={{ marginTop: 12 }}>
              <Table rowKey="jobId" size="small" pagination={false} columns={processColumns(actions.openJob)} dataSource={split.processJobs} scroll={{ x: 820 }} />
            </Card>
          )}
        </>
      )}
    </Card>
  );
};

export default OrderSplitTab;
