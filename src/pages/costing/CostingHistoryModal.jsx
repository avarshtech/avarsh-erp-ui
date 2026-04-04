import { Fragment, useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Timeline,
  Row,
  Col,
  Typography,
  Tag,
  Divider,
  Empty,
  Skeleton,
  Card,
  Space,
  Descriptions,
  Statistic,
} from 'antd';
import {
  ClockCircleOutlined,
  SwapOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getCostSheetHistory } from '../../services/costingService';
import { formatCurrency } from '../../utils/costingConstants';
import { getCurrencySymbol } from '../../utils/orderConstants';
import { useTheme } from '../../context/ThemeContext';
import StatusTag from '../../components/StatusTag';
import { COSTING_STATUS_CONFIG } from '../../utils/statusConfig';
import { getStatusLabel } from '../../utils/costingConstants';

const { Text, Title } = Typography;

// ==================== FIELD DEFINITIONS ====================

const GENERAL_FIELDS = [
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'buyerName', label: 'Buyer', type: 'text' },
  { key: 'styleNo', label: 'Style #', type: 'text' },
  { key: 'garmentName', label: 'Garment', type: 'text' },
  { key: 'season', label: 'Season', type: 'text' },
  { key: 'currency', label: 'Costing Currency', type: 'text' },
  { key: 'quoteCurrency', label: 'Quote Currency', type: 'text' },
  { key: 'actualRate', label: 'Actual Rate', type: 'number' },
  { key: 'todaysRate', label: "Today's Rate", type: 'number' },
  { key: 'sizes', label: 'Sizes', type: 'array' },
];

const SUMMARY_FIELDS = [
  { key: 'totalFabricCost', label: 'Fabric Cost', type: 'currency' },
  { key: 'totalAccessoriesCost', label: 'Trims / Accessories', type: 'currency' },
  { key: 'totalManufacturingCost', label: 'Manufacturing Cost', type: 'currency' },
  { key: 'totalMarkupCost', label: 'Markup / Overhead', type: 'currency' },
  { key: 'totalMakingPrice', label: 'Total Making Price', type: 'currency', highlight: true },
  { key: 'agentCommissionPct', label: 'Agent Commission %', type: 'percent' },
  { key: 'profitPct', label: 'Profit %', type: 'percent' },
  { key: 'totalOverheadCharges', label: 'Overhead Charges', type: 'currency' },
  { key: 'totalPrice', label: 'Total Price', type: 'currency', highlight: true },
  { key: 'finalPrice', label: 'Final Price', type: 'quoteCurrency', highlight: true },
  { key: 'finalPriceUsd', label: 'Final Price (USD)', type: 'currency_usd', highlight: true },
];

const FABRIC_COMPARE_FIELDS = ['fabricType', 'classification', 'description', 'consumption', 'uom', 'fabricPrice', 'fabricWidthStd', 'fabricWidthVendor', 'vendorName', 'allowancePct', 'netCost'];
const LOCAL_TRIM_COMPARE_FIELDS = ['item', 'code', 'size', 'consumption', 'uom', 'cost', 'price'];
const IMPORTED_TRIM_COMPARE_FIELDS = ['item', 'code', 'size', 'consumption', 'uom', 'costUsd', 'priceUsd'];
const MFG_COMPARE_FIELDS = ['process', 'cost', 'comments'];
const OVERHEAD_COMPARE_FIELDS = ['description', 'cost', 'comments'];

const FABRIC_FIELD_LABELS = {
  fabricType: 'Fabric Type', classification: 'Classification', description: 'Description',
  consumption: 'Consumption', uom: 'UOM', fabricPrice: 'Price', fabricWidthStd: 'Width (Std)',
  fabricWidthVendor: 'Width (Vendor)', vendorName: 'Vendor', allowancePct: 'Allowance %', netCost: 'Net Cost',
};
const LOCAL_TRIM_FIELD_LABELS = {
  item: 'Item', code: 'Code', size: 'Size', consumption: 'Consumption', uom: 'UOM', cost: 'Cost', price: 'Price',
};
const IMPORTED_TRIM_FIELD_LABELS = {
  item: 'Item', code: 'Code', size: 'Size', consumption: 'Consumption', uom: 'UOM', costUsd: 'Cost (USD)', priceUsd: 'Price (USD)',
};
const MFG_FIELD_LABELS = { process: 'Process', cost: 'Cost', comments: 'Comments' };
const OVERHEAD_FIELD_LABELS = { description: 'Description', cost: 'Cost', comments: 'Comments' };

