import { useState, useEffect, useMemo } from 'react';
import { App, Modal, Typography, Row, Col, Statistic, Table, Tag, Empty, Spin, Tooltip } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getBuyerPriceTrend } from '../../services/costingService';

const { Text } = Typography;

const BuyerPriceTrendModal = ({ open, onClose, buyerId, buyerName }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  useEffect(() => {
    if (open && buyerId) {
      setLoading(true);
      getBuyerPriceTrend(buyerId)
        .then(setData)
        .catch(() => message.error('Failed to load price trend'))
        .finally(() => setLoading(false));
    }
  }, [open, buyerId]);

  const stats = useMemo(() => {
    const prices = data.map((d) => Number(d.finalPriceUsd) || 0).filter((p) => p > 0);
    if (!prices.length) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return { min, max, avg, count: prices.length };
  }, [data]);

  const columns = [
    {
      title: 'Style #', dataIndex: 'styleNo', width: 130,
      render: (v) => <Text strong>{v || '-'}</Text>,
    },
    { title: 'Garment', dataIndex: 'garmentName', width: 150, ellipsis: true },
    { title: 'Season', dataIndex: 'season', width: 80 },
    {
      title: 'Date', dataIndex: 'date', width: 110,
      render: (v) => v ? dayjs(v).format('DD-MMM-YY') : '-',
    },
    { title: 'Type', dataIndex: 'costingType', width: 60, render: (v) => <Tag>{v || 'FOB'}</Tag> },
    {
      title: 'FOB Price (USD)', dataIndex: 'finalPriceUsd', width: 160,
      render: (v) => {
        const price = Number(v) || 0;
        const maxPrice = stats?.max || 1;
        const pct = (price / maxPrice) * 100;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text strong style={{ minWidth: 60 }}>$ {price.toFixed(2)}</Text>
            <Tooltip title={`$ ${price.toFixed(2)}`}>
              <div style={{ flex: 1, height: 16, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: price === stats?.min ? '#10b981' : price === stats?.max ? '#f59e0b' : '#6366f1', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <Modal
      title={<span><BarChartOutlined style={{ marginRight: 8, color: '#6366f1' }} />Buyer Price Trend — {buyerName || 'Buyer'}</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
      centered
      destroyOnClose
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : data.length === 0 ? (
        <Empty description="No approved or finalized cost sheets found for this buyer" />
      ) : (
        <>
          {stats && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic title="Lowest FOB" value={stats.min} prefix="$" precision={2} valueStyle={{ color: '#10b981', fontSize: 16 }} />
              </Col>
              <Col span={6}>
                <Statistic title="Average FOB" value={stats.avg} prefix="$" precision={2} valueStyle={{ color: '#6366f1', fontSize: 16 }} />
              </Col>
              <Col span={6}>
                <Statistic title="Highest FOB" value={stats.max} prefix="$" precision={2} valueStyle={{ color: '#f59e0b', fontSize: 16 }} />
              </Col>
              <Col span={6}>
                <Statistic title="Cost Sheets" value={stats.count} valueStyle={{ fontSize: 16 }} />
              </Col>
            </Row>
          )}
          <Table dataSource={data} columns={columns} pagination={false} size="small" rowKey="costingId" scroll={{ y: 400 }} />
        </>
      )}
    </Modal>
  );
};

export default BuyerPriceTrendModal;
