import { useState, useEffect } from 'react';
import {
  Card,
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
  Skeleton,
  message,
} from 'antd';
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
  calcFinalPriceUsd,
} from '../../utils/costingConstants';
import { getCurrencySymbol } from '../../utils/orderConstants';
import { hasPermission } from '../../utils/permissions';
import { useTheme } from '../../context/ThemeContext';
import { generateCostingPdf } from '../../utils/costingPdfGenerator';
import { ActionButton } from '../../components/buttons';
import StatusTag from '../../components/StatusTag';
import PageHeader from '../../components/PageHeader';
import DraftWatermark from '../../components/DraftWatermark';
import StatusSteps from '../../components/StatusSteps';
import { COSTING_STATUS_CONFIG, COSTING_STATUS_FLOW } from '../../utils/statusConfig';

const { Text, Title } = Typography;

const CostingView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [duplicating, setDuplicating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [printing, setPrinting] = useState(false);

  const canAdd    = hasPermission('costing', 'add');
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
    setDuplicating(true);
    try {
      const dup = await duplicateCostSheet(id);
      message.success(`Duplicated as ${dup.costingId}`);
      navigate(`/costing/edit/${dup.id}`);
    } catch {
      message.error('Failed to duplicate cost sheet');
    } finally {
      setDuplicating(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await updateCostSheet(id, { ...data, status: COSTING_STATUS.APPROVED, version: data.version });
      message.success('Cost sheet approved');
      loadData();
    } catch {
      message.error('Failed to approve cost sheet');
    } finally {
      setApproving(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await generateCostingPdf(data);
    } catch {
      message.error('Failed to generate print document');
    } finally {
      setPrinting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="animate-fade-in-up">
        <div className="page-header">
          <Space>
            <Skeleton.Button active size="small" style={{ width: 32, height: 32 }} />
            <Skeleton.Input active style={{ width: 160 }} />
            <Skeleton.Button active size="small" style={{ width: 80 }} />
          </Space>
          <Space>
            <Skeleton.Button active style={{ width: 80 }} />
            <Skeleton.Button active style={{ width: 100 }} />
            <Skeleton.Button active style={{ width: 100 }} />
          </Space>
        </div>
        {/* General Details skeleton */}
        <Card style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 140, marginBottom: 16 }} />
          <Row gutter={[16, 16]}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Col xs={12} md={8} key={i}>
                <Skeleton.Input active size="small" style={{ width: 70, marginBottom: 8 }} block={false} />
                <Skeleton.Input active block />
              </Col>
            ))}
          </Row>
        </Card>
        {/* Fabric section skeleton */}
        <Card style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 180, marginBottom: 16 }} />
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
        {/* Trims section skeleton */}
        <Card style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 160, marginBottom: 16 }} />
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
        {/* Manufacturing skeleton */}
        <Card style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 170, marginBottom: 16 }} />
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
        {/* Summary skeleton */}
        <Card>
          <Skeleton.Input active style={{ width: 120, marginBottom: 16 }} />
          <Row gutter={[16, 16]}>
            {[1, 2, 3, 4].map((i) => (
              <Col xs={12} md={6} key={i}>
                <Skeleton.Input active size="small" style={{ width: 90, marginBottom: 8 }} block={false} />
                <Skeleton.Input active block />
              </Col>
            ))}
          </Row>
        </Card>
      </div>
    );
  }

  const isEditable = EDITABLE_STATUSES.includes(data.status);

  const finalPriceUsd = (() => {
    if (!data) return 0;
    if (data.quoteCurrency === 'USD') return data.finalPrice;
    if (data.finalPriceUsd) return data.finalPriceUsd;
    return calcFinalPriceUsd(data.finalPrice, data.quoteCurrency, data.actualRate);
  })();

  const sectionHeaderStyle = (color) => ({
    background: isDarkMode
      ? `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`
      : `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
    borderRadius: 8,
    border: `1px solid ${isDarkMode ? `${color}33` : `${color}22`}`,
  });

  const renderSizes = (v) => {
    if (!v) return '-';
    const arr = v.split(',').map((s) => s.trim()).filter(Boolean);
    if (arr.length <= 1) return v;
    return <span>{arr[0]} <Tag style={{ marginLeft: 2 }}>+{arr.length - 1}</Tag></span>;
  };

  const fabricColumns = [
    { title: 'S.No', width: 50, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Sizes', dataIndex: 'sizes', width: 160, align: 'center', render: renderSizes },
    { title: 'Fabric Name', dataIndex: 'fabricType', width: 240, align: 'center' },
    { title: 'Classification', dataIndex: 'classification', width: 120, align: 'center' },
    { title: 'Description', dataIndex: 'description', align: 'center' },
    { title: 'Consumption', dataIndex: 'consumption', width: 130, align: 'center', render: (v, record) => v != null ? `${v.toFixed(4)} ${(record.uomSymbol || record.uom || record.uomName || '').toUpperCase()}`.trim() : '-' },
    { title: `Price (${getCurrencySymbol(data.currency)})`, dataIndex: 'fabricPrice', width: 120, align: 'center', render: (v) => formatCurrency(v, data.currency) },
    { title: 'Width (Std)', dataIndex: 'fabricWidthStd', width: 100, align: 'center' },
    { title: 'Width (Vendor)', dataIndex: 'fabricWidthVendor', width: 110, align: 'center' },
    { title: 'Vendor', dataIndex: 'vendorName', width: 150, align: 'center', ellipsis: true },
    { title: 'Allowance %', dataIndex: 'allowancePct', width: 100, align: 'center', render: (v) => `${v || 0}%` },
    { title: 'Net Cost', dataIndex: 'netCost', width: 120, align: 'center', render: (v) => <Text strong style={{ color: 'var(--success-color)' }}>{formatCurrency(v, data.currency)}</Text> },
  ];

  const localTrimColumns = [
    { title: 'S.No', width: 50, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Sizes', dataIndex: 'sizes', width: 160, align: 'center', render: renderSizes },
    { title: 'Item', dataIndex: 'item', align: 'center' },
    { title: 'Code', dataIndex: 'code', width: 130, align: 'center' },
    { title: 'Size', dataIndex: 'size', width: 90, align: 'center' },
    { title: 'Consumption', dataIndex: 'consumption', width: 130, align: 'center', render: (v, record) => v != null ? `${v} ${(record.uom || '').toUpperCase()}`.trim() : '-' },
    { title: `Cost (${getCurrencySymbol(data.currency)})`, dataIndex: 'cost', width: 120, align: 'center', render: (v) => formatCurrency(v, data.currency) },
    { title: `Price (${getCurrencySymbol(data.currency)})`, dataIndex: 'price', width: 120, align: 'center', render: (v) => <Text strong>{formatCurrency(v, data.currency)}</Text> },
  ];

  const importedTrimColumns = [
    { title: 'S.No', width: 50, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Sizes', dataIndex: 'sizes', width: 160, align: 'center', render: renderSizes },
    { title: 'Item', dataIndex: 'item', align: 'center' },
    { title: 'Code', dataIndex: 'code', width: 130, align: 'center' },
    { title: 'Size', dataIndex: 'size', width: 90, align: 'center' },
    { title: 'Consumption', dataIndex: 'consumption', width: 130, align: 'center', render: (v, record) => v != null ? `${v} ${(record.uom || '').toUpperCase()}`.trim() : '-' },
    { title: 'Cost ($ USD)', dataIndex: 'costUsd', width: 120, align: 'center', render: (v) => formatCurrency(v, 'USD') },
    { title: 'Price ($ USD)', dataIndex: 'priceUsd', width: 120, align: 'center', render: (v) => <Text strong>{formatCurrency(v, 'USD')}</Text> },
  ];

  const mfgColumns = [
    { title: 'S.No', width: 50, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Sizes', dataIndex: 'sizes', width: 160, align: 'center', render: renderSizes },
    { title: 'Process', dataIndex: 'process', width: 200, align: 'center' },
    { title: `Cost (${getCurrencySymbol(data.currency)})`, dataIndex: 'cost', width: 130, align: 'center', render: (v) => formatCurrency(v, data.currency) },
    { title: 'Comments', dataIndex: 'comments', align: 'center' },
  ];

  const overheadColumns = [
    { title: 'S.No', width: 50, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Sizes', dataIndex: 'sizes', width: 160, align: 'center', render: renderSizes },
    { title: 'Description', dataIndex: 'description', width: 200, align: 'center' },
    { title: `Cost (${getCurrencySymbol(data.currency)})`, dataIndex: 'cost', width: 130, align: 'center', render: (v) => formatCurrency(v, data.currency) },
    { title: 'Comments', dataIndex: 'comments', align: 'center' },
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
          <Descriptions.Item label="Status">
            <StatusTag status={data.status} config={COSTING_STATUS_CONFIG} getLabel={getStatusLabel} />
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
          <Text strong style={{ fontSize: 15, color: 'var(--info-color)' }}>Fabric Cost Breakup</Text>
          <Tag color="blue">{formatCurrency(data.totalFabricCost, data.currency)}</Tag>
        </Space>
      ),
      style: sectionHeaderStyle('var(--info-color)'),
      children: (
        <Table
          dataSource={data.fabricRows}
          columns={fabricColumns}
          pagination={false}
          size="small"
          rowKey="key"
          scroll={{ x: 1440 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={summaryRowStyle}>
                <Table.Summary.Cell index={0} colSpan={11}><Text strong>Total Fabric Cost</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={11}>
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
          <Table dataSource={data.localTrims} columns={localTrimColumns} pagination={false} size="small" rowKey="key" scroll={{ x: 860 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={summaryRowStyle}>
                  <Table.Summary.Cell index={0} colSpan={7}><Text strong>Local Total</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={7}><Text strong>{formatCurrency(data.totalLocalTrimsCost, data.currency)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
          <Divider style={{ margin: '16px 0' }} />
          <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>Imported Accessories</Text>
          <Table dataSource={data.importedTrims} columns={importedTrimColumns} pagination={false} size="small" rowKey="key" scroll={{ x: 860 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={summaryRowStyle}>
                  <Table.Summary.Cell index={0} colSpan={7}><Text strong>Imported Total (USD)</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={7}><Text strong>{formatCurrency(data.totalImportedTrimsCostUsd, 'USD')}</Text></Table.Summary.Cell>
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
        <Table dataSource={data.manufacturingRows} columns={mfgColumns} pagination={false} size="small" rowKey="key" scroll={{ x: 640 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={summaryRowStyle}>
                <Table.Summary.Cell index={0} colSpan={3}><Text strong>Total Manufacturing Cost</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={3}><Text strong style={{ color: 'var(--primary-color)' }}>{formatCurrency(data.totalManufacturingCost, data.currency)}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={4} />
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
        <Table dataSource={data.overheadRows} columns={overheadColumns} pagination={false} size="small" rowKey="key" scroll={{ x: 640 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={summaryRowStyle}>
                <Table.Summary.Cell index={0} colSpan={3}><Text strong>Total Markup Cost</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={3}><Text strong style={{ color: 'var(--primary-color)' }}>{formatCurrency(data.totalMarkupCost, data.currency)}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={4} />
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
              <Statistic title="Fabric Cost" value={data.totalFabricCost} precision={2} prefix={getCurrencySymbol(data.currency)} valueStyle={{ fontSize: 16, color: 'var(--info-color)' }} />
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
          <Row gutter={[16, 16]} align="middle">
            <Col xs={12} md={6}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#6366f1' }}>
                <Text style={{ color: '#6366f1', fontSize: 12, display: 'block' }}>Total Price (INR)</Text>
                <Text style={{ color: '#6366f1', fontSize: 26, fontWeight: 800, display: 'block' }}>
                  {getCurrencySymbol('INR')} {data.totalPrice?.toFixed(2)}
                </Text>
              </Card>
            </Col>
            {data.quoteCurrency !== 'INR' && data.quoteCurrency !== 'USD' && (
              <Col xs={12} md={6}>
                <Card size="small" style={{ textAlign: 'center', borderColor: '#10b981' }}>
                  <Text style={{ color: '#10b981', fontSize: 12, display: 'block' }}>Final Price ({data.quoteCurrency})</Text>
                  <Text style={{ color: '#10b981', fontSize: 26, fontWeight: 800, display: 'block' }}>
                    {getCurrencySymbol(data.quoteCurrency)} {data.finalPrice?.toFixed(2)}
                  </Text>
                </Card>
              </Col>
            )}
            <Col xs={12} md={data.quoteCurrency !== 'INR' && data.quoteCurrency !== 'USD' ? 6 : 9}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#3b82f6' }}>
                <Text style={{ color: '#3b82f6', fontSize: 12, display: 'block' }}>Final Price (USD)</Text>
                <Text style={{ color: '#3b82f6', fontSize: 26, fontWeight: 800, display: 'block' }}>
                  $ {finalPriceUsd?.toFixed(2)}
                </Text>
              </Card>
            </Col>
          </Row>

          {/* Per-Size Breakdown (read-only) */}
          {data.sizeSummaries && data.sizeSummaries.length > 0 && (
            <>
              <Divider style={{ margin: '16px 0' }} />
              <Text strong style={{ fontSize: 15, marginBottom: 12, display: 'block' }}>Per-Size Breakdown</Text>
              <Row gutter={[16, 16]}>
                {data.sizeSummaries.map((ss) => (
                  <Col xs={24} sm={12} md={Math.max(6, Math.floor(24 / data.sizeSummaries.length))} key={ss.sizes}>
                    <Card size="small" title={<Tag color="blue">{ss.sizes}</Tag>} style={{ borderColor: '#10b981' }}>
                      <div style={{ fontSize: 12, lineHeight: '22px' }}>
                        <div>Fabric: {formatCurrency(ss.totalFabricCost, data.currency)}</div>
                        <div>Accessories: {formatCurrency(ss.totalAccessoriesCost, data.currency)}</div>
                        <div>Manufacturing: {formatCurrency(ss.totalManufacturingCost, data.currency)}</div>
                        <div>Markup: {formatCurrency(ss.totalMarkupCost, data.currency)}</div>
                        <Divider style={{ margin: '6px 0' }} />
                        <div><Text strong>Making: {formatCurrency(ss.totalMakingPrice, data.currency)}</Text></div>
                        <div>Agent: {ss.agentCommissionPct}% | Profit: {ss.profitPct}%</div>
                      </div>
                      <Divider style={{ margin: '6px 0' }} />
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: 700 }}>
                          $ {ss.finalPriceUsd?.toFixed(2)}
                        </Text>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {getCurrencySymbol(data.currency)} {ss.totalPrice?.toFixed(2)}
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="View Cost Sheet"
        backPath="/costing/list"
        subtitle={data.date ? dayjs(data.date).format('DD-MMM-YYYY') : undefined}
        status={
          <Space>
            <Tag color="blue" style={{ borderRadius: 20, fontSize: 13, padding: '2px 12px' }}>
              {data.costingId}
            </Tag>
            <StatusTag status={data.status} config={COSTING_STATUS_CONFIG} getLabel={getStatusLabel} />
          </Space>
        }
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <Space>
          {isEditable && canUpdate && (
            <ActionButton action="edit" text="Edit" onClick={() => navigate(`/costing/edit/${id}`)} />
          )}
          {canAdd && (
            <ActionButton action="duplicate" text="Duplicate" onClick={handleDuplicate} loading={duplicating} />
          )}
          <ActionButton action="print" text="Print / PDF" onClick={handlePrint} loading={printing} />
          {data.status === COSTING_STATUS.FINAL && canApprove && (
            <ActionButton action="approve" text="Approve" onClick={handleApprove} loading={approving} />
          )}
        </Space>
      </PageHeader>

      <StatusSteps
        statusFlow={COSTING_STATUS_FLOW}
        currentStatus={data.status}
        statusConfig={COSTING_STATUS_CONFIG}
        getLabel={getStatusLabel}
        size="small"
        style={{ marginBottom: 16 }}
      />

      <DraftWatermark status={data.status} draftStatuses={['Draft']}>
      <Collapse
        defaultActiveKey={['general', 'fabric', 'trims', 'manufacturing', 'overhead', 'summary']}
        items={collapseItems}
      />
      </DraftWatermark>
    </div>
  );
};

export default CostingView;
