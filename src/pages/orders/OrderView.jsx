import { useState, useRef, useEffect } from 'react';
import {
  Modal,
  Descriptions,
  Tag,
  Card,
  Typography,
  Space,
  Button,
  Table,
  Input,
  message,
  Divider,
  Row,
  Col,
  Alert,
  Popconfirm,
} from 'antd';
import {
  CheckCircleOutlined,
  FileTextOutlined,
  EditOutlined,
  SendOutlined,
  RollbackOutlined,
  UndoOutlined,
  StopOutlined,
  PrinterOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { generateOrderPdf } from '../../utils/orderPdfGenerator';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { changeOrderStatus } from '../../services/orderService';
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
  EDITABLE_STATUSES,
  getCurrencySymbol,
} from '../../utils/orderConstants';

const { Text, Title } = Typography;

const STATUS_CONFIG = {
  [ORDER_STATUS.DRAFT]:                { color: 'default', icon: <FileTextOutlined /> },
  [ORDER_STATUS.CONFIRMED]:            { color: 'green',   icon: <CheckCircleOutlined /> },
  [ORDER_STATUS.REFER_BACK_REQUESTED]: { color: 'orange',  icon: <ClockCircleOutlined /> },
  [ORDER_STATUS.REFERRED_BACK]:        { color: 'orange',  icon: <UndoOutlined /> },
  [ORDER_STATUS.CANCEL_REQUESTED]:     { color: 'red',     icon: <ClockCircleOutlined /> },
  [ORDER_STATUS.CANCELLED]:            { color: 'red',     icon: <StopOutlined /> },
  [ORDER_STATUS.IN_PRODUCTION]:        { color: 'blue',    icon: <CheckCircleOutlined /> },
  [ORDER_STATUS.COMPLETED]:            { color: 'green',   icon: <CheckCircleOutlined /> },
};

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

