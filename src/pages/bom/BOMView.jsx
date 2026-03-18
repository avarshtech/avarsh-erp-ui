import { useState, useEffect } from 'react';
import {
  Modal,
  Descriptions,
  Table,
  Tag,
  Space,
  Typography,
  Button,
  Spin,
  Popover,
  Tooltip,
  Card,
  Row,
  Col,
  message,
} from 'antd';
import {
  FileTextOutlined,
  PrinterOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { getStatusLabel, BOM_STATUS, calcPurchaseQty } from '../../utils/bomConstants';
import { getBomById } from '../../services/bomService';

const { Text } = Typography;

const STATUS_CONFIG = {
  [BOM_STATUS.DRAFT]:   { color: 'default', icon: <FileTextOutlined /> },
  [BOM_STATUS.CREATED]: { color: 'green',   icon: <CheckCircleOutlined /> },
};

const variantsToTags = (variants) => {
  if (!variants || typeof variants !== 'object') return [];
  return Object.entries(variants)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}:${v}`);
};

const processToLabel = (proc) => {
  if (typeof proc === 'string') return proc;
  if (typeof proc === 'object' && proc !== null) return proc.processName || proc.name || String(proc.id);
  return String(proc);
};

const isFabricLine = (line) => (line?.categoryName || '').toLowerCase().includes('fabric');

const BOMView = ({ open, bomData, onClose, onStatusChange }) => {
  const [fullBom, setFullBom] = useState(null);
  const [loading, setLoading] = useState(false);

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

  if (!bomData) return null;
  const bom = fullBom || bomData;
  const { orderNo, status, styleName, garmentName, material, buyerName, season, orderQty, remarks, lines = [] } = bom;
  const statusConfig = STATUS_CONFIG[status] || {};

  // Summary stats
  const linesWithCat = lines.filter((l) => l.categoryName);
  const fabricCount = linesWithCat.filter(isFabricLine).length;
  const trimsCount = linesWithCat.length - fabricCount;

  const columns = [
    { title: '#', width: 45, fixed: 'left', align: 'center', render: (_, __, idx) => idx + 1 },
    {
      title: 'Category',
      dataIndex: 'categoryName',
      width: 110,
      render: (text) => text || '-',
    },
    {
      title: 'Sub Category',
      dataIndex: 'subCategoryName',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: 'Item Name',
      dataIndex: 'itemName',
      width: 180,
      render: (text) => <Text strong>{text || '-'}</Text>,
    },
    {
      title: 'Item Code',
      dataIndex: 'itemCode',
      width: 110,
      render: (text) => <Text type="secondary" style={{ fontSize: 12 }}>{text || '-'}</Text>,
    },
    {
      title: 'Variants',
      dataIndex: 'variants',
      width: 180,
      render: (variants) => {
        const tags = variantsToTags(variants);
        if (tags.length === 0) return <Text type="secondary">—</Text>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.map((t) => (
              <Tag key={t} color="geekblue" style={{ margin: 0, fontSize: 11 }}>{t}</Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: 'Consumption',
      dataIndex: 'consumptionPerGarment',
      width: 100,
      align: 'right',
      render: (val) => val != null ? Number(val).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '-',
    },
    {
      title: 'UOM',
      dataIndex: 'uom',
      width: 70,
      align: 'center',
      render: (text) => <Text strong style={{ fontSize: 12 }}>{(text || '-').toUpperCase()}</Text>,
    },
    {
      title: 'Parts',
      dataIndex: 'partsName',
      width: 120,
      render: (value) => {
        if (!value) return '-';
        const parts = Array.isArray(value) ? value : [value];
        return parts.join(', ');
      },
    },
    {
      title: 'Process',
      dataIndex: 'processes',
      width: 180,
      render: (processes) => {
        if (!processes || processes.length === 0) return <Text type="secondary">—</Text>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {processes.map((p, i) => (
              <Tag key={i} color="blue" style={{ margin: 0, fontSize: 11 }}>{processToLabel(p)}</Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: 'Calc Basis',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const fabric = isFabricLine(record);
        if (fabric) return <Tag color="blue" style={{ fontSize: 11 }}>Total</Tag>;
        const basis = record.qtyCalcBasis || 'TOTAL';
        const attr = record.baseQtyMatchAttr;
        return (
          <div style={{ fontSize: 11, textAlign: 'center' }}>
            <Tag style={{ fontSize: 11, margin: 0 }}>{basis === 'BUYER_PO' ? 'Buyer PO' : 'Total Qty'}</Tag>
            {attr && <div style={{ marginTop: 2 }}><Text type="secondary" style={{ fontSize: 10 }}>By {attr === 'color+size' ? 'Color+Size' : attr === 'color' ? 'Color' : 'Size'}</Text></div>}
          </div>
        );
      },
    },
    {
      title: 'Total Qty',
      dataIndex: 'totalQty',
      width: 100,
      align: 'right',
      render: (val) => (
        <Tag color={val ? 'blue' : 'default'} style={{ fontSize: 12 }}>
          {val ? Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
        </Tag>
      ),
    },
    {
      title: 'Purchase Qty',
      width: 110,
      align: 'right',
      render: (_, record) => {
        const totalQty = record.totalQty;
        if (!totalQty) return <Text type="secondary">—</Text>;
        const allowances = record.processAllowances || [];
        if (allowances.length === 0) return <Text type="secondary">—</Text>;
        const totalLoss = allowances.reduce((s, a) => s + (Number(a.processLossPercent) || 0), 0);
        const totalRej = allowances.reduce((s, a) => s + (Number(a.rejectionPercent) || 0), 0);
        const totalShip = allowances.reduce((s, a) => s + (Number(a.shipmentAllowancePercent) || 0), 0);
        const pq = calcPurchaseQty(totalQty, totalLoss, totalRej + totalShip);
        return (
          <Tag color="green" style={{ fontSize: 12 }}>
            {pq.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Tag>
        );
      },
    },
    {
      title: 'CAD',
      width: 60,
      align: 'center',
      render: (_, record) => {
        if (!isFabricLine(record)) return <Text type="secondary">—</Text>;
        if (!record.cadPreviewUrl && !record.cadMarkerFileId) return <Text type="secondary">—</Text>;
        if (record.cadPreviewUrl) {
          return (
            <Popover
              content={<img src={record.cadPreviewUrl} alt="CAD" style={{ maxWidth: 400, maxHeight: 400, borderRadius: 4 }} />}
              title="CAD Marker"
              trigger="hover"
              placement="left"
            >
              <img src={record.cadPreviewUrl} alt="CAD" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-color, #d9d9d9)', cursor: 'pointer' }} />
            </Popover>
          );
        }
        return <Tooltip title={record.cadMarkerFileId}><Tag style={{ fontSize: 10 }}>CAD</Tag></Tooltip>;
      },
    },
  ];

  const renderFooter = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <Space>
        <Button icon={<PrinterOutlined />} onClick={() => message.info('Print functionality coming soon')}>Print</Button>
      </Space>
      <Button onClick={onClose}>Close</Button>
    </div>
  );

  return (
    <Modal
      title={
        <Space>
          <Text strong style={{ fontSize: 18 }}>{orderNo || 'BOM'}</Text>
          <Tag color={statusConfig.color} icon={statusConfig.icon} style={{ borderRadius: 20 }}>{getStatusLabel(status)}</Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={1300}
      centered
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto', padding: '16px 24px' } }}
      footer={renderFooter()}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin tip="Loading BOM details..." /></div>
      ) : (
        <>
          {/* General Info */}
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 4 }} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Order No"><Text code>{orderNo || '-'}</Text></Descriptions.Item>
            <Descriptions.Item label="Style No"><Text strong>{styleName || '-'}</Text></Descriptions.Item>
            <Descriptions.Item label="Garment">{garmentName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Buyer"><Text strong>{buyerName || '-'}</Text></Descriptions.Item>
            <Descriptions.Item label="Material">{material || '-'}</Descriptions.Item>
            <Descriptions.Item label="Season">{season || '-'}</Descriptions.Item>
            <Descriptions.Item label="Order Qty"><Text strong>{(orderQty || 0).toLocaleString()}</Text></Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusConfig.color} style={{ borderRadius: 20 }}>{getStatusLabel(status)}</Tag>
            </Descriptions.Item>
            {remarks && <Descriptions.Item label="Remarks" span={4}>{remarks}</Descriptions.Item>}
          </Descriptions>

          {/* Summary Stats */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={8} md={4}>
              <Card size="small" style={{ textAlign: 'center', borderLeft: '3px solid #1677ff', borderRadius: 8 }} styles={{ body: { padding: '8px' } }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #8c8c8c)' }}>Total Lines</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1677ff' }}>{lines.length}</div>
              </Card>
            </Col>
            <Col xs={8} md={4}>
              <Card size="small" style={{ textAlign: 'center', borderLeft: '3px solid #6366f1', borderRadius: 8 }} styles={{ body: { padding: '8px' } }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #8c8c8c)' }}>Fabric</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>{fabricCount}</div>
              </Card>
            </Col>
            <Col xs={8} md={4}>
              <Card size="small" style={{ textAlign: 'center', borderLeft: '3px solid #10b981', borderRadius: 8 }} styles={{ body: { padding: '8px' } }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #8c8c8c)' }}>Trims</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{trimsCount}</div>
              </Card>
            </Col>
          </Row>

          {/* BOM Lines Table */}
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
            BOM Lines
          </Text>
          <Table
            dataSource={lines}
            columns={columns}
            rowKey={(record, idx) => record.key || record.id || idx}
            pagination={false}
            scroll={{ x: 1800 }}
            size="small"
            bordered
          />
        </>
      )}
    </Modal>
  );
};

export default BOMView;
