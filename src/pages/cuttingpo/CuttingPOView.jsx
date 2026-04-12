import { useState, useEffect, useCallback } from 'react';
import { Drawer, Descriptions, Table, Tag, Space, Typography, Divider, Skeleton, App } from 'antd';
import { getStatusLabel, getStatusColor, CUTTING_PO_STATUS } from '../../utils/cuttingPoConstants';
import { getCuttingPOById, changeCuttingPOStatus } from '../../services/cuttingpo/cuttingPoService';
import { ActionButton } from '../../components/buttons';
import { formatDate } from '../../utils/formatters';
import { hasPermission } from '../../utils/permissions';

const { Text } = Typography;

const CuttingPOView = ({ open, record, onClose, onStatusChange }) => {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  // Approval handled via centralized Approval Flows module
  const canApprove = false;

  useEffect(() => {
    if (open && record?.id) {
      setLoading(true);
      getCuttingPOById(record.id).then(setData).catch(() => message.error('Failed to load'))
        .finally(() => setLoading(false));
    } else { setData(null); }
  }, [open, record?.id]);

  const handleApprove = useCallback(async () => {
    try { await changeCuttingPOStatus(data.id, { status: CUTTING_PO_STATUS.APPROVED }); message.success(`${data.cuttingPoNo} approved`); onStatusChange?.(); }
    catch { message.error('Failed to approve'); }
  }, [data, onStatusChange]);

  const handleReject = useCallback(() => {
    modal.confirm({ title: 'Reject Cutting PO', content: `Send ${data?.cuttingPoNo} back to Draft?`, okText: 'Reject', okType: 'danger',
      onOk: async () => {
        try { await changeCuttingPOStatus(data.id, { status: CUTTING_PO_STATUS.DRAFT, reason: 'Rejected' }); message.success(`${data.cuttingPoNo} rejected`); onStatusChange?.(); }
        catch { message.error('Failed to reject'); }
      },
    });
  }, [data, onStatusChange]);

  const itemColumns = [
    { title: 'Color', dataIndex: 'color', key: 'color', width: 120 },
    { title: 'Size', dataIndex: 'size', key: 'size', width: 80 },
    { title: 'Order Qty', dataIndex: 'orderQty', key: 'orderQty', width: 100, align: 'right', render: (v) => (v || 0).toLocaleString() },
    { title: 'Allowance %', dataIndex: 'allowancePercent', key: 'allowancePercent', width: 100, align: 'right', render: (v) => `${v || 0}%` },
    { title: 'Planned Qty', dataIndex: 'plannedQty', key: 'plannedQty', width: 110, align: 'right', render: (v) => <Text strong>{(v || 0).toLocaleString()}</Text> },
    { title: 'Rate/Pc', dataIndex: 'ratePerPiece', key: 'ratePerPiece', width: 100, align: 'right', render: (v) => (v || 0).toFixed(2) },
    { title: 'Total', key: 'total', width: 120, align: 'right',
      render: (_, r) => <Text strong>{((r.plannedQty || 0) * (r.ratePerPiece || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text> },
  ];

  return (
    <Drawer title={<Space><span>Cutting PO Details</span>{data && <Tag color={getStatusColor(data.status)}>{getStatusLabel(data.status)}</Tag>}</Space>}
      open={open} onClose={onClose} width={720}
      extra={data?.status === CUTTING_PO_STATUS.PENDING_APPROVAL && canApprove && (
        <Space><ActionButton action="approve" onClick={handleApprove} /><ActionButton action="reject" onClick={handleReject} /></Space>
      )}>
      {loading ? <Skeleton active paragraph={{ rows: 12 }} /> : data ? (
        <>
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
            <Descriptions.Item label="CPO No"><Text strong>{data.cuttingPoNo}</Text></Descriptions.Item>
            <Descriptions.Item label="Order No">{data.orderNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="Buyer">{data.buyerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Style No">{data.styleNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="Processing Unit">
              <Space><Tag color={data.processingUnitType === 'VENDOR' ? 'orange' : 'blue'}>{data.processingUnitType === 'VENDOR' ? 'Vendor' : 'Unit'}</Tag>{data.processingUnitName || '-'}</Space>
            </Descriptions.Item>
            <Descriptions.Item label="Cut Date">{formatDate(data.plannedCutDate)}</Descriptions.Item>
            <Descriptions.Item label="Delivery Date">{formatDate(data.plannedDeliveryDate)}</Descriptions.Item>
            <Descriptions.Item label="Total Order Qty"><Text strong>{(data.totalOrderQty || 0).toLocaleString()}</Text></Descriptions.Item>
            <Descriptions.Item label="Allowance %">{data.allowancePercent || 0}%</Descriptions.Item>
            <Descriptions.Item label="Total Planned Qty"><Text strong>{(data.totalPlannedQty || 0).toLocaleString()}</Text></Descriptions.Item>
            <Descriptions.Item label="BOM Consumption/Pc">{data.bomConsumptionPerPc || '-'}</Descriptions.Item>
            <Descriptions.Item label="CAD Consumption/Pc">{data.cadConsumptionPerPc || '-'}</Descriptions.Item>
            <Descriptions.Item label="Marker Efficiency">{data.markerEfficiency ? `${data.markerEfficiency}%` : '-'}</Descriptions.Item>
            <Descriptions.Item label="Fabric Wastage">{data.fabricWastagePercent ? `${data.fabricWastagePercent}%` : '-'}</Descriptions.Item>
            {data.approvedBy && <Descriptions.Item label="Approved By">{data.approvedBy}</Descriptions.Item>}
            {data.approvedDate && <Descriptions.Item label="Approved Date">{formatDate(data.approvedDate)}</Descriptions.Item>}
            {data.rejectionReason && <Descriptions.Item label="Rejection Reason" span={2}><Text type="danger">{data.rejectionReason}</Text></Descriptions.Item>}
            {data.cancelReason && <Descriptions.Item label="Cancel Reason" span={2}><Text type="danger">{data.cancelReason}</Text></Descriptions.Item>}
            {data.remarks && <Descriptions.Item label="Remarks" span={2}>{data.remarks}</Descriptions.Item>}
          </Descriptions>
          <Divider orientation="left">Size-Color Matrix</Divider>
          <Table rowKey={(r, i) => `${r.color}-${r.size}-${i}`} columns={itemColumns} dataSource={data.items || []}
            pagination={false} size="small" scroll={{ x: 700 }} />
        </>
      ) : null}
    </Drawer>
  );
};

export default CuttingPOView;
