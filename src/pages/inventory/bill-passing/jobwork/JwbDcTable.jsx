import { useMemo } from 'react';
import { Table, Tag } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import DetailCard from '../../../../components/DetailCard';
import { formatDate, formatNumber } from '../../../../utils/formatters';
import { billSourceOf, CHECK_STATUS_COLOR } from '../../../../utils/jobWorkBillConstants';

const STATUS_LABEL = { PASSED: 'Passed', PARTIAL: 'Partial', FAILED: 'Failed' };
const qty = (v) => (v ? formatNumber(v) : <span style={{ color: 'var(--text-secondary)' }}>0</span>);

/**
 * Every vendor DC the PO came back on, each with its panel / garment check (D2: the check is the QC of that
 * DC). A DC without a finished check holds the bill. Demo references are plain text: they point at nothing real.
 */
const JwbDcTable = ({ bill }) => {
  const checkName = billSourceOf(bill.source).check;
  const columns = useMemo(() => [
    { title: 'Receipt No', dataIndex: 'returnNo', key: 'returnNo', fixed: 'left' },
    { title: 'Received On', dataIndex: 'returnDate', key: 'returnDate', render: (v) => formatDate(v) },
    { title: 'Vendor DC No', dataIndex: 'vendorDcNo', key: 'vendorDcNo', render: (v) => <strong>{v}</strong> },
    { title: 'DC Date', dataIndex: 'vendorDcDate', key: 'vendorDcDate', render: (v) => formatDate(v) },
    { title: 'Good', dataIndex: 'goodQty', key: 'goodQty', align: 'right', render: qty },
    { title: 'Rejected at Receipt', dataIndex: 'rejectedReceiptQty', key: 'rejectedReceiptQty', align: 'right', render: qty },
    {
      title: checkName,
      key: 'check',
      align: 'center',
      render: (_, r) => (r.checkId
        ? <span>{r.checkNo} <Tag color={CHECK_STATUS_COLOR[r.checkStatus]}>{STATUS_LABEL[r.checkStatus] || r.checkStatus}</Tag></span>
        : <Tag color="warning">Not checked</Tag>),
    },
    { title: 'Rejected at Check', dataIndex: 'rejectedQcQty', key: 'rejectedQcQty', align: 'right', render: qty },
  ], [checkName]);

  return (
    <DetailCard title="Vendor DCs & Checks" icon={<CarOutlined />} count={bill.dcs.length} bare style={{ marginBottom: 16 }}>
      <Table
        size="small"
        className="table-nowrap"
        rowKey="id"
        columns={columns}
        dataSource={bill.dcs}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </DetailCard>
  );
};

export default JwbDcTable;
