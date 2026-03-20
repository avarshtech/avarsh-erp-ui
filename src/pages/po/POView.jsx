import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  Descriptions,
  Table,
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
  Popconfirm,
  Select,
  Avatar,
  Tooltip,
  Upload,
  Progress,
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
  CheckOutlined,
  CloseOutlined,
  UserOutlined,
  SettingOutlined,
  InboxOutlined,
  PrinterOutlined,
  PaperClipOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getPurchaseOrderById,
  updatePurchaseOrder,
  createActivity,
} from '../../services/purchaseOrderService';
import PermissionGuard from '../../components/PermissionGuard';
import PantoneColorSwatch from '../../components/PantoneColorSwatch';
import { isPantoneCode } from '../../services/pantoneService';
import {
  canApprovePO,
  canRejectPO,
  canCancelPO,
  canReferBackPO,
  hasPermission,
  getCurrentUser,
} from '../../utils/permissions';
import { PO_STATUS, LINE_ITEM_STATUS, getStatusLabel, getLineItemStatusLabel } from '../../utils/poStatusConstants';
import { generatePOPdf } from '../../utils/poPdfGenerator';
import { uploadFile, deleteFile, getFilesByEntity, downloadFileAsBlob } from '../../services/fileService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// Status config for display — keys are DB enum values
// Colors kept in sync with POList.jsx STATUS_CONFIG
const STATUS_CONFIG = {
  [PO_STATUS.DRAFT]: { color: 'default', icon: <FileTextOutlined /> },
  [PO_STATUS.PENDING_APPROVAL]: { color: 'gold', icon: <ClockCircleOutlined /> },
  [PO_STATUS.APPROVED]: { color: 'blue', icon: <CheckCircleOutlined /> },
  [PO_STATUS.IN_PROGRESS]: { color: 'cyan', icon: <ClockCircleOutlined /> },
  [PO_STATUS.COMPLETED]: { color: 'green', icon: <CheckCircleOutlined /> },
  [PO_STATUS.REJECTED]: { color: 'red', icon: <CloseCircleOutlined /> },
  [PO_STATUS.CANCELLED]: { color: 'volcano', icon: <StopOutlined /> },
  [PO_STATUS.REFERRED_BACK]: { color: 'orange', icon: <RollbackOutlined /> },
  [PO_STATUS.PARTIALLY_RECEIVED]: { color: 'purple', icon: <InboxOutlined /> },
  [PO_STATUS.SENT_TO_SUPPLIER]: { color: 'magenta', icon: <SendOutlined /> },
};

// Rejection reason categories
const REJECTION_CATEGORIES = [
  { value: 'pricing', label: 'Pricing Issue' },
  { value: 'quality', label: 'Quality Concern' },
  { value: 'delivery', label: 'Delivery Timeline' },
  { value: 'specification', label: 'Specification Mismatch' },
  { value: 'budget', label: 'Budget Constraints' },
  { value: 'other', label: 'Other' },
];

