import { useState, useRef, useEffect } from 'react';
import {
  App,
  Card,
  Typography,
  Space,
  Table,
  Tag,
  Input,
  Alert,
  Popconfirm,
  Image,
  Skeleton,
} from 'antd';
import {
  CalendarOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { generateOrderPdf } from '../../utils/orderPdfGenerator';
import { useNavigate } from 'react-router-dom';
import { changeOrderStatus } from '../../services/orders/orderService';
import ApprovalActionBar from '../../components/approval/ApprovalActionBar';
import { getFilesByEntity, downloadFileAsBlob } from '../../services/core/fileService';
import {
  hasPermission,
  canSubmitOrder,
  canReferBackOrder,
  canCancelOrder,
  canApproveOrderAction,
  canRejectOrderAction,
} from '../../utils/permissions';
import {
  ORDER_STATUS,
  getStatusLabel,
  getCurrencySymbol,
} from '../../utils/orderConstants';
import { ActionButton } from '../../components/buttons';
import StatusTag from '../../components/StatusTag';
import ViewDialog from '../../components/ViewDialog';
import DetailCard from '../../components/DetailCard';
import LineItemCard from '../../components/LineItemCard';
import StatusSteps from '../../components/StatusSteps';
import DraftWatermark from '../../components/DraftWatermark';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ORDER_STATUS_CONFIG, ORDER_STATUS_FLOW } from '../../utils/statusConfig';

const { Text, Title } = Typography;

const thStyle = {
  padding: '8px 10px',
  borderBottom: '2px solid var(--border-color, #e5e7eb)',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--border-color, #f0f0f0)',
  whiteSpace: 'nowrap',
};

