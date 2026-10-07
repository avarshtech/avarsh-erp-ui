import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Card, Col, Empty, Popconfirm, Row, Skeleton, Space, Table, Tag, Typography,
} from 'antd';
import { FileAddOutlined } from '@ant-design/icons';
import { createDraftPo, getPoPrefill, removeDraftPo } from '../../../../services/production/jobwork/jobWorkPullBackApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { hasPermission } from '../../../../utils/permissions';
import { DOC_TYPE_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { fmtDate, fmtMoney, fmtQty } from '../jwFormat';

const { Text } = Typography;

/** One preview's lines as a colour × size matrix ('-' = written-off pieces with no size yet). */
const PreviewCard = ({ p, orderSizes, busy, canAdd, onOpen }) => {
  const sizes = [...orderSizes.filter((s) => p.lines.some((l) => l.size === s)), ...new Set(p.lines.map((l) => l.size).filter((s) => !orderSizes.includes(s)))];
  const rows = [...new Set(p.lines.map((l) => l.colour))].map((colour) => ({
    colour, ...Object.fromEntries(sizes.map((s) => [s, p.lines.find((l) => l.colour === colour && l.size === s)?.qty || 0])),
  }));
  const columns = [
    { title: 'Colour', dataIndex: 'colour', width: 90 },
    ...sizes.map((s) => ({ title: s === '-' ? 'Unsized' : s, dataIndex: s, align: 'right', render: (v) => (v ? fmtQty(v) : '—') })),
    { title: 'Total', key: 't', align: 'right', render: (_, r) => <Text strong>{fmtQty(sizes.reduce((a, s) => a + r[s], 0))}</Text> },
  ];
  return (
    <Card size="small" title={p.label} extra={<Button size="small" type="primary" icon={<FileAddOutlined />} loading={busy} disabled={!canAdd} onClick={() => onOpen(p)}>Open pre-filled</Button>}>
      <Space size={[4, 4]} wrap style={{ marginBottom: 8 }}>
        <Tag>{p.branch}</Tag>
        <Tag>{p.unit}</Tag>
        <Tag color={p.rate === null ? 'orange' : 'default'}>{p.rate === null ? 'Rate to enter' : `${fmtMoney(p.rate)} / pc`}</Tag>
        {p.provisional && <Tag color="gold">Provisional split</Tag>}
      </Space>
      {p.processes?.length > 0 && <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Processes still to do: {p.processes.join(', ')}</Text>}
      <Table rowKey="colour" size="small" pagination={false} columns={columns} dataSource={rows} scroll={{ x: 'max-content' }} />
      <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6 }}>{p.note}</Text>
    </Card>
  );
};

/** What the in-house Cutting PO / Work Order / Finishing PO would open with, and the POs already linked. */
const PoPrefillPreview = ({ pb, refresh, onChanged }) => {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    let alive = true;
    getPoPrefill(pb.id).then((d) => { if (alive) setData(d); }).catch((e) => toastUnlessHandled(message, e));
    return () => { alive = false; };
  }, [pb.id, pb.status, refresh, message]);

  const open = async (p) => {
    setBusy(p.docType);
    try {
      const d = await createDraftPo(pb.id, { docType: p.docType, totalQty: p.totalQty });
      message.success(`${d.docNo} saved as a draft linked to ${pb.pbNo}. In the live system the ${DOC_TYPE_LABEL[p.docType]} form opens pre-filled.`);
      onChanged();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(null); }
  };
  const remove = async (d) => {
    try { await removeDraftPo(d.id); onChanged(); } catch (e) { toastUnlessHandled(message, e); }
  };
  const canAdd = hasPermission('production-job-work', 'add');

  return (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title="What the in-house POs open with"
        description="Each button stands in for opening the real form with ?pullBackId=: same order, the job's branch, rates from the order's in-house PO of that type. Pieces still at the vendor are split by size pro rata until they come back. A linked PO stops the pull-back being cancelled." />
      {!data && <Skeleton active />}
      {data && !data.previews.length && <Empty description={data.note || 'Nothing is waiting to be made in-house.'} />}
      <Row gutter={[12, 12]}>
        {data?.previews.map((p) => (
          <Col key={p.docType} xs={24} xl={12}>
            <PreviewCard p={p} orderSizes={pb.order.sizes} busy={busy === p.docType} canAdd={canAdd} onOpen={open} />
          </Col>
        ))}
      </Row>
      {pb.draftPos.length > 0 && (
        <Card size="small" title="In-house POs linked to this pull-back" style={{ marginTop: 12 }}>
          <Table rowKey="id" size="small" pagination={false} dataSource={pb.draftPos} columns={[
            { title: 'PO', dataIndex: 'docNo', render: (v, d) => <>{v} <Text type="secondary">({DOC_TYPE_LABEL[d.docType]})</Text></> },
            { title: 'Pieces', dataIndex: 'totalQty', align: 'right', render: fmtQty },
            { title: 'Created', dataIndex: 'createdAt', render: fmtDate },
            { title: 'Status', dataIndex: 'status', render: () => <Tag>Draft</Tag> },
            { title: '', key: 'x', width: 90, render: (_, d) => <Popconfirm title={`Remove ${d.docNo}?`} onConfirm={() => remove(d)}><Button size="small" type="link" danger>Remove</Button></Popconfirm> },
          ]} />
        </Card>
      )}
    </>
  );
};

export default PoPrefillPreview;
