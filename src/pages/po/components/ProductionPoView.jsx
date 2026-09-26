import { useEffect, useState } from 'react';
import { App, Modal, Tabs, Descriptions, Tag, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import StatusTag from '../../../components/StatusTag';
import StatusSteps from '../../../components/StatusSteps';
import { ActionButton } from '../../../components/buttons';
import SizeColorMatrix from '../SizeColorMatrix';
import MaterialStockPanel from './MaterialStockPanel';
import ProductionEngineHistory from './ProductionEngineHistory';
import ProductionStatusBar from './ProductionStatusBar';
import ApprovalActionBar from '../../../components/approval/ApprovalActionBar';
import PpSampleGate from './PpSampleGate';
import ReferBackNotice from './ReferBackNotice';
import { PRODUCTION_PO_STATUS_CONFIG, PRODUCTION_PO_STATUS_FLOW } from '../../../utils/statusConfig';
import {
  getStatusLabel, PO_TYPE, PO_TYPE_META, getProcessLabel, PROD_PO_STATUS, EDITABLE_STATUSES,
  computeVariancePercent, getVarianceStatus, isPpApproved,
} from '../../../utils/productionConstants';
import { hasPermission } from '../../../utils/permissions';
import { getStockByBom, getPpApprovalStatus } from '../../../services/po/production/productionLookupService';
import { generateProductionPoPdf } from '../../../utils/productionPoPdfGenerator';
import { printWorkOrder } from '../../../utils/workOrderPdfGenerator';
import { useBranch } from '../../../context/BranchContext';

const { Text } = Typography;
const KIND = { CUTTING: 'fabric', WORK_ORDER: 'trim', FINISHING: 'packing' };
const ENGINE_ENTITY_TYPE = { CUTTING: 'CUTTING_PO', WORK_ORDER: 'WORK_ORDER', FINISHING: 'FINISHING_PO' };
const STOCK_LABEL = { CUTTING: 'Fabric Stock', WORK_ORDER: 'Trim Stock', FINISHING: 'Packing Stock' };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');
const money = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

/** Generic read-only PO view modal reused by all three PO lists. */
const ProductionPoView = ({ open, onClose, poType, record, onChanged }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [stockRows, setStockRows] = useState([]);
  const [printing, setPrinting] = useState(false);
  const [ppStatus, setPpStatus] = useState(null);
  const { isMultiBranch, branchName } = useBranch();
  const meta = PO_TYPE_META[poType];

  useEffect(() => {
    if (!open || !record?.orderId) return;
    let active = true;
    getStockByBom(record, KIND[poType], { cadPerPc: record.cadConsumptionPerPc, plannedQty: record.totalPlannedQty, branchId: record.branchId })
      .then((rows) => active && setStockRows(rows));
    getPpApprovalStatus(record.orderId).then((s) => active && setPpStatus(s));
    return () => { active = false; };
  }, [open, record, poType]);

  if (!record) return null;

  const ppApproved = isPpApproved(ppStatus);
  const hasShortage = stockRows.some((r) => r.shortageSurplus < 0);
  // Consumption is settled on the cutting PO; the work order only carries it over
  const showVariance = poType === PO_TYPE.CUTTING && record.bomConsumptionPerPc != null;
  const variance = showVariance ? computeVariancePercent(record.cadConsumptionPerPc, record.bomConsumptionPerPc) : 0;
  const vStatus = showVariance ? getVarianceStatus(variance) : null;
  // A finishing PO is priced at one Rate/Pc for the whole PO, not per size-colour row
  const grandTotal = poType === PO_TYPE.FINISHING
    ? (record.totalPlannedQty || 0) * (record.vendorRate || 0)
    : (record.items || []).reduce((s, i) => s + (i.plannedQty || 0) * (i.ratePerPiece || 0), 0);
  const canEdit = EDITABLE_STATUSES.includes(record.status) && hasPermission(meta.permission, 'update');
  const printBlocked = [PROD_PO_STATUS.DRAFT, PROD_PO_STATUS.REFERRED_BACK].includes(record.status);

  const print = async () => {
    if (poType !== PO_TYPE.WORK_ORDER) return generateProductionPoPdf(record, poType);
    setPrinting(true);
    try {
      if (!(await printWorkOrder(record.id))) message.warning('Allow pop-ups for this site to print the work order');
    } catch (e) {
      message.error(e.message || 'Could not prepare the work order print');
    } finally { setPrinting(false); }
  };
  const ppCompliance = ppStatus && !ppApproved; // pending or revoked

  const overview = (
    <>
      <ReferBackNotice record={record} />
      {ppCompliance && <PpSampleGate status={ppStatus} />}
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
        <Descriptions.Item label="Order">{record.orderNo}</Descriptions.Item>
        <Descriptions.Item label="Style">{record.styleNo}</Descriptions.Item>
        <Descriptions.Item label="Buyer">{record.buyer}</Descriptions.Item>
        <Descriptions.Item label="BOM">{record.bomNo}</Descriptions.Item>
        {isMultiBranch && <Descriptions.Item label="Branch">{branchName(record.branchId)}</Descriptions.Item>}
        {poType === PO_TYPE.FINISHING ? (
          <>
            <Descriptions.Item label="Work Order">{record.workOrderNo}</Descriptions.Item>
            <Descriptions.Item label="Processing">{record.isOutsourced ? record.vendorName : 'In-house'}</Descriptions.Item>
            <Descriptions.Item label="Rate / Pc">₹ {money(record.vendorRate)}</Descriptions.Item>
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
    { key: 'history', label: 'Approval History',
      children: <ProductionEngineHistory entityType={ENGINE_ENTITY_TYPE[poType]} entityId={record.id}
        legacyHistory={record.approvalHistory || []} /> },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={920}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <ActionButton action="print" text={poType === PO_TYPE.WORK_ORDER ? 'Print Work Order' : 'Print PO'}
              disabled={printBlocked} loading={printing}
              tooltip={printBlocked ? 'Submit/approve before printing for a unit/vendor' : undefined}
              onClick={print} />
            {canEdit && (
              <ActionButton action="edit" text="Edit"
                onClick={() => { onClose?.(); navigate(`${meta.basePath}/edit/${record.id}`); }} />
            )}
          </Space>
          <ApprovalActionBar
            entityType={ENGINE_ENTITY_TYPE[poType]}
            entityId={record.id}
            docLabel={meta.label}
            docNumber={record[meta.noField]}
            onActionComplete={() => { onChanged?.(); onClose?.(); }}
            fallback={
              <ProductionStatusBar poType={poType} record={record} ppApproved={ppApproved}
                onChanged={(u) => { onChanged?.(u); onClose?.(); }} />
            } />
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
      {/* A referred-back PO is back at the start of the flow, awaiting rework */}
      <StatusSteps statusFlow={PRODUCTION_PO_STATUS_FLOW}
        currentStatus={record.status === PROD_PO_STATUS.REFERRED_BACK ? PROD_PO_STATUS.DRAFT : record.status}
        statusConfig={PRODUCTION_PO_STATUS_CONFIG} getLabel={getStatusLabel} size="small" style={{ margin: '4px 0 16px' }} />
      <Tabs items={tabs} />
    </Modal>
  );
};

export default ProductionPoView;
