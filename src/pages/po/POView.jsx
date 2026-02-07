import { useState, useEffect, useCallback } from 'react';
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
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  RollbackOutlined,
  EditOutlined,
  SendOutlined,
  SaveOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getPurchaseOrderById,
  updatePurchaseOrder,
  createActivity,
  updateActivity,
  parseActivityComment,
} from '../../services/purchaseOrderService';
import PermissionGuard from '../../components/PermissionGuard';
import {
  canApprovePO,
  canRejectPO,
  canCancelPO,
  canReferBackPO,
  hasPermission,
  getCurrentUser,
} from '../../utils/permissions';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// Status config for display
const STATUS_CONFIG = {
  Draft: { color: 'default', icon: <FileTextOutlined /> },
  AwaitApproval: { color: 'processing', icon: <ClockCircleOutlined /> },
  InProgress: { color: 'warning', icon: <ClockCircleOutlined /> },
  Approved: { color: 'success', icon: <CheckCircleOutlined /> },
  Completed: { color: 'success', icon: <CheckCircleOutlined /> },
  Rejected: { color: 'error', icon: <CloseCircleOutlined /> },
  Cancelled: { color: 'default', icon: <StopOutlined /> },
  ReferredBack: { color: 'warning', icon: <RollbackOutlined /> },
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

  // Activity state
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');

  // Status action modal
  const [statusAction, setStatusAction] = useState(null); // { action, title, requiresReason }
  const [actionReason, setActionReason] = useState('');
  const [rejectionCategory, setRejectionCategory] = useState(null);

  // Load full PO data when modal opens
  useEffect(() => {
    if (open && poData?.id) {
      loadPODetails(poData.id);
    }
    if (!open) {
      setPo(null);
      setNotes([]);
      setNewNote('');
      setEditingNoteId(null);
      setStatusAction(null);
      setActionReason('');
      setRejectionCategory(null);
    }
  }, [open, poData?.id]);

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
          status: parsed.status,
          timestamp: activity.createdAt || activity.timestamp || '',
          user: activity.user || activity.userName || 'User',
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
    try {
      const res = await createActivity(po.id, {
        comment: newNote,
        status: po.status || 'InProgress',
        isSystemGenerated: false,
      });
      const parsed = parseActivityComment(res.comment || '');
      setNotes((prev) => [
        ...prev,
        {
          id: res.id,
          text: parsed.text || newNote,
          isSystemGenerated: false,
          status: parsed.status,
          timestamp: res.createdAt || new Date().toISOString(),
          user: res.user || 'Current User',
          edited: false,
        },
      ]);
      setNewNote('');
      message.success('Note added');
    } catch {
      message.error('Failed to add note');
    }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditNoteText(note.text);
  };

  const handleSaveEdit = async (note) => {
    if (!editNoteText.trim()) return;
    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
        n.id === note.id
          ? { ...n, text: editNoteText, edited: true, timestamp: new Date().toISOString() }
          : n
      )
    );
    setEditingNoteId(null);
    setEditNoteText('');

    if (note.id && po?.id) {
      try {
        const res = await updateActivity(po.id, note.id, {
          comment: editNoteText,
          status: note.status || po.status || 'InProgress',
        });
        const parsed = parseActivityComment(res.comment || '');
        setNotes((prev) =>
          prev.map((n) =>
            n.id === res.id
              ? {
                  ...n,
                  text: parsed.text || editNoteText,
                  timestamp: res.updatedAt || res.createdAt || n.timestamp,
                  edited: true,
                }
              : n
          )
        );
      } catch {
        message.error('Failed to update note');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditNoteText('');
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
      fromStatus: ['AwaitApproval'],
      toStatus: 'InProgress',
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
      fromStatus: ['AwaitApproval'],
      toStatus: 'Rejected',
      canPerform: canRejectPO,
      requiresReason: true,
    },
    {
      key: 'cancel',
      label: 'Cancel',
      icon: <StopOutlined />,
      color: undefined,
      type: 'default',
      fromStatus: ['AwaitApproval', 'Draft'],
      toStatus: 'Cancelled',
      canPerform: canCancelPO,
      requiresReason: true,
    },
    {
      key: 'refer_back',
      label: 'Refer Back',
      icon: <RollbackOutlined />,
      color: '#faad14',
      type: 'default',
      fromStatus: ['AwaitApproval'],
      toStatus: 'ReferredBack',
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
      // Update PO status via existing updatePurchaseOrder (POST with id)
      await updatePurchaseOrder(po.id, {
        ...po,
        status: action.toStatus,
        lineItems: po.lineItems,
      });

      // Create system activity log
      const currentUser = getCurrentUser();
      const userName = currentUser?.name || currentUser?.username || 'User';
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

      await createActivity(po.id, {
        comment: activityComment,
        status: action.toStatus,
        isSystemGenerated: true,
      });

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
        {status}
      </Tag>
    );
  };

  // Compute totals from PO data
  const computeTotals = () => {
    if (!po) return { subtotal: 0, sgst: 0, cgst: 0, igst: 0, grandTotal: 0 };

    const items = po.lineItems || [];
    const subtotal =
      po.subtotal ||
      items.reduce(
        (sum, item) => sum + (item.quantity || item.qty || 0) * (item.unitPrice || 0),
        0
      );

    const sgst = po.sgstValue || po.sgst || 0;
    const cgst = po.cgstValue || po.cgst || 0;
    const igst = po.igstValue || po.igst || 0;
    const grandTotal = po.grandTotal || subtotal + sgst + cgst + igst;

    return { subtotal, sgst, cgst, igst, grandTotal };
  };

  const totals = po ? computeTotals() : { subtotal: 0, sgst: 0, cgst: 0, igst: 0, grandTotal: 0 };
  const hasIgst = totals.igst > 0;

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
            <>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {typeof record.variantAttributes === 'string'
                  ? record.variantAttributes
                  : JSON.stringify(record.variantAttributes)}
              </Text>
            </>
          )}
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      width: 180,
      render: (v) => v || '-',
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
        <Text strong>{formatCurrency(r.totalAmount || r.amount || 0)}</Text>
      ),
    },
  ];

  const isInProgress =
    po?.status === 'InProgress' || po?.status === 'Approved';

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
            <div>
              {/* Status Action Buttons */}
              <Space>
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
                        : undefined
                    }
                  >
                    {action.label}
                  </Button>
                ))}
              </Space>
            </div>
            <Button onClick={onClose}>Close</Button>
          </div>
        }
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <Spin size="large" tip="Loading PO details..." />
          </div>
        ) : po ? (
          <>
            {/* PO Header Details */}
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, sm: 2, md: 3 }}
              style={{ marginBottom: 24 }}
            >
              <Descriptions.Item label="PO Number">
                <Text strong>{po.poNumber || po.poNo || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">{renderStatusTag(po.status)}</Descriptions.Item>
              <Descriptions.Item label="Supplier">
                <Space>
                  <Avatar size="small" style={{ backgroundColor: 'var(--primary-color)' }}>
                    {(po.supplierName || '?')[0]}
                  </Avatar>
                  <div>
                    <Text strong>{po.supplierName || '-'}</Text>
                  </div>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="PO Date">{formatDate(po.poDate)}</Descriptions.Item>
              <Descriptions.Item label="Expected Delivery">
                {formatDate(po.deliveryDate || po.expectedDeliveryDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Terms & Conditions">
                {po.termsConditionsTitle || '-'}
              </Descriptions.Item>
              {po.remarks && (
                <Descriptions.Item label="Remarks" span={3}>
                  {po.remarks}
                </Descriptions.Item>
              )}
            </Descriptions>

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
              rowKey={(record, idx) => record.id || idx}
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

                {hasIgst ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>IGST</Text>
                    <Text>{formatCurrency(totals.igst)}</Text>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text>SGST</Text>
                      <Text>{formatCurrency(totals.sgst)}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text>CGST</Text>
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
                      children: (
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
                              {note.isSystemGenerated && (
                                <Tag
                                  style={{ marginLeft: 4, fontSize: 10 }}
                                  color="blue"
                                >
                                  System
                                </Tag>
                              )}
                            </Text>
                          </div>
                          {editingNoteId === note.id ? (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <TextArea
                                value={editNoteText}
                                onChange={(e) => setEditNoteText(e.target.value)}
                                rows={2}
                                autoFocus
                              />
                              <Space>
                                <Button
                                  size="small"
                                  type="primary"
                                  icon={<SaveOutlined />}
                                  onClick={() => handleSaveEdit(note)}
                                  disabled={!editNoteText.trim()}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="small"
                                  icon={<CloseOutlined />}
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </Button>
                              </Space>
                            </Space>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <Text style={{ flex: 1 }}>{note.text}</Text>
                              {!note.isSystemGenerated && (
                                <PermissionGuard module="purchase-orders" operation="update">
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => handleEditNote(note)}
                                  />
                                </PermissionGuard>
                              )}
                            </div>
                          )}
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
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
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
        destroyOnClose
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
            {statusAction?.key === 'reject' ? 'Rejection Reason' : 'Reason'} *
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
