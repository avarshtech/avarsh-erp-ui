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
} from '@ant-design/icons';
import { generateOrderPdf } from '../../utils/orderPdfGenerator';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { changeOrderStatus } from '../../services/orderService';
import { hasPermission, canSubmitOrder, canReferBackOrder, canCancelOrder } from '../../utils/permissions';
import {
  ORDER_STATUS,
  getStatusLabel,
  EDITABLE_STATUSES,
  getCurrencySymbol,
} from '../../utils/orderConstants';

const { Text, Title } = Typography;

const STATUS_CONFIG = {
  [ORDER_STATUS.DRAFT]:        { color: 'default', icon: <FileTextOutlined /> },
  [ORDER_STATUS.CONFIRMED]:    { color: 'green',   icon: <CheckCircleOutlined /> },
  [ORDER_STATUS.REFERRED_BACK]:{ color: 'orange',  icon: <UndoOutlined /> },
};

// Table cell styles (shared between header and size breakdown)
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
  const [referBackReason, setReferBackReason] = useState('');
  const [showReferBackInput, setShowReferBackInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const referBackTextareaRef = useRef(null);

  useEffect(() => {
    if (showReferBackInput) {
      setTimeout(() => referBackTextareaRef.current?.focus(), 50);
    }
  }, [showReferBackInput]);

  useEffect(() => {
    if (!open) {
      setShowReferBackInput(false);
      setReferBackReason('');
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
    remarks,
    totalOrderQty,
    totalOrderValue,
    orderLines = [],
    referBackReason: existingReferBackReason,
  } = orderData;

  const currSymbol = getCurrencySymbol(currency);
  const statusConfig = STATUS_CONFIG[status] || {};
  const isEditable = EDITABLE_STATUSES.includes(status);
  const canEdit = isEditable && hasPermission('orders', 'update');

  const fmtCurrency = (amount) => {
    if (amount === null || amount === undefined) return `${currSymbol} 0.00`;
    return `${currSymbol} ${Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Assortment summary grouped by destination
  const assortmentSummary = (() => {
    const groups = {};
    orderLines.forEach((line) => {
      const dest = line.destination || 'Unspecified';
      if (!groups[dest]) {
        groups[dest] = { destination: dest, lineCount: 0, totalQty: 0, totalValue: 0 };
      }
      groups[dest].lineCount++;
      groups[dest].totalQty += line.lineQty || 0;
      groups[dest].totalValue += line.lineTotal || 0;
    });
    return Object.values(groups).map((g) => ({
      ...g,
      avgPrice: g.totalQty > 0 ? g.totalValue / g.totalQty : 0,
    }));
  })();

  // Submit (Draft/Referred Back → Confirmed)
  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await changeOrderStatus(orderData.id, ORDER_STATUS.CONFIRMED);
      message.success(`${orderNo} submitted and confirmed`);
      onStatusChange?.();
    } catch {
      message.error('Failed to submit order');
    } finally {
      setActionLoading(false);
    }
  };

  // Refer back (Confirmed → Referred Back)
  const handleReferBack = async () => {
    setActionLoading(true);
    try {
      await changeOrderStatus(orderData.id, ORDER_STATUS.REFERRED_BACK, referBackReason || undefined);
      message.success(`${orderNo} referred back`);
      setShowReferBackInput(false);
      setReferBackReason('');
      onStatusChange?.();
    } catch {
      message.error('Failed to refer back order');
    } finally {
      setActionLoading(false);
    }
  };

  // Print
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

  // Cancel (Confirmed → Cancelled)
  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await changeOrderStatus(orderData.id, ORDER_STATUS.CANCELLED);
      message.success(`${orderNo} cancelled`);
      onStatusChange?.();
    } catch {
      message.error('Failed to cancel order');
    } finally {
      setActionLoading(false);
    }
  };

  // Size breakdown table for a single order line
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
    const grandQty = Object.values(colTotals).reduce((a, b) => a + b, 0);
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
            {/* Price row */}
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
            {/* Color rows */}
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
            {/* Total qty */}
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
            {/* Total value */}
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
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          {/* Left — print */}
          <Button
            icon={<PrinterOutlined />}
            loading={printLoading}
            onClick={handlePrint}
          >
            Print
          </Button>
          {/* Right — action buttons */}
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
          {canReferBackOrder() && status === ORDER_STATUS.CONFIRMED && !showReferBackInput && (
            <Button
              icon={<RollbackOutlined />}
              onClick={() => setShowReferBackInput(true)}
              style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
            >
              Refer Back
            </Button>
          )}
          {canCancelOrder() && status === ORDER_STATUS.CONFIRMED && (
            <Popconfirm
              title="Cancel Order"
              description={`Are you sure you want to cancel order "${orderNo}"? This action cannot be undone.`}
              onConfirm={handleCancel}
              okText="Cancel Order"
              cancelText="No"
              okButtonProps={{ danger: true, loading: actionLoading }}
            >
              <Button
                icon={<StopOutlined />}
                danger
              >
                Cancel Order
              </Button>
            </Popconfirm>
          )}
          <Button onClick={onClose}>Close</Button>
          </Space>
        </div>
      }
    >
      {/* Refer-back input */}
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
                onClick={handleReferBack}
                style={referBackReason.trim().length >= 50 ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16' } : {}}
              >
                Confirm Refer Back
              </Button>
              <Button size="small" onClick={() => { setShowReferBackInput(false); setReferBackReason(''); }}>
                Cancel
              </Button>
            </Space>
          </Space>
        </Card>
      )}

      {/* Existing refer-back reason banner */}
      {existingReferBackReason && status === ORDER_STATUS.REFERRED_BACK && (
        <Card size="small" style={{ marginBottom: 16, borderColor: '#fa8c16', backgroundColor: 'var(--accent-light)' }}>
          <Text strong style={{ color: '#fa8c16' }}>Refer Back Reason: </Text>
          <Text>{existingReferBackReason}</Text>
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
        {remarks && (
          <Descriptions.Item label="Remarks" span={2}>{remarks}</Descriptions.Item>
        )}
      </Descriptions>

      {/* ── Assortment Summary ── */}
      {assortmentSummary.length > 0 && (
        <Card size="small" title="Assortment Summary" style={{ marginBottom: 16 }}>
          <Table
            dataSource={assortmentSummary}
            rowKey="destination"
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Destination',
                dataIndex: 'destination',
                key: 'destination',
                ellipsis: true,
                render: (t) => <Text style={{ fontSize: 12 }}>{t}</Text>,
              },
              { title: 'Lines', dataIndex: 'lineCount', key: 'lineCount', width: 60, align: 'center' },
              {
                title: 'Total Qty',
                dataIndex: 'totalQty',
                key: 'totalQty',
                width: 100,
                align: 'right',
                render: (v) => <Text strong>{v.toLocaleString()}</Text>,
              },
              {
                title: 'Avg Price',
                dataIndex: 'avgPrice',
                key: 'avgPrice',
                width: 100,
                align: 'right',
                render: (v) => `${currSymbol} ${v.toFixed(2)}`,
              },
              {
                title: 'Total Value',
                dataIndex: 'totalValue',
                key: 'totalValue',
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
        const leadTimeDays = line.leadTime != null ? line.leadTime : null;
        return (
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
                  {leadTimeDays != null ? `${leadTimeDays} days` : '—'}
                </Text>
              </Col>
            </Row>
            <Divider style={{ margin: '8px 0' }} />
            {renderSizeBreakdown(line)}
          </Card>
        );
      })}
    </Modal>
  );
};

export default OrderView;
