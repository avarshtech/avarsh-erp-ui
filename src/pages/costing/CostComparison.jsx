import { useState, useEffect } from 'react';
import {
  App,
  Card,
  Button,
  Select,
  Typography,
  Row,
  Col,
  Space,
  Empty,
} from 'antd';
import {
  SwapOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getAllCostSheetSummaries,
  getCostSheetById,
} from '../../services/costing/costingService';
import {
  getStatusLabel,
  formatCurrency,
} from '../../utils/costingConstants';
import { useTheme } from '../../context/ThemeContext';
import StatusTag from '../../components/StatusTag';
import PageHeader from '../../components/PageHeader';
import { COSTING_STATUS_CONFIG } from '../../utils/statusConfig';

const { Text, Title } = Typography;

const CostComparison = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [allSheets, setAllSheets] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSummaries();
  }, []);

  const loadSummaries = async () => {
    try {
      const summaries = await getAllCostSheetSummaries();
      setAllSheets(summaries);
    } catch {
      message.error('Failed to load cost sheets');
    }
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) {
      message.warning('Please select at least 2 cost sheets to compare');
      return;
    }
    setLoading(true);
    try {
      const sheets = await Promise.all(
        selectedIds.map((id) => getCostSheetById(id))
      );
      setComparisonData(sheets);
    } catch {
      message.error('Failed to load comparison data');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedIds([]);
    setComparisonData([]);
  };

  // Find min/max for highlighting differences
  const getHighlightStyle = (value, allValues) => {
    const nums = allValues.filter((v) => typeof v === 'number' && !isNaN(v));
    if (nums.length < 2) return {};
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (value === min && min !== max) {
      return {
        background: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
        fontWeight: 700,
        color: '#10b981',
      };
    }
    if (value === max && min !== max) {
      return {
        background: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
        fontWeight: 700,
        color: '#f59e0b',
      };
    }
    return {};
  };

  const comparisonFields = [
    { label: 'Costing ID', key: 'costingId', type: 'text' },
    { label: 'Status', key: 'status', type: 'status' },
    { label: 'Costing Type', key: 'costingType', type: 'text' },
    { label: 'Buyer', key: 'buyerName', type: 'text' },
    { label: 'Style #', key: 'styleNo', type: 'text' },
    { label: 'Garment Name', key: 'garmentName', type: 'text' },
    { label: 'Season', key: 'season', type: 'text' },
    { label: 'Pricing Unit', key: 'pricingUnit', type: 'text' },
    { label: 'Currency', key: 'currency', type: 'text' },
    { label: 'Quote Currency', key: 'quoteCurrency', type: 'text' },
    { label: 'Actual Rate', key: 'actualRate', type: 'number' },
    { label: 'Fabric Cost', key: 'totalFabricCost', type: 'currency' },
    { label: 'Trims / Accessories', key: 'totalAccessoriesCost', type: 'currency' },
    { label: 'Manufacturing Cost', key: 'totalManufacturingCost', type: 'currency' },
    { label: 'Markup / Overhead', key: 'totalMarkupCost', type: 'currency' },
    { label: 'Total Making Price', key: 'totalMakingPrice', type: 'currency', highlight: true },
    { label: 'Agent Commission %', key: 'agentCommissionPct', type: 'percent' },
    { label: 'Profit %', key: 'profitPct', type: 'percent' },
    { label: 'Total Price', key: 'totalPrice', type: 'currency', highlight: true },
    { label: 'Final Price', key: 'finalPrice', type: 'quoteCurrency', highlight: true },
  ];

  const renderValue = (field, sheet) => {
    const val = sheet[field.key];
    switch (field.type) {
      case 'status':
        return (
          <StatusTag
            status={val}
            config={COSTING_STATUS_CONFIG}
            getLabel={getStatusLabel}
          />
        );
      case 'currency':
        return formatCurrency(val, sheet.currency);
      case 'quoteCurrency':
        return formatCurrency(val, sheet.quoteCurrency);
      case 'percent':
        return `${val || 0}%`;
      case 'number':
        return val?.toFixed(2) || '-';
      default:
        return val || '-';
    }
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Cost Comparison" backPath="/costing/list" />

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Select
              mode="multiple"
              placeholder="Search and select 2-4 cost sheets to compare..."
              style={{ width: '100%' }}
              value={selectedIds}
              onChange={(vals) => {
                if (vals.length <= 4) setSelectedIds(vals);
                else message.warning('Maximum 4 cost sheets can be compared');
              }}
              showSearch
              optionFilterProp="label"
              options={allSheets.map((s) => ({
                value: s.id,
                label: `${s.costingId} — ${s.styleNo} — ${s.buyerName}`,
              }))}
              maxTagCount={4}
            />
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<SwapOutlined />}
                onClick={handleCompare}
                loading={loading}
                disabled={selectedIds.length < 2}
              >
                Compare
              </Button>
              <Button icon={<ClearOutlined />} onClick={handleClear}>
                Clear
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {comparisonData.length > 0 ? (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      borderBottom: `2px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                      background: isDarkMode ? '#1e293b' : '#f8fafc',
                      minWidth: 180,
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                    }}
                  >
                    Field
                  </th>
                  {comparisonData.map((sheet) => (
                    <th
                      key={sheet.id}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        borderBottom: `2px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                        background: isDarkMode ? '#1e293b' : '#f8fafc',
                        minWidth: 180,
                      }}
                    >
                      <Text strong style={{ color: 'var(--primary-color)' }}>
                        {sheet.costingId}
                      </Text>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFields.map((field, idx) => {
                  const allValues = comparisonData.map((s) => s[field.key]);
                  const isSectionBreak = ['Fabric Cost', 'Total Making Price', 'Total Price'].includes(field.label);

                  return (
                    <tr
                      key={field.key}
                      style={{
                        borderTop: isSectionBreak
                          ? `2px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`
                          : undefined,
                      }}
                    >
                      <td
                        style={{
                          padding: '10px 16px',
                          borderBottom: `1px solid ${isDarkMode ? '#334155' : '#f1f5f9'}`,
                          fontWeight: field.highlight ? 700 : 500,
                          fontSize: field.highlight ? 14 : 13,
                          background: isDarkMode ? '#1e293b' : '#fff',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        {field.label}
                      </td>
                      {comparisonData.map((sheet) => {
                        const numVal = typeof sheet[field.key] === 'number' ? sheet[field.key] : null;
                        const hlStyle = field.highlight && numVal !== null
                          ? getHighlightStyle(numVal, allValues)
                          : {};

                        return (
                          <td
                            key={sheet.id}
                            style={{
                              padding: '10px 16px',
                              textAlign: 'center',
                              borderBottom: `1px solid ${isDarkMode ? '#334155' : '#f1f5f9'}`,
                              fontSize: field.highlight ? 15 : 13,
                              ...hlStyle,
                            }}
                          >
                            {renderValue(field, sheet)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 16, justifyContent: 'center' }}>
            <Space>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(16, 185, 129, 0.3)' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>Lowest value</Text>
            </Space>
            <Space>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(245, 158, 11, 0.3)' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>Highest value</Text>
            </Space>
          </div>
        </Card>
      ) : (
        <Card>
          <Empty
            description="Select 2-4 cost sheets above and click Compare to view side-by-side comparison"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
    </div>
  );
};

export default CostComparison;
