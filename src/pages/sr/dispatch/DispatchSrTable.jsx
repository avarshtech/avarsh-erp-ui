import { useMemo } from 'react';
import { Card, Table, Select, Tag, Typography } from 'antd';
import DaysRemainingTag from '../DaysRemainingTag';

const { Text } = Typography;

const LABEL_STYLE = {
  fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.4,
};

/**
 * Customer picker and the requests that could go on this parcel.
 *
 * One dispatch carries one customer's samples, so the customer is chosen first
 * and locks once the draft exists — moving a saved dispatch to another buyer
 * would orphan every request already selected on it. The rows come from the
 * server already filtered to that buyer, including this draft's own requests.
 */
const DispatchSrTable = ({
  customers, customersLoading, buyerId, onBuyerChange, locked, current,
  rows, rowsLoading, selectedIds, onSelectionChange,
}) => {
  const columns = useMemo(() => [
    {
      title: 'SR No', dataIndex: 'srNo', key: 'srNo', width: 140,
      render: (t) => <Text strong style={{ whiteSpace: 'nowrap' }}>{t}</Text>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 120 },
    { title: 'Garment', dataIndex: 'garmentName', key: 'garmentName', ellipsis: true },
    {
      title: 'Sample Type', dataIndex: 'sampleTypeName', key: 'sampleTypeName', width: 160,
      render: (n) => <Tag color="purple" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>{n}</Tag>,
    },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 70, align: 'right' },
    {
      title: 'Dispatch Deadline', dataIndex: 'dispatchDeadline', key: 'dispatchDeadline', width: 210,
      render: (d) => <DaysRemainingTag date={d} showDate />,
    },
  ], []);

  const options = useMemo(() => {
    const opts = customers.map((c) => ({
      value: c.buyerId,
      label: c.country ? `${c.name} · ${c.country}` : c.name,
    }));
    // A draft that already claims every one of its buyer's requests leaves that
    // buyer off the "customers with something waiting" list — the select would
    // then have nothing to render the saved id as but the id.
    if (current?.buyerId != null && !opts.some((o) => o.value === current.buyerId)) {
      opts.unshift({
        value: current.buyerId,
        label: current.buyerCountry ? `${current.buyerName} · ${current.buyerCountry}` : current.buyerName,
      });
    }
    return opts;
  }, [customers, current]);

  return (
    <Card size="small" title="Customer & Sample Requests">
      <div style={{ maxWidth: 380, marginBottom: 12 }}>
        <Text type="secondary" style={LABEL_STYLE}>Customer</Text>
        <Select
          style={{ width: '100%' }}
          placeholder="Customers with dispatchable SRs"
          showSearch
          optionFilterProp="label"
          loading={customersLoading}
          value={buyerId}
          onChange={onBuyerChange}
          disabled={locked}
          options={options}
        />
      </div>
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={rows}
        loading={rowsLoading}
        pagination={false}
        scroll={{ x: 860 }}
        rowSelection={{ selectedRowKeys: selectedIds, onChange: onSelectionChange }}
        locale={{
          emptyText: buyerId != null
            ? 'No dispatchable In-Production SRs for this customer'
            : 'Select a customer to list its dispatchable SRs',
        }}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>{`${selectedIds.length} SR(s) selected`}</Text>
    </Card>
  );
};

export default DispatchSrTable;
