import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Drawer,
  Button,
  Checkbox,
  Tag,
  Space,
  Typography,
  Alert,
  Collapse,
  Row,
  Col,
  Divider,
  Empty,
  Badge,
  Input,
  App,
} from 'antd';
import {
  CheckOutlined,
  LockOutlined,
  ShoppingCartOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { ActionButton } from '../../components/buttons';
import PantoneColorSwatch from '../../components/PantoneColorSwatch';
import SampleOrderTag from '../../components/SampleOrderTag';
import useSampleOrderNos from '../../hooks/useSampleOrderNos';
import RecentSuggestionsButton from '../../components/RecentSuggestionsButton';
import { isPantoneCode } from '../../services/core/pantoneService';
import { getRecentBoms } from '../../services/bom/bomService';
import orderInputIllustration from '../../assets/images/order-input-illustration.svg';
import { formattedIdKeyDown } from '../../utils/inputHelpers';

const { Text } = Typography;

/** Format order number with SG/ prefix and auto-hyphens/slashes (same as BOMForm) */
const ORDER_NO_PATTERN = /^SG\/\d{2}-\d{2}\/\d{4,}$/;
const formatOrderNo = (raw, prev = '') => {
  const prefix = 'SG/';
  if (!raw || raw.length < prefix.length) return prefix;
  const isDeleting = raw.length < prev.length;
  if (isDeleting && raw.length <= prefix.length) return prefix;
  let digits = raw.slice(prefix.length).replace(/[^0-9]/g, '');
  // When deleting and the removed char was a separator (- or /),
  // also remove the digit before it so backspace feels natural
  if (isDeleting && prev.length > prefix.length) {
    const removedChar = prev[raw.length];
    if (removedChar === '-' || removedChar === '/') {
      digits = digits.slice(0, -1);
    }
  }
  let result = prefix;
  for (let i = 0; i < digits.length; i++) {
    if (i === 2) result += '-';
    if (i === 4) result += '/';
    result += digits[i];
  }
  if (!isDeleting) {
    if (digits.length === 2 && !result.endsWith('-')) result += '-';
    if (digits.length === 4 && !result.endsWith('/')) result += '/';
  }
  return result;
};

/**
 * Detect if a BOM line is Fabric category.
 * Reuses same pattern from BOMForm.jsx.
 */
const isFabricLine = (line) =>
  (line?.categoryName || '').toLowerCase().includes('fabric');

/**
 * BomLineSelectionDrawer
 *
 * Drawer for selecting BOM lines when creating Regular/Combined POs.
 * Includes order number input at the top, then groups lines by order
 * and category (Fabric / Trims).
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - poType: 'Regular' | 'Combined'
 *  - bomOrders: [{ orderNo, bomId, styleName, season, orderQty, bomLines: [...] }]
 *  - onBomOrdersChange: (orders) => void — updates parent state
 *  - onFetchBom: (orderNo) => Promise — fetches BOM and adds to bomOrders
 *  - bomLoading: boolean
 *  - supplierFabric: boolean
 *  - supplierTrims: boolean
 *  - existingBomLineIds: Set<number>
 *  - onConfirm: (selectedLines: [{ bomLine, bomId }]) => void
 */
const BomLineSelectionDrawer = ({
  open,
  onClose,
  poType,
  bomOrders = [],
  onBomOrdersChange,
  onFetchBom,
  bomLoading = false,
  supplierFabric = false,
  supplierTrims = false,
  existingBomLineIds = new Set(),
  onConfirm,
}) => {
  const { message } = App.useApp();
  const { isSampleOrder } = useSampleOrderNos();
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [orderNoInput, setOrderNoInput] = useState('SG/');
  const [recentBoms, setRecentBoms] = useState([]);

  // Fetch recently created BOMs (suggestions) each time the drawer opens
  useEffect(() => {
    if (!open) return;
    getRecentBoms().then(setRecentBoms).catch(() => setRecentBoms([]));
  }, [open]);

  const recentBomItems = useMemo(() => {
    const usedOrderNos = new Set(bomOrders.map((o) => o.orderNo));
    return recentBoms
      .filter((b) => b.orderNo && !usedOrderNos.has(b.orderNo))
      .map((b) => ({
        value: b.orderNo,
        label: [b.orderNo, b.styleName, b.season].filter(Boolean).join(' · '),
      }));
  }, [recentBoms, bomOrders]);

  // Initialize selection and reset input when drawer opens
  useMemo(() => {
    if (open) setOrderNoInput('SG/');
    if (open && existingBomLineIds.size > 0) {
      const keys = new Set();
      bomOrders.forEach((order) => {
        (order.bomLines || []).forEach((line) => {
          if (existingBomLineIds.has(line.id)) {
            keys.add(`${order.bomId}_${line.id}`);
          }
        });
      });
      setSelectedKeys(keys);
    } else if (open) {
      setSelectedKeys(new Set());
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine filtering
  const showFabric = supplierFabric;
  const showTrims = supplierTrims;
  const showAll = supplierFabric && supplierTrims;

  const filterMessage = useMemo(() => {
    if (showAll || (!supplierFabric && !supplierTrims)) return null;
    if (supplierFabric && !supplierTrims) return 'Showing Fabric lines only — supplier supplies fabric';
    if (!supplierFabric && supplierTrims) return 'Showing Trims lines only — supplier supplies trims';
    return null;
  }, [supplierFabric, supplierTrims, showAll]);

  // Compute filtered lines per order
  const ordersWithFilteredLines = useMemo(() => {
    return bomOrders.map((order) => {
      const allLines = order.bomLines || [];
      const filteredLines = allLines.filter((line) => {
        const isFabric = isFabricLine(line);
        if (showAll) return true;
        if (showFabric && !showTrims) return isFabric;
        if (showTrims && !showFabric) return !isFabric;
        return true;
      });
      const fabricLines = filteredLines.filter(isFabricLine);
      const trimLines = filteredLines.filter((l) => !isFabricLine(l));
      return { ...order, fabricLines, trimLines, filteredLines };
    });
  }, [bomOrders, showAll, showFabric, showTrims]);

  const toggleLine = useCallback((bomId, lineId) => {
    const key = `${bomId}_${lineId}`;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((bomId, lines, checked) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      lines.forEach((line) => {
        if (line.isPoGenerated) return;
        const key = `${bomId}_${line.id}`;
        if (checked) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  }, []);

  const selectedCount = selectedKeys.size;

  // Handle Load BOM button click (also used by the recent-BOM suggestion picker, which
  // passes the order number directly instead of reading it from orderNoInput)
  const handleLoadBom = useCallback(async (overrideVal) => {
    const val = (overrideVal ?? orderNoInput)?.trim();
    if (!val || val === 'SG/') {
      message.warning('Please enter an order number');
      return;
    }
    if (!ORDER_NO_PATTERN.test(val)) {
      message.warning('Enter a valid order number (e.g. SG/25-26/1001)');
      return;
    }
    if (poType === 'Combined' && bomOrders.some(o => o.orderNo === val)) {
      message.warning('This order has already been added');
      return;
    }
    await onFetchBom(val);
    setOrderNoInput('SG/');
  }, [orderNoInput, onFetchBom, poType, bomOrders]);

  // Remove an order (Combined only)
  const handleRemoveOrder = useCallback((orderNo) => {
    // Deselect lines from removed order
    const orderToRemove = bomOrders.find(o => o.orderNo === orderNo);
    if (orderToRemove) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        (orderToRemove.bomLines || []).forEach((line) => {
          next.delete(`${orderToRemove.bomId}_${line.id}`);
        });
        return next;
      });
    }
    onBomOrdersChange(bomOrders.filter(o => o.orderNo !== orderNo));
  }, [bomOrders, onBomOrdersChange]);

  const handleConfirm = useCallback(() => {
    const selectedLines = [];
    bomOrders.forEach((order) => {
      (order.bomLines || []).forEach((line) => {
        if (selectedKeys.has(`${order.bomId}_${line.id}`)) {
          selectedLines.push({ bomLine: line, bomId: order.bomId });
        }
      });
    });
    onConfirm(selectedLines);
    onClose();
  }, [selectedKeys, bomOrders, onConfirm, onClose]);

  // Render a single BOM line row
  const renderLineRow = (line, bomId) => {
    const key = `${bomId}_${line.id}`;
    const isLocked = !!line.isPoGenerated;
    const isSelected = selectedKeys.has(key);

    return (
      <div
        key={key}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color, #f0f0f0)',
          opacity: isLocked ? 0.5 : 1,
          background: isSelected && !isLocked ? 'rgba(22, 119, 255, 0.04)' : 'transparent',
        }}
      >
        <Checkbox
          checked={isSelected}
          disabled={isLocked}
          onChange={() => toggleLine(bomId, line.id)}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text strong style={{ fontSize: 13 }}>{line.variantCode || line.itemCode}</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>{line.variantName || line.itemName}</Text>
            {isLocked && (
              <Tag color="warning" icon={<LockOutlined />} style={{ fontSize: 11 }}>
                PO Placed
              </Tag>
            )}
          </div>
          {line.variants && Object.keys(line.variants).length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(line.variants).map(([attr, val]) => {
                const strVal = String(val);
                if (isPantoneCode(strVal)) {
                  return (
                    <Tag key={attr} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                      <PantoneColorSwatch code={strVal} size={10} style={{ marginRight: 3 }} />
                      {strVal}
                    </Tag>
                  );
                }
                return (
                  <Tag key={attr} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                    {attr}: {strVal}
                  </Tag>
                );
              })}
            </div>
          )}
          {(line.categoryName || line.subCategoryName) && (
            <div style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {[line.categoryName, line.subCategoryName].filter(Boolean).join(' > ')}
              </Text>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: 110, flexShrink: 0 }}>
          {/* Quantity the PO will be raised in; lines saved before UOM conversion fall back */}
          <Text strong style={{ fontSize: 13 }}>
            {(line.purchaseQtyPrimary ?? line.purchaseQty) != null
              ? Number(line.purchaseQtyPrimary ?? line.purchaseQty).toLocaleString('en-IN', { maximumFractionDigits: 2 })
              : '-'}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{line.purchaseUom || line.uom || ''}</Text>
          {line.purchaseQtyPrimary != null && Number(line.uomConversionFactor) > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 10 }}>
                {Number(line.purchaseQty).toLocaleString('en-IN', { maximumFractionDigits: 2 })} {line.uom}
              </Text>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGroupHeader = (label, lines, bomId, color) => {
    const selectableLines = lines.filter((l) => !l.isPoGenerated);
    const allSelected = selectableLines.length > 0 && selectableLines.every((l) => selectedKeys.has(`${bomId}_${l.id}`));
    const someSelected = selectableLines.some((l) => selectedKeys.has(`${bomId}_${l.id}`));

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <div style={{ width: 4, height: 16, borderRadius: 2, background: color }} />
          <Text strong>{label}</Text>
          <Badge count={lines.length} style={{ background: 'var(--primary-bg, #e6f4ff)', color: 'var(--primary-color)', fontSize: 11 }} />
        </Space>
        {selectableLines.length > 0 && (
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onChange={(e) => toggleGroup(bomId, selectableLines, e.target.checked)}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>Select All</Text>
          </Checkbox>
        )}
      </div>
    );
  };

  const collapseItems = useMemo(() => {
    const items = [];
    ordersWithFilteredLines.forEach((order) => {
      const orderItems = [];
      if (order.fabricLines.length > 0) {
        orderItems.push({
          key: `${order.bomId}_fabric`,
          label: renderGroupHeader('Fabric', order.fabricLines, order.bomId, '#6366f1'),
          children: order.fabricLines.map((line) => renderLineRow(line, order.bomId)),
        });
      }
      if (order.trimLines.length > 0) {
        orderItems.push({
          key: `${order.bomId}_trims`,
          label: renderGroupHeader('Trims', order.trimLines, order.bomId, '#10b981'),
          children: order.trimLines.map((line) => renderLineRow(line, order.bomId)),
        });
      }
      if (orderItems.length > 0) {
        items.push({ order, orderItems });
      }
    });
    return items;
  }, [ordersWithFilteredLines, selectedKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  const noMatchingLines = !supplierFabric && !supplierTrims;
  const isRegular = poType === 'Regular';

  return (
    <Drawer
      title={
        <Space>
          <ShoppingCartOutlined />
          <span>Select BOM Lines for PO</span>
        </Space>
      }
      placement="right"
      width={Math.min(720, typeof window !== 'undefined' ? window.innerWidth : 720)}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton action="close" text="Cancel" onClick={onClose} />
          <ActionButton
            action="save"
            text={`Add ${selectedCount} Line${selectedCount !== 1 ? 's' : ''} to PO`}
            icon={<CheckOutlined />}
            onClick={handleConfirm}
            disabled={selectedCount === 0}
          />
        </div>
      }
    >
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Order Number Input — hidden for Regular when order is loaded */}
        {!(isRegular && bomOrders.length > 0) && (
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 13 }}>
                {isRegular ? 'Order No' : 'Add Order No'}
              </Text>
            </div>
            <Row gutter={8}>
              <Col span={14}>
                <Input
                  placeholder="SG/25-26/1001"
                  inputMode="numeric"
                  value={orderNoInput || 'SG/'}
                  onChange={(e) => setOrderNoInput(formatOrderNo(e.target.value, orderNoInput))}
                  onKeyDown={(e) => formattedIdKeyDown(e, 'SG/')}
                  onPressEnter={() => handleLoadBom()}
                  disabled={bomLoading}
                  suffix={
                    <RecentSuggestionsButton
                      items={recentBomItems}
                      onSelect={handleLoadBom}
                      disabled={bomLoading}
                      placement="bottomRight"
                    />
                  }
                />
              </Col>
              <Col span={10}>
                <Button
                  type="primary"
                  block
                  onClick={() => handleLoadBom()}
                  loading={bomLoading}
                  disabled={!orderNoInput || orderNoInput === 'SG/' || bomLoading}
                >
                  {isRegular ? 'Load BOM' : 'Add Order'}
                </Button>
              </Col>
            </Row>
          </div>
        )}

        {/* Loaded orders — statistic-style */}
        {bomOrders.length > 0 && (
          <div style={{ padding: '12px 16px 0' }}>
            {bomOrders.map((order, idx) => (
              <div key={order.orderNo}>
                {idx > 0 && <Divider style={{ margin: '8px 0' }} />}
                <Row gutter={[12, 6]} align="middle">
                  <Col flex="auto">
                    <Row gutter={[16, 4]}>
                      <Col>
                        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Order No</Text>
                        <Text strong style={{ fontSize: 13, color: 'var(--primary-color)' }}>
                          {order.orderNo}
                          {isSampleOrder(order.orderNo) && <SampleOrderTag />}
                        </Text>
                      </Col>
                      <Col>
                        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Style</Text>
                        <Text strong style={{ fontSize: 13 }}>{order.styleName || '-'}</Text>
                      </Col>
                      <Col>
                        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Season</Text>
                        <Text strong style={{ fontSize: 13 }}>{order.season || '-'}</Text>
                      </Col>
                      <Col>
                        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Qty</Text>
                        <Text strong style={{ fontSize: 13 }}>{order.orderQty?.toLocaleString('en-IN') || '-'}</Text>
                      </Col>
                    </Row>
                  </Col>
                  <Col flex="none">
                    <CloseCircleOutlined
                      style={{ fontSize: 16, color: 'var(--error-color)', cursor: 'pointer' }}
                      onClick={() => handleRemoveOrder(order.orderNo)}
                    />
                  </Col>
                </Row>
              </div>
            ))}
          </div>
        )}

        {/* Filter alert */}
        {bomOrders.length > 0 && filterMessage && (
          <Alert
            type="info"
            message={filterMessage}
            showIcon
            banner
            style={{ marginTop: 8 }}
          />
        )}

        {noMatchingLines && bomOrders.length > 0 && (
          <Alert
            type="warning"
            message="This supplier does not supply fabric or trims. No BOM lines can be selected."
            showIcon
            banner
            style={{ marginTop: 8 }}
          />
        )}

        <Divider style={{ margin: '12px 0 0' }} />

        {/* Empty state when no orders loaded — illustration pointing to input */}
        {bomOrders.length === 0 && (
          <div style={{ padding: '40px 40px', textAlign: 'center' }}>
            <img
              src={orderInputIllustration}
              alt="Enter order number"
              style={{ width: 200, height: 182, margin: '0 auto 16px', display: 'block', opacity: 0.9 }}
            />
            <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 6 }}>
              Enter an Order Number
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Type the order number above and click <Text strong style={{ fontSize: 13 }}>&ldquo;Load BOM&rdquo;</Text> to fetch BOM lines for selection
            </Text>
          </div>
        )}

        {/* BOM line sections */}
        {collapseItems.length === 0 && bomOrders.length > 0 && !noMatchingLines && (
          <div style={{ padding: 40 }}>
            <Empty description="No matching BOM lines for this supplier" />
          </div>
        )}

        {collapseItems.map(({ order, orderItems }) => (
          <div key={order.bomId}>
            <div style={{ margin: '8px 16px' }}>
              <Collapse
                defaultActiveKey={orderItems.map((i) => i.key)}
                ghost
                size="small"
                items={orderItems}
                style={{ background: 'var(--bg-secondary, #fafafa)', borderRadius: 8 }}
              />
            </div>
            {collapseItems.length > 1 && <Divider style={{ margin: '4px 0' }} />}
          </div>
        ))}
      </div>
    </Drawer>
  );
};

export default BomLineSelectionDrawer;
