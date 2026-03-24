import { useState, useRef, useEffect } from 'react';
import {
  Card,
  Typography,
  Space,
  Table,
  Input,
  message,
  Alert,
  Popconfirm,
  Spin,
} from 'antd';
import {
  CalendarOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { generateOrderPdf } from '../../utils/orderPdfGenerator';
import { useNavigate } from 'react-router-dom';
import { changeOrderStatus } from '../../services/orderService';
import { getFilesByEntity, downloadFileAsBlob } from '../../services/fileService';
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
import ImagePreview from '../../components/ImagePreview';
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
  const navigate = useNavigate();

  // Refer-back request state
  const [showReferBackInput, setShowReferBackInput] = useState(false);
  const [referBackReason, setReferBackReason] = useState('');

  // Cancel request state
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  // Garment images per order line: { [lineId]: { loading, previewUrl } }
  const [lineImages, setLineImages] = useState({});

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
      // Clean up blob URLs for line images
      Object.values(lineImages).forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
      setLineImages({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load garment images for order lines when modal opens
  useEffect(() => {
    if (!open || !orderData?.orderLines?.length) return;
    let cancelled = false;

    const loadImages = async () => {
      const linesWithIds = orderData.orderLines.filter((l) => l.id);
      if (linesWithIds.length === 0) return;

      // Mark lines as loading
      const loadingState = {};
      linesWithIds.forEach((l) => { loadingState[l.id] = { loading: true, previewUrl: null }; });
      setLineImages(loadingState);

      await Promise.all(
        linesWithIds.map(async (l) => {
          try {
            const files = await getFilesByEntity('ORDER_LINE', l.id);
            const imageFile = (files || []).find((f) =>
              ['IMAGE', 'PHOTO'].includes(f.fileCategory),
            );
            if (!imageFile || cancelled) return;
            const blob = await downloadFileAsBlob(imageFile.fileId);
            if (cancelled) return;
            const previewUrl = URL.createObjectURL(blob);
            setLineImages((prev) => ({ ...prev, [l.id]: { loading: false, previewUrl } }));
          } catch {
            if (!cancelled) {
              setLineImages((prev) => ({ ...prev, [l.id]: { loading: false, previewUrl: null } }));
            }
          }
        }),
      );
    };

    loadImages();
    return () => { cancelled = true; };
  }, [open, orderData]);

  if (!orderData) return null;

  const {
    orderNo,
    status,
    costingId,
    buyerName,
    orderDate,
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

  // Pending-approval statuses
  const isReferBackPending = status === ORDER_STATUS.REFER_BACK_REQUESTED;
  const isCancelPending    = status === ORDER_STATUS.CANCEL_REQUESTED;
  const isPendingApproval  = isReferBackPending || isCancelPending;

  // Handle pending action from push notification deep link
  useEffect(() => {
    if (!pendingAction || !orderData) return;
    if (pendingAction === 'approve' && isPendingApproval && canApproveOrderAction()) {
      handleApprove();
    } else if (pendingAction === 'reject' && isPendingApproval && canRejectOrderAction()) {
      handleReject();
    }
  }, [orderData, pendingAction]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtCurrency = (amount) => {
    if (amount === null || amount === undefined) return `${currSymbol} 0.00`;
    return `${currSymbol} ${Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // ── Assortment summary — one row per order line ───────────────────────────────
  const assortmentSummary = orderLines.map((line, idx) => ({
    key: line.key || line.id || idx,
    buyerPoNo: line.buyerPoNo || '—',
    destination: line.destination || 'Unspecified',
    colorRows: line.colorRows || [],
    lineQty: line.lineQty || 0,
    lineTotal: line.lineTotal || 0,
  }));

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

        {/* Approve — shown when a request is pending and user has approve permission */}
        {isPendingApproval && canApproveOrderAction() && (
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

        {/* Reject — separate permission check; restores order to Confirmed */}
        {isPendingApproval && canRejectOrderAction() && (
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
  const heroConfig = {
    title: orderNo,
    status: <StatusTag status={status} config={ORDER_STATUS_CONFIG} getLabel={getStatusLabel} />,
    subtitle: buyerName,
    subtitleIcon: <ShoppingOutlined />,
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
              columns={[
                {
                  title: 'Buyer PO No',
                  dataIndex: 'buyerPoNo',
                  key: 'buyerPoNo',
                  width: 130,
                  render: (t) => <Text style={{ fontSize: 12 }}>{t}</Text>,
                },
                {
                  title: 'Destination',
                  dataIndex: 'destination',
                  key: 'destination',
                  ellipsis: true,
                  render: (t) => <Text style={{ fontSize: 12 }}>{t}</Text>,
                },
                {
                  title: 'Color / Print',
                  dataIndex: 'colorRows',
                  key: 'colorRows',
                  render: (rows) =>
                    rows.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
                        {rows.map((c, i) => (
                          <Text key={i} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                            {c.colorName || '—'}
                            <Text type="secondary" style={{ fontSize: 11 }}> ({(c.total || 0).toLocaleString()})</Text>
                          </Text>
                        ))}
                      </div>
                    ),
                },
                {
                  title: 'Total Qty',
                  dataIndex: 'lineQty',
                  key: 'lineQty',
                  width: 90,
                  align: 'right',
                  render: (v) => <Text strong>{v.toLocaleString()}</Text>,
                },
                {
                  title: 'Avg Price',
                  key: 'avgPrice',
                  width: 100,
                  align: 'right',
                  render: (_, r) => `${currSymbol} ${(r.lineQty > 0 ? r.lineTotal / r.lineQty : 0).toFixed(2)}`,
                },
                {
                  title: 'Total Value',
                  dataIndex: 'lineTotal',
                  key: 'lineTotal',
                  width: 120,
                  align: 'right',
                  render: (v) => (
                    <Text strong style={{ color: 'var(--success-color, #10b981)' }}>
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
          const lineImg = line.id ? lineImages[line.id] : null;
          const imageElement = lineImg ? (
            lineImg.loading ? (
              <Spin size="small" />
            ) : lineImg.previewUrl ? (
              <ImagePreview
                src={lineImg.previewUrl}
                alt="Garment"
                size={64}
                previewSize={240}
              />
            ) : null
          ) : null;

          return (
            <LineItemCard
              key={line.key || idx}
              index={idx + 1}
              image={imageElement}
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
