import { useMemo } from 'react';
import { Drawer, Descriptions, Table, Divider, Space, Tag, Typography } from 'antd';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import { QC_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { formatDate, formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const fabricParamColumns = [
  { title: 'Parameter', dataIndex: 'parameter', key: 'parameter', width: 160, ellipsis: true },
  { title: 'Standard', dataIndex: 'standard', key: 'standard', width: 120, align: 'center' },
  { title: 'Actual', dataIndex: 'actual', key: 'actual', width: 120, align: 'center' },
  { title: 'Result', dataIndex: 'result', key: 'result', width: 100, align: 'center', render: (v) => <Tag color={v === 'Pass' ? 'green' : v === 'Fail' ? 'red' : 'orange'}>{v}</Tag> },
];

const QCViewDrawer = ({ open, onClose, record, type }) => {
  const isFabric = type === 'fabric';

  const title = useMemo(
    () =>
      record ? (
        <Space>
          <span>{record.qcNumber}</span>
          <StatusTag status={record.approvalStatus || record.status} config={QC_STATUS_CONFIG} getLabel={getInventoryStatusLabel} size="small" />
        </Space>
      ) : 'QC Details',
    [record],
  );

  if (!record) return null;

  return (
    <Drawer title={title} open={open} onClose={onClose} width={720} footer={
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ActionButton action="print" text="Print QC Report" />
        <ActionButton action="close" text="Close" onClick={onClose} />
      </div>
    }>
      <Descriptions size="small" column={2} title="Inspection Information">
        <Descriptions.Item label="GRN Number">{record.grnNumber}</Descriptions.Item>
        <Descriptions.Item label="Type"><Tag color={isFabric ? 'blue' : 'purple'}>{isFabric ? 'Fabric' : 'Trims'}</Tag></Descriptions.Item>
        <Descriptions.Item label="Inspector">{record.inspector}</Descriptions.Item>
        <Descriptions.Item label="Inspection Date">{formatDate(record.inspectionDate)}</Descriptions.Item>
        <Descriptions.Item label="Overall Result">
          <Tag color={record.overallResult === 'Pass' ? 'green' : record.overallResult === 'Fail' ? 'red' : 'orange'}>
            {record.overallResult}
          </Tag>
        </Descriptions.Item>
        {isFabric && <Descriptions.Item label="Fabric">{record.fabricDescription}</Descriptions.Item>}
        {!isFabric && <Descriptions.Item label="Item">{record.itemDescription}</Descriptions.Item>}
      </Descriptions>

      <Divider />

      {isFabric && (
        <>
          <Descriptions size="small" column={2} title="Fabric Details">
            <Descriptions.Item label="Roll Count">{record.rollCount}</Descriptions.Item>
            <Descriptions.Item label="Total Defect Points">{formatNumber(record.totalDefectPoints)}</Descriptions.Item>
          </Descriptions>

          {record.parameters && record.parameters.length > 0 && (
            <>
              <Divider />
              <Text strong style={{ marginBottom: 8, display: 'block' }}>Parameters</Text>
              <Table rowKey="id" columns={fabricParamColumns} dataSource={record.parameters} pagination={false} size="small" scroll={{ x: 500 }} />
            </>
          )}

          {record.defects && record.defects.length > 0 && (
            <>
              <Divider />
              <Text strong style={{ marginBottom: 8, display: 'block' }}>Defects Summary</Text>
              <Table
                rowKey="id"
                columns={[
                  { title: 'Defect', dataIndex: 'defect', key: 'defect', width: 180 },
                  { title: 'Points', dataIndex: 'points', key: 'points', width: 80, align: 'center' },
                  { title: 'Severity', dataIndex: 'severity', key: 'severity', width: 100, render: (v) => <Tag color={v === 'Major' ? 'red' : 'orange'}>{v}</Tag> },
                ]}
                dataSource={record.defects}
                pagination={false}
                size="small"
                scroll={{ x: 360 }}
              />
            </>
          )}
        </>
      )}

      {!isFabric && (
        <>
          <Descriptions size="small" column={2} title="AQL Details">
            <Descriptions.Item label="Category">{record.category}</Descriptions.Item>
            <Descriptions.Item label="AQL Level">{record.aqlLevel}</Descriptions.Item>
            <Descriptions.Item label="Sample Size">{record.sampleSize}</Descriptions.Item>
            <Descriptions.Item label="Lot Size">{record.lotSize || '\u2014'}</Descriptions.Item>
            <Descriptions.Item label="Total Defects">{formatNumber(record.defectsFound)}</Descriptions.Item>
            <Descriptions.Item label="Major / Minor">{record.majorDefects ?? '\u2014'} / {record.minorDefects ?? '\u2014'}</Descriptions.Item>
          </Descriptions>
        </>
      )}

      <Divider />

      <Descriptions size="small" column={2} title="Approval">
        <Descriptions.Item label="Approval Status">
          <StatusTag status={record.approvalStatus} config={QC_STATUS_CONFIG} getLabel={getInventoryStatusLabel} size="small" />
        </Descriptions.Item>
        <Descriptions.Item label="Approver">{record.approver || '\u2014'}</Descriptions.Item>
        <Descriptions.Item label="Remarks" span={2}>{record.remarks || '\u2014'}</Descriptions.Item>
      </Descriptions>
    </Drawer>
  );
};

export default QCViewDrawer;
