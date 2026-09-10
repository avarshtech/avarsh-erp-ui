import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Select, DatePicker, Segmented, Row, Col, Button, Spin, Alert, Typography, Space } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getPayrollBridge } from '../../../services/hr/hrAnalyticsService';
import { getActiveFactories } from '../../../services/master/factoryService';
import BridgeDriverBars from './BridgeDriverBars';
import BridgeDriverDrawer from './BridgeDriverDrawer';
import BridgeSummary from './BridgeSummary';

const { Text } = Typography;

const MEASURES = [
  { value: 'NET', label: 'Net pay' },
  { value: 'GROSS', label: 'Gross earnings' },
  { value: 'CTC', label: 'Cost to company' },
];

/**
 * Why the payroll total moved between two periods.
 *
 * The periods are months rather than a free date range on purpose: a salary
 * record exists per employee per run, so there is no such thing as payroll cost
 * for the 5th to the 19th. Offering a range here and quietly rounding it to
 * whole months would be the kind of thing a user only notices once.
 */
const PayrollBridge = () => {
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [from, setFrom] = useState(dayjs().subtract(2, 'month'));
  const [to, setTo] = useState(dayjs().subtract(1, 'month'));
  const [measure, setMeasure] = useState('NET');

  const [loading, setLoading] = useState(false);
  const [bridge, setBridge] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);

  useEffect(() => {
    getActiveFactories()
      .then((list) => {
        const rows = Array.isArray(list) ? list : list?.content || [];
        setFactories(rows);
        if (rows.length && factoryId === undefined) setFactoryId(rows[0].id);
      })
      .catch(() => setFactories([]));
    // Runs once; the factory list does not change while the screen is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = useMemo(() => (factoryId && from && to ? {
    factoryId,
    fromMonth: from.month() + 1,
    fromYear: from.year(),
    toMonth: to.month() + 1,
    toYear: to.year(),
    measure,
  } : null), [factoryId, from, to, measure]);

  const fetchBridge = useCallback(async () => {
    if (!params) return;
    setLoading(true);
    setError(null);
    try {
      setBridge(await getPayrollBridge(params));
    } catch (err) {
      setBridge(null);
      setError(err?.response?.data?.message || 'The comparison could not be built.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchBridge(); }, [fetchBridge]);

  const swap = useCallback(() => { setFrom(to); setTo(from); }, [from, to]);

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} sm={12} md={6}>
            <Text type="secondary" style={{ fontSize: 12 }}>Factory</Text>
            <Select
              name="factory"
              value={factoryId}
              onChange={setFactoryId}
              style={{ width: '100%' }}
              placeholder="Select factory"
              options={factories.map((f) => ({
                value: f.id,
                label: `${f.factoryCode || ''} ${f.factoryName || ''}`.trim(),
              }))}
            />
          </Col>
          <Col xs={10} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>Compare from</Text>
            <DatePicker name="from" picker="month" value={from} onChange={setFrom}
              format="MMM YYYY" allowClear={false} style={{ width: '100%' }} />
          </Col>
          <Col xs={4} sm={2} md={1} style={{ textAlign: 'center' }}>
            <Button icon={<SwapOutlined />} onClick={swap} aria-label="Swap the two periods" />
          </Col>
          <Col xs={10} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>to</Text>
            <DatePicker name="to" picker="month" value={to} onChange={setTo}
              format="MMM YYYY" allowClear={false} style={{ width: '100%' }} />
          </Col>
          <Col xs={24} md={9}>
            <div><Text type="secondary" style={{ fontSize: 12 }}>Measure</Text></div>
            <Segmented options={MEASURES} value={measure} onChange={setMeasure} />
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="No comparison to show" description={error} />
      )}

      <Spin spinning={loading}>
        {bridge && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <BridgeSummary bridge={bridge} />
            <Card size="small" title="What moved the total">
              <BridgeDriverBars drivers={bridge.drivers || []} onSelect={setSelectedDriver} />
            </Card>
          </Space>
        )}
      </Spin>

      <BridgeDriverDrawer
        driver={selectedDriver}
        params={params}
        onClose={() => setSelectedDriver(null)}
      />
    </>
  );
};

export default PayrollBridge;
