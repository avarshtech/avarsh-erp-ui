import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Tag,
  Typography,
  Spin,
  Card,
  Table,
  Row,
  Col,
  Space,
  Empty,
  Badge,
} from 'antd';
import {
  HistoryOutlined,
  ClockCircleOutlined,
  UserOutlined,
  NumberOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getPoVersionHistory } from '../../services/purchaseOrderService';
import StatusTag from '../../components/StatusTag';
import { PO_STATUS_CONFIG } from '../../utils/statusConfig';
import { getStatusLabel } from '../../utils/poStatusConstants';
import { formatCurrency } from '../../utils/formatters';

const { Text, Title } = Typography;

const POVersionHistory = ({ open, onClose, poId, poNumber }) => {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);

  useEffect(() => {
    if (open && poId) {
      loadVersions();
    }
    if (!open) {
      setVersions([]);
      setSelectedVersion(null);
    }
  }, [open, poId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await getPoVersionHistory(poId);
      setVersions(data || []);
      if (data?.length > 0) setSelectedVersion(data[0]);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  };

  const snapshot = selectedVersion?.snapshot;

  const lineItems = useMemo(() => {
    if (!snapshot?.lineItems) return [];
    return snapshot.lineItems;
  }, [snapshot]);

  const lineItemColumns = useMemo(() => [
    { title: '#', width: 40, align: 'center', render: (_, __, i) => <Text type="secondary">{i + 1}</Text> },
    {
      title: 'Item',
      key: 'item',
      width: 200,
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.processName || r.itemName || '-'}</Text>
          {r.itemCode && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{r.itemCode}</Text>}
        </div>
      ),
    },
    { title: 'Description', dataIndex: 'description', width: 140, render: (v) => <span style={{ fontSize: 12 }}>{v || '-'}</span> },
    { title: 'Qty', key: 'qty', width: 70, align: 'center', render: (_, r) => <Text strong>{r.quantity || 0}</Text> },
    {
      title: 'Unit Price', dataIndex: 'unitPrice', width: 100, align: 'right',
      render: (v) => formatCurrency(v),
    },
    {
      title: 'Amount', key: 'amount', width: 110, align: 'right',
      render: (_, r) => <Text strong style={{ color: 'var(--success-color, #52c41a)' }}>{formatCurrency(r.totalAmount || 0)}</Text>,
    },
  ], []);

  // Compute differences between adjacent versions
  const getDiff = (current, previous) => {
    if (!previous || !current) return [];
    const changes = [];
    const cs = current.snapshot;
    const ps = previous.snapshot;
    if (!cs || !ps) return changes;

    if (cs.supplierName !== ps.supplierName) changes.push(`Supplier: ${ps.supplierName} → ${cs.supplierName}`);
    if (cs.deliveryDate !== ps.deliveryDate) changes.push(`Delivery: ${ps.deliveryDate || '-'} → ${cs.deliveryDate || '-'}`);
    if (String(cs.grandTotal) !== String(ps.grandTotal)) changes.push(`Total: ${formatCurrency(ps.grandTotal)} → ${formatCurrency(cs.grandTotal)}`);

    const curLines = cs.lineItems?.length || 0;
    const prevLines = ps.lineItems?.length || 0;
    if (curLines !== prevLines) changes.push(`Items: ${prevLines} → ${curLines}`);

    if (cs.remarks !== ps.remarks) changes.push('Remarks updated');

    return changes;
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HistoryOutlined style={{ color: 'var(--primary-color)', fontSize: 18 }} />
          <span>Version History</span>
          {poNumber && <Tag style={{ borderRadius: 20, fontSize: 12 }}>{poNumber}</Tag>}
        </div>
      }
      open={open}
      onCancel={onClose}
      width={1100}
      footer={null}
      style={{ top: 24 }}
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto', padding: 0 } }}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : versions.length === 0 ? (
        <div style={{ padding: 40 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary">No version history available. Versions are captured each time a PO is submitted for approval.</Text>}
          />
        </div>
      ) : (
        <Row style={{ height: '100%' }}>
          {/* Left sidebar: Version timeline */}
          <Col xs={24} md={7} style={{ borderRight: '1px solid var(--border-color, #f0f0f0)', padding: '20px 0', background: 'var(--bg-secondary)' }}>
            <div style={{ padding: '0 16px 12px' }}>
              <Text strong style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                Versions ({versions.length})
              </Text>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0 12px' }}>
              {versions.map((ver, idx) => {
                const isSelected = selectedVersion?.id === ver.id;
                const prev = idx < versions.length - 1 ? versions[idx + 1] : null;
                const changes = getDiff(ver, prev);
                return (
                  <div
                    key={ver.id}
                    onClick={() => setSelectedVersion(ver)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      marginBottom: 6,
                      border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color, #f0f0f0)',
                      background: isSelected ? 'var(--primary-light)' : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Tag color={isSelected ? 'blue' : 'default'} style={{ borderRadius: 12, fontSize: 12, margin: 0 }}>
                        v{ver.versionNumber}
                      </Tag>
                      {idx === 0 && <Tag color="green" style={{ fontSize: 10, borderRadius: 10, margin: 0 }}>Latest</Tag>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <ClockCircleOutlined style={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                      <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(ver.submittedAt).format('DD MMM YYYY, HH:mm')}</Text>
                    </div>
                    {ver.submittedByName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <UserOutlined style={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                        <Text type="secondary" style={{ fontSize: 11 }}>{ver.submittedByName}</Text>
                      </div>
                    )}
                    {changes.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {changes.slice(0, 3).map((c, ci) => (
                          <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <SwapOutlined style={{ fontSize: 10, color: 'var(--warning-color)' }} />
                            <Text style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{c}</Text>
                          </div>
                        ))}
                        {changes.length > 3 && <Text type="secondary" style={{ fontSize: 10, paddingLeft: 14 }}>+{changes.length - 3} more</Text>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Col>

          {/* Right panel: Version detail */}
          <Col xs={24} md={17} style={{ padding: '20px 24px' }}>
            {selectedVersion && snapshot ? (
              <>
                {/* Version header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <Title level={4} style={{ margin: 0 }}>Version {selectedVersion.versionNumber}</Title>
                      <StatusTag status={snapshot.status} config={PO_STATUS_CONFIG} getLabel={getStatusLabel} />
                    </div>
                    <Space size="large">
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {dayjs(selectedVersion.submittedAt).format('DD MMM YYYY, HH:mm:ss')}
                      </Text>
                      {selectedVersion.submittedByName && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <UserOutlined style={{ marginRight: 4 }} />
                          {selectedVersion.submittedByName}
                        </Text>
                      )}
                    </Space>
                    {selectedVersion.remarks && (
                      <div style={{ marginTop: 6 }}>
                        <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>{selectedVersion.remarks}</Text>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Grand Total</Text>
                    <Text strong style={{ fontSize: 22, color: 'var(--primary-color)', lineHeight: 1 }}>{formatCurrency(snapshot.grandTotal)}</Text>
                  </div>
                </div>

                {/* Snapshot details */}
                <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }} styles={{ body: { padding: '14px 18px' } }}>
                  <Row gutter={[20, 12]}>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Supplier</Text>
                      <Text strong style={{ fontSize: 13 }}>{snapshot.supplierName || '-'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PO Date</Text>
                      <Text strong style={{ fontSize: 13 }}>{snapshot.poDate ? dayjs(snapshot.poDate).format('DD MMM YYYY') : '-'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Delivery Date</Text>
                      <Text strong style={{ fontSize: 13 }}>{snapshot.deliveryDate ? dayjs(snapshot.deliveryDate).format('DD MMM YYYY') : '-'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subtotal</Text>
                      <Text style={{ fontSize: 13 }}>{formatCurrency(snapshot.subtotal)}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tax</Text>
                      <Text style={{ fontSize: 13 }}>{formatCurrency(snapshot.taxAmount || 0)}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Items</Text>
                      <Text strong style={{ fontSize: 13 }}>{lineItems.length}</Text>
                    </Col>
                    {snapshot.remarks && (
                      <Col span={24}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Remarks</Text>
                        <Text style={{ fontSize: 13 }}>{snapshot.remarks}</Text>
                      </Col>
                    )}
                  </Row>
                </Card>

                {/* Line items */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <NumberOutlined style={{ color: 'var(--primary-color)', fontSize: 13 }} />
                    <Text strong style={{ fontSize: 14 }}>Line Items</Text>
                    <Badge count={lineItems.length} style={{ backgroundColor: 'var(--primary-color)' }} />
                  </div>
                  <Table
                    dataSource={lineItems}
                    columns={lineItemColumns}
                    pagination={false}
                    size="small"
                    scroll={{ x: 600 }}
                    rowKey={(r, i) => r.id || i}
                    style={{ borderRadius: 8, overflow: 'hidden' }}
                  />
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                <Text type="secondary">Select a version to view details</Text>
              </div>
            )}
          </Col>
        </Row>
      )}
    </Modal>
  );
};

export default POVersionHistory;
