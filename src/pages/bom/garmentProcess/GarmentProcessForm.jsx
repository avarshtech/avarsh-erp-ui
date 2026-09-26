import { useMemo, useState } from 'react';
import { Button, Card, Col, Input, Row, Skeleton, Space } from 'antd';
import { CloseCircleOutlined, HistoryOutlined, RollbackOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import useRequirementMasters from '../../../hooks/useRequirementMasters';
import {
  hasPermission, canReopenRequirement, canCloseRequirement, canSubmitRequirement, canSubmitGarmentProcessOverQty,
} from '../../../utils/permissions';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import {
  getRequirementStatusLabel, isRequirementClosable, isRequirementEditable, isRequirementReopenable,
} from '../../../utils/requirementStatus';
import { GPR_MODULE_ID, GPR_PROCESS_CATEGORY, GPR_REMARKS_MAX } from '../../../utils/garmentProcessConstants';
import { getGprAudit } from '../../../services/bom/garmentProcess/garmentProcessService';
import RequirementHistoryDrawer from '../shared/RequirementHistoryDrawer';
import RequirementNotFound from '../shared/RequirementNotFound';
import RequirementStatusBanner from '../shared/RequirementStatusBanner';
import RequirementTransitionDialog from '../shared/RequirementTransitionDialog';
import useGarmentProcessRequirement from './useGarmentProcessRequirement';
import useGprActions from './useGprActions';
import GprOrderSection from './GprOrderSection';
import GprSequenceList from './GprSequenceList';
import GprLineEditor from './GprLineEditor';
import GprActionBar from './GprActionBar';

const LIST_PATH = '/bom/garment-process/list';

/**
 * Garment Process Requirement — one vertically scrolling screen (PRD §6): A. Order
 * details, B. Processes (sequence list + editor; stacks below ~980 px), C. Remarks, and a
 * sticky action bar. Reopen and Close are secondary page-head actions. No approval.
 */
const GarmentProcessForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { doc, order, activeKey, dirty, dispatch, loading, orders, siblings, selectOrder } = useGarmentProcessRequirement(id);
  const { clearDirty } = useUnsavedChanges(dirty);
  const actions = useGprActions({ doc, dirty, order, dispatch, clearDirty });
  const [dialog, setDialog] = useState({ kind: 'close', open: false });
  const [historyOpen, setHistoryOpen] = useState(false);

  const canEdit = hasPermission(GPR_MODULE_ID, doc?.id ? 'update' : 'add');
  const editable = Boolean(doc) && isRequirementEditable(doc.status) && canEdit;
  const masters = useRequirementMasters(GPR_PROCESS_CATEGORY, { enabled: editable && Boolean(order) });
  const lines = doc?.lines;
  const activeIndex = useMemo(() => (lines || []).findIndex((l) => l.key === activeKey), [lines, activeKey]);
  const usedNames = useMemo(() => new Set((lines || []).map((l) => l.processName).filter(Boolean)), [lines]);
  const allProcessesUsed = masters.processes.length > 0 && masters.processes.every((p) => usedNames.has(p.processName));

  const lineHandlers = useMemo(() => ({
    patch: (patch) => dispatch({ type: 'LINE_PATCHED', key: activeKey, patch }),
    qty: (color, size, qty) => dispatch({ type: 'CELL_QTY', key: activeKey, color, size, qty }),
    reason: (cell, text) => dispatch({ type: 'OVER_REASON', key: activeKey, cell, reason: text }),
    copyPrevious: () => dispatch({ type: 'COPY_PREVIOUS', key: activeKey }),
    resetQty: () => dispatch({ type: 'RESET_QTY', key: activeKey }),
  }), [dispatch, activeKey]);

  if (loading) return <Skeleton active paragraph={{ rows: 12 }} />;
  if (!doc) return <RequirementNotFound listPath={LIST_PATH} />;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={doc.requirementNo ? `Garment Process Requirement ${doc.requirementNo}` : 'New Garment Process Requirement'}
        subtitle="Which sewn garments need which process, in what sequence and quantity"
        backPath={LIST_PATH}
        status={<StatusTag status={doc.status} config={REQUIREMENT_STATUS_CONFIG} getLabel={getRequirementStatusLabel} />}
      >
        <Space wrap>
          <Button icon={<UnorderedListOutlined />} onClick={() => navigate(LIST_PATH)}>View all requirements</Button>
          {doc.id && <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>History</Button>}
          {canReopenRequirement(GPR_MODULE_ID) && isRequirementReopenable(doc.status, doc.consumedQty) && (
            <Button icon={<RollbackOutlined />} onClick={() => setDialog({ kind: 'reopen', open: true })}>Reopen</Button>
          )}
          {canCloseRequirement(GPR_MODULE_ID) && isRequirementClosable(doc.status) && (
            <Button danger icon={<CloseCircleOutlined />} onClick={() => setDialog({ kind: 'close', open: true })}>Close</Button>
          )}
        </Space>
      </PageHeader>

      <RequirementStatusBanner doc={doc} />

      <GprOrderSection doc={doc} order={order} orders={orders} siblings={siblings} editable={editable} onSelectOrder={selectOrder} />

      {order && doc.lines.length > 0 && (
        <Row gutter={16}>
          <Col xs={24} lg={7}>
            <GprSequenceList
              lines={doc.lines} order={order} activeKey={activeKey} editable={editable} allProcessesUsed={allProcessesUsed}
              onSelect={(key) => dispatch({ type: 'LINE_SELECTED', key })}
              onMove={(key, delta) => dispatch({ type: 'LINE_MOVED', key, delta })}
              onRemove={(key) => dispatch({ type: 'LINE_REMOVED', key })}
              onAdd={() => dispatch({ type: 'LINE_ADDED' })}
            />
          </Col>
          <Col xs={24} lg={17}>
            {activeIndex >= 0 && (
              <GprLineEditor
                line={doc.lines[activeIndex]} lines={doc.lines} index={activeIndex} order={order}
                processes={masters.processes} masters={masters} editable={editable}
                canOverQty={canSubmitGarmentProcessOverQty()} on={lineHandlers}
              />
            )}
          </Col>
        </Row>
      )}
      {order && editable && doc.lines.length === 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Button type="dashed" block onClick={() => dispatch({ type: 'LINE_ADDED' })}>Add process</Button>
        </Card>
      )}

      {order && (
        <Card title="C. Remarks" size="small" style={{ marginBottom: 16 }}>
          <Input.TextArea
            name="gpr-remarks" aria-label="Remarks" rows={2} maxLength={GPR_REMARKS_MAX} showCount disabled={!editable}
            placeholder='e.g. "Process only Black colour." or "Required for shipment lot 1."'
            value={doc.remarks} onChange={(e) => dispatch({ type: 'REMARKS', text: e.target.value })}
          />
        </Card>
      )}

      <GprActionBar
        doc={doc} editable={editable} canSubmit={canSubmitRequirement(GPR_MODULE_ID)} busy={actions.busy} errors={actions.errors}
        on={{ cancel: () => navigate(LIST_PATH), save: actions.save, submit: actions.submit }}
      />
      <RequirementTransitionDialog
        dialog={dialog} onDone={() => setDialog((d) => ({ ...d, open: false }))} actions={actions}
        docLabel="Garment Process Requirement" docNumber={doc.requirementNo}
      />
      <RequirementHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} docId={doc.id} docNo={doc.requirementNo} loadAudit={getGprAudit} />
    </div>
  );
};

export default GarmentProcessForm;
