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
  message,
  Popconfirm,
  Select,
  Avatar,
  Tooltip,
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getPurchaseOrderById,
  updatePurchaseOrder,
  createActivity,
  parseActivityComment,
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

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// Status config for display — keys are DB enum values
const STATUS_CONFIG = {
  [PO_STATUS.DRAFT]: { color: 'default', icon: <FileTextOutlined /> },
  [PO_STATUS.PENDING_APPROVAL]: { color: 'processing', icon: <ClockCircleOutlined /> },
  [PO_STATUS.APPROVED]: { color: 'blue', icon: <CheckCircleOutlined /> },
  [PO_STATUS.IN_PROGRESS]: { color: 'cyan', icon: <ClockCircleOutlined /> },
  [PO_STATUS.COMPLETED]: { color: 'success', icon: <CheckCircleOutlined /> },
  [PO_STATUS.REJECTED]: { color: 'error', icon: <CloseCircleOutlined /> },
  [PO_STATUS.CANCELLED]: { color: 'volcano', icon: <StopOutlined /> },
  [PO_STATUS.REFERRED_BACK]: { color: 'warning', icon: <RollbackOutlined /> },
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

const POView = ({ open, onClose, poData, onStatusChange }) => {
  const [loading, setLoading] = useState(false);
  const [po, setPo] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [completingLineId, setCompletingLineId] = useState(null);

  // Activity state
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

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
    }
  }, [open, poData?.id]);

  // Activity events are handled locally by updating notes from API responses.

  const loadPODetails = async (poId) => {
    setLoading(true);
    try {
      const data = await getPurchaseOrderById(poId);
      setPo(data);

      // Map activities/notes
      const activities = data.activities || data.notes || [];
      const mappedNotes = activities.map((activity) => {
      const parsed = parseActivityComment(activity.comment || activity.text || '');
       
        return {
          id: activity.id,
          text: parsed.text,
          isSystemGenerated: parsed.isSystemGenerated,
          status: activity.status ?? null,
          timestamp: activity.createdAt || activity.timestamp || '',
          user: parsed.userName || (parsed.isSystemGenerated ? 'System' : 'User'),
          edited: activity.edited || false,
        };
      });
      setNotes(mappedNotes);
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
      const userName = currentUser?.username || '';
      const res = await createActivity(po.id, {
        comment: newNote,
        status: po.status ?? null,
        isSystemGenerated: false,
        userName,
      });
      // Append the created activity to local notes (no global events)
      const parsed = parseActivityComment(res.comment || res.text || '');
      setNotes((prev) => [
        ...prev,
        {
          id: res.id,
          text: parsed.text || res.comment || newNote,
          isSystemGenerated: parsed.isSystemGenerated,
          status: res.status ?? null,
          timestamp: res.createdAt || new Date().toISOString(),
          user: parsed.userName || (parsed.isSystemGenerated ? 'System' : 'User'),
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
      });

      // Create system activity log
      const currentUser = getCurrentUser();
      const userName = currentUser?.username || '';
      let activityComment = `PO ${action.label.toLowerCase()}d by ${userName}`;
      if (reason) {
        activityComment += `. Reason: ${reason}`;
      }
      if (action.key === 'reject' && rejectionCategory) {
        const catLabel = REJECTION_CATEGORIES.find(
          (c) => c.value === rejectionCategory
        )?.label;
        activityComment = `PO rejected by ${userName}. Category: ${catLabel || rejectionCategory}. Reason: ${reason}`;
      }

      // Include rejection category in activity payload when present
      const activityPayload = {
        comment: activityComment,
        status: action.toStatus,
        isSystemGenerated: true,
      };
      if (action.key === 'reject' && rejectionCategory) {
        activityPayload.rejectionCategory = rejectionCategory;
        const catLabel = REJECTION_CATEGORIES.find((c) => c.value === rejectionCategory)?.label;
        if (catLabel) activityPayload.rejectionCategoryLabel = catLabel;
      }

      // Attach the performing user's name so backend can record the actor
      activityPayload.userName = userName;
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
      });

      const currentUser = getCurrentUser();
      const userName = currentUser?.username || '';
      const lineLabel = lineItem.itemName || lineItem.itemCode || 'Line item';
      const actComment = allCompleted
        ? `All line items completed. PO marked as Completed by ${userName}`
        : `Line item "${lineLabel}" marked as completed by ${userName}`;

      const activityRes = await createActivity(po.id, {
        comment: actComment,
        status: newPoStatus,
        isSystemGenerated: true,
        userName,
      });
      const parsed = parseActivityComment(activityRes.comment || activityRes.text || '');
      setNotes((prev) => [
        ...prev,
        {
          id: activityRes.id,
          text: parsed.text || activityRes.comment || actComment,
          isSystemGenerated: parsed.isSystemGenerated || true,
          status: activityRes.status ?? null,
          timestamp: activityRes.createdAt || new Date().toISOString(),
          user: parsed.userName || (parsed.isSystemGenerated ? 'System' : 'User'),
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

      // Notify parent to refresh list (but don't close dialog)
      if (onStatusChange) onStatusChange();
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
      width: 200,
      render: (_, record) => (
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
      ),
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
      render: (_, r) => r.uomName || r.uom || '-',
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
        styles={{
          body: { maxHeight: '75vh', overflowY: 'auto', padding: '24px' },
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size="middle">
              {/* Print PO Button */}
              {po && (
                <Button
                  icon={<PrinterOutlined />}
                  onClick={async () => {
                    setPrintLoading(true);
                    try {
                      await generatePOPdf(po);
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 12 }}>
            <Spin size="large" />
            <Text type="secondary">Loading PO details...</Text>
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

            {/* Activity Log & Notes */}
            {isInProgress && (
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
                      dot: note.isSystemGenerated ? (
                        <SettingOutlined style={{ fontSize: 14 }} />
                      ) : (
                        <UserOutlined style={{ fontSize: 14 }} />
                      ),
                      content: (
                        <div>
                          <div style={{ marginBottom: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {dayjs(note.timestamp).format('YYYY-MMM-DD HH:mm:ss')}
                              {note.edited && (
                                <Tag
                                  style={{ marginLeft: 8, fontSize: 10 }}
                                  color="default"
                                >
                                  Edited
                                </Tag>
                              )}
                              {note.isSystemGenerated ? (
                                <Tag
                                  style={{ marginLeft: 4, fontSize: 10 }}
                                  color="blue"
                                >
                                  System
                                </Tag>
                              ) :
                                note.user && (
                                  <Tag
                                    style={{ marginLeft: 4, fontSize: 10 }}
                                    color="green"
                                  >
                                    {note.user}
                                  </Tag>
                                )}
                            </Text>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <Text style={{ flex: 1 }}>{note.text}</Text>
                          </div>
                        </div>
                      ),
                    }))}
                  />
                )}

                {/* Add Note Input */}
                <PermissionGuard module="purchase-orders" operation="update">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <TextArea
                          rows={2}
                          placeholder="Enter your note or comment here..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          style={{ flex: 1 }}
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
              </>
            )}
          </>
        ) : null}
      </Modal>

      {/* Status Action Reason Modal */}
      <Modal
        title={statusAction ? `${statusAction.label} Purchase Order` : ''}
        open={!!statusAction}
        onCancel={() => {
          setStatusAction(null);
          setActionReason('');
          setRejectionCategory(null);
        }}
        onOk={() => executeStatusChange(statusAction, actionReason)}
        okText={statusAction?.label || 'Confirm'}
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