const OrderView = ({ open, orderData, onClose, onStatusChange }) => {
  const navigate = useNavigate();

  // Refer-back request state
  const [showReferBackInput, setShowReferBackInput] = useState(false);
  const [referBackReason, setReferBackReason] = useState('');

  // Cancel request state
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

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
    }
  }, [open]);

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
  const statusConfig = STATUS_CONFIG[status] || {};

  // Edit is only available once refer back is APPROVED (status = REFERRED_BACK), not while pending
  const canEdit = status === ORDER_STATUS.REFERRED_BACK && hasPermission('orders', 'update');

  // Pending-approval statuses
  const isReferBackPending = status === ORDER_STATUS.REFER_BACK_REQUESTED;
  const isCancelPending    = status === ORDER_STATUS.CANCEL_REQUESTED;
  const isPendingApproval  = isReferBackPending || isCancelPending;

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
                <Text strong style={{ fontSize: 12, color: '#1890ff' }}>
                  Price{currency ? ` (${currency})` : ''}
                </Text>
              </td>
              {sizes.map((s) => (
                <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                  <Text style={{ color: '#1890ff' }}>{(sizePrices[s] || 0).toFixed(2)}</Text>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      {/* Left */}
      <Space>
        <Button icon={<PrinterOutlined />} loading={printLoading} onClick={handlePrint}>
          Print
        </Button>

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
            <Button icon={<CheckOutlined />} style={{ color: '#52c41a', borderColor: '#52c41a' }}>
              Approve
            </Button>
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
            <Button icon={<CloseOutlined />} danger>
              Reject
            </Button>
          </Popconfirm>
        )}

        {/* Refer Back request — only for CONFIRMED, hide when pending approval */}
        {canReferBackOrder() && status === ORDER_STATUS.CONFIRMED && !showReferBackInput && (
          <Button
            icon={<RollbackOutlined />}
            onClick={() => { setShowReferBackInput(true); setShowCancelInput(false); setCancelReason(''); }}
            style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
          >
            Refer Back
          </Button>
        )}

        {/* Cancel request — only for CONFIRMED, hide when pending approval */}
        {canCancelOrder() && status === ORDER_STATUS.CONFIRMED && !showCancelInput && (
          <Button
            icon={<StopOutlined />}
            danger
            onClick={() => { setShowCancelInput(true); setShowReferBackInput(false); setReferBackReason(''); }}
          >
            Cancel Order
          </Button>
        )}
      </Space>

      {/* Right */}
      <Space>
        {canEdit && (
          <Button
            icon={<EditOutlined />}
            onClick={() => { onClose(); navigate(`/orders/edit/${orderData.id}`, { state: { orderData } }); }}
          >
            Edit Order
          </Button>
        )}
        {canSubmitOrder() && (status === ORDER_STATUS.DRAFT || status === ORDER_STATUS.REFERRED_BACK) && (
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={actionLoading}
            onClick={handleSubmit}
          >
            {status === ORDER_STATUS.REFERRED_BACK ? 'Resubmit Order' : 'Submit Order'}
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </Space>
    </div>
  );

  return (
    <Modal
      title={
        <Space>
          <Text strong style={{ fontSize: 18 }}>{orderNo}</Text>
          <Tag color={statusConfig.color} icon={statusConfig.icon} style={{ borderRadius: 20 }}>
            {getStatusLabel(status)}
          </Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={1100}
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', padding: '16px 16px 16px 24px' } }}
      footer={renderFooter()}
    >
      {/* ── Refer-back request input ── */}
      {showReferBackInput && (
        <Card size="small" style={{ marginBottom: 16, borderColor: '#fa8c16' }}>
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
              <Button
                type="primary"
                size="small"
                loading={actionLoading}
                disabled={referBackReason.trim().length < 50}
                onClick={async () => {
                  await handleRequestReferBack();
                  setShowReferBackInput(false);
                  setReferBackReason('');
                }}
                style={referBackReason.trim().length >= 50 ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16' } : {}}
              >
                Submit Request
              </Button>
              <Button size="small" onClick={() => { setShowReferBackInput(false); setReferBackReason(''); }}>
                Cancel
              </Button>
            </Space>
          </Space>
        </Card>
      )}

      {/* ── Cancel request input ── */}
      {showCancelInput && (
        <Card size="small" style={{ marginBottom: 16, borderColor: '#ff4d4f' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong style={{ color: '#ff4d4f' }}>Reason for Cancellation:</Text>
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
              <Button
                type="primary"
                danger
                size="small"
                loading={actionLoading}
                disabled={cancelReason.trim().length < 50}
                onClick={async () => {
                  await handleRequestCancel();
                  setShowCancelInput(false);
                  setCancelReason('');
                }}
              >
                Submit Request
              </Button>
              <Button size="small" onClick={() => { setShowCancelInput(false); setCancelReason(''); }}>
                Cancel
              </Button>
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
        <Card size="small" style={{ marginBottom: 16, borderColor: '#fa8c16', backgroundColor: 'var(--accent-light)' }}>
          <Text strong style={{ color: '#fa8c16' }}>Refer Back Reason: </Text>
          <Text>{existingReferBackReason}</Text>
        </Card>
      )}

      {/* ── Cancelled order reason ── */}
      {status === ORDER_STATUS.CANCELLED && existingCancelReason && (
        <Card size="small" style={{ marginBottom: 16, borderColor: '#ff4d4f', backgroundColor: 'var(--accent-light)' }}>
          <Text strong style={{ color: '#ff4d4f' }}>Cancellation Reason: </Text>
          <Text>{existingCancelReason}</Text>
        </Card>
      )}

      {/* ── Order Header ── */}
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Costing ID">
          <Text code>{costingId || '—'}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Order No">
          <Text strong>{orderNo}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Order Date">
          {orderDate ? dayjs(orderDate).format('DD-MMM-YYYY') : '—'}
        </Descriptions.Item>

        <Descriptions.Item label="Buyer">{buyerName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Style No">{styleNo || '—'}</Descriptions.Item>
        <Descriptions.Item label="Garment Type">{garmentType || '—'}</Descriptions.Item>

        <Descriptions.Item label="Season">{season || '—'}</Descriptions.Item>
        <Descriptions.Item label="Material">{material || '—'}</Descriptions.Item>
        <Descriptions.Item label="Component">
          {component || '—'}
          {component === 'Multiple' && components.length > 0 && (
            <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
              ({components.map((c) => c.name).join(', ')})
            </Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Currency">{currency || '—'}</Descriptions.Item>

        <Descriptions.Item label="Payment Terms">{paymentTermsName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Payment Days">
          {paymentDays != null ? `${paymentDays} days` : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Order Qty">
          <Text strong>{(totalOrderQty || 0).toLocaleString()}</Text>
        </Descriptions.Item>

        <Descriptions.Item label="Total Order Value">
          <Text strong style={{ color: 'var(--success-color, #10b981)' }}>
            {fmtCurrency(totalOrderValue)}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Fabric Description" span={2}>{fabricDescription || '—'}</Descriptions.Item>
        {remarks && (
          <Descriptions.Item label="Remarks" span={3}>{remarks}</Descriptions.Item>
        )}
      </Descriptions>

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
      {orderLines.map((line, idx) => (
        <Card
          key={line.key || idx}
          size="small"
          style={{ marginBottom: 12 }}
          title={
            <Space wrap>
              <Tag color="blue">#{idx + 1}</Tag>
              {line.buyerPoNo && <Text strong>PO: {line.buyerPoNo}</Text>}
              {line.destination && <Text type="secondary">{line.destination}</Text>}
              <Text type="secondary">|</Text>
              <Text>Qty: {(line.lineQty || 0).toLocaleString()}</Text>
              <Text type="secondary">|</Text>
              <Text style={{ color: 'var(--success-color, #10b981)' }}>
                {fmtCurrency(line.lineTotal)}
              </Text>
            </Space>
          }
        >
          <Row gutter={[16, 8]} style={{ marginBottom: 12 }}>
            <Col xs={12} sm={6}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Buyer PO No</Text>
              <Text strong>{line.buyerPoNo || '—'}</Text>
            </Col>
            <Col xs={12} sm={6}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Destination</Text>
              <Text strong>{line.destination || '—'}</Text>
            </Col>
            <Col xs={12} sm={6}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Dispatch Date</Text>
              <Text strong>
                {line.dispatchDate ? dayjs(line.dispatchDate).format('DD-MMM-YYYY') : '—'}
              </Text>
            </Col>
            <Col xs={12} sm={6}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Lead Time</Text>
              <Text strong>
                {line.leadTime != null ? `${line.leadTime} days` : '—'}
              </Text>
            </Col>
          </Row>
          <Divider style={{ margin: '8px 0' }} />
          {renderSizeBreakdown(line)}
        </Card>
      ))}
    </Modal>
  );
};

export default OrderView;
