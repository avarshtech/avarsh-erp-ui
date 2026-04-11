import { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Descriptions, Table, Tag, Space, Typography, Divider, Skeleton, App,
  Steps, InputNumber, Button, Card,
} from 'antd';
import { getPPOStatusLabel, getPPOStatusColor, PPO_STATUS, STAGE_TYPE_LABELS, STAGE_STATUS_COLORS, getStageStatusColor } from '../../utils/productionPoConstants';
import { getProductionPOById, updateProductionStage, changeProductionPOStatus } from '../../services/productionpo/productionPoService';
import { ActionButton } from '../../components/buttons';
import { formatDate } from '../../utils/formatters';

const { Text } = Typography;

const ProductionPOView = ({ open, record, onClose, onStatusChange }) => {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [updatingStage, setUpdatingStage] = useState(null);

  useEffect(() => {
    if (open && record?.id) {
      setLoading(true);
      getProductionPOById(record.id).then(setData).catch(() => message.error('Failed to load'))
        .finally(() => setLoading(false));
    } else setData(null);
  }, [open, record?.id]);

  const handleStageUpdate = useCallback(async (stage, field, value) => {
    setUpdatingStage(stage.id);
    try {
      await updateProductionStage(data.id, stage.id, { ...stage, [field]: value });
      const updated = await getProductionPOById(data.id);
      setData(updated);
      message.success('Stage updated');
    } catch { message.error('Failed to update stage'); }
    finally { setUpdatingStage(null); }
  }, [data]);

  const handleComplete = useCallback(() => {
    modal.confirm({ title: 'Complete Production PO', content: `Mark ${data?.ppoNumber} as completed?`,
      okText: 'Complete', onOk: async () => {
        try { await changeProductionPOStatus(data.id, { status: PPO_STATUS.COMPLETED }); message.success('Completed'); onStatusChange?.(); }
        catch (e) { message.error(e?.response?.data?.message || 'Failed to complete'); }
      }});
  }, [data, onStatusChange]);

  const stageColumns = [
    { title: '#', dataIndex: 'stageNumber', key: 'stageNumber', width: 35 },
    { title: 'Stage', dataIndex: 'stageType', key: 'stageType', width: 140,
      render: t => <Text strong>{STAGE_TYPE_LABELS[t] || t}</Text> },
    { title: 'Required', dataIndex: 'isRequired', key: 'isRequired', width: 70, align: 'center',
      render: v => v ? <Tag color="blue">Yes</Tag> : <Tag>No</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: s => <Tag color={getStageStatusColor(s)}>{s?.replace(/_/g, ' ')}</Tag> },
    { title: 'Assigned', key: 'assigned', width: 140,
      render: (_, r) => <Space size={4}><Tag color={r.assignedType === 'VENDOR' ? 'orange' : 'blue'}>{r.assignedType === 'VENDOR' ? 'Vendor' : 'Unit'}</Tag><Text>{r.assignedName || '-'}</Text></Space> },
    { title: 'Qty In', dataIndex: 'qtyReceived', key: 'qtyReceived', width: 80, align: 'right',
      render: (v, r) => data?.status === PPO_STATUS.IN_PROGRESS && r.isRequired
        ? <InputNumber size="small" value={v} min={0} style={{ width: 70 }} onPressEnter={e => handleStageUpdate(r, 'qtyReceived', Number(e.target.value))} />
        : (v || 0).toLocaleString() },
    { title: 'Qty Out', dataIndex: 'qtyProduced', key: 'qtyProduced', width: 80, align: 'right',
      render: (v, r) => data?.status === PPO_STATUS.IN_PROGRESS && r.isRequired
        ? <InputNumber size="small" value={v} min={0} style={{ width: 70 }} onPressEnter={e => handleStageUpdate(r, 'qtyProduced', Number(e.target.value))} />
        : (v || 0).toLocaleString() },
    { title: 'Rejected', dataIndex: 'qtyRejected', key: 'qtyRejected', width: 75, align: 'right',
      render: v => <Text type={v > 0 ? 'danger' : undefined}>{(v || 0).toLocaleString()}</Text> },
    { title: 'Status Action', key: 'stageAction', width: 100,
      render: (_, r) => {
        if (!r.isRequired || data?.status !== PPO_STATUS.IN_PROGRESS) return null;
        if (r.status === 'NOT_STARTED') return <Button size="small" type="link" onClick={() => handleStageUpdate(r, 'status', 'IN_PROGRESS')}>Start</Button>;
        if (r.status === 'IN_PROGRESS') return <Button size="small" type="link" onClick={() => handleStageUpdate(r, 'status', 'COMPLETED')}>Complete</Button>;
        return <Tag color="success">Done</Tag>;
      }},
  ];

  const sizeColorColumns = [
    { title: 'Color', dataIndex: 'color', key: 'color', width: 120 },
    { title: 'Size', dataIndex: 'size', key: 'size', width: 80 },
    { title: 'Order Qty', dataIndex: 'orderQty', key: 'orderQty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: 'Allowance %', dataIndex: 'allowancePercent', key: 'allowancePercent', width: 100, align: 'right', render: v => `${v || 0}%` },
    { title: 'Planned Qty', dataIndex: 'plannedQty', key: 'plannedQty', width: 110, align: 'right', render: v => <Text strong>{(v || 0).toLocaleString()}</Text> },
  ];

  return (
    <Drawer title={<Space><span>Production PO</span>{data && <Tag color={getPPOStatusColor(data.status)}>{getPPOStatusLabel(data.status)}</Tag>}</Space>}
      open={open} onClose={onClose} width={800}
      extra={data?.status === PPO_STATUS.IN_PROGRESS && <Button type="primary" onClick={handleComplete}>Mark Complete</Button>}>
      {loading ? <Skeleton active paragraph={{ rows: 15 }} /> : data ? (
        <>
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
            <Descriptions.Item label="PPO No"><Text strong>{data.ppoNumber}</Text></Descriptions.Item>
            <Descriptions.Item label="Order No">{data.orderNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="Buyer">{data.buyerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Style">{data.styleNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="Season">{data.season || '-'}</Descriptions.Item>
            <Descriptions.Item label="Colour">{data.colour || '-'}</Descriptions.Item>
            <Descriptions.Item label="Order Qty"><Text strong>{(data.totalOrderQty || 0).toLocaleString()}</Text></Descriptions.Item>
            <Descriptions.Item label="FG Produced"><Text strong type={data.fgProducedQty > 0 ? 'success' : undefined}>{(data.fgProducedQty || 0).toLocaleString()}</Text></Descriptions.Item>
            <Descriptions.Item label="RM Issued">{(data.rmIssuedQty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Dates">{formatDate(data.startDate)} — {formatDate(data.endDate)}</Descriptions.Item>
            {data.remarks && <Descriptions.Item label="Remarks" span={2}>{data.remarks}</Descriptions.Item>}
          </Descriptions>

          <Divider orientation="left">Production Stages</Divider>
          <Table rowKey="id" columns={stageColumns} dataSource={data.stages || []} pagination={false} size="small" scroll={{ x: 900 }} />

          <Divider orientation="left">Size-Color Breakdown</Divider>
          <Table rowKey={(r, i) => `${r.color}-${r.size}-${i}`} columns={sizeColorColumns} dataSource={data.sizeColorItems || []} pagination={false} size="small" />
        </>
      ) : null}
    </Drawer>
  );
};

export default ProductionPOView;
