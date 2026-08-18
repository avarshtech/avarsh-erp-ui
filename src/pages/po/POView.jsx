import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  Tag,
  Typography,
  Divider,
  Space,
  Button,
  Input,
  Timeline,
  Spin,
  Skeleton,
  App,
  Select,
  Avatar,
  Tooltip,
  Upload,
  Progress,
  Card,
  Popover,
  Popconfirm,
  Row,
  Col,
  Tabs,
  Badge,
  DatePicker,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  RollbackOutlined,
  SendOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  SettingOutlined,
  InboxOutlined,
  PaperClipOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  ShopOutlined,
  CalendarOutlined,
  TagOutlined,
  FileProtectOutlined,
  NumberOutlined,
  UndoOutlined,
  PlusOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getPurchaseOrderById,
  updatePurchaseOrder,
  createActivity,
  cancelEwayBill,
  updateStageCompletion,
  addStagesToLineItem,
  reorderStages,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  referBackPurchaseOrder,
  cancelPurchaseOrder,
} from '../../services/po/purchaseOrderService';
import ApprovalActionBar from '../../components/approval/ApprovalActionBar';
import ApprovalHistoryPanel from '../../components/approval/ApprovalHistoryPanel';
import { updateBomLinePoStatus } from '../../services/bom/bomService';
import PermissionGuard from '../../components/PermissionGuard';
import PantoneColorSwatch from '../../components/PantoneColorSwatch';
import { isPantoneCode } from '../../services/core/pantoneService';
import {
  canApprovePO,
  canRejectPO,
  canCancelPO,
  canReferBackPO,
  hasPermission,
  getCurrentUser,
} from '../../utils/permissions';
import { PO_STATUS, LINE_ITEM_STATUS, getStatusLabel, getLineItemStatusLabel, BOM_UNLOCK_STATUSES, EWAY_BILL_CANCEL_REASONS } from '../../utils/poStatusConstants';
import { generatePOPdf } from '../../utils/poPdfGenerator';
import { uploadFile, deleteFile, getFilesByEntity, downloadFileAsBlob } from '../../services/core/fileService';
import { ActionButton } from '../../components/buttons';
import StatusTag from '../../components/StatusTag';
import { PO_STATUS_CONFIG } from '../../utils/statusConfig';
import POVersionHistory from './POVersionHistory';
import FabricStagesDialog from './FabricStagesDialog';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * Small modal for marking a stage complete — replaces the Popover approach
 * which had focus/event conflicts with the parent PO View Modal.
 * Using a Modal-inside-Modal is the Ant Design recommended pattern when
 * the overlay needs interactive form inputs.
 */
