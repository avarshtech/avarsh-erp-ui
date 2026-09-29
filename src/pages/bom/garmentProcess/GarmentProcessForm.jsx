import { useMemo, useState } from 'react';
import { Button, Card, Col, Input, Row, Skeleton, Space } from 'antd';
import { CloseCircleOutlined, HistoryOutlined, PartitionOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import useRequirementMasters from '../../../hooks/useRequirementMasters';
import {
  hasPermission, canCloseRequirement, canSubmitRequirement, canSubmitGarmentProcessOverQty,
} from '../../../utils/permissions';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getRequirementStatusLabel, isRequirementClosable, isRequirementEditable } from '../../../utils/requirementStatus';
import { GPR_MODULE_ID, GPR_PROCESS_CATEGORY, GPR_REMARKS_MAX } from '../../../utils/garmentProcessConstants';
import { getGprAudit, getGprAllocation } from '../../../services/bom/garmentProcess/garmentProcessService';
import DocumentHistoryDrawer from '../../../components/DocumentHistoryDrawer';
import RequirementAllocationDrawer from '../shared/RequirementAllocationDrawer';
import RequirementNotFound from '../shared/RequirementNotFound';
import RequirementStatusBanner from '../shared/RequirementStatusBanner';
import RequirementTransitionDialog from '../shared/RequirementTransitionDialog';
import useRequirementEditMode from '../shared/useRequirementEditMode';
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
 * sticky action bar. Close is a secondary page-head action. No approval. A submitted GPR is
 * edited in place (`?edit=1`) until a PO against it is placed; its order stays fixed.
 */
const GarmentProcessForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { doc, order, activeKey, dirty, dispatch, loading, orders, siblings, selectOrder, reload } = useGarmentProcessRequirement(id);
  const { clearDirty } = useUnsavedChanges(dirty);
  const canEdit = hasPermission(GPR_MODULE_ID, doc?.id ? 'update' : 'add');
  const mode = useRequirementEditMode({ id, doc, loading, dirty, canEdit, clearDirty, reload, docNo: doc?.requirementNo });
  const actions = useGprActions({ doc, dirty, order, dispatch, clearDirty, reload, onRevised: mode.stopEdit });
  const [closeOpen, setCloseOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);

  const editable = Boolean(doc) && canEdit && (isRequirementEditable(doc.status) || mode.editing);
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
          {doc.id && !editable && <Button icon={<PartitionOutlined />} onClick={() => setAllocationOpen(true)}>PO allocation</Button>}
          {doc.id && <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>History</Button>}
          {canCloseRequirement(GPR_MODULE_ID) && isRequirementClosable(doc.status) && !mode.editing && (
            <Button danger icon={<CloseCircleOutlined />} onClick={() => setCloseOpen(true)}>Close</Button>
          )}
        </Space>
      </PageHeader>

      <RequirementStatusBanner doc={doc} />

      <GprOrderSection doc={doc} order={order} orders={orders} siblings={siblings} editable={editable && !mode.editing} onSelectOrder={selectOrder} />

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
        doc={doc} can={{ edit: canEdit, submit: canSubmitRequirement(GPR_MODULE_ID) }} editing={mode.editing} dirty={dirty}
        busy={actions.busy} errors={actions.errors}
        on={{
          cancel: () => navigate(LIST_PATH), save: actions.save, submit: actions.submit,
          edit: mode.startEdit, cancelEdit: mode.cancelEdit, saveChanges: actions.saveChanges,
        }}
      />
      <RequirementTransitionDialog
        open={closeOpen} onDone={() => setCloseOpen(false)} actions={actions}
        docLabel="Garment Process Requirement" docNumber={doc.requirementNo}
      />
      <DocumentHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} docId={doc.id} docNo={doc.requirementNo} loadAudit={getGprAudit} />
      <RequirementAllocationDrawer open={allocationOpen} onClose={() => setAllocationOpen(false)} source="GPR" docId={doc.id} docNo={doc.requirementNo} load={getGprAllocation} />
    </div>
  );
};

export default GarmentProcessForm;
