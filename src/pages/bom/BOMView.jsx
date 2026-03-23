import { useState, useEffect } from 'react';
import {
  Modal, Tag, Space, Typography, Button, Spin, Skeleton, Card, Row, Col, Tooltip, message,
} from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, AppstoreOutlined, ScissorOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { getStatusLabel, BOM_STATUS, calcPurchaseQty } from '../../utils/bomConstants';
import { getBomById } from '../../services/bomService';
import { getFilesByEntity, downloadFileAsBlob } from '../../services/fileService';

const { Text, Title } = Typography;

const STATUS_CONFIG = {
  [BOM_STATUS.DRAFT]:   { color: 'default', icon: <FileTextOutlined /> },
  [BOM_STATUS.CREATED]: { color: 'green',   icon: <CheckCircleOutlined /> },
};

const variantsToTags = (variants) => {
  if (!variants || typeof variants !== 'object') return [];
  return Object.entries(variants)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}: ${v}`);
};

const processToLabel = (proc) => {
  if (typeof proc === 'string') return proc;
  if (typeof proc === 'object' && proc !== null) return proc.processName || proc.name || String(proc.id);
  return String(proc);
};

const isFabricLine = (line) => (line?.categoryName || '').toLowerCase().includes('fabric');

const BOMView = ({ open, bomData, onClose }) => {
  const [fullBom, setFullBom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cadFileNames, setCadFileNames] = useState({}); // { lineId: filename }

  useEffect(() => {
    if (!open || !bomData) { setFullBom(null); return; }
    if (bomData.lines && bomData.lines.length > 0) { setFullBom(bomData); return; }
    const fetchFull = async () => {
      setLoading(true);
      try {
        const data = await getBomById(bomData.id);
        setFullBom(data);
      } catch {
        message.error('Failed to load BOM details');
        setFullBom(bomData);
      } finally {
        setLoading(false);
      }
    };
    fetchFull();
  }, [open, bomData]);

  // Load CAD filenames for fabric lines
  useEffect(() => {
    const bLines = (fullBom || bomData)?.lines || [];
    if (!open || !bLines.length) return;
    setCadFileNames({});
    const fabIds = bLines.filter((l) => l.id && isFabricLine(l)).map((l) => l.id);
    if (!fabIds.length) return;
    fabIds.forEach((lineId) => {
      getFilesByEntity('BOM_LINE', lineId)
        .then((files) => {
          const cadFile = (files?.data || files || []).find((f) => f.fileCategory === 'CAD_MARKER');
          if (cadFile) {
            setCadFileNames((prev) => ({ ...prev, [lineId]: cadFile.originalFilename || 'CAD Marker' }));
          }
        })
        .catch(() => {});
    });
  }, [open, fullBom, bomData]);

  if (!bomData) return null;
  const bom = fullBom || bomData;
  const { orderNo, status, styleName, garmentName, material, buyerName, season, orderQty, remarks, lines = [] } = bom;
  const statusConfig = STATUS_CONFIG[status] || {};

  const fabricLines = lines.filter(isFabricLine);
  const trimLines = lines.filter((l) => !isFabricLine(l));

  // Download CAD marker file for a BOM line
  const handleCadDownload = async (lineId) => {
    try {
      const files = await getFilesByEntity('BOM_LINE', lineId);
      const cadFile = (files?.data || files || []).find((f) => f.fileCategory === 'CAD_MARKER');
      if (!cadFile) { message.info('No CAD marker file found'); return; }
      const blob = await downloadFileAsBlob(cadFile.fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cadFile.originalFilename || 'cad-marker';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      message.error('Failed to download CAD marker');
    }
  };

  // Compute purchase qty for a line
  const getLinePurchaseQty = (record) => {
    const totalQty = record.totalQty;
    if (!totalQty) return null;
    const allowances = record.processAllowances || [];
    if (allowances.length === 0) return null;
    const totalLoss = allowances.reduce((s, a) => s + (Number(a.processLossPercent) || 0), 0);
    const totalRej = allowances.reduce((s, a) => s + (Number(a.rejectionPercent) || 0), 0);
    const totalShip = allowances.reduce((s, a) => s + (Number(a.shipmentAllowancePercent) || 0), 0);
    return calcPurchaseQty(totalQty, totalLoss, totalRej + totalShip);
  };

  // Render a single BOM line card. When wrap=false, returns Card without Col wrapper.
  const renderLineCard = (line, idx, wrap = true) => {
    const fabric = isFabricLine(line);
    const cMode = line.consumptionMode || 'SIMPLE';
    const isMatrix = !fabric && (cMode === 'SIZE_WISE' || cMode === 'VARIANT_PER_SIZE');
    const purchaseQty = getLinePurchaseQty(line);
    const parts = line.partsName ? (Array.isArray(line.partsName) ? line.partsName : [line.partsName]) : [];
    const processes = line.processes || [];
    const variantTags = variantsToTags(line.variants);

    const card = (
        <Card
          size="small"
          style={{
            borderRadius: 10, height: '100%',
            borderLeft: `4px solid ${fabric ? 'var(--primary-color, #6366f1)' : '#10b981'}`,
          }}
          styles={{ body: { padding: '16px 20px' } }}
        >
          {/* Header: Item name + code + category */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text strong style={{ fontSize: 14 }}>{line.itemName || '-'}</Text>
                {line.itemCode && <Text type="secondary" style={{ fontSize: 11 }}>({line.itemCode})</Text>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Tag style={{ margin: 0, fontSize: 10 }}>{line.categoryName || '-'}</Tag>
                <Tag style={{ margin: 0, fontSize: 10 }}>{line.subCategoryName || '-'}</Tag>
                {fabric && <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>Fabric</Tag>}
                {!fabric && (
                  <Tag color="cyan" style={{ margin: 0, fontSize: 10 }}>
                    {cMode === 'SIZE_WISE' ? 'Size-wise' : cMode === 'VARIANT_PER_SIZE' ? 'Variant/size' : 'Simple'}
                  </Tag>
                )}
              </div>
            </div>
            {/* UOM shown inline with values below */}
          </div>

          {/* Variant tags (fabric) */}
          {fabric && variantTags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
              {variantTags.map((t) => (
                <Tag key={t} className="bom-variant-tag" style={{ margin: 0, fontSize: 10 }}>{t}</Tag>
              ))}
            </div>
          )}

          {/* Parts */}
          {parts.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <Text type="secondary" style={{ fontSize: 10 }}>Parts</Text>
              <div style={{ fontSize: 12 }}>{parts.join(', ')}</div>
            </div>
          )}

          {/* Processes */}
          {processes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>Process</Text>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {processes.map((p, i) => (
                  <Tag key={i} color="blue" style={{ margin: 0, fontSize: 10 }}>{processToLabel(p)}</Tag>
                ))}
              </div>
            </div>
          )}

          {/* Quantities */}
          <div style={{
            display: 'flex', gap: 16, flexWrap: 'wrap',
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--bg-secondary, #f6f8fa)',
            border: '1px solid var(--border-color, #e8e8e8)',
          }}>
            <div>
              <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                {isMatrix ? 'Matrix Total' : 'Consumption'}
              </Text>
              <Text strong style={{ fontSize: 14 }}>
                {isMatrix
                  ? (line.totalQty ? Number(line.totalQty).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—')
                  : (line.consumptionPerGarment != null ? Number(line.consumptionPerGarment).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—')
                }
                {' '}<Text type="secondary" style={{ fontSize: 10 }}>{(line.uom || '').toUpperCase()}</Text>
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Total Qty</Text>
              <Text strong style={{ fontSize: 14, color: 'var(--primary-color, #6366f1)' }}>
                {line.totalQty ? Number(line.totalQty).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                {' '}<Text type="secondary" style={{ fontSize: 10 }}>{(line.uom || '').toUpperCase()}</Text>
              </Text>
            </div>
            {purchaseQty != null && (
              <div>
                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Purchase Qty</Text>
                <Text strong style={{ fontSize: 14, color: '#10b981' }}>
                  {purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  {' '}<Text type="secondary" style={{ fontSize: 10 }}>{(line.uom || '').toUpperCase()}</Text>
                </Text>
              </div>
            )}
            {/* CAD download for fabric lines */}
            {fabric && line.id && cadFileNames[line.id] && (
              <div style={{ marginLeft: 'auto' }}>
                <Tooltip title={cadFileNames[line.id]}>
                  <Button
                    size="small"
                    type="text"
                    icon={<DownloadOutlined />}
                    onClick={() => handleCadDownload(line.id)}
                    style={{ fontSize: 11, color: 'var(--primary-color, #6366f1)' }}
                  >
                    CAD Marker
                  </Button>
                </Tooltip>
              </div>
            )}
          </div>
        </Card>
    );
    if (!wrap) return card;
    return <Col xs={24} md={12} key={line.id || idx}>{card}</Col>;
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text strong style={{ fontSize: 18 }}>{orderNo || 'BOM'}</Text>
          <Tag color={statusConfig.color} icon={statusConfig.icon} style={{ borderRadius: 20, fontSize: 12 }}>
            {getStatusLabel(status)}
          </Tag>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={1000}
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', padding: '20px 24px' } }}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {loading ? (
        <div style={{ padding: '8px 0' }}>
          <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Col xs={12} sm={8} md={4} key={i}>
                <Skeleton.Input active size="small" style={{ width: '100%', height: 48 }} block />
              </Col>
            ))}
          </Row>
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      ) : (
        <>
          {/* General Info Cards */}
          <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
            {[
              { label: 'Style', value: styleName },
              { label: 'Garment', value: garmentName },
              { label: 'Buyer', value: buyerName },
              { label: 'Material', value: material },
              { label: 'Season', value: season },
              { label: 'Order Qty', value: orderQty ? orderQty.toLocaleString() : '-', highlight: true },
            ].map((item) => (
              <Col xs={12} sm={8} md={4} key={item.label}>
                <div style={{
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--bg-secondary, #f6f8fa)',
                  border: '1px solid var(--border-color, #e8e8e8)',
                  height: '100%',
                }}>
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{item.label}</Text>
                  <Text strong style={{ fontSize: 13, color: item.highlight ? 'var(--primary-color, #6366f1)' : undefined }}>
                    {item.value || '-'}
                  </Text>
                </div>
              </Col>
            ))}
          </Row>

          {remarks && (
            <div style={{
              marginBottom: 20, padding: '8px 14px', borderRadius: 8,
              background: 'var(--bg-secondary, #f6f8fa)',
              border: '1px solid var(--border-color, #e8e8e8)',
              fontSize: 12,
            }}>
              <Text type="secondary" style={{ fontSize: 10 }}>Remarks: </Text>
              <Text>{remarks}</Text>
            </div>
          )}

          {/* Side by side when exactly 1 fabric + 1 trim */}
          {fabricLines.length === 1 && trimLines.length === 1 ? (
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <ScissorOutlined style={{ color: 'var(--primary-color, #6366f1)' }} />
                  <Text strong style={{ fontSize: 14 }}>Fabric</Text>
                </div>
                {renderLineCard(fabricLines[0], 'fab-0', false)}
              </Col>
              <Col xs={24} md={12}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <AppstoreOutlined style={{ color: '#10b981' }} />
                  <Text strong style={{ fontSize: 14 }}>Trims</Text>
                </div>
                {renderLineCard(trimLines[0], 'trim-0', false)}
              </Col>
            </Row>
          ) : (
            <>
              {/* Fabric Lines */}
              {fabricLines.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <ScissorOutlined style={{ color: 'var(--primary-color, #6366f1)' }} />
                    <Text strong style={{ fontSize: 14 }}>Fabric</Text>
                    <Tag style={{ margin: 0, fontSize: 10 }}>{fabricLines.length}</Tag>
                  </div>
                  <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                    {fabricLines.map((line, idx) => renderLineCard(line, `fab-${idx}`))}
                  </Row>
                </>
              )}

              {/* Trim Lines */}
              {trimLines.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <AppstoreOutlined style={{ color: '#10b981' }} />
                    <Text strong style={{ fontSize: 14 }}>Trims</Text>
                    <Tag style={{ margin: 0, fontSize: 10 }}>{trimLines.length}</Tag>
                  </div>
                  <Row gutter={[12, 12]}>
                    {trimLines.map((line, idx) => renderLineCard(line, `trim-${idx}`))}
                  </Row>
                </>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
};

export default BOMView;
