import { useMemo } from 'react';
import { Drawer, Descriptions, Table, Divider, Space, Typography } from 'antd';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import { ISSUE_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { formatDate, formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const fabricRollColumns = [
  { title: 'Roll #', dataIndex: 'rollNumber', key: 'rollNumber', width: 100, ellipsis: true },
  { title: 'Weight (kg)', dataIndex: 'weight', key: 'weight', width: 110, align: 'center', render: (v) => formatNumber(v, 1) },
  { title: 'Shade Lot', dataIndex: 'shadeLot', key: 'shadeLot', width: 120, ellipsis: true },
];

const accItemColumns = [
  { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode', width: 130, ellipsis: true },
  { title: 'Description', dataIndex: 'description', key: 'description', width: 200, ellipsis: true },
  { title: 'BOM Qty', dataIndex: 'bomQty', key: 'bomQty', width: 100, align: 'right', render: (v) => formatNumber(v) },
  { title: 'Issued Qty', dataIndex: 'issuedQty', key: 'issuedQty', width: 100, align: 'right', render: (v) => formatNumber(v) },
];

const IssueViewDrawer = ({ open, onClose, record, type }) => {
  const isFabric = type === 'fabric';

  const title = useMemo(
    () =>
      record ? (
        <Space>
          <span>{record.issueNumber}</span>
          <StatusTag status={record.status} config={ISSUE_STATUS_CONFIG} getLabel={getInventoryStatusLabel} size="small" />
        </Space>
      ) : 'Issue Details',
    [record],
  );

  if (!record) return null;

  const variance = isFabric ? (record.totalWeight || 0) - (record.bomRequired || 0) : null;

  return (
    <Drawer title={title} open={open} onClose={onClose} width={720} footer={
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ActionButton action="print" text="Print Issue Slip" />
        <ActionButton action="close" text="Close" onClick={onClose} />
      </div>
    }>
      <Descriptions size="small" column={2} title="Issue Information">
        <Descriptions.Item label="Production Order">{record.productionOrder}</Descriptions.Item>
        <Descriptions.Item label="Style">{record.style}</Descriptions.Item>
        <Descriptions.Item label="Issue Date">{formatDate(record.issueDate)}</Descriptions.Item>
        <Descriptions.Item label="Issued By">{record.issuedBy || '\u2014'}</Descriptions.Item>
        <Descriptions.Item label="Received By">{record.receivedBy || '\u2014'}</Descriptions.Item>
        <Descriptions.Item label="Status">
          <StatusTag status={record.status} config={ISSUE_STATUS_CONFIG} getLabel={getInventoryStatusLabel} size="small" />
        </Descriptions.Item>
        {isFabric && <Descriptions.Item label="Fabric">{record.fabric}</Descriptions.Item>}
      </Descriptions>

      <Divider />

      {isFabric && (
        <>
          <Descriptions size="small" column={3} title="BOM Summary">
            <Descriptions.Item label="BOM Required">{formatNumber(record.bomRequired, 1)} kg</Descriptions.Item>
            <Descriptions.Item label="Total Issued">{formatNumber(record.totalWeight, 1)} kg</Descriptions.Item>
            <Descriptions.Item label="Variance">
              <Text style={{ color: variance >= 0 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: 600 }}>
                {variance >= 0 ? '+' : ''}{formatNumber(variance, 1)} kg
              </Text>
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          <Text strong style={{ marginBottom: 8, display: 'block' }}>Rolls ({record.rollsIssued || 0})</Text>
          {record.rolls && record.rolls.length > 0 ? (
            <Table rowKey="id" columns={fabricRollColumns} dataSource={record.rolls} pagination={false} size="small" scroll={{ x: 330 }} />
          ) : (
            <Text type="secondary">Roll details not available in list view</Text>
          )}
        </>
      )}

      {!isFabric && (
        <>
          <Descriptions size="small" column={2} title="Issue Summary">
            <Descriptions.Item label="Total Items">{record.itemsCount || 0}</Descriptions.Item>
            <Descriptions.Item label="Total Qty">{formatNumber(record.totalQty)}</Descriptions.Item>
          </Descriptions>

          <Divider />

          <Text strong style={{ marginBottom: 8, display: 'block' }}>Items</Text>
          {record.items && record.items.length > 0 ? (
            <Table rowKey="id" columns={accItemColumns} dataSource={record.items} pagination={false} size="small" scroll={{ x: 530 }} />
          ) : (
            <Text type="secondary">Item details not available in list view</Text>
          )}
        </>
      )}

      {record.remarks && (
        <>
          <Divider />
          <Text type="secondary">Remarks: </Text>
          <Text>{record.remarks}</Text>
        </>
      )}
    </Drawer>
  );
};

export default IssueViewDrawer;
