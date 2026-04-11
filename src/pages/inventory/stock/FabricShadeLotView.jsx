import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Input, Row, Col, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import { getFabricStock } from '../../../services/inventory/inventoryService';
import ShadeLotGroupCard from './ShadeLotGroupCard';

const FabricShadeLotView = () => {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFabricStock({});
      setData(res.content || []);
    } catch {
      message.error('Failed to load fabric stock');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groups = useMemo(() => {
    const map = {};
    const filtered = searchText
      ? data.filter((r) => r.fabricDescription?.toLowerCase().includes(searchText.toLowerCase()))
      : data;
    filtered.forEach((roll) => {
      const key = roll.shadeLot || 'Unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(roll);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [data, searchText]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Shade Lot View" backPath="/inventory/stock" style={{ position: 'sticky', top: 64, zIndex: 10 }} />

      <div style={{ marginBottom: 20 }}>
        <Input
          placeholder="Search by fabric type..."
          prefix={<SearchOutlined />}
          style={{ width: 300 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState title="No shade lots found" description="Adjust your search criteria" />
      ) : (
        <Row gutter={[16, 16]}>
          {groups.map(([lot, rolls]) => (
            <Col key={lot} xs={24} sm={12} lg={8}>
              <ShadeLotGroupCard shadeLot={lot} rolls={rolls} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default FabricShadeLotView;
