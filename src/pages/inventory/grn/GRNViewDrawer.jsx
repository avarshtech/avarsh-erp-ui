import { useMemo } from 'react';
import { Drawer, Descriptions, Table, Divider, Space, Typography, Tag } from 'antd';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import { GRN_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const TYPE_COLORS = { Fabric: 'blue', Accessories: 'purple' };

const fabricRollColumns = [
  { title: 'Roll #', dataIndex: 'rollNumber', key: 'rollNumber', width: 80, ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'Fabric', dataIndex: 'fabricDescription', key: 'fabricDescription', width: 200, ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'Width (in)', dataIndex: 'width', key: 'width', width: 90, align: 'center', ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'Weight (kg)', dataIndex: 'weight', key: 'weight', width: 100, align: 'center', ellipsis: true, render: (v) => formatNumber(v, 1), onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'Shade Lot', dataIndex: 'shadeLot', key: 'shadeLot', width: 100, ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'GSM', dataIndex: 'gsm', key: 'gsm', width: 80, align: 'center', ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
];

const accItemColumns = [
  { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode', width: 130, ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'Description', dataIndex: 'description', key: 'description', width: 200, ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'Color', dataIndex: 'color', key: 'color', width: 90, ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'Receiving Qty', dataIndex: 'receivingQty', key: 'receivingQty', width: 110, align: 'center', ellipsis: true, render: (v) => formatNumber(v), onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'UOM', dataIndex: 'uom', key: 'uom', width: 70, ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 110, align: 'right', ellipsis: true, render: (v) => formatNumber(v, 2), onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
];

const cartonColumns = [
  { title: 'Carton #', dataIndex: 'cartonNumber', key: 'cartonNumber', width: 90, ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'Item', dataIndex: 'itemDescription', key: 'itemDescription', width: 200, ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 90, align: 'center', ellipsis: true, render: (v) => formatNumber(v), onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
  { title: 'Batch', dataIndex: 'batchNo', key: 'batchNo', width: 120, ellipsis: true, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
];

const GRNViewDrawer = ({ open, onClose, grn }) => {
  const isFabric = grn?.type === 'Fabric';

  const title = useMemo(
    () =>
      grn ? (
        <Space>
          <span>{grn.grnNumber}</span>
          <StatusTag status={grn.status} config={GRN_STATUS_CONFIG} getLabel={getInventoryStatusLabel} size="small" />
        </Space>
      ) : 'GRN Details',
    [grn],
  );

  if (!grn) return null;

  return (
    <Drawer title={title} open={open} onClose={onClose} width={800} footer={
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ActionButton action="print" text="Print GRN" />
        <ActionButton action="close" text="Close" onClick={onClose} />
      </div>
    }>
      <Descriptions size="small" column={2} title="GRN Information">
        <Descriptions.Item label="Type"><Tag color={TYPE_COLORS[grn.type]}>{grn.type}</Tag></Descriptions.Item>
        <Descriptions.Item label="Date">{grn.grnDate}</Descriptions.Item>
        <Descriptions.Item label="PO Number">{grn.poNumber}</Descriptions.Item>
        <Descriptions.Item label="Supplier">{grn.supplier}</Descriptions.Item>
        {grn.style && <Descriptions.Item label="Style">{grn.style}</Descriptions.Item>}
        {grn.orderNumber && <Descriptions.Item label="Order">{grn.orderNumber}</Descriptions.Item>}
        <Descriptions.Item label="Invoice">{grn.supplierInvoice || grn.challanNo}</Descriptions.Item>
        <Descriptions.Item label="Vehicle">{grn.vehicleNumber || '-'}</Descriptions.Item>
        <Descriptions.Item label="Transporter">{grn.transporter || '-'}</Descriptions.Item>
      </Descriptions>

      <Divider />

      <Descriptions size="small" column={2} title="Receipt Summary">
        {isFabric ? (
          <>
            <Descriptions.Item label="Total Rolls">{formatNumber(grn.totalRolls)}</Descriptions.Item>
            <Descriptions.Item label="Total Weight">{formatNumber(grn.totalWeight, 1)} kg</Descriptions.Item>
          </>
        ) : (
          <>
            <Descriptions.Item label="Cartons">{formatNumber(grn.totalCartons)}</Descriptions.Item>
            <Descriptions.Item label="Total Items">{formatNumber(grn.totalItems)}</Descriptions.Item>
          </>
        )}
        <Descriptions.Item label="Total Amount"><Text strong style={{ color: 'var(--success-color)' }}>{formatNumber(grn.totalAmount, 2)}</Text></Descriptions.Item>
      </Descriptions>

      <Divider />

      {isFabric && grn.rolls && (
        <Table rowKey="id" columns={fabricRollColumns} dataSource={grn.rolls} pagination={false} size="small" scroll={{ x: 650 }} />
      )}

      {!isFabric && grn.items && (
        <>
          <Text strong style={{ marginBottom: 8, display: 'block' }}>Items</Text>
          <Table rowKey="id" columns={accItemColumns} dataSource={grn.items} pagination={false} size="small" scroll={{ x: 710 }} style={{ marginBottom: 16 }} />
        </>
      )}

      {!isFabric && grn.cartons && (
        <>
          <Text strong style={{ marginBottom: 8, display: 'block' }}>Cartons</Text>
          <Table rowKey="id" columns={cartonColumns} dataSource={grn.cartons} pagination={false} size="small" scroll={{ x: 500 }} />
        </>
      )}

      {grn.remarks && (
        <>
          <Divider />
          <Text type="secondary">Remarks: </Text>
          <Text>{grn.remarks}</Text>
        </>
      )}
    </Drawer>
  );
};

export default GRNViewDrawer;