const POView = ({ open, onClose, poData, onStatusChange, onRefresh }) => {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [po, setPo] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [completingLineId, setCompletingLineId] = useState(null);

  // Activity state
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Attachments state
  const [poFiles, setPoFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [deletingFileId, setDeletingFileId] = useState(null);

  // Variant images for line items { [variantId]: 'loading' | blobUrl }
  const [lineItemImages, setLineItemImages] = useState({});

  // Status action modal
  const [statusAction, setStatusAction] = useState(null); // { action, title, requiresReason }
  const [actionReason, setActionReason] = useState('');
  const [rejectionCategory, setRejectionCategory] = useState(null);
  const [printLoading, setPrintLoading] = useState(false);

  // Load full PO data when modal opens
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

  // Activity events are handled locally by updating notes from API responses.

  // Two-phase variant image loader for line items
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
      } catch {
        // Non-critical — just no image shown
      }
    });
  }, []);

  const loadPODetails = async (poId) => {
    setLoading(true);
    try {
      const data = await getPurchaseOrderById(poId);
      setPo(data);

      // Load variant images for line items (non-blocking)
      loadLineItemImages(data.lineItems || []);

      // Map activities/notes
      const activities = data.activities || data.notes || [];
      const mappedNotes = activities.map((activity) => ({
        id: activity.id,
        text: activity.comment || activity.text || '',
        isSystemGenerated: activity.isSystemGenerated || false,
        status: activity.status ?? null,
        timestamp: activity.createdAt || activity.timestamp || '',
        user: activity.userName || activity.name || (activity.isSystemGenerated ? 'System' : 'User'),
        edited: activity.edited || false,
      }));
      setNotes(mappedNotes);

      // Load attachments
      try {
        const files = await getFilesByEntity('PO', poId);
        setPoFiles(files || []);
      } catch {
        setPoFiles([]);
      }
    } catch {
      message.error('Failed to load PO details');
    } finally {
      setLoading(false);
    }
  };

  // Format helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return dayjs(dateStr).format('DD-MMM-YYYY');
  };

  const formatCurrency = (val) => {
    return `₹ ${(parseFloat(val) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // ========================
  // Activity / Notes Handlers
  // ========================
  const handleAddNote = async () => {
    if (!newNote.trim() || !po?.id) return;
    setAddingNote(true);
    try {
      const currentUser = getCurrentUser();
      const name = currentUser?.name || '';
      const res = await createActivity(po.id, {
        comment: newNote,
        status: po.status ?? null,
        isSystemGenerated: false,
        name,
      });
      // Append the created activity to local notes (no global events)
      setNotes((prev) => [
        ...prev,
        {
          id: res.id,
          text: res.comment || newNote,
          isSystemGenerated: res.isSystemGenerated || false,
          status: res.status ?? null,
          timestamp: res.createdAt || new Date().toISOString(),
          user: res.userName || res.name || name,
          edited: res.edited || false,
        },
      ]);
      // Clear the input and show feedback after server acknowledgement
      setNewNote('');
      message.success('Note added');
    } catch {
      message.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  // ========================
  // File Attachment Helpers & Handlers
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
    if (['txt', 'md'].includes(ext)) return { bg: '#f0f0f0', color: '#595959', label: ext.toUpperCase() };
    return { bg: '#f0f0f0', color: '#595959', label: ext.toUpperCase() || 'FILE' };
  };

  // Windows Explorer–style renaming: "report.pdf" → "report (1).pdf"
  const getUniqueFileName = (name, existingFiles) => {
    const lastDot = name.lastIndexOf('.');
    const ext = lastDot >= 0 ? name.slice(lastDot) : '';
    const base = lastDot >= 0 ? name.slice(0, lastDot) : name;
    let counter = 1;
    let newName = `${base} (${counter})${ext}`;
    while (existingFiles.some((f) => f.originalFilename === newName)) {
      counter++;
      newName = `${base} (${counter})${ext}`;
    }
    return newName;
  };

  const doUpload = async (file) => {
    setUploadingFile(true);
    setUploadProgress(0);
    try {
      const currentUser = getCurrentUser();
      const userName = currentUser?.name || '';
      const result = await uploadFile(
        file,
        { module: 'PURCHASE_ORDER', entity: 'PO', entityId: po.id, fileCategory: 'DOCUMENT' },
        (percent) => setUploadProgress(percent)
      );
      setPoFiles((prev) => [...prev, result]);

      const actComment = JSON.stringify({
        type: 'file_upload',
        fileName: result.originalFilename || file.name,
        fileId: result.fileId,
        by: userName,
      });
      const actRes = await createActivity(po.id, {
        comment: actComment,
        status: po.status ?? null,
        isSystemGenerated: false,
        name: userName,
      });
      setNotes((prev) => [...prev, {
        id: actRes.id,
        text: actRes.comment || actComment,
        isSystemGenerated: false,
        status: actRes.status ?? null,
        timestamp: actRes.createdAt || new Date().toISOString(),
        user: actRes.userName || actRes.name || userName,
        edited: false,
      }]);
      message.success(`"${result.originalFilename || file.name}" uploaded`);
    } catch {
      message.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
    }
  };

  const handleFileUpload = async (file) => {
    if (!po?.id) return false;

    // Check for duplicate filename
    const duplicate = poFiles.some((f) => f.originalFilename === file.name);
    if (duplicate) {
      modal.confirm({
        title: 'File already attached',
        content: `"${file.name}" is already attached. Upload as a new copy?`,
        okText: 'Upload as Copy',
        cancelText: 'Cancel',
        onOk: async () => {
          const newName = getUniqueFileName(file.name, poFiles);
          const renamed = new File([file], newName, { type: file.type });
          await doUpload(renamed);
        },
      });
      return false;
    }

    await doUpload(file);
    return false; // prevent antd default upload
  };

  const handleFileDownload = async (fileRecord) => {
    setDownloadingFileId(fileRecord.fileId);
    try {
      const fileName = fileRecord.originalFilename || 'download';
      const blob = await downloadFileAsBlob(fileRecord.fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('Failed to download file');
    } finally {
      setDownloadingFileId(null);
    }
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
      const actRes = await createActivity(po.id, {
        comment: actComment,
        status: po.status ?? null,
        isSystemGenerated: false,
        name: userName,
      });
      setNotes((prev) => [...prev, {
        id: actRes.id,
        text: actRes.comment || actComment,
        isSystemGenerated: false,
        status: actRes.status ?? null,
        timestamp: actRes.createdAt || new Date().toISOString(),
        user: actRes.userName || actRes.name || userName,
        edited: false,
      }]);
      message.success(`"${fileName}" removed`);
    } catch {
      message.error('Failed to delete file');
    } finally {
      setDeletingFileId(null);
    }
  };

  // ========================
  // Status Action Handlers
  // ========================
  const statusActions = [
    {
      key: 'approve',
      label: 'Approve',
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
      type: 'primary',
      fromStatus: [PO_STATUS.PENDING_APPROVAL],
      toStatus: PO_STATUS.SENT_TO_SUPPLIER,
      lineItemStatus: PO_STATUS.IN_PROGRESS,
      canPerform: canApprovePO,
      requiresReason: false,
    },
    {
      key: 'reject',
      label: 'Reject',
      icon: <CloseCircleOutlined />,
      color: '#ff4d4f',
      type: 'default',
      danger: true,
      fromStatus: [PO_STATUS.PENDING_APPROVAL],
      toStatus: PO_STATUS.REJECTED,
      lineItemStatus: PO_STATUS.IN_PROGRESS,
      canPerform: canRejectPO,
      requiresReason: true,
    },
    {
      key: 'cancel',
      label: 'Cancel',
      icon: <StopOutlined />,
      color: undefined,
      type: 'default',
      fromStatus: [PO_STATUS.PENDING_APPROVAL, PO_STATUS.DRAFT, PO_STATUS.SENT_TO_SUPPLIER],
      toStatus: PO_STATUS.CANCELLED,
      lineItemStatus: PO_STATUS.CANCELLED,
      canPerform: canCancelPO,
      requiresReason: true,
    },
    {
      key: 'refer_back',
      label: 'Refer Back',
      icon: <RollbackOutlined />,
      color: '#faad14',
      type: 'default',
      fromStatus: [PO_STATUS.SENT_TO_SUPPLIER],
      toStatus: PO_STATUS.REFERRED_BACK,
      lineItemStatus: PO_STATUS.IN_PROGRESS,
      canPerform: canReferBackPO,
      requiresReason: true,
    },
  ];

  const availableActions = po
    ? statusActions.filter(
        (action) =>
          action.fromStatus.includes(po.status) && action.canPerform()
      )
    : [];

  const handleStatusAction = (action) => {
    if (action.requiresReason) {
      setStatusAction(action);
      setActionReason('');
      setRejectionCategory(null);
    } else {
      // No reason needed — confirm directly
      Modal.confirm({
        title: `${action.label} Purchase Order`,
        icon: <ExclamationCircleOutlined />,
        content: `Are you sure you want to ${action.label.toLowerCase()} this purchase order?`,
        okText: action.label,
        okButtonProps: { danger: action.danger },
        onOk: () => executeStatusChange(action, ''),
      });
    }
  };

  const executeStatusChange = async (action, reason) => {
    if (!po) return;
    setActionLoading(true);
    try {
      // Update line items status based on action
      const updatedLineItems = (po.lineItems || []).map((li) => ({
        ...li,
        status: action.lineItemStatus || li.status,
      }));

      // Update PO status via existing updatePurchaseOrder (POST with id)
      await updatePurchaseOrder(po.id, {
        ...po,
        status: action.toStatus,
        lineItems: updatedLineItems,
        version: po.version,
      });

      // Create system activity log
      const currentUser = getCurrentUser();
      const name = currentUser?.name || '';
      const commentData = {
        type: 'status_change',
        action: action.key,
        actionLabel: action.label,
        from: po.status,
        to: action.toStatus,
        by: name,
        ...(reason ? { reason } : {}),
      };
      if (action.key === 'reject' && rejectionCategory) {
        const catLabel = REJECTION_CATEGORIES.find((c) => c.value === rejectionCategory)?.label;
        commentData.rejectionCategory = rejectionCategory;
        commentData.rejectionCategoryLabel = catLabel || rejectionCategory;
      }
      const activityComment = JSON.stringify(commentData);

      const activityPayload = {
        comment: activityComment,
        status: action.toStatus,
        isSystemGenerated: true,
        name,
      };

      await createActivity(po.id, activityPayload);

      message.success(`Purchase order ${action.label.toLowerCase()}d successfully`);
      setStatusAction(null);
      setActionReason('');
      setRejectionCategory(null);

      // Notify parent to refresh list
      if (onStatusChange) onStatusChange();
      onClose();
    } catch {
      message.error(`Failed to ${action.label.toLowerCase()} purchase order`);
    } finally {
      setActionLoading(false);
    }
  };

  // ========================
  // Render helpers
  // ========================
  const renderStatusTag = (status) => {
    const config = STATUS_CONFIG[status] || { color: 'default', icon: null };
    return (
      <Tag color={config.color} icon={config.icon} style={{ fontSize: 14, padding: '4px 12px' }}>
        {getStatusLabel(status)}
      </Tag>
    );
  };

  // Determine IGST applicability from PO data
  const isIgstApplicable = po?.isIgstApplicable || po?.igstApplicable || false;

  // Compute totals from line items (not from flat PO values)
  const totals = useMemo(() => {
    if (!po) return { subtotal: 0, sgst: 0, cgst: 0, igst: 0, grandTotal: 0 };

    const items = po.lineItems || [];
    const subtotal = items.reduce(
      (sum, item) => sum + (parseFloat(item.quantity || item.qty || 0)) * (parseFloat(item.unitPrice) || 0),
      0
    );

    let sgst = 0, cgst = 0, igst = 0;
    items.forEach((item) => {
      const base = (parseFloat(item.quantity || item.qty || 0)) * (parseFloat(item.unitPrice) || 0);
      let gstPercent = 0;
      if (item.gstPercent !== undefined && item.gstPercent !== null) {
        gstPercent = parseFloat(item.gstPercent) || 0;
      } else if (isIgstApplicable) {
        gstPercent = parseFloat(item.igstPercent ?? item.igst ?? 0) || 0;
      } else {
        gstPercent =
          (parseFloat(item.sgstPercent ?? item.sgst ?? 0) || 0) +
          (parseFloat(item.cgstPercent ?? item.cgst ?? 0) || 0);
      }
      const gstAmount = (base * gstPercent) / 100;
      if (isIgstApplicable) {
        igst += gstAmount;
      } else {
        sgst += gstAmount / 2;
        cgst += gstAmount / 2;
      }
    });

    const grandTotal = po.grandTotal || (subtotal + sgst + cgst + igst);
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      sgst: parseFloat(sgst.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)),
      igst: parseFloat(igst.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
    };
  }, [po, isIgstApplicable]);

  // GST Breakup by percentage
  const gstBreakup = useMemo(() => {
    if (!po) return [];
    const items = po.lineItems || [];
    const groups = {};

    items.forEach((item) => {
      const qty = parseFloat(item.quantity || item.qty) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const base = qty * unitPrice;

      let gstPercent = 0;
      if (item.gstPercent !== undefined && item.gstPercent !== null) {
        gstPercent = parseFloat(item.gstPercent) || 0;
      } else if (isIgstApplicable) {
        gstPercent = parseFloat(item.igstPercent ?? item.igst ?? 0) || 0;
      } else {
        gstPercent =
          (parseFloat(item.sgstPercent ?? item.sgst ?? 0) || 0) +
          (parseFloat(item.cgstPercent ?? item.cgst ?? 0) || 0);
      }

      if (gstPercent === 0 || base === 0) return;
      const gstAmount = (base * gstPercent) / 100;

      if (!groups[gstPercent]) {
        groups[gstPercent] = { igst: 0, sgst: 0, cgst: 0, taxableAmount: 0 };
      }
      if (isIgstApplicable) {
        groups[gstPercent].igst += gstAmount;
      } else {
        groups[gstPercent].sgst += gstAmount / 2;
        groups[gstPercent].cgst += gstAmount / 2;
      }
      groups[gstPercent].taxableAmount += base;
    });

    return Object.entries(groups)
      .map(([pct, vals]) => ({ percent: parseFloat(pct), ...vals }))
      .sort((a, b) => a.percent - b.percent);
  }, [po, isIgstApplicable]);

  const hasIgst = isIgstApplicable || totals.igst > 0;

  // Can mark individual line items as completed when PO is with supplier
  const canMarkLineCompleted =
    po?.status === PO_STATUS.SENT_TO_SUPPLIER ||
    po?.status === PO_STATUS.PARTIALLY_RECEIVED;

  // Show status column only after PO is sent to supplier
  const showStatusColumn =
    po?.status === PO_STATUS.SENT_TO_SUPPLIER ||
    po?.status === PO_STATUS.PARTIALLY_RECEIVED ||
    po?.status === PO_STATUS.COMPLETED;

  // Mark a single line item as completed
  const handleMarkLineItemCompleted = async (lineItem) => {
    if (!po) return;
    const lineId = lineItem.id || lineItem.itemId;
    setCompletingLineId(lineId);
    try {
      const updatedLineItems = (po.lineItems || []).map((li) => {
        if ((li.id || li.itemId) === lineId) {
          return { ...li, status: LINE_ITEM_STATUS.COMPLETED };
        }
        return li;
      });

      // Check if ALL line items are now completed
      const allCompleted = updatedLineItems.every(
        (li) => li.status === LINE_ITEM_STATUS.COMPLETED
      );

      const newPoStatus = allCompleted
        ? PO_STATUS.COMPLETED
        : PO_STATUS.PARTIALLY_RECEIVED;

      await updatePurchaseOrder(po.id, {
        ...po,
        status: newPoStatus,
        lineItems: updatedLineItems,
        version: po.version,
      });

      const currentUser = getCurrentUser();
      const name = currentUser?.name || '';
      const lineLabel = lineItem.itemName || lineItem.itemCode || 'Line item';
      const actComment = JSON.stringify(
        allCompleted
          ? { type: 'all_complete', by: name }
          : { type: 'line_complete', item: lineLabel, by: name }
      );

      const activityRes = await createActivity(po.id, {
        comment: actComment,
        status: newPoStatus,
        isSystemGenerated: true,
        name,
      });
      setNotes((prev) => [
        ...prev,
        {
          id: activityRes.id,
          text: activityRes.comment || actComment,
          isSystemGenerated: activityRes.isSystemGenerated ?? true,
          status: activityRes.status ?? null,
          timestamp: activityRes.createdAt || new Date().toISOString(),
          user: activityRes.name || 'System',
          edited: activityRes.edited || false,
        },
      ]);
      setPo((prev) => ({
        ...prev,
        status: newPoStatus,
        lineItems: updatedLineItems,
      }));

      message.success(
        allCompleted
          ? 'All line items completed — PO marked as Completed'
          : `"${lineLabel}" marked as completed`
      );

      // Notify parent to refresh list but keep dialog open
      if (onRefresh) onRefresh();
    } catch {
      message.error('Failed to update line item status');
    } finally {
      setCompletingLineId(null);
    }
  };

  // Line items columns
  const lineItemColumns = [
    {
      title: '#',
      width: 45,
      align: 'center',
      render: (_, __, i) => i + 1,
    },
    {
      title: 'Item',
      key: 'item',
      width: 220,
      render: (_, record) => {
        const imgUrl = record.variantId ? lineItemImages[record.variantId] : null;
        return (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {imgUrl === 'loading' && (
              <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Spin size="small" />
              </div>
            )}
            {imgUrl && imgUrl !== 'loading' && (
              <img
                src={imgUrl}
                alt="variant"
                style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0, border: '1px solid var(--border-color, #d9d9d9)' }}
              />
            )}
            <div>
              <Text strong>{record.itemName || 'Unknown Item'}</Text>
              {record.itemCode && (
                <>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {record.itemCode}
                  </Text>
                </>
              )}
              {record.variantAttributes && (
                <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {typeof record.variantAttributes === 'object'
                    ? Object.entries(record.variantAttributes).map(([k, v]) => {
                        const kLower = k.toLowerCase();
                        const isColorAttr = kLower.includes('color') || kLower.includes('colour');
                        const showSwatch = isColorAttr && isPantoneCode(v);
                        return (
                          <Tag key={k} style={{ fontSize: 11, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            {showSwatch && <PantoneColorSwatch value={v} size={14} />}
                            {k}: {showSwatch ? (v.split('/')[0]?.trim() || v) : v}
                          </Tag>
                        );
                      })
                    : <Text type="secondary" style={{ fontSize: 11 }}>{record.variantAttributes}</Text>
                  }
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      width: 180,
      render: (v) => <span style={{ wordBreak: 'break-word' }}>{v || '-'}</span>,
    },
    {
      title: 'Qty',
      key: 'qty',
      width: 70,
      align: 'center',
      render: (_, r) => r.quantity || r.qty || 0,
    },
    {
      title: 'UOM',
      key: 'uom',
      width: 80,
      align: 'center',
      render: (_, r) => r.uomSymbol || r.uomName || r.uom || '-',
    },
    {
      title: 'Unit Price',
      dataIndex: 'unitPrice',
      width: 100,
      align: 'right',
      render: (v) => formatCurrency(v),
    },
    ...(hasIgst
      ? [
          {
            title: 'IGST %',
            key: 'igst',
            width: 80,
            align: 'center',
            render: (_, r) => `${r.igst || 0}%`,
          },
        ]
      : [
          {
            title: 'SGST %',
            key: 'sgst',
            width: 80,
            align: 'center',
            render: (_, r) => `${r.sgstPercent || r.sgst || 0}%`,
          },
          {
            title: 'CGST %',
            key: 'cgst',
            width: 80,
            align: 'center',
            render: (_, r) => `${r.cgstPercent || r.cgst || 0}%`,
          },
        ]),
    {
      title: 'Amount',
      key: 'totalAmount',
      width: 110,
      align: 'right',
      render: (_, r) => (
        <Text strong style={{ whiteSpace: 'nowrap' }}>{formatCurrency(r.totalAmount || r.amount || 0)}</Text>
      ),
    },
    ...(showStatusColumn
      ? [
          {
            title: 'Status',
            key: 'lineStatus',
            width: 120,
            align: 'center',
            render: (_, r) => {
              const st = r.status || PO_STATUS.DRAFT;
              const lineConfig = STATUS_CONFIG[st] || { color: 'default' };
              return (
                <Tag color={lineConfig.color} style={{ borderRadius: 12 }}>
                  {getLineItemStatusLabel(st)}
                </Tag>
              );
            },
          },
        ]
      : []),
    ...(canMarkLineCompleted
      ? [
          {
            title: '',
            key: 'lineAction',
            width: 100,
            render: (_, r) => {
              if (r.status === LINE_ITEM_STATUS.COMPLETED) {
                return <Tag color="success">Done</Tag>;
              }
              return (
                <Tooltip title="Mark as complete">
                  <Button
                    size="small"
                    type="link"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleMarkLineItemCompleted(r)}
                    loading={completingLineId === (r.id || r.itemId)}
                  >
                    Complete
                  </Button>
                </Tooltip>
              );
            },
          },
        ]
      : []),
  ];

  const isInProgress =
    po?.status === PO_STATUS.IN_PROGRESS ||
    po?.status === PO_STATUS.PENDING_APPROVAL ||
    po?.status === PO_STATUS.APPROVED ||
    po?.status === PO_STATUS.SENT_TO_SUPPLIER ||
    po?.status === PO_STATUS.PARTIALLY_RECEIVED;

  const canPrintPO =
    po?.status === PO_STATUS.SENT_TO_SUPPLIER ||
    po?.status === PO_STATUS.PARTIALLY_RECEIVED ||
    po?.status === PO_STATUS.COMPLETED;

  // ========================
  // Activity comment renderer
  // ========================
  const renderActivityComment = (note) => {
    // Always try JSON parsing — system events AND user file actions both use JSON
    try {
      const data = JSON.parse(note.text);
      if (data && data.type) {
        if (data.type === 'status_change') {
          const fromCfg = STATUS_CONFIG[data.from] || { color: 'default', icon: null };
          const toCfg = STATUS_CONFIG[data.to] || { color: 'default', icon: null };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Tag color={fromCfg.color} icon={fromCfg.icon} style={{ margin: 0 }}>
                  {getStatusLabel(data.from)}
                </Tag>
                <span style={{ fontSize: 18, color: 'var(--text-secondary, #888)', lineHeight: 1 }}>→</span>
                <Tag color={toCfg.color} icon={toCfg.icon} style={{ margin: 0 }}>
                  {getStatusLabel(data.to)}
                </Tag>
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
                  <Text type="secondary">Reason: </Text>
                  <Text style={{ fontSize: 12 }}>{data.reason}</Text>
                </div>
              )}
            </div>
          );
        }

        if (data.type === 'line_complete') {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text>Line item <Text strong>"{data.item}"</Text> marked as completed</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>by {data.by}</Text>
            </div>
          );
        }

        if (data.type === 'all_complete') {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text>All line items received —</Text>
              <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0 }}>PO Completed</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>by {data.by}</Text>
            </div>
          );
        }

        if (data.type === 'file_upload') {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <PaperClipOutlined style={{ color: '#1677ff' }} />
              <Text>Attached: <Text strong>{data.fileName}</Text></Text>
              <Text type="secondary" style={{ fontSize: 12 }}>by {data.by}</Text>
            </div>
          );
        }

        if (data.type === 'file_delete') {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <DeleteOutlined style={{ color: '#ff4d4f' }} />
              <Text>Removed: <Text strong style={{ textDecoration: 'line-through', opacity: 0.7 }}>{data.fileName}</Text></Text>
              <Text type="secondary" style={{ fontSize: 12 }}>by {data.by}</Text>
            </div>
          );
        }
      }
    } catch {
      // not JSON — fall through to plain text
    }
    return <Text style={{ flex: 1 }}>{note.text}</Text>;
  };

  return (
    <>
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            <span>{po?.poNumber || po?.poNo || 'Purchase Order'}</span>
            {po?.status && renderStatusTag(po.status)}
          </Space>
        }
        open={open}
        onCancel={onClose}
        width={1200}
        style={{ top: 20 }}
        styles={{
          body: { maxHeight: '70vh', overflowY: 'auto', padding: '24px' },
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size="middle">
              {/* Print PO Button */}
              {po && canPrintPO && (
                <Button
                  icon={<PrinterOutlined />}
                  onClick={async () => {
                    setPrintLoading(true);
                    try {
                      // Convert blob URLs → base64 data URLs for PDF embedding
                      const variantImages = {};
                      await Promise.all(
                        (po.lineItems || [])
                          .filter((li) => li.variantId && lineItemImages[li.variantId] && lineItemImages[li.variantId] !== 'loading')
                          .map(async (li) => {
                            try {
                              const res = await fetch(lineItemImages[li.variantId]);
                              const blob = await res.blob();
                              const base64 = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                              });
                              variantImages[li.variantId] = base64;
                            } catch { /* skip if conversion fails */ }
                          })
                      );
                      await generatePOPdf(po, { variantImages });
                    } catch {
                      message.error('Failed to generate PO PDF');
                    } finally {
                      setPrintLoading(false);
                    }
                  }}
                  loading={printLoading}
                >
                  Print PO
                </Button>
              )}
              {availableActions.map((action) => (
                <Button
                  key={action.key}
                  type={action.type}
                  danger={action.danger}
                  icon={action.icon}
                  onClick={() => handleStatusAction(action)}
                  loading={actionLoading}
                  style={
                    action.color && !action.danger
                      ? { backgroundColor: action.color, borderColor: action.color, color: '#fff' }
                      : action.danger
                        ? { borderColor: '#ff4d4f' }
                        : undefined
                  }
                >
                  {action.label}
                </Button>
              ))}
            </Space>
            <Button onClick={onClose}>Close</Button>
          </div>
        }
      >
        {loading ? (
          <div style={{ padding: '16px 0' }}>
            <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 2, width: ['100%', '60%'] }} style={{ marginBottom: 24 }} />
            <Divider />
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        ) : po ? (
          <>
            {/* PO Header Details */}
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, sm: 2, md: 3 }}
              style={{ marginBottom: 24 }}
              items={[
                {
                  key: 'poNumber',
                  label: 'PO Number',
                  children: <Text strong>{po.poNumber || po.poNo || '-'}</Text>,
                },
                {
                  key: 'status',
                  label: 'Status',
                  children: renderStatusTag(po.status),
                },
                {
                  key: 'supplier',
                  label: 'Supplier',
                  children: (
                    <Space>
                      <Avatar size="small" style={{ backgroundColor: 'var(--primary-color)' }}>
                        {(po.supplierName || '?')[0]}
                      </Avatar>
                      <div>
                        <Text strong>{po.supplierName || '-'}</Text>
                      </div>
                    </Space>
                  ),
                },
                {
                  key: 'poDate',
                  label: 'PO Date',
                  children: formatDate(po.poDate),
                },
                {
                  key: 'expectedDelivery',
                  label: 'Expected Delivery',
                  children: formatDate(po.deliveryDate || po.expectedDeliveryDate),
                },
                {
                  key: 'terms',
                  label: 'Terms & Conditions',
                  children: po.termsConditionsTitle || '-',
                },
                po.remarks && {
                  key: 'remarks',
                  label: 'Remarks',
                  span: 3,
                  children: po.remarks,
                },
              ].filter(Boolean)}
            />

            {/* Line Items */}
            <Title level={5} style={{ marginBottom: 12 }}>
              Line Items
            </Title>
            <Table
              dataSource={po.lineItems || []}
              columns={lineItemColumns}
              pagination={false}
              scroll={{ x: 900 }}
              size="small"
              className="centered-header-table"
              rowKey={(record) => record.id || record.itemId || record.itemCode || record.itemName}
              style={{ marginBottom: 24 }}
            />

            {/* Order Summary */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
              <div
                style={{
                  width: 360,
                  background: 'var(--bg-secondary, #f8f9fa)',
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <Title level={5} style={{ margin: '0 0 12px' }}>
                  Order Summary
                </Title>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Subtotal</Text>
                  <Text strong>{formatCurrency(totals.subtotal)}</Text>
                </div>

                {/* GST Breakup */}
                {gstBreakup.length > 0 && (
                  <>
                    <Divider style={{ margin: '4px 0' }} />
                    <Text strong style={{ color: 'var(--primary-color)', fontSize: 12 }}>
                      GST BREAKUP
                    </Text>
                    {gstBreakup.map((group, idx) => (
                      <div key={group.percent} style={{ paddingLeft: 12, marginTop: 4 }}>
                        <Text
                          type="secondary"
                          style={{ fontSize: 12, display: 'block' }}
                        >
                          GST @ {group.percent}%
                        </Text>
                        {hasIgst ? (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              paddingLeft: 12,
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              IGST ({group.percent}%)
                            </Text>
                            <Text style={{ fontSize: 12 }}>
                              {formatCurrency(group.igst)}
                            </Text>
                          </div>
                        ) : (
                          <>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                paddingLeft: 12,
                              }}
                            >
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                SGST ({group.percent / 2}%)
                              </Text>
                              <Text style={{ fontSize: 12 }}>
                                {formatCurrency(group.sgst)}
                              </Text>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                paddingLeft: 12,
                              }}
                            >
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                CGST ({group.percent / 2}%)
                              </Text>
                              <Text style={{ fontSize: 12 }}>
                                {formatCurrency(group.cgst)}
                              </Text>
                            </div>
                          </>
                        )}
                        {idx < gstBreakup.length - 1 && (
                          <Divider variant="dashed" style={{ margin: '4px 0' }} />
                        )}
                      </div>
                    ))}
                  </>
                )}

                <Divider style={{ margin: '8px 0' }} />

                {hasIgst ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>Total IGST</Text>
                    <Text>{formatCurrency(totals.igst)}</Text>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text>Total SGST</Text>
                      <Text>{formatCurrency(totals.sgst)}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text>Total CGST</Text>
                      <Text>{formatCurrency(totals.cgst)}</Text>
                    </div>
                  </>
                )}

                <Divider style={{ margin: '8px 0' }} />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: 'var(--primary-color)',
                  }}
                >
                  <Text strong style={{ color: '#fff', fontSize: 15 }}>
                    Grand Total
                  </Text>
                  <Text strong style={{ color: '#fff', fontSize: 18 }}>
                    {formatCurrency(totals.grandTotal)}
                  </Text>
                </div>
              </div>
            </div>

            {/* Activity Log & Notes — shown when entries exist or PO is not a draft */}
            {(notes.length > 0 || po?.status !== PO_STATUS.DRAFT) && (
              <>
                <Divider />
                <Title level={5} style={{ marginBottom: 16 }}>
                  Activity Log & Notes
                </Title>

                {notes.length === 0 ? (
                  <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: 24 }}>
                    No activity notes yet.
                  </Text>
                ) : (
                  <Timeline
                    style={{ marginBottom: 24, paddingTop: 8 }}
                    items={notes.map((note) => ({
                      color: note.isSystemGenerated ? 'blue' : 'green',
                      icon: note.isSystemGenerated ? (
                        <SettingOutlined style={{ fontSize: 14 }} />
                      ) : (
                        <UserOutlined style={{ fontSize: 14 }} />
                      ),
                      content: (
                        <div>
                          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {dayjs(note.timestamp).format('DD-MMM-YYYY HH:mm')}
                            </Text>
                            {!note.isSystemGenerated && note.user && note.user !== 'User' && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                · <UserOutlined style={{ fontSize: 10, marginRight: 3 }} />{note.user}
                              </Text>
                            )}
                          </div>
                          <div>{renderActivityComment(note)}</div>
                        </div>
                      ),
                    }))}
                  />
                )}

                {/* Attachments card grid — always visible when files exist or non-draft */}
                {(poFiles.length > 0 || po?.status !== PO_STATUS.DRAFT) && (
                  <div style={{ marginBottom: 16 }}>
                    {/* Section header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text strong style={{ fontSize: 13 }}>
                        <PaperClipOutlined style={{ marginRight: 6, color: 'var(--primary-color)' }} />
                        Attachments {poFiles.length > 0 && <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>({poFiles.length})</Text>}
                      </Text>
                      {po?.status !== PO_STATUS.DRAFT && (
                        <PermissionGuard module="purchase-orders" operation="update">
                          <Upload showUploadList={false} beforeUpload={handleFileUpload} disabled={uploadingFile}>
                            <Button
                              icon={<PaperClipOutlined />}
                              loading={uploadingFile}
                              disabled={uploadingFile}
                              style={{
                                borderStyle: 'dashed',
                                color: 'var(--primary-color)',
                                borderColor: 'var(--primary-color)',
                                background: 'transparent',
                                padding: '4px 14px',
                                height: 32,
                              }}
                            >
                              Attach File
                            </Button>
                          </Upload>
                        </PermissionGuard>
                      )}
                    </div>

                    {/* Upload progress */}
                    {uploadingFile && (
                      <Progress percent={uploadProgress} size="small" status="active" style={{ marginBottom: 10 }} />
                    )}

                    {/* File cards grid */}
                    {poFiles.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center', padding: '12px 0', color: 'var(--text-secondary)' }}>
                        No attachments yet
                      </Text>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                        {poFiles.map((f) => {
                          const fileName = f.originalFilename || 'file';
                          const ext = getExtColor(fileName);
                          return (
                            <div
                              key={f.fileId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--border-color, #e8e8e8)',
                                background: 'var(--card-bg, #fff)',
                                minWidth: 0,
                              }}
                            >
                              {/* Extension badge */}
                              <div
                                style={{
                                  flexShrink: 0,
                                  width: 36,
                                  height: 36,
                                  borderRadius: 6,
                                  background: ext.bg,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: ext.color,
                                  letterSpacing: '0.02em',
                                }}
                              >
                                {ext.label}
                              </div>

                              {/* File info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Tooltip title={fileName}>
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      display: 'block',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {fileName}
                                  </Text>
                                </Tooltip>
                                {f.fileSizeBytes && (
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    {formatFileSize(f.fileSizeBytes)}
                                  </Text>
                                )}
                              </div>

                              {/* Actions */}
                              <div style={{ display: 'flex', flexShrink: 0, gap: 2 }}>
                                <Tooltip title="Download">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<DownloadOutlined style={{ fontSize: 13 }} />}
                                    loading={downloadingFileId === f.fileId}
                                    onClick={() => handleFileDownload(f)}
                                  />
                                </Tooltip>
                                <PermissionGuard module="purchase-orders" operation="update">
                                  <Popconfirm
                                    title={`Remove "${fileName}"?`}
                                    description="This will permanently delete the attachment."
                                    onConfirm={() => handleFileDelete(f)}
                                    okText="Remove"
                                    cancelText="Cancel"
                                    okButtonProps={{ danger: true, loading: deletingFileId === f.fileId }}
                                  >
                                    <Tooltip title="Remove">
                                      <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: 13 }} />} />
                                    </Tooltip>
                                  </Popconfirm>
                                </PermissionGuard>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Add Note input — available for all non-draft statuses */}
                {po?.status !== PO_STATUS.DRAFT && (
                  <PermissionGuard module="purchase-orders" operation="update">
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <TextArea
                        placeholder="Enter your note or comment here..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        style={{ flex: 1, minHeight: 72, resize: 'none' }}
                        disabled={addingNote}
                      />
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={handleAddNote}
                        loading={addingNote}
                        disabled={!newNote.trim() || addingNote}
                      >
                        Add Note
                      </Button>
                    </div>
                  </PermissionGuard>
                )}
              </>
            )}
          </>
        ) : null}
      </Modal>

      {/* Status Action Reason Modal */}
      <Modal
        title={statusAction ? `${statusAction.label} Purchase Order` : ''}
        open={!!statusAction}
        onCancel={() => setStatusAction(null)}
        afterClose={() => {
          setActionReason('');
          setRejectionCategory(null);
        }}
        onOk={() => executeStatusChange(statusAction, actionReason)}
        okText={statusAction?.key === 'cancel' ? 'Cancel PO' : statusAction?.label || 'Confirm'}
        cancelText="Close"
        okButtonProps={{
          danger: statusAction?.danger,
          disabled: !actionReason.trim(),
          loading: actionLoading,
        }}
        destroyOnHidden
        styles={{ body: { paddingBottom: 80 } }}
      >
        {statusAction?.key === 'reject' && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Rejection Category
            </Text>
            <Select
              placeholder="Select a category"
              style={{ width: '100%' }}
              value={rejectionCategory}
              onChange={setRejectionCategory}
              options={REJECTION_CATEGORIES}
            />
          </div>
        )}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {statusAction?.key === 'reject' ? 'Rejection Reason' : 'Reason'}{' '}
            <span style={{ color: 'var(--error-color, #ff4d4f)' }}>*</span>
          </Text>
          <TextArea
            rows={3}
            placeholder={`Enter reason for ${statusAction?.label?.toLowerCase() || 'action'}...`}
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            maxLength={500}
            showCount
          />
        </div>
      </Modal>
    </>
  );
};

export default POView;
