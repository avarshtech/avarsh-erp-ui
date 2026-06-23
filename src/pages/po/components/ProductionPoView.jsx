import { useEffect, useState } from 'react';
import { Modal, Tabs, Descriptions, Tag, Space, Typography } from 'antd';
import StatusTag from '../../../components/StatusTag';
import StatusSteps from '../../../components/StatusSteps';
import { ActionButton } from '../../../components/buttons';
import SizeColorMatrix from '../SizeColorMatrix';
import MaterialStockPanel from './MaterialStockPanel';
import ProductionApprovalTimeline from './ProductionApprovalTimeline';
import ProductionStatusBar from './ProductionStatusBar';
import PpSampleGate from './PpSampleGate';
import { PRODUCTION_PO_STATUS_CONFIG, PRODUCTION_PO_STATUS_FLOW } from '../../../utils/statusConfig';
import {
  getStatusLabel, PO_TYPE, PO_TYPE_META, getProcessLabel, PROD_PO_STATUS,
  computeVariancePercent, getVarianceStatus, isPpApproved,
} from '../../../utils/productionConstants';
import { getStockByBom, getPpApprovalStatus } from '../../../services/po/productionService';
import { generateProductionPoPdf } from '../../../utils/productionPoPdfGenerator';

const { Text } = Typography;
const KIND = { CUTTING: 'fabric', WORK_ORDER: 'trim', FINISHING: 'packing' };
const STOCK_LABEL = { CUTTING: 'Fabric Stock', WORK_ORDER: 'Trim Stock', FINISHING: 'Packing Stock' };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');
const money = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

/** Generic read-only PO view modal reused by all three PO lists. */
const ProductionPoView = ({ open, onClose, poType, record, onChanged }) => {
  const [stockRows, setStockRows] = useState([]);
  const [ppStatus, setPpStatus] = useState(null);
  const meta = PO_TYPE_META[poType];

  useEffect(() => {
    if (!open || !record?.orderId) return;
    let active = true;
    getStockByBom(record.orderId, KIND[poType], { cadPerPc: record.cadConsumptionPerPc })
      .then((rows) => active && setStockRows(rows));
    getPpApprovalStatus(record.orderId).then((s) => active && setPpStatus(s));
    return () => { active = false; };
  }, [open, record, poType]);

  if (!record) return null;

  const ppApproved = isPpApproved(ppStatus);
  const hasShortage = stockRows.some((r) => r.shortageSurplus < 0);
  const showVariance = poType !== PO_TYPE.FINISHING && record.bomConsumptionPerPc != null;
  const variance = showVariance ? computeVariancePercent(record.cadConsumptionPerPc, record.bomConsumptionPerPc) : 0;
  const vStatus = showVariance ? getVarianceStatus(variance) : null;
  const grandTotal = (record.items || []).reduce((s, i) => s + (i.plannedQty || 0) * (i.ratePerPiece || 0), 0);
  const ppCompliance = ppStatus && !ppApproved; // pending or revoked

  const overview = (
    <>
      {ppCompliance && <PpSampleGate status={ppStatus} />}
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
        <Descriptions.Item label="Order">{record.orderNo}</Descriptions.Item>
        <Descriptions.Item label="Style">{record.styleNo}</Descriptions.Item>
        <Descriptions.Item label="Buyer">{record.buyer}</Descriptions.Item>
        <Descriptions.Item label="BOM">{record.bomNo}</Descriptions.Item>
        {poType === PO_TYPE.FINISHING ? (
          <>
            <Descriptions.Item label="Work Order">{record.workOrderNo}</Descriptions.Item>
            <Descriptions.Item label="Processing">{record.isOutsourced ? record.vendorName : 'In-house'}</Descriptions.Item>
            <Descriptions.Item label="Processes" span={2}>
              <Space wrap>{(record.processes || []).map((p) => <Tag key={p.processName} color="blue">{getProcessLabel(p.processName)}</Tag>)}</Space>
            </Descriptions.Item>
          </>
        ) : (
          <>
            {poType === PO_TYPE.WORK_ORDER && <Descriptions.Item label="Cutting PO">{record.cuttingPoNo}</Descriptions.Item>}
            {poType === PO_TYPE.WORK_ORDER && record.garmentProcesses?.length > 0 && (
              <Descriptions.Item label="Garment Processes" span={2}>
                <Space wrap>{record.garmentProcesses.map((p) => <Tag key={p} color="purple">{p}</Tag>)}</Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Processing Unit">{record.processingUnitName}</Descriptions.Item>
            <Descriptions.Item label="Delivery Date">{fmtDate(record.plannedDeliveryDate)}</Descriptions.Item>
            {poType === PO_TYPE.CUTTING && record.markerEfficiency != null && (
              <Descriptions.Item label="Marker Efficiency">{record.markerEfficiency}%</Descriptions.Item>
            )}
          </>
        )}
        <Descriptions.Item label="Order Qty">{(record.totalOrderQty || 0).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="Planned Qty">{(record.totalPlannedQty || 0).toLocaleString()} ({record.allowancePercent}% allow.)</Descriptions.Item>
        {showVariance && (
          <Descriptions.Item label="Consumption Variance">
            <Tag color={vStatus.tagColor}>{variance >= 0 ? '+' : ''}{variance.toFixed(2)}% · {vStatus.label}</Tag>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Material Readiness">
          <Tag color={hasShortage ? 'red' : 'green'}>{hasShortage ? 'Shortage' : 'Stock OK'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="PO Value">₹ {money(grandTotal)}</Descriptions.Item>
        {record.markerFileUrl && <Descriptions.Item label="CAD Marker">{record.markerFileUrl}</Descriptions.Item>}
        {record.remarks && <Descriptions.Item label="Remarks" span={2}>{record.remarks}</Descriptions.Item>}
      </Descriptions>
    </>
  );

  const tabs = [
    { key: 'overview', label: 'Overview', children: overview },
    { key: 'matrix', label: 'Size-Color Matrix', children: <SizeColorMatrix items={record.items || []} onChange={() => {}} editable={false} /> },
    { key: 'stock', label: STOCK_LABEL[poType], children: <MaterialStockPanel rows={stockRows} materialType={KIND[poType]} /> },
    { key: 'history', label: 'Approval History', children: <ProductionApprovalTimeline history={record.approvalHistory || []} /> },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={920}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <ActionButton action="print" text="Print PO" disabled={record.status === PROD_PO_STATUS.DRAFT}
            tooltip={record.status === PROD_PO_STATUS.DRAFT ? 'Submit/approve before printing for a unit/vendor' : undefined}
            onClick={() => generateProductionPoPdf(record, poType)} />
          <ProductionStatusBar poType={poType} record={record} ppApproved={ppApproved}
            onChanged={(u) => { onChanged?.(u); onClose?.(); }} />
        </Space>
      }
      title={
        <Space>
          <Text strong>{record[meta.noField]}</Text>
          <StatusTag status={record.status} config={PRODUCTION_PO_STATUS_CONFIG} getLabel={getStatusLabel} />
          {ppStatus && <PpSampleGate status={ppStatus} compact />}
        </Space>
      }
    >
      <StatusSteps statusFlow={PRODUCTION_PO_STATUS_FLOW} currentStatus={record.status}
        statusConfig={PRODUCTION_PO_STATUS_CONFIG} getLabel={getStatusLabel} size="small" style={{ margin: '4px 0 16px' }} />
      <Tabs items={tabs} />
    </Modal>
  );
};

export default ProductionPoView;
