import { useState, useCallback, useEffect, useMemo } from 'react';
import { App, Card, Empty, Row, Col, Skeleton, Tag, Typography, Space } from 'antd';
import { CalendarOutlined, UserOutlined, AppstoreOutlined, TagsOutlined, ProfileOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { getCurrentUser } from '../../../utils/permissions';
import { formatDate } from '../../../utils/formatters';
import {
  getAdjustmentList,
  getAdjustmentMetaData,
  getAdjustableVariants,
  saveAdjustment,
} from '../../../services/inventory/inventoryService';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import AdjustmentFilterCard from './AdjustmentFilterCard';
import AdjustmentCountTable from './AdjustmentCountTable';

const { Text } = Typography;

const InfoTile = ({ icon, label, children }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-secondary, rgba(255,255,255,0.06))',
      color: 'var(--primary-color)', fontSize: 16, flexShrink: 0,
    }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #8c8c8c)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{children}</div>
    </div>
  </div>
);

const StockAdjustmentForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [metaData, setMetaData] = useState([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [filter, setFilter] = useState({});
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [record, setRecord] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  useEffect(() => {
    setMetaLoading(true);
    getAdjustmentMetaData()
      .then(setMetaData)
      .catch(() => message.error('Failed to load categories'))
      .finally(() => setMetaLoading(false));
  }, [message]);

  useEffect(() => {
    if (!isEdit) return;
    setLoadingEdit(true);
    (async () => {
      try {
        const res = await getAdjustmentList();
        const adj = (res.content || []).find((a) => a.id === Number(id));
        if (!adj) return;
        setRecord(adj);
        setFilter({ categoryId: adj.categoryId, subCategoryId: adj.subCategoryId, itemTypeId: adj.itemTypeId });

        // Hydrate saved items with availableRolls so the roll dropdown can render
        // for fabric variants with multiple rolls. Match by itemCode + variantLabel.
        const variants = await getAdjustableVariants({
          categoryId: adj.categoryId,
          subCategoryId: adj.subCategoryId,
          itemTypeId: adj.itemTypeId,
        });
        const variantMap = new Map(variants.map((v) => [`${v.itemCode}__${v.variantLabel}`, v]));
        const hydrated = (adj.items || []).map((i) => {
          const match = variantMap.get(`${i.itemCode}__${i.variantLabel}`);
          return { ...i, availableRolls: match?.availableRolls || [] };
        });
        setItems(hydrated);
      } catch {
        message.error('Failed to load adjustment');
      } finally {
        setLoadingEdit(false);
      }
    })();
  }, [id, isEdit, message]);

  const handleFilterChange = useCallback(async (next) => {
    setFilter(next);
    if (!next.categoryId) {
      setItems([]);
      return;
    }
    setItemsLoading(true);
    try {
      const rows = await getAdjustableVariants(next);
      setItems(rows);
      setIsDirty(true);
    } catch {
      message.error('Failed to load items');
    } finally {
      setItemsLoading(false);
    }
  }, [message]);

  const handleItemChange = useCallback((index, patch) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    const entered = items.filter((i) => i.physicalQty !== null && i.physicalQty !== undefined);
    if (entered.length === 0) {
      message.warning('Enter physical quantity for at least one item');
      return;
    }
    const user = getCurrentUser();
    const adjustedBy = user?.fullName || user?.username || 'Unknown User';
    const cat = metaData.find((c) => c.id === filter.categoryId);
    const sub = cat?.subCategories.find((s) => s.id === filter.subCategoryId);
    const type = sub?.itemTypes.find((t) => t.id === filter.itemTypeId);

    const enriched = entered.map((i) => {
      const variance = (i.physicalQty ?? 0) - (i.inStockQty ?? 0);
      const variancePct = i.inStockQty === 0 ? (i.physicalQty ? 100 : 0) : (variance / i.inStockQty) * 100;
      return { ...i, variance, variancePct };
    });
    const totalVarianceQty = enriched.reduce((s, i) => s + i.variance, 0);
    const uom = enriched[0]?.uom;

    const payload = {
      categoryId: filter.categoryId,
      categoryName: cat?.name,
      subCategoryId: filter.subCategoryId,
      subCategoryName: sub?.name,
      itemTypeId: filter.itemTypeId,
      itemTypeName: type?.name,
      adjustedBy,
      items: enriched,
      totalVarianceQty,
      uom,
    };

    setSaving(true);
    try {
      await saveAdjustment(payload);
      clearDirty();
      message.success('Adjustment saved');
      navigate('/inventory/adjustment');
    } catch {
      message.error('Failed to save adjustment');
    } finally {
      setSaving(false);
    }
  }, [items, filter, metaData, clearDirty, message, navigate]);

  const headerTitle = useMemo(() => {
    if (!isEdit) return 'New Stock Adjustment';
    return (
      <Space size={12} wrap>
        <span>Edit Stock Adjustment</span>
        {record?.adjustmentNumber && (
          <Tag color="processing" style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', fontSize: 13, margin: 0 }}>
            {record.adjustmentNumber}
          </Tag>
        )}
      </Space>
    );
  }, [isEdit, record]);

  const infoCard = useMemo(() => {
    if (!isEdit || !record) return null;
    return (
      <Card size="small" style={{ marginBottom: 24 }} styles={{ body: { padding: 20 } }}>
        <Row gutter={[24, 20]}>
          <Col xs={24} sm={12} md={8} lg={5}>
            <InfoTile icon={<CalendarOutlined />} label="Date">{formatDate(record.adjustmentDate)}</InfoTile>
          </Col>
          <Col xs={24} sm={12} md={8} lg={5}>
            <InfoTile icon={<UserOutlined />} label="Adjusted By">{record.adjustedBy || '—'}</InfoTile>
          </Col>
          <Col xs={24} sm={12} md={8} lg={5}>
            <InfoTile icon={<AppstoreOutlined />} label="Category">
              <Tag color="blue" style={{ margin: 0 }}>{record.categoryName || '—'}</Tag>
            </InfoTile>
          </Col>
          <Col xs={24} sm={12} md={8} lg={5}>
            <InfoTile icon={<TagsOutlined />} label="Sub-Category">{record.subCategoryName || '—'}</InfoTile>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <InfoTile icon={<ProfileOutlined />} label="Item Type">
              <Text ellipsis={{ tooltip: record.itemTypeName }}>{record.itemTypeName || '—'}</Text>
            </InfoTile>
          </Col>
        </Row>
      </Card>
    );
  }, [isEdit, record]);

  const showSkeleton = isEdit && loadingEdit;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={headerTitle} backPath="/inventory/adjustment" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        <ActionButton action="save" text="Save" loading={saving} onClick={handleSave} disabled={showSkeleton} />
      </PageHeader>

      {showSkeleton ? (
        <>
          <Card size="small" style={{ marginBottom: 24 }} styles={{ body: { padding: 20 } }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
          <Card title="Items" style={{ marginBottom: 24 }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        </>
      ) : (
        <>
          {infoCard}

          {!isEdit && (
            <AdjustmentFilterCard
              metaData={metaData}
              value={filter}
              onChange={handleFilterChange}
              loading={metaLoading}
            />
          )}

          <Card title="Items" style={{ marginBottom: 24 }}>
            {items.length === 0 ? (
              <Empty description={isEdit ? 'No items in this adjustment' : 'Select category to load items'} />
            ) : (
              <AdjustmentCountTable items={items} onItemChange={handleItemChange} readOnly={false} loading={itemsLoading} />
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default StockAdjustmentForm;