// ==================== DIFF FUNCTIONS ====================

const computeScalarDiff = (prevSnap, currSnap, fields) => {
  return fields.map((field) => {
    const prev = prevSnap?.[field.key];
    const curr = currSnap?.[field.key];
    let changed = false;
    if (field.type === 'currency' || field.type === 'currency_usd' || field.type === 'quoteCurrency' || field.type === 'number' || field.type === 'percent') {
      changed = Number(prev || 0) !== Number(curr || 0);
    } else if (field.type === 'array' || Array.isArray(prev) || Array.isArray(curr)) {
      changed = JSON.stringify(prev || []) !== JSON.stringify(curr || []);
    } else {
      changed = String(prev || '') !== String(curr || '');
    }
    return { ...field, prev, curr, changed };
  });
};

const computeRowDiff = (prevRows = [], currRows = [], matchKey = 'key', compareFields) => {
  const prevMap = new Map(prevRows.map((r) => [r[matchKey], r]));
  const currMap = new Map(currRows.map((r) => [r[matchKey], r]));

  const matched = [];
  const added = [];
  const removed = [];

  currRows.forEach((currRow) => {
    const prevRow = prevMap.get(currRow[matchKey]);
    if (prevRow) {
      const changedFields = compareFields.filter((f) => {
        const pv = prevRow[f];
        const cv = currRow[f];
        if (typeof pv === 'number' || typeof cv === 'number') {
          return Number(pv || 0) !== Number(cv || 0);
        }
        return String(pv || '') !== String(cv || '');
      });
      matched.push({ key: currRow[matchKey], prev: prevRow, curr: currRow, changedFields });
    } else {
      added.push(currRow);
    }
  });

  prevRows.forEach((prevRow) => {
    if (!currMap.has(prevRow[matchKey])) {
      removed.push(prevRow);
    }
  });

  const hasChanges = added.length > 0 || removed.length > 0 || matched.some((m) => m.changedFields.length > 0);
  return { matched, added, removed, hasChanges };
};

// ==================== COMPONENT ====================

