import { memo } from 'react';
import { Table, Tag, Typography } from 'antd';
import { DOC_TYPE_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { fmtDate, fmtMoney, fmtQty } from '../jwFormat';

const { Text } = Typography;

/** The vendor documents linked to the job: one row per approved PO. */
const JobDocsTable = memo(function JobDocsTable({ docs = [] }) {
  const columns = [
    { title: 'Document', dataIndex: 'docNo', render: (v, d) => <><Text strong>{v}</Text><br /><Tag>{DOC_TYPE_LABEL[d.docType]}</Tag></> },
    { title: 'Process', key: 'proc', render: (_, d) => d.processName || (d.processes || []).map((p) => p.charAt(0) + p.slice(1).toLowerCase()).join(', ') || '—' },
    { title: 'Planned', dataIndex: 'plannedTotal', align: 'right', render: fmtQty },
    { title: 'Allowance', dataIndex: 'allowancePct', align: 'right', render: (v) => (v ? `${v}%` : '—') },
    { title: 'Rate / pc', dataIndex: 'rate', align: 'right', render: (v) => (v ? fmtMoney(v) : '—') },
    { title: 'Approved', dataIndex: 'approvedOn', render: fmtDate },
    { title: 'Delivery', key: 'del', render: (_, d) => fmtDate(d.plannedDelivery || d.plannedEnd) },
  ];
  return <Table rowKey="key" size="small" pagination={false} columns={columns} dataSource={docs} />;
});

export default JobDocsTable;
