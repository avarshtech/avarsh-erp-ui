import { useState, useEffect, useMemo } from 'react';
import { Modal, Row, Col, Card, Table, Tag, Typography, Avatar, Divider, Alert, Space, Skeleton, Button, App } from 'antd';
import { DownloadOutlined, FilePdfOutlined, FileImageOutlined } from '@ant-design/icons';
import { getFilesByEntity, downloadFileAsBlob } from '../../../services/core/fileService';
import useResponsive from '../../../hooks/useResponsive';
import {
  ShopOutlined,
  CalendarOutlined,
  UserOutlined,
  FileTextOutlined,
  NumberOutlined,
  InboxOutlined,
  ProfileOutlined,
  AppstoreOutlined,
  DollarOutlined,
  ColumnHeightOutlined,
} from '@ant-design/icons';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import { GRN_STATUS_CONFIG } from '../../../utils/statusConfig';
import { GRN_STATUS, getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { formatNumber, formatDate } from '../../../utils/formatters';
import { generateGRNPdf } from '../../../utils/grnPdfGenerator';
import GRNApprovalActions from './GRNApprovalActions';
import ApprovalHistoryPanel from '../../../components/approval/ApprovalHistoryPanel';

const { Text, Title } = Typography;

// Hero accent map — left-border colour per GRN status. Matches the palette in
// GRN_STATUS_CONFIG so each state looks distinct in the modal header.
const HERO_ACCENT = {
  [GRN_STATUS.DRAFT]:            '#8c8c8c',              // default / gray
  [GRN_STATUS.QC_PENDING]:       '#2f54eb',              // geekblue
  [GRN_STATUS.PENDING_REVERSAL]: '#faad14',              // gold
  [GRN_STATUS.REVERSED]:         '#722ed1',              // purple
  [GRN_STATUS.CLOSED]:           'var(--success-color)', // green
};

const labelStyle = { fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 };

const fabricRollColumns = [
  { title: 'Roll #', dataIndex: 'rollNumber', align: 'center', width: 90 },
  { title: 'Item Code', dataIndex: 'itemCode', align: 'center', width: 130, render: (v, r) => r.variantCode || '—' },
  { title: 'Description', dataIndex: 'description', align: 'center', ellipsis: true },
  { title: 'Width', dataIndex: 'width', align: 'center', width: 70 },
  { title: 'GSM', dataIndex: 'gsm', align: 'center', width: 70 },
  { title: 'Receiving Qty', dataIndex: 'receivingQty', align: 'center', width: 110, render: (v) => formatNumber(v, 2) },
  { title: 'UOM', dataIndex: 'uom', align: 'center', width: 70 },
  { title: 'Shade Lot', dataIndex: 'shadeLot', align: 'center', width: 100 },
];

const accItemColumns = [
  { title: 'Item Code', dataIndex: 'itemCode', align: 'center', width: 140, render: (v, r) => r.variantCode || '—' },
  { title: 'Description', dataIndex: 'description', align: 'center', ellipsis: true },
  { title: 'Color', dataIndex: 'color', align: 'center', width: 90 },
  { title: 'Size', dataIndex: 'size', align: 'center', width: 80 },
  { title: 'Receiving Qty', dataIndex: 'receivingQty', align: 'center', width: 110, render: (v) => formatNumber(v) },
  { title: 'UOM', dataIndex: 'uom', align: 'center', width: 70 },
];

const cartonColumns = [
  { title: 'Carton #', dataIndex: 'cartonNumber', align: 'center', width: 100 },
  { title: 'Item', dataIndex: 'itemDescription', align: 'center', ellipsis: true },
  { title: 'Quantity', dataIndex: 'quantity', align: 'center', width: 100, render: (v) => formatNumber(v) },
  { title: 'UOM', dataIndex: 'uom', align: 'center', width: 80 },
];

const flattenFabricRolls = (grn) => {
  if (Array.isArray(grn?.rolls) && grn.rolls.length > 0) return grn.rolls;
  return (grn?.lineItems || []).flatMap((li) => li.rolls || []);
};

const GRNViewModal = ({ open, onClose, grn: initialGrn }) => {
  const { message } = App.useApp();
  const [grn, setGrn] = useState(initialGrn);
  const [attachments, setAttachments] = useState([]);
  const { isMobile, isTablet } = useResponsive();
  const modalWidth = isMobile ? '100vw' : isTablet ? '94vw' : 1200;

  useEffect(() => { setGrn(initialGrn); }, [initialGrn]);

  // Fetch file attachments from GCS whenever the modal opens for a new GRN.
  useEffect(() => {
    if (!open || !initialGrn?.id) { setAttachments([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const files = await getFilesByEntity('GRN', initialGrn.id);
        if (!cancelled) setAttachments(files || []);
      } catch (err) {
        console.warn('Failed to load GRN attachments:', err);
        if (!cancelled) setAttachments([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, initialGrn?.id]);

  const handleDownload = async (file) => {
    try {
      const blob = await downloadFileAsBlob(file.fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalFilename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke the blob URL after a short delay so the browser can finalise the download
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Failed to download file:', err);
      message.error('Failed to download file');
    }
  };

  const isFabric = grn?.type === 'Fabric';
  const accent = HERO_ACCENT[grn?.status] || 'var(--primary-color)';

  const rolls = useMemo(() => grn ? flattenFabricRolls(grn) : [], [grn]);

  const totals = useMemo(() => {
    if (!grn) return { receivingQty: 0, value: 0, lineItems: 0, rolls: 0, cartons: 0 };
    if (isFabric) {
      const receivingQty = rolls.reduce((s, r) => s + (Number(r.receivingQty) || 0), 0);
      const value = rolls.reduce((s, r) => s + (Number(r.receivingQty) || 0) * (Number(r.rate) || 0), 0);
      return { receivingQty, value, lineItems: (grn.lineItems || []).length || (new Set(rolls.map((r) => r.poLineItemId))).size, rolls: rolls.length, cartons: 0 };
    }
    const items = grn.items || [];
    const receivingQty = items.reduce((s, i) => s + (Number(i.receivingQty) || 0), 0);
    const value = items.reduce((s, i) => s + (Number(i.receivingQty) || 0) * (Number(i.rate) || 0), 0);
    return { receivingQty, value, lineItems: items.length, rolls: 0, cartons: (grn.cartons || []).length };
  }, [grn, isFabric, rolls]);

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      width={modalWidth}
      centered
      closable
      className="po-view-modal"
      styles={{
        body: { maxHeight: 'calc(85vh - 60px)', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        header: { border: 'none', padding: 0, margin: 0, minHeight: 0 },
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
          <Space size="middle">
            {grn && grn.status !== GRN_STATUS.DRAFT && (
              <ActionButton action="print" text="Print GRN" onClick={() => generateGRNPdf(grn)} />
            )}
            <GRNApprovalActions grn={grn} onUpdated={(updated) => setGrn(updated)} />
          </Space>
          <ActionButton action="close" text="Close" onClick={onClose} />
        </div>
      }
    >
      {!grn ? (
        <div style={{ padding: 32, flex: 1, overflowY: 'auto' }}>
          <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 2 }} style={{ marginBottom: 24 }} />
          <Divider />
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : (
        <>
          {/* ===== HERO HEADER ===== */}
          <div
            style={{
              background: 'var(--card-bg, #fff)',
              borderBottom: '2px solid var(--border-color, #f0f0f0)',
              padding: '28px 32px 20px',
              borderLeft: `4px solid ${accent}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Title level={3} style={{ margin: 0, letterSpacing: '-0.02em' }}>{grn.grnNumber || '—'}</Title>
                  <StatusTag status={grn.status} config={GRN_STATUS_CONFIG} getLabel={getInventoryStatusLabel} style={{ fontSize: 13, padding: '3px 14px' }} />
                  <Tag color={isFabric ? 'blue' : 'purple'} style={{ borderRadius: 20, fontSize: 12 }}>{grn.type} GRN</Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShopOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
                    <Text strong style={{ fontSize: 15 }}>{grn.supplier || '—'}</Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarOutlined style={{ color: 'var(--text-secondary)', fontSize: 13 }} />
                    <Text type="secondary">{formatDate(grn.grnDate)}</Text>
                  </div>
                  {grn.createdByName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <UserOutlined style={{ color: 'var(--text-secondary)', fontSize: 13 }} />
                      <Text type="secondary">Created by {grn.createdByName}</Text>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Total Receiving</Text>
                <Text strong style={{ fontSize: 28, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {formatNumber(totals.receivingQty, 2)}
                </Text>
              </div>
            </div>
          </div>

          {/* ===== BODY ===== */}
          <div style={{ padding: '20px 32px 24px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {/* Detail + Summary cards row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              <Col xs={24} md={16}>
                <Card size="small" style={{ height: '100%', borderRadius: 12 }} styles={{ body: { padding: '16px 20px' } }}>
                  <Row gutter={[24, 14]}>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>GRN Number</Text>
                      <Text strong style={{ fontSize: 14, fontFamily: 'monospace' }}>{grn.grnNumber || '—'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>PO Number</Text>
                      <Text strong style={{ fontSize: 14, fontFamily: 'monospace' }}>{grn.poNumber || '—'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>Supplier</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar size={24} style={{ backgroundColor: 'var(--primary-color)', fontSize: 11, flexShrink: 0 }}>{(grn.supplier || '?')[0]}</Avatar>
                        <Text strong style={{ fontSize: 14 }}>{grn.supplier || '—'}</Text>
                      </div>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>Buyer</Text>
                      <Text strong style={{ fontSize: 14 }}>{grn.buyerName || '—'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>Style</Text>
                      <Text strong style={{ fontSize: 14 }}>{grn.styleNumber || '—'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>Challan / Invoice #</Text>
                      <Text strong style={{ fontSize: 14 }}>{grn.challanNo || '—'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>Invoice Date</Text>
                      <Text strong style={{ fontSize: 14 }}>{grn.invoiceDate ? formatDate(grn.invoiceDate) : '—'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>DC Date</Text>
                      <Text strong style={{ fontSize: 14 }}>{grn.deliveryChallanDate ? formatDate(grn.deliveryChallanDate) : '—'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>Vehicle</Text>
                      <Text strong style={{ fontSize: 14 }}>{grn.vehicleNumber || '—'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>Transporter</Text>
                      <Text strong style={{ fontSize: 14 }}>{grn.transporter || '—'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>Created By</Text>
                      <Text strong style={{ fontSize: 14 }}>{grn.createdByName || '—'}</Text>
                    </Col>
                    {grn.remarks && (
                      <Col span={24}>
                        <Text type="secondary" style={labelStyle}>Remarks</Text>
                        <Text style={{ fontSize: 13 }}>{grn.remarks}</Text>
                      </Col>
                    )}
                  </Row>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card
                  size="small"
                  style={{ height: '100%', borderRadius: 12 }}
                  styles={{ body: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 } }}
                >
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Receipt Summary
                  </Text>

                  {/* Headline Total Receiving — neutral tinted surface, no primary fill */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 10,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'var(--bg-tertiary, rgba(99, 102, 241, 0.08))',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ColumnHeightOutlined style={{ fontSize: 18 }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Total Receiving
                      </Text>
                      <Text strong style={{ fontSize: 22, lineHeight: 1.2, color: 'var(--text-primary)' }}>
                        {formatNumber(totals.receivingQty, 2)}
                      </Text>
                    </div>
                  </div>

                  {/* Breakdown rows — icon + label + value, neutral styling */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Space size={8}>
                        <AppstoreOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
                        <Text type="secondary" style={{ fontSize: 13 }}>Line Items</Text>
                      </Space>
                      <Text strong style={{ fontSize: 14 }}>{totals.lineItems}</Text>
                    </div>
                    {isFabric ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Space size={8}>
                          <NumberOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
                          <Text type="secondary" style={{ fontSize: 13 }}>Rolls</Text>
                        </Space>
                        <Text strong style={{ fontSize: 14 }}>{totals.rolls}</Text>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Space size={8}>
                          <InboxOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
                          <Text type="secondary" style={{ fontSize: 13 }}>Cartons</Text>
                        </Space>
                        <Text strong style={{ fontSize: 14 }}>{totals.cartons}</Text>
                      </div>
                    )}
                    <Divider style={{ margin: '2px 0' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Space size={8}>
                        <DollarOutlined style={{ color: 'var(--success-color)', fontSize: 14 }} />
                        <Text type="secondary" style={{ fontSize: 13 }}>Receipt Value</Text>
                      </Space>
                      <Text strong style={{ fontSize: 14, color: 'var(--success-color)' }}>
                        {formatNumber(totals.value, 2)}
                      </Text>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>

            {(grn.referBackReason || grn.reversalReason) && (
              <div style={{ marginBottom: 20 }}>
                {grn.referBackReason && <Alert type="warning" showIcon style={{ borderRadius: 10, marginBottom: 8 }} message="Refer-back reason" description={grn.referBackReason} />}
                {grn.reversalReason && <Alert type="error" showIcon style={{ borderRadius: 10 }} message="Reversal reason" description={grn.reversalReason} />}
              </div>
            )}

            {/* Roll / Item / Carton tables */}
            {isFabric && rolls.length > 0 && (
              <Card
                size="small"
                style={{ marginBottom: 20, borderRadius: 12 }}
                styles={{ body: { padding: '14px 20px' } }}
                title={
                  <Space>
                    <NumberOutlined style={{ color: 'var(--primary-color)' }} />
                    <Text strong style={{ fontSize: 14 }}>Roll Details</Text>
                  </Space>
                }
              >
                <Table rowKey={(r, i) => `${r.rollNumber}-${i}`} columns={fabricRollColumns} dataSource={rolls} pagination={false} size="small" scroll={{ x: 900 }} />
              </Card>
            )}

            {!isFabric && grn.items?.length > 0 && (
              <Card
                size="small"
                style={{ marginBottom: 20, borderRadius: 12 }}
                styles={{ body: { padding: '14px 20px' } }}
                title={
                  <Space>
                    <ProfileOutlined style={{ color: 'var(--primary-color)' }} />
                    <Text strong style={{ fontSize: 14 }}>Items</Text>
                  </Space>
                }
              >
                <Table rowKey={(r, i) => `${r.itemCode}-${i}`} columns={accItemColumns} dataSource={grn.items} pagination={false} size="small" scroll={{ x: 800 }} />
              </Card>
            )}

            {!isFabric && grn.cartons?.length > 0 && (
              <Card
                size="small"
                style={{ marginBottom: 20, borderRadius: 12 }}
                styles={{ body: { padding: '14px 20px' } }}
                title={
                  <Space>
                    <InboxOutlined style={{ color: 'var(--primary-color)' }} />
                    <Text strong style={{ fontSize: 14 }}>Cartons</Text>
                  </Space>
                }
              >
                <Table rowKey={(r, i) => `${r.cartonNumber}-${i}`} columns={cartonColumns} dataSource={grn.cartons} pagination={false} size="small" scroll={{ x: 600 }} />
              </Card>
            )}

            {attachments.length > 0 && (
              <Card
                size="small"
                style={{ marginBottom: 20, borderRadius: 12 }}
                styles={{ body: { padding: '14px 20px' } }}
                title={
                  <Space>
                    <FileTextOutlined style={{ color: 'var(--primary-color)' }} />
                    <Text strong style={{ fontSize: 14 }}>Attachments</Text>
                  </Space>
                }
              >
                <Row gutter={[16, 12]}>
                  {attachments.map((f) => {
                    const isImage = (f.fileType || '').startsWith('image/');
                    const isPdf = (f.fileType || '').includes('pdf');
                    const categoryLabel = f.fileCategory === 'INVOICE'
                      ? 'Supplier Invoice'
                      : f.fileCategory === 'ATTACHMENT'
                      ? 'Delivery Challan'
                      : f.fileCategory;
                    return (
                      <Col xs={24} md={12} key={f.fileId}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            border: '1px solid var(--border-color, #f0f0f0)',
                            borderRadius: 8,
                            background: 'var(--bg-secondary, #fafafa)',
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: 'var(--bg-tertiary, rgba(99, 102, 241, 0.08))',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: isPdf ? '#d32f2f' : 'var(--primary-color)',
                            }}
                          >
                            {isImage ? <FileImageOutlined style={{ fontSize: 18 }} /> : <FilePdfOutlined style={{ fontSize: 18 }} />}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Text type="secondary" style={labelStyle}>{categoryLabel}</Text>
                            <Text style={{ fontSize: 13, display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {f.originalFilename}
                            </Text>
                          </div>
                          <Button
                            type="text"
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownload(f)}
                            aria-label="Download attachment"
                          />
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            )}

            <ApprovalHistoryPanel
              entityType="GRN_REVERSAL"
              entityId={grn?.id}
              style={{ marginTop: 16 }}
            />
          </div>
        </>
      )}
    </Modal>
  );
};

export default GRNViewModal;
