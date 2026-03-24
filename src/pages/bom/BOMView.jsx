import { useState, useEffect } from 'react';
import {
  Tag, Typography, Button, Tooltip, message, Row, Col,
} from 'antd';
import {
  AppstoreOutlined, ScissorOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { getStatusLabel, calcPurchaseQty } from '../../utils/bomConstants';
import { getBomById } from '../../services/bomService';
import { getFilesByEntity, downloadFileAsBlob } from '../../services/fileService';

import ViewDialog from '../../components/ViewDialog';
import DetailCard from '../../components/DetailCard';
import StatusTag from '../../components/StatusTag';
import StatusSteps from '../../components/StatusSteps';
import DraftWatermark from '../../components/DraftWatermark';
import { ActionButton } from '../../components/buttons';
import { BOM_STATUS_CONFIG, BOM_STATUS_FLOW } from '../../utils/statusConfig';
import { formatNumber } from '../../utils/formatters';

const { Text } = Typography;

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

  // Render a single BOM line card
  const renderLineCard = (line, idx, wrap = true) => {
    const fabric = isFabricLine(line);
    const cMode = line.consumptionMode || 'SIMPLE';
    const isMatrix = !fabric && (cMode === 'SIZE_WISE' || cMode === 'VARIANT_PER_SIZE');
    const purchaseQty = getLinePurchaseQty(line);
    const parts = line.partsName ? (Array.isArray(line.partsName) ? line.partsName : [line.partsName]) : [];
    const processes = line.processes || [];
    const variantTags = variantsToTags(line.variants);

    const card = (
        <div
          style={{
            borderRadius: 'var(--radius-md, 10px)',
            height: '100%',
            borderLeft: `4px solid ${fabric ? 'var(--primary-color, #6366f1)' : 'var(--color-success, #10b981)'}`,
            border: '1px solid var(--border-color)',
            borderLeftWidth: 4,
            borderLeftColor: fabric ? 'var(--primary-color, #6366f1)' : 'var(--color-success, #10b981)',
            background: 'var(--card-bg)',
            padding: '16px 20px',
          }}
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
            padding: '10px 14px', borderRadius: 'var(--radius-sm, 8px)',
            background: 'var(--bg-secondary, #f6f8fa)',
            border: '1px solid var(--border-color, #e8e8e8)',
          }}>
            <div>
              <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                {isMatrix ? 'Matrix Total' : 'Consumption'}
              </Text>
              <Text strong style={{ fontSize: 14 }}>
                {isMatrix
                  ? (line.totalQty ? formatNumber(line.totalQty, 2) : '\u2014')
                  : (line.consumptionPerGarment != null ? Number(line.consumptionPerGarment).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '\u2014')
                }
                {' '}<Text type="secondary" style={{ fontSize: 10 }}>{(line.uom || '').toUpperCase()}</Text>
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Total Qty</Text>
              <Text strong style={{ fontSize: 14, color: 'var(--primary-color, #6366f1)' }}>
                {line.totalQty ? formatNumber(line.totalQty, 2) : '\u2014'}
                {' '}<Text type="secondary" style={{ fontSize: 10 }}>{(line.uom || '').toUpperCase()}</Text>
              </Text>
            </div>
            {purchaseQty != null && (
              <div>
                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Purchase Qty</Text>
                <Text strong style={{ fontSize: 14, color: 'var(--color-success, #10b981)' }}>
                  {formatNumber(purchaseQty, 2)}
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
        </div>
    );
    if (!wrap) return card;
    return <Col xs={24} md={12} key={line.id || idx}>{card}</Col>;
  };

  return (
    <ViewDialog
      open={open}
      onClose={onClose}
      width={1000}
      loading={loading}
      hero={{
        title: orderNo || 'BOM',
        status: (
          <StatusTag
            status={status}
            config={BOM_STATUS_CONFIG}
            getLabel={getStatusLabel}
          />
        ),
        subtitle: [styleName, buyerName].filter(Boolean).join(' \u2022 '),
        highlight: orderQty ? { label: 'Order Qty', value: orderQty.toLocaleString() } : undefined,
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <ActionButton action="close" text="Close" onClick={onClose} />
        </div>
      }
    >
      <StatusSteps
        statusFlow={BOM_STATUS_FLOW}
        currentStatus={status}
        statusConfig={BOM_STATUS_CONFIG}
        getLabel={getStatusLabel}
        size="small"
        style={{ marginBottom: 20 }}
      />
      <DraftWatermark status={status}>
        {/* General Info */}
        <DetailCard title="General Information" style={{ marginBottom: 20 }}>
          <DetailCard.Field label="Style" value={styleName} span={4} />
          <DetailCard.Field label="Garment" value={garmentName} span={4} />
          <DetailCard.Field label="Buyer" value={buyerName} span={4} />
          <DetailCard.Field label="Material" value={material} span={4} />
          <DetailCard.Field label="Season" value={season} span={4} />
          <DetailCard.Field
            label="Order Qty"
            value={orderQty ? orderQty.toLocaleString() : undefined}
            span={4}
          />
        </DetailCard>

        {remarks && (
          <div style={{
            marginBottom: 20, padding: '8px 14px', borderRadius: 'var(--radius-sm, 8px)',
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
                <AppstoreOutlined style={{ color: 'var(--color-success, #10b981)' }} />
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
                  <AppstoreOutlined style={{ color: 'var(--color-success, #10b981)' }} />
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
      </DraftWatermark>
    </ViewDialog>
  );
};

export default BOMView;