const OrderView = ({ open, orderData, pendingAction, onClose, onStatusChange }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  // Refer-back request state
  const [showReferBackInput, setShowReferBackInput] = useState(false);
  const [referBackReason, setReferBackReason] = useState('');

  // Cancel request state
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  // Style image
  const [styleImageUrl, setStyleImageUrl] = useState(null);
  const [styleImageLoading, setStyleImageLoading] = useState(false);

  const referBackTextareaRef = useRef(null);
  const cancelTextareaRef = useRef(null);

  useEffect(() => {
    if (showReferBackInput) {
      setTimeout(() => referBackTextareaRef.current?.focus(), 50);
    }
  }, [showReferBackInput]);

  useEffect(() => {
    if (showCancelInput) {
      setTimeout(() => cancelTextareaRef.current?.focus(), 50);
    }
  }, [showCancelInput]);

  // Reset all transient state when dialog closes/reopens
  useEffect(() => {
    if (!open) {
      setShowReferBackInput(false);
      setReferBackReason('');
      setShowCancelInput(false);
      setCancelReason('');
      setStyleImageUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      setStyleImageLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load style image when dialog opens
  useEffect(() => {
    if (!open || !orderData?.styleId) return;
    let cancelled = false;
    setStyleImageLoading(true);

    (async () => {
      try {
        const files = await getFilesByEntity('STYLE', orderData.styleId);
        if (cancelled) return;
        const img = (files || []).find((f) => ['IMAGE', 'PHOTO'].includes(f.fileCategory));
        if (!img) return;
        const blob = await downloadFileAsBlob(img.fileId);
        if (cancelled) return;
        setStyleImageUrl(URL.createObjectURL(blob));
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setStyleImageLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, orderData?.styleId]);

  // Handle pending action from push notification deep link
  const status = orderData?.status;
  const isReferBackPending = status === ORDER_STATUS.REFER_BACK_REQUESTED;
  const isCancelPending    = status === ORDER_STATUS.CANCEL_REQUESTED;
  const isPendingApproval  = isReferBackPending || isCancelPending;

  useEffect(() => {
    if (!pendingAction || !orderData) return;
    if (pendingAction === 'approve' && isPendingApproval && canApproveOrderAction()) {
      handleApprove();
    } else if (pendingAction === 'reject' && isPendingApproval && canRejectOrderAction()) {
      handleReject();
    }
  }, [orderData, pendingAction]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!orderData) return null;

  const {
    orderNo,
    costingId,
    buyerName,
    orderDate,
    styleId,
    styleNo,
    garmentType,
    season,
    component,
    components = [],
    currency,
    paymentTermsName,
    paymentDays,
    fabricDescription,
    material,
    remarks,
    totalOrderQty,
    totalOrderValue,
    orderLines = [],
    referBackReason: existingReferBackReason,
    cancelReason: existingCancelReason,
  } = orderData;

  const currSymbol = getCurrencySymbol(currency);

  // Edit is only available once refer back is APPROVED (status = REFERRED_BACK), not while pending
  const canEdit = status === ORDER_STATUS.REFERRED_BACK && hasPermission('orders', 'update');

  const fmtCurrency = (amount) => {
    if (amount === null || amount === undefined) return `${currSymbol} 0.00`;
    return `${currSymbol} ${Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // ── Assortment summary — grouped by color (case-insensitive, Pantone-aware) ──
  const assortmentSummary = (() => {
    const getPantoneKey = (s) => {
      const fashion = s.match(/(\d{2}-\d{3,4})/);
      if (fashion) return fashion[1];
      const graphics = s.match(/(?:pantone|pms)\s+(\d{2,5})/i);
      return graphics ? `PMS-${graphics[1]}` : null;
    };
    const getColorKey = (name) => {
      const p = getPantoneKey(name.trim());
      return p || name.trim().toLowerCase();
    };
    const formatColorName = (name) =>
      name.trim().split(/\s+/).map((w) => {
        if (/^(TCX|TPX|TPG|TC|PMS|PANTONE)$/i.test(w)) return w.toUpperCase();
        if (/\d/.test(w)) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }).join(' ');

    const colorMap = new Map();
    orderLines.forEach((line) => {
      const buyerPoNo = line.buyerPoNo || '—';
      const destination = line.destination || 'Unspecified';
      (line.colorRows || []).forEach((cr) => {
        const raw = cr.colorName || 'Unspecified';
        const key = getColorKey(raw);
        if (!colorMap.has(key)) {
          colorMap.set(key, { displayName: formatColorName(raw), poLines: [], totalQty: 0, totalValue: 0 });
        }
        const g = colorMap.get(key);
        g.poLines.push({ buyerPoNo, destination });
        g.totalQty += (cr.total || 0);
        g.totalValue += (cr.rowValue || 0);
      });
    });
    const rows = [];
    for (const [, group] of colorMap) {
      const avgPrice = group.totalQty > 0 ? group.totalValue / group.totalQty : 0;
      group.poLines.forEach((po, i) => {
        rows.push({
          key: `${group.displayName}_${i}`,
          colorName: group.displayName,
          buyerPoNo: po.buyerPoNo,
          destination: po.destination,
          totalQty: group.totalQty,
          avgPrice,
          totalValue: group.totalValue,
          _rowSpan: i === 0 ? group.poLines.length : 0,
        });
      });
    }
    return rows;
  })();

  // ── Action handlers ──────────────────────────────────────────────────────────

  const doStatusChange = async (targetStatus, reason, successMsg, errorMsg) => {
    setActionLoading(true);
    try {
      await changeOrderStatus(orderData.id, targetStatus, reason || undefined, orderData.version);
      message.success(successMsg);
      onStatusChange?.();
    } catch {
      message.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = () =>
    doStatusChange(ORDER_STATUS.CONFIRMED, undefined,
      `${orderNo} submitted and confirmed`, 'Failed to submit order');

  const handleRequestReferBack = () =>
    doStatusChange(ORDER_STATUS.REFER_BACK_REQUESTED, referBackReason,
      `Refer back requested for ${orderNo}`, 'Failed to request refer back');

  const handleRequestCancel = () =>
    doStatusChange(ORDER_STATUS.CANCEL_REQUESTED, cancelReason,
      `Cancel requested for ${orderNo}`, 'Failed to request cancellation');



  const handleApprove = () => {
    if (isReferBackPending) {
      return doStatusChange(ORDER_STATUS.REFERRED_BACK, undefined,
        `${orderNo} refer back approved`, 'Failed to approve');
    } else if (isCancelPending) {
      return doStatusChange(ORDER_STATUS.CANCELLED, undefined,
        `${orderNo} cancellation approved`, 'Failed to approve');
    }
  };

  const handleReject = () =>
    doStatusChange(ORDER_STATUS.CONFIRMED, undefined,
      `${orderNo} request rejected — restored to Confirmed`, 'Failed to reject');

  const handlePrint = async () => {
    setPrintLoading(true);
    try {
      await generateOrderPdf(orderData);
    } catch {
      message.error('Failed to generate PDF');
    } finally {
      setPrintLoading(false);
    }
  };

  // ── Size breakdown table ─────────────────────────────────────────────────────
  const renderSizeBreakdown = (line) => {
    const { sizePrices = {}, colorRows = [] } = line;
    const sizes = line.sizes?.length > 0 ? line.sizes : Object.keys(sizePrices);
    if (sizes.length === 0) return <Text type="secondary">No sizes configured</Text>;

    const colTotals = {};
    const colValues = {};
    sizes.forEach((s) => { colTotals[s] = 0; colValues[s] = 0; });
    colorRows.forEach((row) => {
      sizes.forEach((s) => {
        const qty = row.quantities?.[s] || 0;
        colTotals[s] += qty;
        colValues[s] += qty * (sizePrices[s] || 0);
      });
    });
    const grandQty   = Object.values(colTotals).reduce((a, b) => a + b, 0);
    const grandValue = Object.values(colValues).reduce((a, b) => a + b, 0);

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)' }}>
              <th style={thStyle}>Color / Print</th>
              {sizes.map((s) => (
                <th key={s} style={{ ...thStyle, textAlign: 'center', minWidth: 64 }}>{s}</th>
              ))}
              <th style={{ ...thStyle, textAlign: 'right', minWidth: 80 }}>Total</th>
              <th style={{ ...thStyle, textAlign: 'right', minWidth: 100 }}>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: 'var(--primary-light)' }}>
              <td style={tdStyle}>
                <Text strong style={{ fontSize: 12, color: 'var(--primary-color)' }}>
                  Price{currency ? ` (${currency})` : ''}
                </Text>
              </td>
              {sizes.map((s) => (
                <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                  <Text style={{ color: 'var(--primary-color)' }}>{(sizePrices[s] || 0).toFixed(2)}</Text>
                </td>
              ))}
              <td style={tdStyle} />
              <td style={tdStyle} />
            </tr>
            {colorRows.map((row) => (
              <tr key={row.key}>
                <td style={tdStyle}><Text>{row.colorName || '—'}</Text></td>
                {sizes.map((s) => (
                  <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                    {row.quantities?.[s] || 0}
                  </td>
                ))}
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <Text strong>{(row.total || 0).toLocaleString()}</Text>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <Text>{fmtCurrency(row.rowValue)}</Text>
                </td>
              </tr>
            ))}
            <tr style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)', fontWeight: 600 }}>
              <td style={tdStyle}><Text strong>Total Qty</Text></td>
              {sizes.map((s) => (
                <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                  <Text strong>{colTotals[s]}</Text>
                </td>
              ))}
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                <Text strong style={{ color: 'var(--success-color, #10b981)' }}>
                  {grandQty.toLocaleString()}
                </Text>
              </td>
              <td style={tdStyle} />
            </tr>
            <tr style={{ backgroundColor: 'var(--secondary-light)' }}>
              <td style={tdStyle}><Text strong>Total Value</Text></td>
              {sizes.map((s) => (
                <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                  <Text style={{ fontSize: 12 }}>{fmtCurrency(colValues[s])}</Text>
                </td>
              ))}
              <td style={tdStyle} />
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                <Text strong style={{ color: 'var(--success-color, #10b981)', fontSize: 14 }}>
                  {fmtCurrency(grandValue)}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // ── Footer ───────────────────────────────────────────────────────────────────
  const renderFooter = () => (
    <>
      {/* Left */}
      <Space>
        <ActionButton
          action="print"
          text="Print"
          loading={printLoading}
          onClick={handlePrint}
        />

        {/* Request decisions route through the centralized approval engine when a flow
            is configured; legacy Popconfirm buttons are the no-flow fallback. */}
        {isPendingApproval && (
          <ApprovalActionBar
            entityType="ORDER"
            entityId={orderData.id}
            docLabel={isReferBackPending ? 'Order Refer Back Request' : 'Order Cancel Request'}
            docNumber={orderNo}
            onActionComplete={() => onStatusChange?.()}
            fallback={
              <Space>
                {canApproveOrderAction() && (
                  <Popconfirm
                    title={isReferBackPending ? 'Approve Refer Back' : 'Approve Cancellation'}
                    description={
                      isReferBackPending
                        ? 'Approve this refer back request? The order will be returned to the creator for editing.'
                        : 'Approve this cancellation? The order will be permanently cancelled.'
                    }
                    onConfirm={handleApprove}
                    okText="Approve"
                    cancelText="No"
                    okButtonProps={{ loading: actionLoading, type: 'primary' }}
                  >
                    <ActionButton
                      action="approve"
                      text="Approve"
                    />
                  </Popconfirm>
                )}
                {canRejectOrderAction() && (
                  <Popconfirm
                    title="Reject Request"
                    description="Reject this request? The order will be restored to Confirmed status."
                    onConfirm={handleReject}
                    okText="Reject"
                    cancelText="No"
                    okButtonProps={{ danger: true, loading: actionLoading }}
                  >
                    <ActionButton
                      action="reject"
                      text="Reject"
                    />
                  </Popconfirm>
                )}
              </Space>
            }
          />
        )}

        {/* Refer Back request — only for CONFIRMED, hide when pending approval */}
        {canReferBackOrder() && status === ORDER_STATUS.CONFIRMED && !showReferBackInput && (
          <ActionButton
            action="refer-back"
            text="Refer Back"
            onClick={() => { setShowReferBackInput(true); setShowCancelInput(false); setCancelReason(''); }}
          />
        )}

        {/* Cancel request — only for CONFIRMED, hide when pending approval */}
        {canCancelOrder() && status === ORDER_STATUS.CONFIRMED && !showCancelInput && (
          <ActionButton
            action="cancel"
            text="Cancel Order"
            danger
            onClick={() => { setShowCancelInput(true); setShowReferBackInput(false); setReferBackReason(''); }}
          />
        )}
      </Space>

      {/* Right */}
      <Space>
        {canEdit && (
          <ActionButton
            action="edit"
            text="Edit Order"
            onClick={() => { onClose(); navigate(`/orders/edit/${orderData.id}`, { state: { orderData } }); }}
          />
        )}
        {canSubmitOrder() && (status === ORDER_STATUS.DRAFT || status === ORDER_STATUS.REFERRED_BACK) && (
          <ActionButton
            action="save"
            text={status === ORDER_STATUS.REFERRED_BACK ? 'Resubmit Order' : 'Submit Order'}
            loading={actionLoading}
            onClick={handleSubmit}
          />
        )}
        <ActionButton
          action="close"
          text="Close"
          onClick={onClose}
        />
      </Space>
    </>
  );

  // ── Hero header for ViewDialog ─────────────────────────────────────────────
  const styleImageElement = styleImageLoading ? (
    <Skeleton.Image active style={{ width: 72, height: 72 }} />
  ) : styleImageUrl ? (
    <Image
      src={styleImageUrl}
      alt="Style"
      width={72}
      height={72}
      style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-color, #e5e7eb)' }}
    />
  ) : (
    <div style={{
      width: 72,
      height: 72,
      borderRadius: 8,
      border: '1px dashed var(--border-color, #d9d9d9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      background: 'var(--bg-tertiary)',
    }}>
      <Text type="secondary" style={{ fontSize: 10, lineHeight: 1.3 }}>No style<br />image</Text>
    </div>
  );

  const heroConfig = {
    title: orderNo,
    status: <StatusTag status={status} config={ORDER_STATUS_CONFIG} getLabel={getStatusLabel} />,
    subtitle: buyerName,
    subtitleIcon: <ShoppingOutlined />,
    image: styleImageElement,
    meta: [
      { icon: <CalendarOutlined />, text: formatDate(orderDate) },
      ...(styleNo ? [{ text: `Style: ${styleNo}` }] : []),
      ...(garmentType ? [{ text: garmentType }] : []),
    ],
    highlight: {
      label: 'Total Value',
      value: formatCurrency(totalOrderValue, currency),
    },
  };

  return (
    <ViewDialog
      open={open}
      onClose={onClose}
      width={1100}
      hero={heroConfig}
      footer={renderFooter()}
    >
      <DraftWatermark status={status}>
        {/* Status Steps */}
        <div style={{ marginBottom: 20 }}>
          <StatusSteps
            statusFlow={ORDER_STATUS_FLOW}
            currentStatus={status}
            statusConfig={ORDER_STATUS_CONFIG}
            getLabel={getStatusLabel}
            size="small"
          />
        </div>

        {/* ── Refer-back request input ── */}
        {showReferBackInput && (
          <Card size="small" style={{ marginBottom: 16, borderColor: 'var(--btn-refer-back-color)' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Reason for Referring Back:</Text>
              <Input.TextArea
                ref={referBackTextareaRef}
                rows={3}
                placeholder="Enter reason (minimum 50 characters)..."
                value={referBackReason}
                onChange={(e) => setReferBackReason(e.target.value)}
                showCount
                maxLength={500}
              />
              {referBackReason.length > 0 && referBackReason.length < 50 && (
                <Text type="danger" style={{ fontSize: 12 }}>
                  Minimum 50 characters required ({50 - referBackReason.length} more needed)
                </Text>
              )}
              <Space>
                <ActionButton
                  action="save"
                  text="Submit Request"
                  size="small"
                  loading={actionLoading}
                  disabled={referBackReason.trim().length < 50}
                  onClick={async () => {
                    await handleRequestReferBack();
                    setShowReferBackInput(false);
                    setReferBackReason('');
                  }}
                  style={referBackReason.trim().length >= 50 ? { backgroundColor: 'var(--btn-refer-back-color)', borderColor: 'var(--btn-refer-back-color)' } : {}}
                />
                <ActionButton
                  action="close"
                  text="Cancel"
                  size="small"
                  onClick={() => { setShowReferBackInput(false); setReferBackReason(''); }}
                />
              </Space>
            </Space>
          </Card>
        )}

        {/* ── Cancel request input ── */}
        {showCancelInput && (
          <Card size="small" style={{ marginBottom: 16, borderColor: 'var(--btn-delete-color)' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong style={{ color: 'var(--btn-delete-color)' }}>Reason for Cancellation:</Text>
              <Input.TextArea
                ref={cancelTextareaRef}
                rows={3}
                placeholder="Enter reason (minimum 50 characters)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                showCount
                maxLength={500}
              />
              {cancelReason.length > 0 && cancelReason.length < 50 && (
                <Text type="danger" style={{ fontSize: 12 }}>
                  Minimum 50 characters required ({50 - cancelReason.length} more needed)
                </Text>
              )}
              <Space>
                <ActionButton
                  action="save"
                  text="Submit Request"
                  size="small"
                  danger
                  loading={actionLoading}
                  disabled={cancelReason.trim().length < 50}
                  onClick={async () => {
                    await handleRequestCancel();
                    setShowCancelInput(false);
                    setCancelReason('');
                  }}
                />
                <ActionButton
                  action="close"
                  text="Cancel"
                  size="small"
                  onClick={() => { setShowCancelInput(false); setCancelReason(''); }}
                />
              </Space>
            </Space>
          </Card>
        )}

        {/* ── Pending refer-back approval banner ── */}
        {isReferBackPending && existingReferBackReason && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Refer Back Requested — Pending Approval"
            description={existingReferBackReason}
          />
        )}

        {/* ── Pending cancel approval banner ── */}
        {isCancelPending && existingCancelReason && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="Cancellation Requested — Pending Approval"
            description={existingCancelReason}
          />
        )}

        {/* ── Approved refer-back reason (order is now REFERRED_BACK) ── */}
        {status === ORDER_STATUS.REFERRED_BACK && existingReferBackReason && (
          <Card size="small" style={{ marginBottom: 16, borderColor: 'var(--btn-refer-back-color)', backgroundColor: 'var(--accent-light)' }}>
            <Text strong style={{ color: 'var(--btn-refer-back-color)' }}>Refer Back Reason: </Text>
            <Text>{existingReferBackReason}</Text>
          </Card>
        )}

        {/* ── Cancelled order reason ── */}
        {status === ORDER_STATUS.CANCELLED && existingCancelReason && (
          <Card size="small" style={{ marginBottom: 16, borderColor: 'var(--btn-delete-color)', backgroundColor: 'var(--accent-light)' }}>
            <Text strong style={{ color: 'var(--btn-delete-color)' }}>Cancellation Reason: </Text>
            <Text>{existingCancelReason}</Text>
          </Card>
        )}

        {/* ── Order Header ── */}
        <DetailCard title="Order Details" style={{ marginBottom: 16 }}>
          <DetailCard.Field label="Costing ID" value={costingId} span={8} />
          <DetailCard.Field label="Order No" value={orderNo} span={8} />
          <DetailCard.Field label="Order Date" value={formatDate(orderDate)} span={8} />
          <DetailCard.Field label="Buyer" value={buyerName} span={8} />
          <DetailCard.Field label="Style No" value={styleNo} span={8} />
          <DetailCard.Field label="Garment Type" value={garmentType} span={8} />
          <DetailCard.Field label="Season" value={season} span={8} />
          <DetailCard.Field label="Material" value={material} span={8} />
          <DetailCard.Field
            label="Component"
            value={
              component === 'Multiple' && components.length > 0
                ? `${component} (${components.map((c) => c.name).join(', ')})`
                : component
            }
            span={8}
          />
          <DetailCard.Field label="Currency" value={currency} span={8} />
          <DetailCard.Field label="Payment Terms" value={paymentTermsName} span={8} />
          <DetailCard.Field
            label="Payment Days"
            value={paymentDays != null ? `${paymentDays} days` : null}
            span={8}
          />
          <DetailCard.Field
            label="Order Qty"
            value={<Text strong>{(totalOrderQty || 0).toLocaleString()}</Text>}
            span={8}
          />
          <DetailCard.Field
            label="Total Order Value"
            value={
              <Text strong style={{ color: 'var(--success-color, #10b981)' }}>
                {fmtCurrency(totalOrderValue)}
              </Text>
            }
            span={8}
          />
          <DetailCard.Field label="Fabric Description" value={fabricDescription} span={8} />
          {remarks && (
            <DetailCard.Field label="Remarks" value={remarks} span={24} />
          )}
        </DetailCard>

        {/* ── Assortment Summary ── */}
        {assortmentSummary.length > 0 && (
          <Card size="small" title="Assortment Summary" style={{ marginBottom: 16 }}>
            <Table
              dataSource={assortmentSummary}
              rowKey="key"
              pagination={false}
              size="small"
              bordered
              columns={[
                {
                  title: 'Color',
                  dataIndex: 'colorName',
                  key: 'colorName',
                  width: 180,
                  align: 'center',
                  onCell: (record) => ({ rowSpan: record._rowSpan, style: { verticalAlign: 'middle' } }),
                  render: (v) => (
                    <Tag color="blue" style={{ fontWeight: 600, margin: 0, fontSize: 12, padding: '2px 10px' }}>
                      {v}
                    </Tag>
                  ),
                },
                {
                  title: 'Buyer PO No / Destination',
                  key: 'poDestination',
                  align: 'center',
                  render: (_, record) => (
                    <Space size={4}>
                      <Text strong style={{ fontSize: 12, fontFamily: 'monospace' }}>{record.buyerPoNo}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>/</Text>
                      <Text style={{ fontSize: 12, color: '#475569' }}>{record.destination}</Text>
                    </Space>
                  ),
                },
                {
                  title: 'Total Qty',
                  dataIndex: 'totalQty',
                  key: 'totalQty',
                  width: 100,
                  align: 'center',
                  onCell: (record) => ({ rowSpan: record._rowSpan, style: { verticalAlign: 'middle' } }),
                  render: (v) => <Text strong style={{ fontSize: 13 }}>{v.toLocaleString()}</Text>,
                },
                {
                  title: 'Avg Price',
                  dataIndex: 'avgPrice',
                  key: 'avgPrice',
                  width: 110,
                  align: 'center',
                  onCell: (record) => ({ rowSpan: record._rowSpan, style: { verticalAlign: 'middle' } }),
                  render: (v) => (
                    <Text style={{ fontSize: 12 }}>{`${currSymbol} ${v.toFixed(2)}`}</Text>
                  ),
                },
                {
                  title: 'Total Value',
                  dataIndex: 'totalValue',
                  key: 'totalValue',
                  width: 130,
                  align: 'center',
                  onCell: (record) => ({ rowSpan: record._rowSpan, style: { verticalAlign: 'middle' } }),
                  render: (v) => (
                    <Text strong style={{ color: 'var(--success-color, #10b981)', fontSize: 13 }}>
                      {fmtCurrency(v)}
                    </Text>
                  ),
                },
              ]}
            />
          </Card>
        )}

        {/* ── Order Lines ── */}
        <Title level={5} style={{ marginBottom: 12 }}>
          Order Lines ({orderLines.length})
        </Title>
        {orderLines.map((line, idx) => {
          return (
            <LineItemCard
              key={line.key || idx}
              index={idx + 1}
              title={line.buyerPoNo ? `PO: ${line.buyerPoNo}` : undefined}
              subtitle={line.destination || undefined}
              amount={fmtCurrency(line.lineTotal)}
              pills={[
                { label: 'Qty', value: (line.lineQty || 0).toLocaleString() },
                ...(line.dispatchDate ? [{ label: 'Dispatch', value: formatDate(line.dispatchDate) }] : []),
                ...(line.leadTime != null ? [{ label: 'Lead Time', value: `${line.leadTime} days` }] : []),
              ]}
              style={{ marginBottom: 12 }}
            >
              {renderSizeBreakdown(line)}
            </LineItemCard>
          );
        })}
      </DraftWatermark>
    </ViewDialog>
  );
};

export default OrderView;
