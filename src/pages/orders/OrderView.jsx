import { useState } from 'react';
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
} from 'antd';
import {
  CheckCircleOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  UndoOutlined,
  StopOutlined,
  EditOutlined,
  SendOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { updateOrder } from '../../services/orderService';
import { hasPermission, canSubmitOrder, canReferBackOrder } from '../../utils/permissions';
import {
  ORDER_STATUS,
  getStatusLabel,
  EDITABLE_STATUSES,
  getCurrencySymbol,
} from '../../utils/orderConstants';

const { Text, Title } = Typography;

// Status config
const STATUS_CONFIG = {
  [ORDER_STATUS.DRAFT]: { color: 'default', icon: <FileTextOutlined /> },
  [ORDER_STATUS.CONFIRMED]: { color: 'green', icon: <CheckCircleOutlined /> },
  [ORDER_STATUS.REFERRED_BACK]: { color: 'orange', icon: <UndoOutlined /> },
  [ORDER_STATUS.IN_PRODUCTION]: { color: 'blue', icon: <ClockCircleOutlined /> },
  [ORDER_STATUS.COMPLETED]: { color: 'cyan', icon: <CheckCircleOutlined /> },
  [ORDER_STATUS.CANCELLED]: { color: 'volcano', icon: <StopOutlined /> },
};

const OrderView = ({ open, orderData, onClose, onStatusChange }) => {
  const navigate = useNavigate();
  const [referBackReason, setReferBackReason] = useState('');
  const [showReferBackInput, setShowReferBackInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!orderData) return null;

  const {
    orderNo,
    status,
    buyerName,
    entryDate,
    orderDate,
    shipDate,
    leadTime,
    currency,
    shipmentMode,
    deliveryTerms,
    allowance,
    paymentTerms,
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

  // Format currency
  const fmtCurrency = (amount) => {
    if (amount === null || amount === undefined) return `${currSymbol} 0.00`;
    return `${currSymbol} ${Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Compute assortment summary
  const assortmentSummary = (() => {
    const groups = {};
    orderLines.forEach((line) => {
      const dest = line.destination || 'Unspecified';
      if (!groups[dest]) {
        groups[dest] = { destination: dest, lineCount: 0, totalQty: 0, totalValue: 0, lineKeys: [] };
      }
      groups[dest].lineCount++;
      groups[dest].totalQty += line.lineQty || 0;
      groups[dest].totalValue += line.lineTotal || 0;
      groups[dest].lineKeys.push(line.key);
    });
    return Object.values(groups).map((g) => ({
      ...g,
      avgPrice: g.totalQty > 0 ? g.totalValue / g.totalQty : 0,
    }));
  })();

  // Submit order
  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await updateOrder(orderData.id, { status: ORDER_STATUS.CONFIRMED });
      message.success(`${orderNo} submitted and confirmed`);
      onStatusChange?.();
    } catch {
      message.error('Failed to submit order');
    } finally {
      setActionLoading(false);
    }
  };

  // Refer back
  const handleReferBack = async () => {
    setActionLoading(true);
    try {
      await updateOrder(orderData.id, {
        status: ORDER_STATUS.REFERRED_BACK,
        referBackReason: referBackReason || undefined,
      });
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

  // Render size breakdown table for a line
  const renderSizeBreakdown = (line) => {
    const { sizes = [], sizePrices = {}, colorRows = [] } = line;
    if (sizes.length === 0) return <Text type="secondary">No sizes configured</Text>;

    // Compute column totals
    const colTotals = {};
    const colValues = {};
    sizes.forEach((s) => {
      colTotals[s] = 0;
      colValues[s] = 0;
    });
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
              <th style={thStyle}>Color/Print</th>
              {sizes.map((s) => (
                <th key={s} style={{ ...thStyle, textAlign: 'center', minWidth: 70 }}>{s}</th>
              ))}
              <th style={{ ...thStyle, textAlign: 'right', minWidth: 80 }}>Total</th>
              <th style={{ ...thStyle, textAlign: 'right', minWidth: 100 }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {/* Price Row */}
            <tr style={{ backgroundColor: 'var(--primary-light)' }}>
              <td style={tdStyle}><Text strong style={{ fontSize: 12, color: '#1890ff' }}>Price ({currency})</Text></td>
              {sizes.map((s) => (
                <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                  <Text style={{ color: '#1890ff' }}>{(sizePrices[s] || 0).toFixed(2)}</Text>
                </td>
              ))}
              <td style={tdStyle}></td>
              <td style={tdStyle}></td>
            </tr>
            {/* Color Rows */}
            {colorRows.map((row) => (
              <tr key={row.key}>
                <td style={tdStyle}><Text>{row.colorName || '-'}</Text></td>
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
            {/* Total Qty Row */}
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
              <td style={tdStyle}></td>
            </tr>
            {/* Total Value Row */}
            <tr style={{ backgroundColor: 'var(--secondary-light)' }}>
              <td style={tdStyle}><Text strong>Total Value</Text></td>
              {sizes.map((s) => (
                <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                  <Text style={{ fontSize: 12 }}>{fmtCurrency(colValues[s])}</Text>
                </td>
              ))}
              <td style={tdStyle}></td>
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
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 } }}
      footer={
        <Space>
          {/* Edit button for editable statuses */}
          {canEdit && (
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                onClose();
                navigate(`/orders/edit/${orderData.id}`);
              }}
            >
              Edit Order
            </Button>
          )}
          {/* Submit for Draft */}
          {canSubmitOrder() && status === ORDER_STATUS.DRAFT && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={actionLoading}
              onClick={handleSubmit}
            >
              Submit Order
            </Button>
          )}
          {/* Refer Back for Confirmed */}
          {canReferBackOrder() && status === ORDER_STATUS.CONFIRMED && !showReferBackInput && (
            <Button
              icon={<RollbackOutlined />}
              onClick={() => setShowReferBackInput(true)}
              style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
            >
              Refer Back
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </Space>
      }
    >
      {/* Refer Back Input */}
      {showReferBackInput && (
        <Card size="small" style={{ marginBottom: 16, borderColor: '#fa8c16' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>Reason for Referring Back:</Text>
            <Input.TextArea
              rows={2}
              placeholder="Enter reason..."
              value={referBackReason}
              onChange={(e) => setReferBackReason(e.target.value)}
            />
            <Space>
              <Button
                type="primary"
                size="small"
                loading={actionLoading}
                onClick={handleReferBack}
                style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16' }}
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

      {/* Existing refer back reason */}
      {existingReferBackReason && status === ORDER_STATUS.REFERRED_BACK && (
        <Card size="small" style={{ marginBottom: 16, borderColor: '#fa8c16', backgroundColor: 'var(--accent-light)' }}>
          <Text strong style={{ color: '#fa8c16' }}>Refer Back Reason: </Text>
          <Text>{existingReferBackReason}</Text>
        </Card>
      )}

      {/* Order Header */}
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Buyer">{buyerName}</Descriptions.Item>
        <Descriptions.Item label="Entry Date">{entryDate ? dayjs(entryDate).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
        <Descriptions.Item label="Order Date">{orderDate ? dayjs(orderDate).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
        <Descriptions.Item label="Ship Date">{shipDate ? dayjs(shipDate).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
        <Descriptions.Item label="Lead Time">{leadTime ? `${leadTime} days` : '-'}</Descriptions.Item>
        <Descriptions.Item label="Currency">{currency || '-'}</Descriptions.Item>
        <Descriptions.Item label="Shipment Mode">{shipmentMode || '-'}</Descriptions.Item>
        <Descriptions.Item label="Delivery Terms">{deliveryTerms || '-'}</Descriptions.Item>
        <Descriptions.Item label="Allowance">{allowance || '-'}</Descriptions.Item>
        <Descriptions.Item label="Payment Terms">{paymentTerms || '-'}</Descriptions.Item>
        <Descriptions.Item label="Payment Days">{paymentDays || '-'}</Descriptions.Item>
        <Descriptions.Item label="Total Qty">
          <Text strong>{(totalOrderQty || 0).toLocaleString()}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Total Value">
          <Text strong style={{ color: 'var(--success-color, #10b981)' }}>
            {fmtCurrency(totalOrderValue)}
          </Text>
        </Descriptions.Item>
        {remarks && <Descriptions.Item label="Remarks" span={3}>{remarks}</Descriptions.Item>}
      </Descriptions>

      {/* Assortment Summary */}
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
                render: (text) => <Text style={{ fontSize: 12 }}>{text}</Text>,
              },
              { title: 'Lines', dataIndex: 'lineCount', key: 'lineCount', width: 70, align: 'center' },
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

      {/* Order Lines */}
      <Title level={5} style={{ marginBottom: 12 }}>
        Order Lines ({orderLines.length})
      </Title>
      {orderLines.map((line, idx) => (
        <Card
          key={line.key}
          size="small"
          style={{ marginBottom: 12 }}
          title={
            <Space>
              <Tag color="blue">#{idx + 1}</Tag>
              <Text strong>{line.description || line.styleNo}</Text>
              <Text type="secondary">({line.styleNo})</Text>
              <Text type="secondary">|</Text>
              <Text>Qty: {(line.lineQty || 0).toLocaleString()}</Text>
              <Text type="secondary">|</Text>
              <Text style={{ color: 'var(--success-color, #10b981)' }}>
                {fmtCurrency(line.lineTotal)}
              </Text>
            </Space>
          }
        >
          <Row gutter={[16, 10]} style={{ marginBottom: 12 }}>
            <Col xs={12} sm={6}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Buyer PO</Text>
              <Text strong>{line.buyerPoNo || '-'}</Text>
            </Col>
            <Col xs={12} sm={6}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Item Group</Text>
              <Text strong>{line.itemGroup || '-'}</Text>
            </Col>
            <Col xs={12} sm={6}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Base Price</Text>
              <Text strong>{fmtCurrency(line.basePrice)}</Text>
            </Col>
            <Col xs={12} sm={6}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Dispatch Date</Text>
              <Text strong>{line.dispatchDate ? dayjs(line.dispatchDate).format('DD-MMM-YYYY') : '-'}</Text>
            </Col>
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Destination</Text>
              <Text strong>{line.destination || '-'}</Text>
            </Col>
            <Col xs={12} sm={6}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Fabric</Text>
              <Text strong>{line.fabric || '-'}</Text>
            </Col>
            <Col xs={12} sm={6}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Material</Text>
              <Text strong>{line.material || '-'}</Text>
            </Col>
            {line.gsm && (
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>GSM</Text>
                <Text strong>{line.gsm}</Text>
              </Col>
            )}
            {line.season && (
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Season</Text>
                <Text strong>{line.season}</Text>
              </Col>
            )}
            {line.brand && (
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Brand</Text>
                <Text strong>{line.brand}</Text>
              </Col>
            )}
            {line.collection && (
              <Col xs={12} sm={6}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Collection</Text>
                <Text strong>{line.collection}</Text>
              </Col>
            )}
          </Row>
          <Divider style={{ margin: '8px 0' }} />
          {renderSizeBreakdown(line)}
        </Card>
      ))}
    </Modal>
  );
};

// Table cell styles
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

export default OrderView;