const CostingHistoryModal = ({ open, onClose, costingId, recordId }) => {
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);

  useEffect(() => {
    if (open && recordId) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getCostSheetHistory(recordId);
      setHistory(data);
      if (data.length > 0) {
        setSelectedVersion(data[data.length - 1]);
      }
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleAfterClose = () => {
    setSelectedVersion(null);
    setHistory([]);
  };

  // Derived state
  const selectedIndex = history.findIndex((h) => h.version === selectedVersion?.version);
  const previousVersion = selectedIndex > 0 ? history[selectedIndex - 1] : null;
  const currentSnap = selectedVersion?.snapshot;
  const previousSnap = previousVersion?.snapshot;

  // Memoized diff results
  const diffResults = useMemo(() => {
    if (!currentSnap || !previousSnap) return null;
    return {
      general: computeScalarDiff(previousSnap, currentSnap, GENERAL_FIELDS),
      summary: computeScalarDiff(previousSnap, currentSnap, SUMMARY_FIELDS),
      fabric: computeRowDiff(previousSnap.fabricRows, currentSnap.fabricRows, 'key', FABRIC_COMPARE_FIELDS),
      localTrims: computeRowDiff(previousSnap.localTrims, currentSnap.localTrims, 'key', LOCAL_TRIM_COMPARE_FIELDS),
      importedTrims: computeRowDiff(previousSnap.importedTrims, currentSnap.importedTrims, 'key', IMPORTED_TRIM_COMPARE_FIELDS),
      manufacturing: computeRowDiff(previousSnap.manufacturingRows, currentSnap.manufacturingRows, 'key', MFG_COMPARE_FIELDS),
      overhead: computeRowDiff(previousSnap.overheadRows, currentSnap.overheadRows, 'key', OVERHEAD_COMPARE_FIELDS),
    };
  }, [currentSnap, previousSnap]);

  // Change count per version for timeline badges
  const versionChangeCounts = useMemo(() => {
    const counts = {};
    history.forEach((entry, idx) => {
      if (idx === 0) {
        counts[entry.version] = -1; // Initial version sentinel
      } else {
        const prev = history[idx - 1].snapshot;
        const curr = entry.snapshot;
        const scalarChanges = [...GENERAL_FIELDS, ...SUMMARY_FIELDS].filter((f) => {
          const pv = prev?.[f.key];
          const cv = curr?.[f.key];
          if (f.type === 'array' || Array.isArray(pv)) return JSON.stringify(pv || []) !== JSON.stringify(cv || []);
          if (f.type === 'currency' || f.type === 'number' || f.type === 'percent' || f.type === 'currency_usd' || f.type === 'quoteCurrency') return Number(pv || 0) !== Number(cv || 0);
          return String(pv || '') !== String(cv || '');
        }).length;
        const rowSections = ['fabricRows', 'localTrims', 'importedTrims', 'manufacturingRows', 'overheadRows'];
        const rowChanges = rowSections.filter((s) => JSON.stringify(prev?.[s] || []) !== JSON.stringify(curr?.[s] || [])).length;
        counts[entry.version] = scalarChanges + rowChanges;
      }
    });
    return counts;
  }, [history]);

  // ==================== STYLES ====================

  const borderColor = isDarkMode ? '#334155' : '#e2e8f0';
  const bgHeader = isDarkMode ? '#1e293b' : '#f8fafc';
  const bgNormal = isDarkMode ? '#1e293b' : '#fff';

  const stickyHeaderStyle = {
    padding: '10px 16px', textAlign: 'left', fontWeight: 600,
    borderBottom: `2px solid ${borderColor}`, background: bgHeader,
    minWidth: 160, position: 'sticky', left: 0, zIndex: 1, fontSize: 13,
  };
  const headerStyle = {
    padding: '10px 16px', textAlign: 'center', fontWeight: 600,
    borderBottom: `2px solid ${borderColor}`, background: bgHeader, minWidth: 180, fontSize: 13,
  };
  const stickyCellStyle = {
    padding: '8px 16px', borderBottom: `1px solid ${isDarkMode ? '#334155' : '#f1f5f9'}`,
    background: bgNormal, position: 'sticky', left: 0, zIndex: 1, fontSize: 13,
  };
  const cellStyle = {
    padding: '8px 16px', textAlign: 'center',
    borderBottom: `1px solid ${isDarkMode ? '#334155' : '#f1f5f9'}`, fontSize: 13,
  };
  const changedCellBg = isDarkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)';
  const addedBg = isDarkMode ? 'rgba(22, 163, 74, 0.10)' : 'rgba(22, 163, 74, 0.06)';
  const removedBg = isDarkMode ? 'rgba(220, 38, 38, 0.10)' : 'rgba(220, 38, 38, 0.06)';

  // ==================== RENDER HELPERS ====================

  const formatFieldVal = (val, fieldKey, snap) => {
    if (val === null || val === undefined) return '-';
    if (Array.isArray(val)) return val.join(', ') || '-';
    // Currency fields
    if (['totalFabricCost', 'totalAccessoriesCost', 'totalManufacturingCost', 'totalMarkupCost', 'totalMakingPrice', 'totalOverheadCharges', 'totalPrice', 'fabricPrice', 'netCost', 'cost', 'price'].includes(fieldKey)) {
      return formatCurrency(val, snap?.currency || 'INR');
    }
    if (['finalPriceUsd', 'costUsd', 'priceUsd'].includes(fieldKey)) {
      return formatCurrency(val, 'USD');
    }
    if (fieldKey === 'finalPrice') {
      return formatCurrency(val, snap?.quoteCurrency || 'USD');
    }
    if (['agentCommissionPct', 'profitPct', 'allowancePct'].includes(fieldKey)) {
      return `${val}%`;
    }
    if (['consumption'].includes(fieldKey) && typeof val === 'number') {
      return val.toFixed(4);
    }
    if (['actualRate', 'todaysRate'].includes(fieldKey) && typeof val === 'number') {
      return val.toFixed(2);
    }
    return String(val);
  };

  const renderScalarDiffTable = (diffs, title, titleColor, prevLabel, currLabel) => {
    const changedCount = diffs.filter((d) => d.changed).length;
    // Only show changed rows (plus section header)
    const changedDiffs = diffs.filter((d) => d.changed);

    return (
      <>
        <Divider orientation="left" style={{ margin: '16px 0 8px' }}>
          <Text strong style={{ color: titleColor, fontSize: 13 }}>{title}</Text>
          {changedCount > 0 ? (
            <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>{changedCount} changed</Tag>
          ) : (
            <Tag color="green" style={{ marginLeft: 8, fontSize: 11 }}>No changes</Tag>
          )}
        </Divider>
        {changedCount === 0 ? (
          <Text type="secondary" style={{ display: 'block', padding: '4px 16px', fontStyle: 'italic', fontSize: 12 }}>
            All fields identical between versions
          </Text>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={stickyHeaderStyle}>Field</th>
                  <th style={headerStyle}>{prevLabel}</th>
                  <th style={headerStyle}>{currLabel}</th>
                </tr>
              </thead>
              <tbody>
                {changedDiffs.map((d) => (
                  <tr key={d.key} style={{ background: changedCellBg }}>
                    <td style={{ ...stickyCellStyle, fontWeight: d.highlight ? 700 : 500, background: changedCellBg }}>
                      {d.label}
                    </td>
                    <td style={{ ...cellStyle, textDecoration: 'line-through', opacity: 0.6 }}>
                      {d.key === 'status' ? (
                        <StatusTag status={d.prev} config={COSTING_STATUS_CONFIG} getLabel={getStatusLabel} size="small" />
                      ) : (
                        formatFieldVal(d.prev, d.key, previousSnap)
                      )}
                    </td>
                    <td style={{ ...cellStyle, fontWeight: 700, color: '#d97706' }}>
                      {d.key === 'status' ? (
                        <StatusTag status={d.curr} config={COSTING_STATUS_CONFIG} getLabel={getStatusLabel} size="small" />
                      ) : (
                        formatFieldVal(d.curr, d.key, currentSnap)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  };

  const renderRowDiffSection = (rowDiff, title, titleColor, fieldLabels, displayKeyFn) => {
    if (!rowDiff) return null;
    const { matched, added, removed, hasChanges } = rowDiff;
    const modifiedRows = matched.filter((m) => m.changedFields.length > 0);
    const totalChanges = added.length + removed.length + modifiedRows.length;

    return (
      <>
        <Divider orientation="left" style={{ margin: '16px 0 8px' }}>
          <Text strong style={{ color: titleColor, fontSize: 13 }}>{title}</Text>
          {totalChanges > 0 ? (
            <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>
              {totalChanges} {totalChanges === 1 ? 'change' : 'changes'}
            </Tag>
          ) : (
            <Tag color="green" style={{ marginLeft: 8, fontSize: 11 }}>No changes</Tag>
          )}
        </Divider>

        {!hasChanges ? (
          <Text type="secondary" style={{ display: 'block', padding: '4px 16px', fontStyle: 'italic', fontSize: 12 }}>
            All rows identical between versions
          </Text>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={stickyHeaderStyle}>Row / Field</th>
                  <th style={headerStyle}>Previous</th>
                  <th style={headerStyle}>Current</th>
                </tr>
              </thead>
              <tbody>
                {/* Modified rows */}
                {modifiedRows.map((m) => (
                  <Fragment key={m.key}>
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          padding: '8px 16px',
                          fontWeight: 700,
                          color: '#d97706',
                          background: isDarkMode ? 'rgba(245, 158, 11, 0.06)' : 'rgba(245, 158, 11, 0.04)',
                          borderBottom: `1px solid ${isDarkMode ? '#334155' : '#f1f5f9'}`,
                          fontSize: 13,
                        }}
                      >
                        {displayKeyFn(m.curr)} <Text type="secondary" style={{ fontSize: 11 }}>(modified)</Text>
                      </td>
                    </tr>
                    {m.changedFields.map((f) => (
                      <tr key={`${m.key}-${f}`} style={{ background: changedCellBg }}>
                        <td style={{ ...stickyCellStyle, paddingLeft: 32, background: changedCellBg }}>
                          {fieldLabels[f] || f}
                        </td>
                        <td style={{ ...cellStyle, textDecoration: 'line-through', opacity: 0.6 }}>
                          {formatFieldVal(m.prev[f], f, previousSnap)}
                        </td>
                        <td style={{ ...cellStyle, fontWeight: 700, color: '#d97706' }}>
                          {formatFieldVal(m.curr[f], f, currentSnap)}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}

                {/* Added rows */}
                {added.map((row) => (
                  <tr key={row.key} style={{ background: addedBg }}>
                    <td style={{ ...stickyCellStyle, color: '#16a34a', fontWeight: 600, background: addedBg }}>
                      <PlusCircleOutlined style={{ marginRight: 6 }} />
                      {displayKeyFn(row)} <Text style={{ fontSize: 11, color: '#16a34a' }}>(added)</Text>
                    </td>
                    <td style={{ ...cellStyle, color: '#94a3b8' }}>—</td>
                    <td style={{ ...cellStyle, color: '#16a34a', fontWeight: 600 }}>New</td>
                  </tr>
                ))}

                {/* Removed rows */}
                {removed.map((row) => (
                  <tr key={row.key} style={{ background: removedBg }}>
                    <td style={{ ...stickyCellStyle, color: '#dc2626', fontWeight: 600, background: removedBg }}>
                      <MinusCircleOutlined style={{ marginRight: 6 }} />
                      {displayKeyFn(row)} <Text style={{ fontSize: 11, color: '#dc2626' }}>(removed)</Text>
                    </td>
                    <td style={{ ...cellStyle, textDecoration: 'line-through', color: '#dc2626' }}>Removed</td>
                    <td style={{ ...cellStyle, color: '#94a3b8' }}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  };

  // ==================== INITIAL VERSION VIEW ====================

  const renderInitialVersion = () => {
    const snap = currentSnap;
    if (!snap) return null;
    const cur = snap.currency || 'INR';

    return (
      <Card
        style={{
          background: isDarkMode
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%)'
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(16, 185, 129, 0.03) 100%)',
          border: `1px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)'}`,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Tag color="blue" style={{ fontSize: 13, padding: '4px 16px', borderRadius: 20 }}>
            <FileTextOutlined style={{ marginRight: 6 }} />
            Initial Version
          </Tag>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">First recorded version — no prior version to compare against</Text>
          </div>
        </div>

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label="Costing ID"><Text strong>{snap.costingId}</Text></Descriptions.Item>
          <Descriptions.Item label="Date">{snap.date ? dayjs(snap.date).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <StatusTag status={snap.status} config={COSTING_STATUS_CONFIG} getLabel={getStatusLabel} />
          </Descriptions.Item>
          <Descriptions.Item label="Buyer"><Text strong>{snap.buyerName}</Text></Descriptions.Item>
          <Descriptions.Item label="Style #">{snap.styleNo}</Descriptions.Item>
          <Descriptions.Item label="Garment">{snap.garmentName}</Descriptions.Item>
          <Descriptions.Item label="Season">{snap.season || '-'}</Descriptions.Item>
          <Descriptions.Item label="Currency">{snap.currency}</Descriptions.Item>
          <Descriptions.Item label="Quote Currency">{snap.quoteCurrency}</Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '16px 0' }} />

        <Row gutter={[16, 12]}>
          <Col xs={12} md={4}>
            <Statistic title="Fabric" value={snap.totalFabricCost || 0} prefix={getCurrencySymbol(cur)} precision={2} valueStyle={{ fontSize: 14, color: 'var(--info-color)' }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title="Trims" value={snap.totalAccessoriesCost || 0} prefix={getCurrencySymbol(cur)} precision={2} valueStyle={{ fontSize: 14, color: '#8b5cf6' }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title="Manufacturing" value={snap.totalManufacturingCost || 0} prefix={getCurrencySymbol(cur)} precision={2} valueStyle={{ fontSize: 14, color: '#f59e0b' }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title="Overhead" value={snap.totalOverheadCharges || 0} prefix={getCurrencySymbol(cur)} precision={2} valueStyle={{ fontSize: 14, color: '#64748b' }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title="Total Price" value={snap.totalPrice || 0} prefix={getCurrencySymbol(cur)} precision={2} valueStyle={{ fontSize: 15, fontWeight: 700, color: 'var(--primary-color)' }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title="Final Price (USD)" value={snap.finalPriceUsd || snap.finalPrice || 0} prefix="$" precision={2} valueStyle={{ fontSize: 15, fontWeight: 700, color: '#3b82f6' }} />
          </Col>
        </Row>
      </Card>
    );
  };

  // ==================== MAIN RENDER ====================

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ClockCircleOutlined style={{ color: 'var(--warning-color)', fontSize: 20 }} />
          <span>Costing History — {costingId}</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      afterClose={handleAfterClose}
      footer={null}
      width={1400}
      centered
      destroyOnClose
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', padding: '16px 24px' } }}
    >
      {loading ? (
        <Row gutter={24} style={{ padding: '16px 0' }}>
          <Col xs={24} md={5}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Col>
          <Col xs={24} md={19}>
            <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 8 }} />
          </Col>
        </Row>
      ) : history.length === 0 ? (
        <Empty description="No history available for this cost sheet" />
      ) : (
        <Row gutter={24}>
          {/* Left Panel — Timeline */}
          <Col xs={24} md={5}>
            <Title level={5} style={{ marginBottom: 16, color: 'var(--warning-color)' }}>
              Versions
            </Title>
            <Timeline
              items={[...history].reverse().map((entry) => {
                const isSelected = selectedVersion?.version === entry.version;
                const statusEntry = COSTING_STATUS_CONFIG[entry.status] || {};
                const changeCount = versionChangeCounts[entry.version];

                return {
                  color: isSelected ? 'var(--warning-color)' : (statusEntry.color === 'default' ? 'gray' : statusEntry.color || 'blue'),
                  children: (
                    <div
                      onClick={() => setSelectedVersion(entry)}
                      style={{
                        cursor: 'pointer',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: isSelected ? 'rgba(250, 173, 20, 0.08)' : 'transparent',
                        border: isSelected ? '1px solid rgba(250, 173, 20, 0.3)' : '1px solid transparent',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <Text strong style={{ fontSize: 13 }}>V{entry.version}</Text>
                        <StatusTag status={entry.status} config={COSTING_STATUS_CONFIG} getLabel={getStatusLabel} size="small" />
                      </div>
                      <div style={{ marginBottom: 2 }}>
                        {changeCount === -1 ? (
                          <Tag color="blue" style={{ fontSize: 10 }}>Initial</Tag>
                        ) : changeCount > 0 ? (
                          <Tag color="orange" style={{ fontSize: 10 }}>{changeCount} changes</Tag>
                        ) : (
                          <Tag color="green" style={{ fontSize: 10 }}>No changes</Tag>
                        )}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(entry.timestamp).format('DD-MMM-YYYY HH:mm')}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        By: {entry.changedBy}
                      </Text>
                    </div>
                  ),
                };
              })}
            />
          </Col>

          {/* Right Panel — Comparison View */}
          <Col xs={24} md={19}>
            {!currentSnap ? (
              <Empty description="Select a version to view changes" />
            ) : !previousSnap ? (
              renderInitialVersion()
            ) : (
              <div>
                {/* Comparison Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <Title level={5} style={{ margin: 0, fontSize: 15 }}>
                    <SwapOutlined style={{ marginRight: 8, color: 'var(--warning-color)' }} />
                    Version {previousVersion.version} vs Version {selectedVersion.version}
                  </Title>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Space size={4}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(245, 158, 11, 0.4)' }} />
                      <Text type="secondary" style={{ fontSize: 11 }}>Changed</Text>
                    </Space>
                    <Space size={4}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(22, 163, 74, 0.4)' }} />
                      <Text type="secondary" style={{ fontSize: 11 }}>Added</Text>
                    </Space>
                    <Space size={4}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(220, 38, 38, 0.4)' }} />
                      <Text type="secondary" style={{ fontSize: 11 }}>Removed</Text>
                    </Space>
                  </div>
                </div>

                {/* General Details Diff */}
                {renderScalarDiffTable(
                  diffResults.general,
                  'General Details', '#6366f1',
                  `V${previousVersion.version}`, `V${selectedVersion.version}`
                )}

                {/* Fabric Diff */}
                {renderRowDiffSection(
                  diffResults.fabric,
                  'Fabric Cost Breakup', 'var(--info-color)',
                  FABRIC_FIELD_LABELS,
                  (row) => `${row.fabricType} — ${row.description}`
                )}

                {/* Local Trims Diff */}
                {renderRowDiffSection(
                  diffResults.localTrims,
                  'Local Accessories', '#8b5cf6',
                  LOCAL_TRIM_FIELD_LABELS,
                  (row) => `${row.item} (${row.code})`
                )}

                {/* Imported Trims Diff */}
                {renderRowDiffSection(
                  diffResults.importedTrims,
                  'Imported Accessories', '#8b5cf6',
                  IMPORTED_TRIM_FIELD_LABELS,
                  (row) => `${row.item} (${row.code})`
                )}

                {/* Manufacturing Diff */}
                {renderRowDiffSection(
                  diffResults.manufacturing,
                  'Manufacturing Cost', '#f59e0b',
                  MFG_FIELD_LABELS,
                  (row) => row.process
                )}

                {/* Overhead Diff */}
                {renderRowDiffSection(
                  diffResults.overhead,
                  'Overhead / Markup', '#ef4444',
                  OVERHEAD_FIELD_LABELS,
                  (row) => row.description
                )}

                {/* Cost Summary Diff */}
                {renderScalarDiffTable(
                  diffResults.summary,
                  'Cost Summary', '#10b981',
                  `V${previousVersion.version}`, `V${selectedVersion.version}`
                )}
              </div>
            )}
          </Col>
        </Row>
      )}
    </Modal>
  );
};

export default CostingHistoryModal;