const StageCompleteModal = ({ open, onCancel, poDate, deliveryDate, isUpdating, onComplete, message }) => {
  const [date, setDate] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setDate(null);
      setNotes('');
    }
  }, [open]);

  return (
    <Modal
      title="Mark Stage Complete"
      open={open}
      onCancel={onCancel}
      width={360}
      centered
      destroyOnHidden
      footer={
        <Button
          type="primary"
          block
          loading={isUpdating}
          icon={<CheckCircleOutlined />}
          onClick={() => {
            if (!date) {
              message.warning('Please select the actual completion date');
              return;
            }
            onComplete(date.format('YYYY-MM-DD'), notes);
          }}
        >
          Mark Complete
        </Button>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          Actual Completion Date <span style={{ color: 'var(--error-color)' }}>*</span>
        </Text>
        <DatePicker
          format="DD-MMM-YYYY"
          style={{ width: '100%' }}
          value={date}
          getPopupContainer={(trigger) => trigger.parentElement}
          disabledDate={(current) => {
            if (!current) return false;
            const poStart = poDate ? dayjs(poDate).startOf('day') : null;
            const poEnd = deliveryDate ? dayjs(deliveryDate).endOf('day') : null;
            if (poStart && current.isBefore(poStart, 'day')) return true;
            if (poEnd && current.isAfter(poEnd, 'day')) return true;
            return false;
          }}
          onChange={setDate}
        />
      </div>
      <div>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Notes / Comments</Text>
        <TextArea
          placeholder="Add notes (optional)"
          rows={3}
          maxLength={500}
          style={{ fontSize: 12 }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
};

// Status config — keys are DB enum values (kept for activity rendering and hero header bg/text)
const STATUS_CONFIG = {
  [PO_STATUS.DRAFT]: { color: 'default', icon: <FileTextOutlined />, bg: '#f5f5f5', text: '#8c8c8c' },
  [PO_STATUS.PENDING_APPROVAL]: { color: 'gold', icon: <ClockCircleOutlined />, bg: '#fffbe6', text: '#d48806' },
  [PO_STATUS.SENT_TO_SUPPLIER]: { color: 'magenta', icon: <SendOutlined />, bg: '#fff0f6', text: '#eb2f96' },
  [PO_STATUS.PARTIALLY_RECEIVED]: { color: 'purple', icon: <InboxOutlined />, bg: '#f9f0ff', text: 'var(--btn-duplicate-color)' },
  [PO_STATUS.COMPLETED]: { color: 'green', icon: <CheckCircleOutlined />, bg: '#f6ffed', text: 'var(--success-color)' },
  [PO_STATUS.REJECTED]: { color: 'red', icon: <CloseCircleOutlined />, bg: '#fff2f0', text: 'var(--error-color)' },
  [PO_STATUS.CANCELLED]: { color: 'volcano', icon: <StopOutlined />, bg: '#fff7e6', text: '#fa541c' },
  [PO_STATUS.REFERRED_BACK]: { color: 'orange', icon: <RollbackOutlined />, bg: '#fff7e6', text: 'var(--warning-color)' },
};

const REJECTION_CATEGORIES = [
  { value: 'pricing', label: 'Pricing Issue' },
  { value: 'quality', label: 'Quality Concern' },
  { value: 'delivery', label: 'Delivery Timeline' },
  { value: 'specification', label: 'Specification Mismatch' },
  { value: 'budget', label: 'Budget Constraints' },
  { value: 'other', label: 'Other' },
];

const POView = ({ open, onClose, poData, pendingAction, onStatusChange, onRefresh }) => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [po, setPo] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [poFiles, setPoFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [lineItemImages, setLineItemImages] = useState({});
  const [statusAction, setStatusAction] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [rejectionCategory, setRejectionCategory] = useState(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [ewayBillCancelLoading, setEwayBillCancelLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [stageUpdating, setStageUpdating] = useState(null); // 'lineItemId-stageIndex'
  const [addStagesDialog, setAddStagesDialog] = useState({ open: false, lineItem: null });
  const [completeStageModal, setCompleteStageModal] = useState({ open: false, lineItemId: null, stageIndex: null });

  useEffect(() => {
    if (open && poData?.id) {
      loadPODetails(poData.id);
    }
    if (!open) {
      setPo(null);
      setNotes([]);
      setNewNote('');
      setStatusAction(null);
      setActionReason('');
      setRejectionCategory(null);
      setPoFiles([]);
      setUploadProgress(0);
      setLineItemImages((prev) => {
        Object.values(prev).forEach((url) => {
          if (url && url !== 'loading') URL.revokeObjectURL(url);
        });
        return {};
      });
    }
  }, [open, poData?.id]);

  const loadLineItemImages = useCallback(async (lineItems) => {
    const variantIds = [...new Set(
      (lineItems || []).map((li) => li.variantId).filter(Boolean)
    )];
    variantIds.forEach(async (variantId) => {
      try {
        const files = await getFilesByEntity('ITEM_VARIANT', variantId);
        const img = (files || []).find((f) => ['IMAGE', 'PHOTO'].includes(f.fileCategory));
        if (!img) return;
        setLineItemImages((prev) => ({ ...prev, [variantId]: 'loading' }));
        const blob = await downloadFileAsBlob(img.fileId);
        const url = URL.createObjectURL(blob);
        setLineItemImages((prev) => ({ ...prev, [variantId]: url }));
      } catch { /* Non-critical */ }
    });
  }, []);

  const loadPODetails = async (poId) => {
    setLoading(true);
    try {
      const data = await getPurchaseOrderById(poId);
      setPo(data);
      loadLineItemImages(data.lineItems || []);
      const activities = data.activities || data.notes || [];
      setNotes(activities.map((activity) => ({
        id: activity.id,
        text: activity.comment || activity.text || '',
        isSystemGenerated: activity.isSystemGenerated || false,
        status: activity.status ?? null,
        timestamp: activity.createdAt || activity.timestamp || '',
        user: activity.userName || activity.name || (activity.isSystemGenerated ? 'System' : 'User'),
        edited: activity.edited || false,
      })));
      try {
        const files = await getFilesByEntity('PO', poId);
        setPoFiles(files || []);
      } catch { setPoFiles([]); }
    } catch {
      message.error('Failed to load PO details');
    } finally {
      setLoading(false);
    }
  };

  // Format helpers
  const formatDate = (dateStr) => dateStr ? dayjs(dateStr).format('DD MMM YYYY') : '-';
  const formatCurrency = (val) => `₹ ${(parseFloat(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ========================
  // Activity / Notes
  // ========================
  const handleAddNote = async () => {
    if (!newNote.trim() || !po?.id) return;
    setAddingNote(true);
    try {
      const currentUser = getCurrentUser();
      const name = currentUser?.name || '';
      const res = await createActivity(po.id, { comment: newNote, status: po.status ?? null, isSystemGenerated: false, name });
      setNotes((prev) => [...prev, {
        id: res.id, text: res.comment || newNote, isSystemGenerated: res.isSystemGenerated || false,
        status: res.status ?? null, timestamp: res.createdAt || new Date().toISOString(),
        user: res.userName || res.name || name, edited: res.edited || false,
      }]);
      setNewNote('');
      message.success('Note added');
    } catch { message.error('Failed to add note'); }
    finally { setAddingNote(false); }
  };

  // ========================
  // File Handlers
  // ========================
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getExtColor = (fileName) => {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') return { bg: '#fff1f0', color: '#cf1322', label: 'PDF' };
    if (['doc', 'docx'].includes(ext)) return { bg: '#e6f4ff', color: '#0958d9', label: 'DOC' };
    if (['xls', 'xlsx'].includes(ext)) return { bg: '#f6ffed', color: '#389e0d', label: 'XLS' };
    if (ext === 'csv') return { bg: '#f6ffed', color: '#389e0d', label: 'CSV' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return { bg: '#f9f0ff', color: '#531dab', label: ext.toUpperCase() };
    if (['zip', 'rar', '7z'].includes(ext)) return { bg: '#fff7e6', color: '#d46b08', label: ext.toUpperCase() };
    return { bg: '#f0f0f0', color: '#595959', label: ext.toUpperCase() || 'FILE' };
  };

  const getUniqueFileName = (name, existingFiles) => {
    const lastDot = name.lastIndexOf('.');
    const ext = lastDot >= 0 ? name.slice(lastDot) : '';
    const base = lastDot >= 0 ? name.slice(0, lastDot) : name;
    let counter = 1;
    let newName = `${base} (${counter})${ext}`;
    while (existingFiles.some((f) => f.originalFilename === newName)) { counter++; newName = `${base} (${counter})${ext}`; }
    return newName;
  };

  const doUpload = async (file) => {
    setUploadingFile(true);
    setUploadProgress(0);
    try {
      const currentUser = getCurrentUser();
      const userName = currentUser?.name || '';
      const result = await uploadFile(file, { module: 'PURCHASE_ORDER', entity: 'PO', entityId: po.id, fileCategory: 'DOCUMENT' }, (percent) => setUploadProgress(percent));
      setPoFiles((prev) => [...prev, result]);
      const actComment = JSON.stringify({ type: 'file_upload', fileName: result.originalFilename || file.name, fileId: result.fileId, by: userName });
      const actRes = await createActivity(po.id, { comment: actComment, status: po.status ?? null, isSystemGenerated: false, name: userName });
      setNotes((prev) => [...prev, { id: actRes.id, text: actRes.comment || actComment, isSystemGenerated: false, status: actRes.status ?? null, timestamp: actRes.createdAt || new Date().toISOString(), user: actRes.userName || actRes.name || userName, edited: false }]);
      message.success(`"${result.originalFilename || file.name}" uploaded`);
    } catch { message.error('Failed to upload file'); }
    finally { setUploadingFile(false); setUploadProgress(0); }
  };

  const handleFileUpload = async (file) => {
    if (!po?.id) return false;
    const duplicate = poFiles.some((f) => f.originalFilename === file.name);
    if (duplicate) {
      modal.confirm({
        title: 'File already attached',
        content: `"${file.name}" is already attached. Upload as a new copy?`,
        okText: 'Upload as Copy', cancelText: 'Cancel',
        onOk: async () => { const renamed = new File([file], getUniqueFileName(file.name, poFiles), { type: file.type }); await doUpload(renamed); },
      });
      return false;
    }
    await doUpload(file);
    return false;
  };

  const handleFileDownload = async (fileRecord) => {
    setDownloadingFileId(fileRecord.fileId);
    try {
      const blob = await downloadFileAsBlob(fileRecord.fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileRecord.originalFilename || 'download'; a.click();
      URL.revokeObjectURL(url);
    } catch { message.error('Failed to download file'); }
    finally { setDownloadingFileId(null); }
  };

  const handleFileDelete = async (fileRecord) => {
    if (!po?.id) return;
    setDeletingFileId(fileRecord.fileId);
    try {
      const currentUser = getCurrentUser();
      const userName = currentUser?.name || '';
      const fileName = fileRecord.originalFilename || 'file';
      await deleteFile(fileRecord.fileId);
      setPoFiles((prev) => prev.filter((f) => f.fileId !== fileRecord.fileId));
      const actComment = JSON.stringify({ type: 'file_delete', fileName, by: userName });
      const actRes = await createActivity(po.id, { comment: actComment, status: po.status ?? null, isSystemGenerated: false, name: userName });
      setNotes((prev) => [...prev, { id: actRes.id, text: actRes.comment || actComment, isSystemGenerated: false, status: actRes.status ?? null, timestamp: actRes.createdAt || new Date().toISOString(), user: actRes.userName || actRes.name || userName, edited: false }]);
      message.success(`"${fileName}" removed`);
    } catch { message.error('Failed to delete file'); }
    finally { setDeletingFileId(null); }
  };

  // ========================
  // Status Actions
  // ========================
  const statusActions = [
    { key: 'approve', label: 'Approve', icon: <CheckCircleOutlined />, color: 'var(--success-color)', type: 'primary', fromStatus: [PO_STATUS.PENDING_APPROVAL], toStatus: PO_STATUS.SENT_TO_SUPPLIER, lineItemStatus: LINE_ITEM_STATUS.IN_PROGRESS, canPerform: canApprovePO, requiresReason: false },
    { key: 'reject', label: 'Reject', icon: <CloseCircleOutlined />, color: 'var(--error-color)', type: 'default', danger: true, fromStatus: [PO_STATUS.PENDING_APPROVAL], toStatus: PO_STATUS.REJECTED, lineItemStatus: LINE_ITEM_STATUS.IN_PROGRESS, canPerform: canRejectPO, requiresReason: true },
    { key: 'cancel', label: 'Cancel', icon: <StopOutlined />, type: 'default', fromStatus: [PO_STATUS.PENDING_APPROVAL, PO_STATUS.DRAFT, PO_STATUS.SENT_TO_SUPPLIER], toStatus: PO_STATUS.CANCELLED, lineItemStatus: LINE_ITEM_STATUS.CANCELLED, canPerform: canCancelPO, requiresReason: true },
    { key: 'refer_back', label: 'Refer Back', icon: <RollbackOutlined />, color: 'var(--warning-color)', type: 'default', fromStatus: [PO_STATUS.SENT_TO_SUPPLIER], toStatus: PO_STATUS.REFERRED_BACK, lineItemStatus: LINE_ITEM_STATUS.IN_PROGRESS, canPerform: canReferBackPO, requiresReason: true },
  ];

  const availableActions = po ? statusActions.filter((a) => a.fromStatus.includes(po.status) && a.canPerform()) : [];

  // Handle pending action from push notification deep link
  useEffect(() => {
    if (!pendingAction || !po || actionLoading) return;
    const action = availableActions.find((a) => a.key === pendingAction);
    if (action) {
      handleStatusAction(action);
    }
  }, [po, pendingAction]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusAction = (action) => {
    if (action.requiresReason) {
      setStatusAction(action);
      setActionReason('');
      setRejectionCategory(null);
    } else {
      modal.confirm({
        title: `${action.label} Purchase Order`, icon: <ExclamationCircleOutlined />,
        content: `Are you sure you want to ${action.label.toLowerCase()} this purchase order?`,
        okText: action.label, okButtonProps: { danger: action.danger },
        onOk: () => executeStatusChange(action, ''),
      });
    }
  };

  // Unlock BOM lines when the PO leaves the active pipeline (reject/cancel/refer back)
  const unlockBomLinesIfNeeded = useCallback(async (newStatus) => {
    if (!po?.poType || po.poType === 'General') return;
    if (!BOM_UNLOCK_STATUSES.includes(newStatus)) return;
    const byBomId = {};
    (po.lineItems || []).forEach((li) => {
      (li.bomLineSources || []).forEach((src) => {
        if (!byBomId[src.bomId]) byBomId[src.bomId] = [];
        byBomId[src.bomId].push(src.lineId);
      });
    });
    try {
      await Promise.allSettled(Object.entries(byBomId).map(([bomId, lineIds]) => updateBomLinePoStatus(Number(bomId), [...new Set(lineIds)], false)));
    } catch (err) { console.error('Failed to unlock BOM lines:', err); }
  }, [po]);

  // Called after the centralized approval engine records a decision
  const handleEngineActionComplete = useCallback(async (updatedRequest) => {
    const outcome = updatedRequest?.status;
    if (outcome === 'REJECTED') await unlockBomLinesIfNeeded(PO_STATUS.REJECTED);
    if (outcome === 'REFERRED_BACK') await unlockBomLinesIfNeeded(PO_STATUS.REFERRED_BACK);
    if (onStatusChange) onStatusChange();
    onClose();
  }, [unlockBomLinesIfNeeded, onStatusChange, onClose]);

  const executeStatusChange = async (action, reason) => {
    if (!po) return;
    setActionLoading(true);
    try {
      // Dedicated endpoints for all decisions — the backend routes them through the
      // centralized approval engine when a flow is configured, or applies directly otherwise
      if (action.key === 'reject' || action.key === 'refer_back' || action.key === 'cancel') {
        const actionData = {
          reason,
          version: po.version,
          ...(action.key === 'reject' && rejectionCategory ? { category: rejectionCategory } : {}),
        };
        if (action.key === 'reject') {
          await rejectPurchaseOrder(po.id, actionData);
        } else if (action.key === 'refer_back') {
          await referBackPurchaseOrder(po.id, actionData);
        } else {
          await cancelPurchaseOrder(po.id, actionData);
        }
        // Activity log + notification handled server-side
      } else {
        // Approve — server-side handles status, line items, activity log and email
        await approvePurchaseOrder(po.id, { comment: reason || undefined });
      }

      await unlockBomLinesIfNeeded(action.toStatus);

      message.success(`Purchase order ${action.label.toLowerCase()}d successfully`);
      setStatusAction(null);
      setActionReason('');
      setRejectionCategory(null);
      if (onStatusChange) onStatusChange();
      onClose();
    } catch (err) {
      message.error(err?.response?.data?.message || `Failed to ${action.label.toLowerCase()} purchase order`);
    }
    finally { setActionLoading(false); }
  };

  // ========================
  // Stage Completion
  // ========================
  const canUpdateStages = po?.status === PO_STATUS.SENT_TO_SUPPLIER ||
    po?.status === PO_STATUS.PARTIALLY_RECEIVED;

  const handleStageCompletion = useCallback(async (lineItemId, stageIndex, completed, actualDate, notes) => {
    const key = `${lineItemId}-${stageIndex}`;
    setStageUpdating(key);
    try {
      const result = await updateStageCompletion({
        lineItemId,
        stageIndex,
        completed,
        actualCompletionDate: actualDate || null,
        notes: notes || null,
      });

      // Find stage name and item name for the activity log
      const lineItem = (po?.lineItems || []).find((li) => li.id === lineItemId);
      const stageName = lineItem?.processingStages?.[stageIndex]?.stageName || `Stage ${stageIndex + 1}`;
      const itemLabel = lineItem?.variantName || lineItem?.variantCode || 'Item';

      setPo((prev) => {
        if (!prev) return prev;
        const updatedLineItems = (prev.lineItems || []).map((li) =>
          li.id === lineItemId ? { ...li, processingStages: result.processingStages } : li
        );
        return { ...prev, lineItems: updatedLineItems };
      });

      // Log activity
      const currentUser = getCurrentUser();
      const userName = currentUser?.name || '';
      const activityComment = JSON.stringify({
        type: completed ? 'stage_complete' : 'stage_revert',
        stageName,
        itemLabel,
        actualDate: actualDate || null,
        by: userName,
      });
      const actRes = await createActivity(po.id, {
        comment: activityComment,
        status: po.status ?? null,
        isSystemGenerated: false,
        name: userName,
      });
      setNotes((prev) => [...prev, {
        id: actRes.id,
        text: actRes.comment || activityComment,
        isSystemGenerated: false,
        status: actRes.status ?? null,
        timestamp: actRes.createdAt || new Date().toISOString(),
        user: actRes.userName || actRes.name || userName,
        edited: false,
      }]);

      message.success(completed ? 'Stage marked as completed' : 'Stage completion reverted');
    } catch {
      message.error('Failed to update stage');
    } finally {
      setStageUpdating(null);
    }
  }, [message, po]);

  // ========================
  // Add Stages to line item
  // ========================
  const handleAddStages = useCallback(async (newStages, fullReorderedList) => {
    const lineItem = addStagesDialog.lineItem;
    if (!lineItem || !newStages || newStages.length === 0) return;
    setStageUpdating(`adding-${lineItem.id}`);
    try {
      let result;
      if (fullReorderedList) {
        // User reordered stages — send the full list to replace all stages
        const cleanedList = fullReorderedList.map(({ _isExisting, ...rest }) => rest);
        result = await reorderStages(lineItem.id, cleanedList);
      } else {
        result = await addStagesToLineItem(lineItem.id, newStages);
      }
      setPo((prev) => {
        if (!prev) return prev;
        const updatedLineItems = (prev.lineItems || []).map((li) =>
          li.id === lineItem.id ? { ...li, processingStages: result.processingStages } : li
        );
        return { ...prev, lineItems: updatedLineItems };
      });

      const currentUser = getCurrentUser();
      const userName = currentUser?.name || '';
      const activityComment = JSON.stringify({
        type: 'stages_added',
        itemLabel: lineItem.variantName || lineItem.variantCode || 'Item',
        count: newStages.length,
        stageNames: newStages.map((s) => s.stageName).join(', '),
        by: userName,
      });
      const actRes = await createActivity(po.id, {
        comment: activityComment,
        status: po.status ?? null,
        isSystemGenerated: false,
        name: userName,
      });
      setNotes((prev) => [...prev, {
        id: actRes.id,
        text: actRes.comment || activityComment,
        isSystemGenerated: false,
        status: actRes.status ?? null,
        timestamp: actRes.createdAt || new Date().toISOString(),
        user: actRes.userName || actRes.name || userName,
        edited: false,
      }]);

      message.success(`${newStages.length} stage(s) added successfully`);
    } catch {
      message.error('Failed to add stages');
    } finally {
      setStageUpdating(null);
      setAddStagesDialog({ open: false, lineItem: null });
    }
  }, [message, po, addStagesDialog.lineItem]);

  // ========================
  // E-way Bill
  // ========================
  const handleCancelEwayBill = async (cancelReasonCode, cancelRemarks) => {
    if (!po?.ewayBillNo) return;
    setEwayBillCancelLoading(true);
    try {
      await cancelEwayBill({ poId: po.id, ewayBillNo: po.ewayBillNo, cancelReasonCode, cancelRemarks });
      message.success('E-way Bill cancelled successfully');
      setPo((prev) => ({ ...prev, ewayBillStatus: 'CANCELLED' }));
      if (onRefresh) onRefresh();
    } catch { message.error('Failed to cancel E-way Bill'); }
    finally { setEwayBillCancelLoading(false); }
  };

  // ========================
  // Computed values
  // ========================
  const isIgstApplicable = useMemo(() => {
    if (po?.isIgstApplicable || po?.igstApplicable) return true;
    if (!po?.lineItems?.length) return false;
    return po.lineItems.some((li) => parseFloat(li.igst || li.igstPercent || 0) > 0);
  }, [po]);

  const totals = useMemo(() => {
    if (!po) return { subtotal: 0, sgst: 0, cgst: 0, igst: 0, grandTotal: 0 };
    const items = po.lineItems || [];
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.quantity || 0)) * (parseFloat(item.unitPrice) || 0), 0);
    let sgst = 0, cgst = 0, igst = 0;
    const hasStoredValues = items.some((item) => item.sgstValue != null || item.cgstValue != null || item.igstValue != null);
    if (hasStoredValues) {
      items.forEach((item) => { sgst += parseFloat(item.sgstValue || 0); cgst += parseFloat(item.cgstValue || 0); igst += parseFloat(item.igstValue || 0); });
    } else {
      items.forEach((item) => {
        const base = (parseFloat(item.quantity || 0)) * (parseFloat(item.unitPrice) || 0);
        let gstPercent = 0;
        if (isIgstApplicable) gstPercent = parseFloat(item.igstPercent ?? item.igst ?? 0) || 0;
        else gstPercent = (parseFloat(item.sgstPercent ?? item.sgst ?? 0) || 0) + (parseFloat(item.cgstPercent ?? item.cgst ?? 0) || 0);
        const gstAmount = (base * gstPercent) / 100;
        if (isIgstApplicable) igst += gstAmount;
        else { sgst += gstAmount / 2; cgst += gstAmount / 2; }
      });
    }
    const grandTotal = po.grandTotal || (subtotal + sgst + cgst + igst);
    return { subtotal: parseFloat(subtotal.toFixed(2)), sgst: parseFloat(sgst.toFixed(2)), cgst: parseFloat(cgst.toFixed(2)), igst: parseFloat(igst.toFixed(2)), grandTotal: parseFloat(grandTotal.toFixed(2)) };
  }, [po, isIgstApplicable]);

  const gstBreakup = useMemo(() => {
    if (!po) return [];
    const items = po.lineItems || [];
    const groups = {};
    items.forEach((item) => {
      const qty = parseFloat(item.quantity || 0) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const base = qty * unitPrice;
      let gstPercent = 0;
      if (isIgstApplicable) gstPercent = parseFloat(item.igstPercent ?? item.igst ?? 0) || 0;
      else gstPercent = (parseFloat(item.sgstPercent ?? item.sgst ?? 0) || 0) + (parseFloat(item.cgstPercent ?? item.cgst ?? 0) || 0);
      if (gstPercent === 0 || base === 0) return;
      if (!groups[gstPercent]) groups[gstPercent] = { igst: 0, sgst: 0, cgst: 0, taxableAmount: 0 };
      if (item.igstValue != null || item.sgstValue != null || item.cgstValue != null) {
        groups[gstPercent].igst += parseFloat(item.igstValue || 0);
        groups[gstPercent].sgst += parseFloat(item.sgstValue || 0);
        groups[gstPercent].cgst += parseFloat(item.cgstValue || 0);
      } else {
        const gstAmount = (base * gstPercent) / 100;
        if (isIgstApplicable) groups[gstPercent].igst += gstAmount;
        else { groups[gstPercent].sgst += gstAmount / 2; groups[gstPercent].cgst += gstAmount / 2; }
      }
      groups[gstPercent].taxableAmount += base;
    });
    return Object.entries(groups).map(([pct, vals]) => ({ percent: parseFloat(pct), ...vals })).sort((a, b) => a.percent - b.percent);
  }, [po, isIgstApplicable]);

  const hasIgst = isIgstApplicable || totals.igst > 0;
  const showStatusColumn = po?.status === PO_STATUS.SENT_TO_SUPPLIER || po?.status === PO_STATUS.PARTIALLY_RECEIVED || po?.status === PO_STATUS.COMPLETED;
  const canPrintPO = po?.status === PO_STATUS.SENT_TO_SUPPLIER || po?.status === PO_STATUS.PARTIALLY_RECEIVED || po?.status === PO_STATUS.COMPLETED;

  // ========================
  // Activity renderer
  // ========================
  const renderActivityComment = (note) => {
    try {
      const data = JSON.parse(note.text);
      if (data?.type === 'status_change') {
        const fromCfg = STATUS_CONFIG[data.from] || { color: 'default' };
        const toCfg = STATUS_CONFIG[data.to] || { color: 'default' };
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Tag color={fromCfg.color} icon={fromCfg.icon} style={{ margin: 0 }}>{getStatusLabel(data.from)}</Tag>
              <span style={{ fontSize: 18, color: 'var(--text-secondary, #888)', lineHeight: 1 }}>→</span>
              <Tag color={toCfg.color} icon={toCfg.icon} style={{ margin: 0 }}>{getStatusLabel(data.to)}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>by {data.by}</Text>
            </div>
            {data.rejectionCategoryLabel && (
              <div style={{ paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Category:</Text>
                <Tag color="error" style={{ fontSize: 11, margin: 0 }}>{data.rejectionCategoryLabel}</Tag>
              </div>
            )}
            {data.reason && (
              <div style={{ paddingLeft: 4, fontSize: 12 }}>
                <Text type="secondary">Reason: </Text><Text style={{ fontSize: 12 }}>{data.reason}</Text>
              </div>
            )}
          </div>
        );
      }
      if (data?.type === 'line_complete') {
        return (<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CheckCircleOutlined style={{ color: 'var(--success-color)' }} />
          <Text>Line item <Text strong>"{data.item}"</Text> marked as completed</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>by {data.by}</Text>
        </div>);
      }
      if (data?.type === 'all_complete') {
        return (<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CheckCircleOutlined style={{ color: 'var(--success-color)' }} /><Text>All line items received —</Text>
          <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0 }}>PO Completed</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>by {data.by}</Text>
        </div>);
      }
      if (data?.type === 'file_upload') {
        return (<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <PaperClipOutlined style={{ color: 'var(--primary-color)' }} /><Text>Attached: <Text strong>{data.fileName}</Text></Text>
          <Text type="secondary" style={{ fontSize: 12 }}>by {data.by}</Text>
        </div>);
      }
      if (data?.type === 'file_delete') {
        return (<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <DeleteOutlined style={{ color: 'var(--error-color)' }} /><Text>Removed: <Text strong style={{ textDecoration: 'line-through', opacity: 0.7 }}>{data.fileName}</Text></Text>
          <Text type="secondary" style={{ fontSize: 12 }}>by {data.by}</Text>
        </div>);
      }
      if (data?.type === 'stage_complete') {
        return (<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CheckCircleOutlined style={{ color: 'var(--success-color)' }} />
          <Text>Stage <Text strong>"{data.stageName}"</Text> marked as completed for <Text strong>{data.itemLabel}</Text></Text>
          {data.actualDate && <Tag style={{ margin: 0, fontSize: 10 }}>{dayjs(data.actualDate).format('DD MMM YYYY')}</Tag>}
          <Text type="secondary" style={{ fontSize: 12 }}>by {data.by}</Text>
        </div>);
      }
      if (data?.type === 'stage_revert') {
        return (<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <UndoOutlined style={{ color: 'var(--warning-color)' }} />
          <Text>Stage <Text strong>"{data.stageName}"</Text> completion reverted for <Text strong>{data.itemLabel}</Text></Text>
          <Text type="secondary" style={{ fontSize: 12 }}>by {data.by}</Text>
        </div>);
      }
    } catch { /* not JSON */ }
    return <Text style={{ flex: 1 }}>{note.text}</Text>;
  };

  // ========================
  // Print handler
  // ========================
  const handlePrint = async () => {
    setPrintLoading(true);
    try {
      const variantImages = {};
      await Promise.all(
        (po.lineItems || []).filter((li) => li.variantId && lineItemImages[li.variantId] && lineItemImages[li.variantId] !== 'loading')
          .map(async (li) => {
            try {
              const res = await fetch(lineItemImages[li.variantId]);
              const blob = await res.blob();
              const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
              variantImages[li.variantId] = base64;
            } catch { /* skip */ }
          })
      );
      await generatePOPdf(po, { variantImages });
    } catch { message.error('Failed to generate PO PDF'); }
    finally { setPrintLoading(false); }
  };

  // ========================
  // Line item card renderer
  // ========================
  const renderLineItemCard = useCallback((record, index) => {
    const imgUrl = record.variantId ? lineItemImages[record.variantId] : null;
    const stages = record.processingStages || [];
    const sortedStages = stages.length > 0
      ? stages.map((s, i) => ({ ...s, _origIndex: i })).sort((a, b) => {
          if (!a.completionDate) return 1;
          if (!b.completionDate) return -1;
          return dayjs(a.completionDate).diff(dayjs(b.completionDate));
        })
      : [];
    const st = record.status || PO_STATUS.DRAFT;
    const gstLabel = hasIgst
      ? `IGST ${record.igst || record.igstPercent || 0}%`
      : `SGST ${record.sgstPercent || record.sgst || 0}% + CGST ${record.cgstPercent || record.cgst || 0}%`;

    return (
      <div
        key={record.id || record.itemId || index}
        className="po-line-item-card"
        style={{
          border: '1px solid var(--border-color, #e8e8e8)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 10,
          background: 'var(--card-bg, #fff)',
          cursor: 'default',
        }}
      >
        {/* Top row: item info + amount */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          {/* Left: item details */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
            {/* Index badge */}
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'color-mix(in srgb, var(--primary-color) 10%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'var(--primary-color)',
            }}>
              {index + 1}
            </div>

            {/* Variant image */}
            {imgUrl === 'loading' && (
              <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Spin size="small" /></div>
            )}
            {imgUrl && imgUrl !== 'loading' && (
              <Popover content={<img src={imgUrl} alt="variant" style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 6 }} />} trigger="hover" placement="right" overlayInnerStyle={{ padding: 4 }}>
                <img src={imgUrl} alt="variant" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 10, flexShrink: 0, border: '1px solid var(--border-color, #d9d9d9)', cursor: 'pointer' }} />
              </Popover>
            )}

            {/* Item name, code, variant attrs */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <Text strong style={{ fontSize: 14, display: 'block', lineHeight: 1.3 }}>
                {record.variantName || 'Unknown Item'}
              </Text>
              {record.variantCode && (
                <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>{record.variantCode}</Text>
              )}
              {/* The variant is what was actually ordered — show it above the free-text description. */}
              {(record.variantName || record.variantCode) && (
                <div style={{ marginTop: 2 }}>
                  {record.variantName && (
                    <Text style={{ fontSize: 12, display: 'block', lineHeight: 1.3 }}>{record.variantName}</Text>
                  )}
                  {record.variantCode && (
                    <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>{record.variantCode}</Text>
                  )}
                </div>
              )}
              {record.description && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2, wordBreak: 'break-word' }}>{record.description}</Text>
              )}
              {record.variantAttributes && typeof record.variantAttributes === 'object' && (
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {Object.entries(record.variantAttributes).map(([k, v]) => {
                    const isColor = k.toLowerCase().includes('color') || k.toLowerCase().includes('colour');
                    const showSwatch = isColor && isPantoneCode(v);
                    return (
                      <Tag key={k} style={{ fontSize: 10, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 3, borderRadius: 4 }}>
                        {showSwatch && <PantoneColorSwatch value={v} size={12} />}
                        {k}: {showSwatch ? (v.split('/')[0]?.trim() || v) : v}
                      </Tag>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Amount */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <Text strong style={{ fontSize: 16, color: 'var(--success-color, #52c41a)', display: 'block', lineHeight: 1.2 }}>
              {formatCurrency(record.totalAmount || record.amount || 0)}
            </Text>
            {showStatusColumn && (
              <StatusTag status={st} config={PO_STATUS_CONFIG} getLabel={getLineItemStatusLabel} size="small" style={{ marginTop: 6 }} />
            )}
          </div>
        </div>

        {/* Detail chips row */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12,
          paddingTop: 12, borderTop: '1px solid var(--border-color, #f0f0f0)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'color-mix(in srgb, var(--primary-color) 6%, transparent)', fontSize: 12 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Qty:</Text>
            <Text strong style={{ fontSize: 13 }}>{record.quantity || record.qty || 0}</Text>
            {(record.uomName || record.uomSymbol || record.uom) && (
              <Text type="secondary" style={{ fontSize: 11 }}>{record.uomName || record.uomSymbol || record.uom}</Text>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'color-mix(in srgb, var(--primary-color) 6%, transparent)', fontSize: 12 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Unit Price:</Text>
            <Text strong style={{ fontSize: 13 }}>{formatCurrency(record.unitPrice)}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'color-mix(in srgb, var(--primary-color) 6%, transparent)', fontSize: 12 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>{gstLabel}</Text>
          </div>
          {record.hsnCode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'color-mix(in srgb, var(--primary-color) 6%, transparent)', fontSize: 12 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>HSN:</Text>
              <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{record.hsnCode}</Text>
            </div>
          )}
        </div>

        {/* Processing Stages — inline with completion tracking */}
        {sortedStages.length > 0 && (
          <div style={{
            marginTop: 12, paddingTop: 12,
            borderTop: '1px dashed var(--border-color, #e8e8e8)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ExperimentOutlined style={{ color: 'var(--btn-duplicate-color)', fontSize: 13 }} />
                <Text strong style={{ fontSize: 12, color: 'var(--btn-duplicate-color)' }}>Processing Stages</Text>
                <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>{sortedStages.length}</Tag>
                {(() => {
                  const done = sortedStages.filter((s) => s.isCompleted).length;
                  if (done === sortedStages.length && done > 0) return <Tag color="success" style={{ fontSize: 10, margin: 0 }}>All Complete</Tag>;
                  if (done > 0) return <Tag style={{ fontSize: 10, margin: 0 }}>{done}/{sortedStages.length} done</Tag>;
                  return null;
                })()}
              </div>
              {canUpdateStages && hasPermission('purchase-orders', 'update') && (
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  loading={stageUpdating === `adding-${record.id}`}
                  className="stage-btn-add"
                  style={{ fontSize: 11 }}
                  onClick={() => setAddStagesDialog({ open: true, lineItem: record })}
                >
                  Add Stage
                </Button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedStages.map((stage, sIdx) => {
                const targetDate = stage.completionDate ? dayjs(stage.completionDate) : null;
                const actualDate = stage.actualCompletionDate ? dayjs(stage.actualCompletionDate) : null;
                const isCompleted = !!stage.isCompleted;
                const isOverdue = !isCompleted && targetDate && targetDate.isBefore(dayjs(), 'day');
                const isToday = !isCompleted && targetDate && targetDate.isSame(dayjs(), 'day');
                const stageKey = `${record.id}-${stage._origIndex}`;
                const isUpdating = stageUpdating === stageKey;

                // Calculate delay/advance days
                let daysDiff = null;
                let diffLabel = '';
                let diffColor = '';
                if (isCompleted && actualDate && targetDate) {
                  daysDiff = actualDate.diff(targetDate, 'day');
                  if (daysDiff > 0) { diffLabel = `${daysDiff} day${daysDiff > 1 ? 's' : ''} delayed`; diffColor = 'var(--error-color, #ef4444)'; }
                  else if (daysDiff < 0) { diffLabel = `${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? 's' : ''} early`; diffColor = 'var(--success-color, #52c41a)'; }
                  else { diffLabel = 'On time'; diffColor = 'var(--success-color, #52c41a)'; }
                } else if (!isCompleted && isOverdue && targetDate) {
                  daysDiff = dayjs().diff(targetDate, 'day');
                  diffLabel = `${daysDiff} day${daysDiff > 1 ? 's' : ''} overdue`;
                  diffColor = 'var(--error-color, #ef4444)';
                }

                // Border & background based on status
                let cardBorder = 'var(--border-color, #e8e8e8)';
                let cardBg = 'color-mix(in srgb, var(--primary-color) 3%, transparent)';
                if (isCompleted) {
                  cardBorder = 'var(--success-color, #52c41a)';
                  cardBg = 'color-mix(in srgb, var(--success-color, #52c41a) 6%, transparent)';
                } else if (isOverdue) {
                  cardBorder = 'var(--error-color, #ef4444)';
                  cardBg = 'color-mix(in srgb, var(--error-color, #ef4444) 6%, transparent)';
                } else if (isToday) {
                  cardBorder = 'var(--warning-color, #f59e0b)';
                  cardBg = 'color-mix(in srgb, var(--warning-color, #f59e0b) 6%, transparent)';
                }

                return (
                  <div key={sIdx} style={{
                    padding: '12px 16px', borderRadius: 10,
                    border: `1.5px solid ${cardBorder}`,
                    background: cardBg,
                    transition: 'all 0.2s',
                  }}>
                    {/* Row 1: Stage name + status icon + action */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        {isCompleted ? (
                          <CheckCircleOutlined style={{ fontSize: 16, color: 'var(--success-color, #52c41a)', flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                            border: `2px solid ${isOverdue ? 'var(--error-color, #ef4444)' : isToday ? 'var(--warning-color, #f59e0b)' : 'var(--border-color, #d9d9d9)'}`,
                          }} />
                        )}
                        <Text strong style={{ fontSize: 13, textDecoration: isCompleted ? 'none' : 'none' }}>{stage.stageName}</Text>
                        {isOverdue && !isCompleted && <Tag color="error" style={{ margin: 0, fontSize: 9, padding: '0 6px' }}>Overdue</Tag>}
                        {isToday && !isCompleted && <Tag color="warning" style={{ margin: 0, fontSize: 9, padding: '0 6px' }}>Today</Tag>}
                        {isCompleted && <Tag color="success" style={{ margin: 0, fontSize: 9, padding: '0 6px' }}>Completed</Tag>}
                      </div>

                      {/* Action button */}
                      {canUpdateStages && hasPermission('purchase-orders', 'update') && (
                        isCompleted ? (
                          <Popconfirm
                            title="Revert completion?"
                            description="This will mark the stage as not completed."
                            onConfirm={() => handleStageCompletion(record.id, stage._origIndex, false)}
                            okText="Revert"
                            cancelText="Cancel"
                          >
                            <Button
                              type="text" size="small" loading={isUpdating}
                              icon={<UndoOutlined style={{ fontSize: 12 }} />}
                              className="stage-btn-revert"
                              style={{ fontSize: 11 }}
                            >
                              Revert
                            </Button>
                          </Popconfirm>
                        ) : (
                          <Button
                            type="text" size="small" loading={isUpdating}
                            icon={<CheckCircleOutlined style={{ fontSize: 12 }} />}
                            className="stage-btn-complete"
                            style={{ fontSize: 11 }}
                            onClick={() => setCompleteStageModal({ open: true, lineItemId: record.id, stageIndex: stage._origIndex })}
                          >
                            Mark Complete
                          </Button>
                        )
                      )}
                    </div>

                    {/* Row 2: Date details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, paddingLeft: 24, flexWrap: 'wrap' }}>
                      {targetDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CalendarOutlined style={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                          <Text type="secondary" style={{ fontSize: 11 }}>Expected:</Text>
                          <Text style={{ fontSize: 11 }}>{targetDate.format('DD MMM YYYY')}</Text>
                        </div>
                      )}
                      {isCompleted && actualDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircleOutlined style={{ fontSize: 11, color: 'var(--success-color, #52c41a)' }} />
                          <Text type="secondary" style={{ fontSize: 11 }}>Actual:</Text>
                          <Text style={{ fontSize: 11 }}>{actualDate.format('DD MMM YYYY')}</Text>
                        </div>
                      )}
                      {diffLabel && (
                        <Tag
                          style={{
                            margin: 0, fontSize: 10, fontWeight: 600,
                            borderRadius: 10, padding: '0 8px',
                            color: diffColor,
                            borderColor: diffColor,
                            background: 'transparent',
                          }}
                        >
                          {diffLabel}
                        </Tag>
                      )}
                    </div>

                    {/* Row 3: Completed by info */}
                    {isCompleted && stage.completedBy && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, paddingLeft: 24 }}>
                        <UserOutlined style={{ fontSize: 10, color: 'var(--text-secondary)' }} />
                        <Text type="secondary" style={{ fontSize: 10 }}>
                          Completed by {stage.completedBy}
                          {stage.completedAt && ` · ${dayjs(stage.completedAt).format('DD MMM, HH:mm')}`}
                        </Text>
                      </div>
                    )}

                    {/* Row 4: Notes */}
                    {isCompleted && stage.notes && (
                      <div style={{
                        marginTop: 6, paddingLeft: 24, display: 'flex', alignItems: 'flex-start', gap: 4,
                      }}>
                        <MessageOutlined style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }} />
                        <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic', wordBreak: 'break-word' }}>
                          {stage.notes}
                        </Text>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add Stage button for line items without stages */}
        {sortedStages.length === 0 && canUpdateStages && hasPermission('purchase-orders', 'update') && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border-color, #e8e8e8)' }}>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              loading={stageUpdating === `adding-${record.id}`}
              onClick={() => setAddStagesDialog({ open: true, lineItem: record })}
              className="stage-btn-add"
              style={{ fontSize: 12 }}
            >
              Add Processing Stages
            </Button>
          </div>
        )}
      </div>
    );
  }, [po, hasIgst, showStatusColumn, lineItemImages, canUpdateStages, stageUpdating, handleStageCompletion, addStagesDialog]);

  // ========================
  // Render
  // ========================
  const statusCfg = STATUS_CONFIG[po?.status] || { color: 'default', bg: '#f5f5f5', text: '#8c8c8c' };

  return (
    <>
      <Modal
        title={null}
        open={open}
        onCancel={onClose}
        width={1200}
        centered
        closable
        className="po-view-modal"
        styles={{
          body: { maxHeight: 'calc(80vh - 60px)', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
          header: { border: 'none', padding: 0, margin: 0, minHeight: 0 },
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
            <Space size="middle">
              {po && canPrintPO && (
                <ActionButton action="print" text="Print PO" onClick={handlePrint} loading={printLoading} />
              )}
              {/* Approve/Reject route through the centralized approval engine when a flow
                  is configured; legacy direct buttons are the no-flow fallback. */}
              {po && po.status === PO_STATUS.PENDING_APPROVAL && (
                <ApprovalActionBar
                  entityType="PURCHASE_ORDER"
                  entityId={po.id}
                  docLabel="Purchase Order"
                  docNumber={po.poNumber || po.poNo}
                  onActionComplete={handleEngineActionComplete}
                  fallback={
                    <Space size="middle">
                      {availableActions.filter((a) => a.key === 'approve' || a.key === 'reject').map((action) => (
                        <ActionButton
                          key={action.key}
                          action={action.key}
                          text={action.label}
                          onClick={() => handleStatusAction(action)}
                          loading={actionLoading}
                          danger={action.danger}
                        />
                      ))}
                    </Space>
                  }
                />
              )}
              {availableActions.filter((a) => a.key !== 'approve' && a.key !== 'reject').map((action) => {
                const actionMap = { cancel: 'cancel', refer_back: 'refer-back' };
                return (
                  <ActionButton
                    key={action.key}
                    action={actionMap[action.key] || 'custom'}
                    text={action.label}
                    onClick={() => handleStatusAction(action)}
                    loading={actionLoading}
                    danger={action.danger}
                  />
                );
              })}
            </Space>
            <Space>
              {po && (po.status === PO_STATUS.DRAFT || po.status === PO_STATUS.REFERRED_BACK || po.status === PO_STATUS.REJECTED) && hasPermission('purchase-orders', 'update') && (
                <ActionButton action="edit" text="Edit" onClick={() => { onClose(); navigate(`/purchase-orders/supplier-po/edit/${po.id}`); }} />
              )}
              <ActionButton action="close" text="Close" onClick={onClose} />
            </Space>
          </div>
        }
      >
        {loading ? (
          <div style={{ padding: 32, flex: 1, overflowY: 'auto' }}>
            <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 2, width: ['100%', '60%'] }} style={{ marginBottom: 24 }} />
            <Divider />
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        ) : po ? (
          <>
            {/* ===== HERO HEADER (sticky) ===== */}
            <div style={{
              background: 'var(--card-bg, #fff)',
              borderBottom: '2px solid var(--border-color, #f0f0f0)',
              padding: '28px 32px 20px',
              borderLeft: `4px solid ${statusCfg.text || 'var(--primary-color)'}`,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <Title level={3} style={{ margin: 0, letterSpacing: '-0.02em' }}>{po.poNumber || po.poNo}</Title>
                    <StatusTag status={po.status} config={PO_STATUS_CONFIG} getLabel={getStatusLabel} style={{ fontSize: 13, padding: '3px 14px' }} />
                    {po?.poType && po.poType !== 'General' && <Tag color="purple" style={{ borderRadius: 20, fontSize: 12 }}>{po.poType} PO</Tag>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShopOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
                      <Text strong style={{ fontSize: 15 }}>{po.supplierName || '-'}</Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarOutlined style={{ color: 'var(--text-secondary)', fontSize: 13 }} />
                      <Text type="secondary">{formatDate(po.poDate)}</Text>
                    </div>
                    {po.deliveryDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TagOutlined style={{ color: 'var(--text-secondary)', fontSize: 13 }} />
                        <Text type="secondary">Due: {formatDate(po.deliveryDate)}</Text>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Grand Total</Text>
                  <Text strong style={{ fontSize: 28, color: 'var(--primary-color)', letterSpacing: '-0.02em', lineHeight: 1 }}>{formatCurrency(totals.grandTotal)}</Text>
                </div>
              </div>
            </div>

            {/* ===== BODY CONTENT (scrollable) ===== */}
            <div style={{ padding: '20px 32px 24px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <ApprovalHistoryPanel entityType="PURCHASE_ORDER" entityId={po.id} style={{ marginBottom: 16 }} />
              {/* Detail Cards Row */}
              <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={24} md={16}>
                  <Card size="small" style={{ height: '100%', borderRadius: 12 }} styles={{ body: { padding: '16px 20px' } }}>
                    <Row gutter={[24, 14]}>
                      <Col xs={12} sm={8}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>PO Number</Text>
                        <Text strong style={{ fontSize: 14, fontFamily: 'monospace' }}>{po.poNumber || po.poNo || '-'}</Text>
                      </Col>
                      <Col xs={12} sm={8}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Supplier</Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar size={24} style={{ backgroundColor: 'var(--primary-color)', fontSize: 11, flexShrink: 0 }}>{(po.supplierName || '?')[0]}</Avatar>
                          <Text strong style={{ fontSize: 14 }}>{po.supplierName || '-'}</Text>
                        </div>
                      </Col>
                      <Col xs={12} sm={8}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>PO Date</Text>
                        <Text strong style={{ fontSize: 14 }}>{formatDate(po.poDate)}</Text>
                      </Col>
                      <Col xs={12} sm={8}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Delivery Date</Text>
                        <Text strong style={{ fontSize: 14 }}>{formatDate(po.deliveryDate)}</Text>
                      </Col>
                      <Col xs={12} sm={8}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Terms & Conditions</Text>
                        <Text style={{ fontSize: 13 }}>{po.termsConditionsTitle || '-'}</Text>
                      </Col>
                      <Col xs={12} sm={8}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Items</Text>
                        <Text strong style={{ fontSize: 14 }}>{po.lineItems?.length || 0}</Text>
                      </Col>
                      {po.remarks && (
                        <Col span={24}>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Remarks</Text>
                          <Text style={{ fontSize: 13 }}>{po.remarks}</Text>
                        </Col>
                      )}
                    </Row>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" style={{ height: '100%', borderRadius: 12 }} styles={{ body: { padding: '16px 20px' } }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>Subtotal</Text>
                        <Text style={{ fontSize: 13 }}>{formatCurrency(totals.subtotal)}</Text>
                      </div>
                      {gstBreakup.map((group) => (
                        <div key={group.percent}>
                          {hasIgst ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 8 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>IGST ({group.percent}%)</Text>
                              <Text style={{ fontSize: 12 }}>{formatCurrency(group.igst)}</Text>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 8 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>SGST ({group.percent / 2}%)</Text>
                                <Text style={{ fontSize: 12 }}>{formatCurrency(group.sgst)}</Text>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 8 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>CGST ({group.percent / 2}%)</Text>
                                <Text style={{ fontSize: 12 }}>{formatCurrency(group.cgst)}</Text>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      <Divider style={{ margin: '4px 0' }} />
                      {hasIgst ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 13 }}>Total IGST</Text>
                          <Text style={{ fontSize: 13 }}>{formatCurrency(totals.igst)}</Text>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13 }}>Total SGST</Text>
                            <Text style={{ fontSize: 13 }}>{formatCurrency(totals.sgst)}</Text>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13 }}>Total CGST</Text>
                            <Text style={{ fontSize: 13 }}>{formatCurrency(totals.cgst)}</Text>
                          </div>
                        </>
                      )}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', padding: '12px 14px',
                        borderRadius: 10, background: 'var(--primary-color)', marginTop: 4,
                      }}>
                        <Text strong style={{ color: '#fff', fontSize: 14 }}>Grand Total</Text>
                        <Text strong style={{ color: '#fff', fontSize: 18 }}>{formatCurrency(totals.grandTotal)}</Text>
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Order References */}
              {po?.orderReferences?.length > 0 && (
                <Card size="small" style={{ marginBottom: 16, borderRadius: 12 }} styles={{ body: { padding: '12px 20px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <FileProtectOutlined style={{ color: 'var(--primary-color)' }} />
                    <Text strong style={{ fontSize: 14 }}>Order References</Text>
                  </div>
                  <Row gutter={[24, 8]}>
                    {po.orderReferences.map((ref, idx) => (
                      <Col key={ref.orderNo || idx} xs={24} sm={12} md={8}>
                        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--card-bg, #fafafa)', border: '1px solid var(--border-color, #f0f0f0)' }}>
                          <Text strong style={{ color: 'var(--primary-color)', fontSize: 14, display: 'block' }}>{ref.orderNo}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>{ref.styleName || '-'} · {ref.season || '-'}</Text>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </Card>
              )}

              {/* Line Items — Card View */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <NumberOutlined style={{ color: 'var(--primary-color)' }} />
                    <Text strong style={{ fontSize: 15 }}>Line Items</Text>
                    <Badge count={po.lineItems?.length || 0} style={{ backgroundColor: 'var(--primary-color)' }} />
                  </div>
                  <ActionButton
                    action="history"
                    text="History"
                    tooltip="View submission version history"
                    onClick={() => setHistoryOpen(true)}
                  />
                </div>
                <div>
                  {(po.lineItems || []).map((item, idx) => renderLineItemCard(item, idx))}
                  {(!po.lineItems || po.lineItems.length === 0) && (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <Text type="secondary">No line items</Text>
                    </div>
                  )}
                </div>
              </div>

              {/* E-way Bill */}
              {po?.ewayBillNo && (
                <Card size="small" style={{ marginBottom: 20, borderRadius: 12 }} styles={{ body: { padding: '14px 20px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <FileTextOutlined style={{ color: 'var(--primary-color)' }} />
                    <Text strong style={{ fontSize: 14 }}>E-way Bill</Text>
                    <Tag color={po.ewayBillStatus === 'ACTIVE' ? 'success' : po.ewayBillStatus === 'CANCELLED' ? 'error' : 'default'}>{po.ewayBillStatus || 'ACTIVE'}</Tag>
                  </div>
                  <Row gutter={[24, 12]}>
                    <Col xs={12} sm={6}><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>E-way Bill No</Text><Text strong style={{ fontFamily: 'monospace' }}>{po.ewayBillNo}</Text></Col>
                    <Col xs={12} sm={6}><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Generated</Text><Text strong>{formatDate(po.ewayBillDate)}</Text></Col>
                    <Col xs={12} sm={6}><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Valid Until</Text><Text strong>{formatDate(po.ewayBillValidUpto)}</Text></Col>
                    {po.ewayBillStatus === 'ACTIVE' && (
                      <Col xs={12} sm={6} style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <Popconfirm
                          title="Cancel E-way Bill"
                          description={<div style={{ maxWidth: 300 }}>
                            <Select placeholder="Select cancel reason" style={{ width: '100%', marginBottom: 8 }} options={EWAY_BILL_CANCEL_REASONS} onChange={(val) => { document.getElementById('ewb-cancel-reason-code').value = val; }} />
                            <Input.TextArea id="ewb-cancel-remarks" placeholder="Cancel remarks..." rows={2} />
                            <input type="hidden" id="ewb-cancel-reason-code" />
                          </div>}
                          onConfirm={() => { const code = document.getElementById('ewb-cancel-reason-code')?.value; const remarks = document.getElementById('ewb-cancel-remarks')?.value; if (!code) { message.warning('Please select a cancel reason'); return; } handleCancelEwayBill(Number(code), remarks || ''); }}
                          okText="Cancel E-way Bill" okButtonProps={{ danger: true, loading: ewayBillCancelLoading }}
                        >
                          <ActionButton action="cancel" text="Cancel E-way Bill" size="small" danger loading={ewayBillCancelLoading} />
                        </Popconfirm>
                      </Col>
                    )}
                  </Row>
                </Card>
              )}

              {/* Activity & Attachments — Tabbed */}
              {(notes.length > 0 || po?.status !== PO_STATUS.DRAFT) && (
                <Tabs
                  defaultActiveKey="activity"
                  style={{ marginTop: 8 }}
                  items={[
                    {
                      key: 'activity',
                      label: <span><SettingOutlined style={{ marginRight: 6 }} />Activity ({notes.length})</span>,
                      children: (
                        <div>
                          {notes.length === 0 ? (
                            <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: 24 }}>No activity notes yet.</Text>
                          ) : (
                            <Timeline
                              style={{ paddingTop: 8, maxHeight: 320, overflowY: 'auto' }}
                              items={notes.map((note) => ({
                                color: note.isSystemGenerated ? 'blue' : 'green',
                                dot: note.isSystemGenerated ? <SettingOutlined style={{ fontSize: 14 }} /> : <UserOutlined style={{ fontSize: 14 }} />,
                                children: (
                                  <div>
                                    <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(note.timestamp).format('DD MMM YYYY, HH:mm')}</Text>
                                      {!note.isSystemGenerated && note.user && note.user !== 'User' && (
                                        <Text type="secondary" style={{ fontSize: 11 }}>· {note.user}</Text>
                                      )}
                                    </div>
                                    <div>{renderActivityComment(note)}</div>
                                  </div>
                                ),
                              }))}
                            />
                          )}
                          {po?.status !== PO_STATUS.DRAFT && (
                            <PermissionGuard module="purchase-orders" operation="update">
                              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 12 }}>
                                <TextArea placeholder="Add a note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} style={{ flex: 1, minHeight: 60, resize: 'none' }} disabled={addingNote} />
                                <ActionButton action="send" text="Add" onClick={handleAddNote} loading={addingNote} disabled={!newNote.trim() || addingNote} />
                              </div>
                            </PermissionGuard>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: 'attachments',
                      label: <span><PaperClipOutlined style={{ marginRight: 6 }} />Attachments ({poFiles.length})</span>,
                      children: (
                        <div>
                          {po?.status !== PO_STATUS.DRAFT && (
                            <div style={{ marginBottom: 12 }}>
                              <PermissionGuard module="purchase-orders" operation="update">
                                <Upload showUploadList={false} beforeUpload={handleFileUpload} disabled={uploadingFile}>
                                  <ActionButton action="upload" text="Attach File" icon={<PaperClipOutlined />} loading={uploadingFile} disabled={uploadingFile} style={{ borderStyle: 'dashed', color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }} />
                                </Upload>
                              </PermissionGuard>
                            </div>
                          )}
                          {uploadingFile && <Progress percent={uploadProgress} size="small" status="active" style={{ marginBottom: 10 }} />}
                          {poFiles.length === 0 ? (
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center', padding: '16px 0' }}>No attachments yet</Text>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                              {poFiles.map((f) => {
                                const fileName = f.originalFilename || 'file';
                                const ext = getExtColor(fileName);
                                return (
                                  <div key={f.fileId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color, #e8e8e8)', background: 'var(--card-bg, #fff)' }}>
                                    <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: ext.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: ext.color }}>{ext.label}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <Tooltip title={fileName}><Text style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</Text></Tooltip>
                                      {f.fileSizeBytes && <Text type="secondary" style={{ fontSize: 11 }}>{formatFileSize(f.fileSizeBytes)}</Text>}
                                    </div>
                                    <div style={{ display: 'flex', flexShrink: 0, gap: 2 }}>
                                      <ActionButton action="custom" icon={<DownloadOutlined style={{ fontSize: 13 }} />} tooltip="Download" size="small" loading={downloadingFileId === f.fileId} onClick={() => handleFileDownload(f)} />
                                      <PermissionGuard module="purchase-orders" operation="update">
                                        <Popconfirm title={`Remove "${fileName}"?`} description="This will permanently delete the attachment." onConfirm={() => handleFileDelete(f)} okText="Remove" cancelText="Cancel" okButtonProps={{ danger: true, loading: deletingFileId === f.fileId }}>
                                          <ActionButton action="delete" size="small" />
                                        </Popconfirm>
                                      </PermissionGuard>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </>
        ) : null}
      </Modal>

      {/* Status Action Reason Modal — Redesigned */}
      <Modal
        title={null}
        open={!!statusAction}
        onCancel={() => setStatusAction(null)}
        afterClose={() => { setActionReason(''); setRejectionCategory(null); }}
        footer={null}
        destroyOnHidden
        centered
        width={520}
        styles={{ body: { padding: 0 } }}
      >
        {statusAction && (() => {
          const MIN_CHARS = 50;
          const charCount = actionReason.trim().length;
          const charsRemaining = MIN_CHARS - charCount;
          const isReject = statusAction.key === 'reject';
          const isCancel = statusAction.key === 'cancel';
          const isReferBack = statusAction.key === 'refer_back';
          const canSubmit = charCount >= MIN_CHARS && (!isReject || rejectionCategory);

          // Config per action type
          const config = {
            reject: {
              icon: <CloseCircleOutlined style={{ fontSize: 28 }} />,
              color: 'var(--error-color)',
              bg: 'color-mix(in srgb, var(--error-color) 8%, transparent)',
              title: 'Reject Purchase Order',
              subtitle: 'This PO will be sent back to the creator for revision.',
              flowLabel: 'Pending Approval → Rejected',
              btnText: 'Reject PO',
              placeholder: 'Explain why this PO is being rejected. Include specific issues with pricing, specifications, or other concerns that need to be addressed...',
            },
            cancel: {
              icon: <StopOutlined style={{ fontSize: 28 }} />,
              color: 'var(--btn-cancel-color)',
              bg: 'color-mix(in srgb, var(--btn-cancel-color) 8%, transparent)',
              title: 'Cancel Purchase Order',
              subtitle: 'This action will cancel the PO. Line items will be marked as cancelled.',
              flowLabel: `${getStatusLabel(po?.status)} → Cancelled`,
              btnText: 'Cancel PO',
              placeholder: 'Provide a clear reason for cancellation. This helps maintain accurate records and informs stakeholders...',
            },
            refer_back: {
              icon: <RollbackOutlined style={{ fontSize: 28 }} />,
              color: 'var(--warning-color)',
              bg: 'color-mix(in srgb, var(--warning-color) 8%, transparent)',
              title: 'Refer Back Purchase Order',
              subtitle: 'The PO will be sent back to the supplier for revision and re-submission.',
              flowLabel: 'Sent to Supplier → Referred Back',
              btnText: 'Refer Back',
              placeholder: 'Describe what changes or corrections are needed from the supplier. Be specific about items, quantities, or terms that need revision...',
            },
          };
          const c = config[statusAction.key] || config.cancel;

          return (
            <div>
              {/* Header Banner */}
              <div style={{
                padding: '24px 28px 20px',
                background: c.bg,
                borderBottom: `2px solid ${c.color}`,
                borderRadius: '8px 8px 0 0',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ color: c.color, flexShrink: 0, marginTop: 2 }}>{c.icon}</div>
                  <div>
                    <Title level={4} style={{ margin: '0 0 4px', color: c.color }}>{c.title}</Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>{c.subtitle}</Text>
                  </div>
                </div>
              </div>

              {/* PO Info + Flow */}
              <div style={{ padding: '16px 28px 0' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderRadius: 8,
                  background: 'color-mix(in srgb, var(--primary-color) 5%, transparent)',
                  border: '1px solid var(--border-color, #f0f0f0)',
                  marginBottom: 20,
                }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Purchase Order</Text>
                    <Text strong style={{ fontSize: 14 }}>{po?.poNumber}</Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Status Flow</Text>
                    <Text style={{ fontSize: 12, color: c.color, fontWeight: 600 }}>{c.flowLabel}</Text>
                  </div>
                </div>

                {/* Rejection Category (reject only) */}
                {isReject && (
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                      Rejection Category <span style={{ color: 'var(--error-color)' }}>*</span>
                    </Text>
                    <Select
                      placeholder="Select the primary reason for rejection"
                      style={{ width: '100%' }}
                      size="large"
                      value={rejectionCategory}
                      onChange={setRejectionCategory}
                      options={REJECTION_CATEGORIES}
                    />
                  </div>
                )}

                {/* Feedback Comments */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 13 }}>
                      {isReject ? 'Rejection Reason' : isReferBack ? 'Feedback for Supplier' : 'Cancellation Reason'}
                      {' '}<span style={{ color: 'var(--error-color)' }}>*</span>
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Min {MIN_CHARS} characters
                    </Text>
                  </div>
                  <TextArea
                    rows={4}
                    placeholder={c.placeholder}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    maxLength={500}
                    showCount
                    style={{ fontSize: 13 }}
                    status={charCount > 0 && charCount < MIN_CHARS ? 'warning' : undefined}
                  />
                  {charCount > 0 && charCount < MIN_CHARS && (
                    <Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                      {charsRemaining} more character{charsRemaining !== 1 ? 's' : ''} required
                    </Text>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{
                padding: '16px 28px 20px',
                display: 'flex', justifyContent: 'flex-end', gap: 10,
                borderTop: '1px solid var(--border-color, #f0f0f0)',
                marginTop: 12,
              }}>
                <Button onClick={() => setStatusAction(null)} style={{ minWidth: 80 }}>
                  Go Back
                </Button>
                <Tooltip title={!canSubmit ? (charCount < MIN_CHARS ? `Enter at least ${MIN_CHARS} characters` : 'Select a rejection category') : ''}>
                  <Button
                    type="primary"
                    danger={statusAction.danger}
                    icon={statusAction.icon}
                    loading={actionLoading}
                    disabled={!canSubmit}
                    onClick={() => executeStatusChange(statusAction, actionReason)}
                    style={{
                      minWidth: 120,
                      ...(statusAction.color && !statusAction.danger ? { backgroundColor: statusAction.color, borderColor: statusAction.color } : {}),
                    }}
                  >
                    {c.btnText}
                  </Button>
                </Tooltip>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Version History Dialog */}
      <POVersionHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        poId={po?.id}
        poNumber={po?.poNumber || po?.poNo}
      />

      {/* Add Stages Dialog — append-only mode for view dialog */}
      <FabricStagesDialog
        open={addStagesDialog.open}
        onClose={() => setAddStagesDialog({ open: false, lineItem: null })}
        onSave={(newStages, fullReorderedList) => {
          if (newStages && newStages.length > 0) {
            handleAddStages(newStages, fullReorderedList);
          } else {
            setAddStagesDialog({ open: false, lineItem: null });
          }
        }}
        stages={[]}
        existingStages={addStagesDialog.lineItem?.processingStages || []}
        appendOnly
        poDate={po?.poDate}
        deliveryDate={po?.deliveryDate}
        itemName={addStagesDialog.lineItem?.itemName || ''}
        itemCode={addStagesDialog.lineItem?.itemCode || ''}
        variantAttributes={addStagesDialog.lineItem?.variantAttributes}
      />

      {/* Mark Stage Complete Modal */}
      <StageCompleteModal
        open={completeStageModal.open}
        onCancel={() => setCompleteStageModal({ open: false, lineItemId: null, stageIndex: null })}
        poDate={po?.poDate}
        deliveryDate={po?.deliveryDate}
        isUpdating={!!stageUpdating}
        message={message}
        onComplete={(dateVal, notesVal) => {
          handleStageCompletion(completeStageModal.lineItemId, completeStageModal.stageIndex, true, dateVal, notesVal);
          setCompleteStageModal({ open: false, lineItemId: null, stageIndex: null });
        }}
      />
    </>
  );
};

export default POView;
