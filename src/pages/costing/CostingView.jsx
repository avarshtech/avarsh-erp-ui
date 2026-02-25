import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Row,
  Col,
  Space,
  Table,
  Typography,
  Tag,
  Collapse,
  Divider,
  Descriptions,
  Statistic,
  message,
  Tooltip,
} from 'antd';
import {
  EditOutlined,
  CopyOutlined,
  PrinterOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getCostSheetById,
  duplicateCostSheet,
  updateCostSheet,
} from '../../services/costingService';
import {
  COSTING_STATUS,
  EDITABLE_STATUSES,
  getStatusLabel,
  formatCurrency,
} from '../../utils/costingConstants';
import { getCurrencySymbol } from '../../utils/orderConstants';
import { hasPermission } from '../../utils/permissions';
import { useTheme } from '../../context/ThemeContext';

const { Text, Title } = Typography;

const STATUS_CONFIG = {
  [COSTING_STATUS.DRAFT]: { color: 'default', icon: <FileTextOutlined /> },
  [COSTING_STATUS.FINAL]: { color: 'blue', icon: <SendOutlined /> },
  [COSTING_STATUS.APPROVED]: { color: 'green', icon: <CheckCircleOutlined /> },
};

const CostingView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const canUpdate = hasPermission('costing', 'update');
  const canApprove = hasPermission('costing-approval', 'approve');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const cs = await getCostSheetById(id);
      setData(cs);
    } catch {
      message.error('Failed to load cost sheet');
      navigate('/costing/list');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const dup = await duplicateCostSheet(id);
      message.success(`Duplicated as ${dup.costingId}`);
      navigate(`/costing/edit/${dup.id}`);
    } catch {
      message.error('Failed to duplicate cost sheet');
    }
  };

  const handleApprove = async () => {
    try {
      await updateCostSheet(id, { status: COSTING_STATUS.APPROVED });
      message.success('Cost sheet approved');
      loadData();
    } catch {
      message.error('Failed to approve cost sheet');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Text type="secondary">Loading cost sheet...</Text>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[data.status] || {};
  const isEditable = EDITABLE_STATUSES.includes(data.status);

  const sectionHeaderStyle = (color) => ({
    background: isDarkMode
      ? `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`
      : `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
    borderRadius: 8,
    border: `1px solid ${isDarkMode ? `${color}33` : `${color}22`}`,
  });

  const fabricColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
    { title: 'Fabric Type', dataIndex: 'fabricType', width: 150 },
    { title: 'Classification', dataIndex: 'classification', width: 100 },
    { title: 'Description', dataIndex: 'description', width: 160 },
    { title: 'Consumption', dataIndex: 'consumption', width: 100, render: (v) => v?.toFixed(4) || '-' },
    { title: `Price (${getCurrencySymbol(data.currency)})`, dataIndex: 'fabricPrice', width: 100, render: (v) => formatCurrency(v, data.currency) },
    { title: 'Width (Std)', dataIndex: 'fabricWidthStd', width: 90 },
    { title: 'Width (Vendor)', dataIndex: 'fabricWidthVendor', width: 95 },
    { title: 'Vendor', dataIndex: 'vendorName', width: 150, ellipsis: true },
    { title: 'Allowance %', dataIndex: 'allowancePct', width: 90, render: (v) => `${v || 0}%` },
    { title: `Net Cost`, dataIndex: 'netCost', width: 120, render: (v) => <Text strong style={{ color: 'var(--success-color)' }}>{formatCurrency(v, data.currency)}</Text> },
  ];

  const localTrimColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
    { title: 'Item', dataIndex: 'item', width: 160 },
    { title: 'Code', dataIndex: 'code', width: 130 },
    { title: 'Size', dataIndex: 'size', width: 90 },
    { title: 'Consumption', dataIndex: 'consumption', width: 100 },
    { title: `Cost (${getCurrencySymbol(data.currency)})`, dataIndex: 'cost', width: 110, render: (v) => formatCurrency(v, data.currency) },
    { title: `Price (${getCurrencySymbol(data.currency)})`, dataIndex: 'price', width: 110, render: (v) => <Text strong>{formatCurrency(v, data.currency)}</Text> },
  ];

  const importedTrimColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
    { title: 'Item', dataIndex: 'item', width: 160 },
    { title: 'Code', dataIndex: 'code', width: 130 },
    { title: 'Size', dataIndex: 'size', width: 90 },
    { title: 'Consumption', dataIndex: 'consumption', width: 100 },
    { title: 'Cost ($ USD)', dataIndex: 'costUsd', width: 110, render: (v) => formatCurrency(v, 'USD') },
    { title: 'Price ($ USD)', dataIndex: 'priceUsd', width: 110, render: (v) => <Text strong>{formatCurrency(v, 'USD')}</Text> },
  ];

  const mfgColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
    { title: 'Process', dataIndex: 'process', width: 200 },
    { title: `Cost (${getCurrencySymbol(data.currency)})`, dataIndex: 'cost', width: 130, render: (v) => formatCurrency(v, data.currency) },
    { title: 'Comments', dataIndex: 'comments' },
  ];

  const overheadColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
    { title: 'Description', dataIndex: 'description', width: 200 },
    { title: `Cost (${getCurrencySymbol(data.currency)})`, dataIndex: 'cost', width: 130, render: (v) => formatCurrency(v, data.currency) },
    { title: 'Comments', dataIndex: 'comments' },
  ];

  const summaryRowStyle = {
    background: isDarkMode ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
    fontWeight: 600,
  };

  const collapseItems = [
    {
      key: 'general',
      label: <Text strong style={{ fontSize: 15, color: '#6366f1' }}>General Details</Text>,
      style: sectionHeaderStyle('#6366f1'),
      children: (
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label="Costing ID"><Text strong>{data.costingId}</Text></Descriptions.Item>
          <Descriptions.Item label="Date">{data.date ? dayjs(data.date).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={statusConfig.color} icon={statusConfig.icon} style={{ borderRadius: 20 }}>
              {getStatusLabel(data.status)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Buyer"><Text strong>{data.buyerName}</Text></Descriptions.Item>
          <Descriptions.Item label="Style #">{data.styleNo}</Descriptions.Item>
          <Descriptions.Item label="Garment Name">{data.garmentName}</Descriptions.Item>
          <Descriptions.Item label="Season">{data.season || '-'}</Descriptions.Item>
          <Descriptions.Item label="Costing Currency">{data.currency}</Descriptions.Item>
          <Descriptions.Item label="Quote Currency">{data.quoteCurrency}</Descriptions.Item>
          <Descriptions.Item label="Actual Rate">{data.actualRate}</Descriptions.Item>
          <Descriptions.Item label="Today's Rate">{data.todaysRate}</Descriptions.Item>
          <Descriptions.Item label="Sizes">{(data.sizes || []).join(', ') || '-'}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'fabric',
      label: (
        <Space>
          <Text strong style={{ fontSize: 15, color: '#0ea5e9' }}>Fabric Cost Breakup</Text>
          <Tag color="blue">{formatCurrency(data.totalFabricCost, data.currency)}</Tag>
        </Space>
      ),
      style: sectionHeaderStyle('#0ea5e9'),
      children: (
        <Table
          dataSource={data.fabricRows}
          columns={fabricColumns}
          pagination={false}
          size="small"
          rowKey="key"
          scroll={{ x: 1200 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={summaryRowStyle}>
                <Table.Summary.Cell index={0} colSpan={10}><Text strong>Total Fabric Cost</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={10}>
                  <Text strong style={{ color: 'var(--primary-color)' }}>{formatCurrency(data.totalFabricCost, data.currency)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      ),
    },
    {
      key: 'trims',
      label: (
        <Space>
          <Text strong style={{ fontSize: 15, color: '#8b5cf6' }}>Trims / Accessories</Text>
          <Tag color="purple">{formatCurrency(data.totalAccessoriesCost, data.currency)}</Tag>
        </Space>
      ),
      style: sectionHeaderStyle('#8b5cf6'),
      children: (
        <>
          <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>Local Accessories</Text>
          <Table dataSource={data.localTrims} columns={localTrimColumns} pagination={false} size="small" rowKey="key" scroll={{ x: 800 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={summaryRowStyle}>
                  <Table.Summary.Cell index={0} colSpan={6}><Text strong>Local Total</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={6}><Text strong>{formatCurrency(data.totalLocalTrimsCost, data.currency)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
          <Divider style={{ margin: '16px 0' }} />
          <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>Imported Accessories</Text>
          <Table dataSource={data.importedTrims} columns={importedTrimColumns} pagination={false} size="small" rowKey="key" scroll={{ x: 800 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={summaryRowStyle}>
                  <Table.Summary.Cell index={0} colSpan={6}><Text strong>Imported Total (USD)</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={6}><Text strong>{formatCurrency(data.totalImportedTrimsCostUsd, 'USD')}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
          <Card size="small" style={{ marginTop: 16, background: isDarkMode ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.04)' }}>
            <Text strong>Total Accessories Cost: {formatCurrency(data.totalAccessoriesCost, data.currency)}</Text>
          </Card>
        </>
      ),
    },
    {
      key: 'manufacturing',
      label: (
        <Space>
          <Text strong style={{ fontSize: 15, color: '#f59e0b' }}>Manufacturing Cost</Text>
          <Tag color="orange">{formatCurrency(data.totalManufacturingCost, data.currency)}</Tag>
        </Space>
      ),
      style: sectionHeaderStyle('#f59e0b'),
      children: (
        <Table dataSource={data.manufacturingRows} columns={mfgColumns} pagination={false} size="small" rowKey="key"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={summaryRowStyle}>
                <Table.Summary.Cell index={0} colSpan={2}><Text strong>Total Manufacturing Cost</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={2}><Text strong style={{ color: 'var(--primary-color)' }}>{formatCurrency(data.totalManufacturingCost, data.currency)}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      ),
    },
    {
      key: 'overhead',
      label: (
        <Space>
          <Text strong style={{ fontSize: 15, color: '#ef4444' }}>Overhead / Markup</Text>
          <Tag color="red">{formatCurrency(data.totalMarkupCost, data.currency)}</Tag>
        </Space>
      ),
      style: sectionHeaderStyle('#ef4444'),
      children: (
        <Table dataSource={data.overheadRows} columns={overheadColumns} pagination={false} size="small" rowKey="key"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={summaryRowStyle}>
                <Table.Summary.Cell index={0} colSpan={2}><Text strong>Total Markup Cost</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={2}><Text strong style={{ color: 'var(--primary-color)' }}>{formatCurrency(data.totalMarkupCost, data.currency)}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      ),
    },
    {
      key: 'summary',
      label: <Text strong style={{ fontSize: 15, color: '#10b981' }}>Cost Summary</Text>,
      style: sectionHeaderStyle('#10b981'),
      children: (
        <Card
          style={{
            background: isDarkMode
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(99, 102, 241, 0.03) 100%)',
            border: `1px solid ${isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)'}`,
          }}
        >
          <Row gutter={[24, 16]}>
            <Col xs={12} md={6}>
              <Statistic title="Fabric Cost" value={data.totalFabricCost} precision={2} prefix={getCurrencySymbol(data.currency)} valueStyle={{ fontSize: 16, color: '#0ea5e9' }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Trims / Accessories" value={data.totalAccessoriesCost} precision={2} prefix={getCurrencySymbol(data.currency)} valueStyle={{ fontSize: 16, color: '#8b5cf6' }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Manufacturing Cost" value={data.totalManufacturingCost} precision={2} prefix={getCurrencySymbol(data.currency)} valueStyle={{ fontSize: 16, color: '#f59e0b' }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Markup / Overhead" value={data.totalMarkupCost} precision={2} prefix={getCurrencySymbol(data.currency)} valueStyle={{ fontSize: 16, color: '#ef4444' }} />
            </Col>
          </Row>
          <Divider style={{ margin: '16px 0' }} />
          <Row gutter={[24, 16]}>
            <Col xs={12} md={6}>
              <Statistic title="Total Making Price" value={data.totalMakingPrice} precision={2} prefix={getCurrencySymbol(data.currency)} valueStyle={{ fontSize: 18, fontWeight: 700 }} />
            </Col>
            <Col xs={12} md={4}>
              <Statistic title="Agent Commission" value={data.agentCommissionPct} suffix="%" valueStyle={{ fontSize: 16 }} />
            </Col>
            <Col xs={12} md={4}>
              <Statistic title="Profit" value={data.profitPct} suffix="%" valueStyle={{ fontSize: 16 }} />
            </Col>
            <Col xs={12} md={5}>
              <Statistic title="Overhead Charges" value={data.totalOverheadCharges} precision={2} prefix={getCurrencySymbol(data.currency)} valueStyle={{ fontSize: 16, color: '#64748b' }} />
            </Col>
          </Row>
          <Divider style={{ margin: '16px 0' }} />
          <Row gutter={[24, 16]} align="middle">
            <Col xs={12} md={8}>
              <Statistic title={`Total Price (${data.currency})`} value={data.totalPrice} precision={2} prefix={getCurrencySymbol(data.currency)} valueStyle={{ fontSize: 22, fontWeight: 700, color: 'var(--primary-color)' }} />
            </Col>
            <Col xs={12} md={8}>
              <Card
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  textAlign: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, display: 'block' }}>Final Price ({data.quoteCurrency})</Text>
                <Text style={{ color: '#fff', fontSize: 30, fontWeight: 800, display: 'block' }}>
                  {getCurrencySymbol(data.quoteCurrency)} {data.finalPrice?.toFixed(2)}
                </Text>
              </Card>
            </Col>
          </Row>
        </Card>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/costing/list')} type="text" />
          <h1>View Cost Sheet</h1>
          <Tag color={statusConfig.color} icon={statusConfig.icon} style={{ borderRadius: 20, fontSize: 13, padding: '2px 12px' }}>
            {getStatusLabel(data.status)}
          </Tag>
        </Space>
        <div className="header-actions">
          <Space>
            {isEditable && canUpdate && (
              <Button icon={<EditOutlined />} onClick={() => navigate(`/costing/edit/${id}`)}>
                Edit
              </Button>
            )}
            <Button icon={<CopyOutlined />} onClick={handleDuplicate}>
              Duplicate
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              Print / PDF
            </Button>
            {data.status === COSTING_STATUS.FINAL && canApprove && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleApprove}>
                Approve
              </Button>
            )}
          </Space>
        </div>
      </div>

      <Collapse
        defaultActiveKey={['general', 'fabric', 'trims', 'manufacturing', 'overhead', 'summary']}
        items={collapseItems}
      />
    </div>
  );
};

export default CostingView;
