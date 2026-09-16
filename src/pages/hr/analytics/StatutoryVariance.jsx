import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Select, DatePicker, Row, Col, Spin, Alert, Typography, Space, Table, Button, theme } from 'antd';
import dayjs from 'dayjs';
import { getStatutoryVariance } from '../../../services/hr/hrAnalyticsService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { formatRupees, formatSigned } from './bridgeFormat';
import StatutoryDriverDrawer from './StatutoryDriverDrawer';

const { Text, Title } = Typography;

/**
 * Why PF and ESI moved.
 *
 * Employee and employer stay in separate columns throughout, because they are
 * different money: one is withheld from pay, the other is a cost the company
 * carries on top of it, and a combined figure answers neither question.
 */
const StatutoryVariance = () => {
  const { token } = theme.useToken();
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [from, setFrom] = useState(dayjs().subtract(2, 'month'));
  const [to, setTo] = useState(dayjs().subtract(1, 'month'));

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null);

  useEffect(() => {
    getActiveFactories()
      .then((list) => {
        const rows = Array.isArray(list) ? list : list?.content || [];
        setFactories(rows);
        if (rows.length && factoryId === undefined) setFactoryId(rows[0].id);
      })
      .catch(() => setFactories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = useMemo(() => (factoryId && from && to ? {
    factoryId,
    fromMonth: from.month() + 1, fromYear: from.year(),
    toMonth: to.month() + 1, toYear: to.year(),
  } : null), [factoryId, from, to]);

  const fetchData = useCallback(async () => {
    if (!params) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getStatutoryVariance(params));
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'The comparison could not be built.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const driverColumns = useCallback((statuteCode) => [
    { title: 'Cause', dataIndex: 'label', key: 'label' },
    { title: 'People', dataIndex: 'headcount', key: 'headcount', width: 90, align: 'right' },
    {
      title: 'Effect', dataIndex: 'amount', key: 'amount', width: 140, align: 'right',
      render: (v) => (
        <Text strong style={{ color: Number(v) < 0 ? token.colorSuccess : token.colorWarning }}>
          {formatSigned(v)}
        </Text>
      ),
    },
    {
      title: '', key: 'who', width: 80, align: 'right',
      render: (_, r) => (
        <Button type="link" size="small"
          onClick={() => setDrill({ statute: statuteCode, code: r.code, label: r.label })}>
          Who
        </Button>
      ),
    },
  ], [token]);

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={10}>
            <Text type="secondary" style={{ fontSize: 12 }}>Factory</Text>
            <Select name="factory" value={factoryId} onChange={setFactoryId}
              style={{ width: '100%' }} placeholder="Select factory"
              options={factories.map((f) => ({
                value: f.id,
                label: `${f.factoryCode || ''} ${f.factoryName || ''}`.trim(),
              }))} />
          </Col>
          <Col xs={12} md={7}>
            <Text type="secondary" style={{ fontSize: 12 }}>From</Text>
            <DatePicker name="from" picker="month" value={from} onChange={setFrom}
              format="MMM YYYY" allowClear={false} style={{ width: '100%' }} />
          </Col>
          <Col xs={12} md={7}>
            <Text type="secondary" style={{ fontSize: 12 }}>To</Text>
            <DatePicker name="to" picker="month" value={to} onChange={setTo}
              format="MMM YYYY" allowClear={false} style={{ width: '100%' }} />
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="No comparison to show" description={error} />
      )}

      <Spin spinning={loading}>
        {data && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {data.statutes.map((s) => (
              <Card key={s.code} size="small" title={s.name}
                extra={(
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {s.contributorsBefore} → {s.contributorsAfter} contributing
                  </Text>
                )}>
                <Row gutter={[16, 12]} style={{ marginBottom: 12 }}>
                  <Col xs={12} md={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Employee share</Text>
                    <Title level={5} style={{ margin: '2px 0 0' }}>
                      {formatRupees(s.employeeAfter)}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      was {formatRupees(s.employeeBefore)} · {formatSigned(s.employeeMovement)}
                    </Text>
                  </Col>
                  <Col xs={12} md={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Employer share</Text>
                    <Title level={5} style={{ margin: '2px 0 0' }}>
                      {formatRupees(s.employerAfter)}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      was {formatRupees(s.employerBefore)} · {formatSigned(s.employerMovement)}
                    </Text>
                  </Col>
                  <Col xs={24} md={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Total remitted</Text>
                    <Title level={5} style={{
                      margin: '2px 0 0',
                      color: Number(s.totalMovement) === 0 ? undefined
                        : Number(s.totalMovement) > 0 ? token.colorWarning : token.colorSuccess,
                    }}>
                      {formatRupees(s.totalAfter)}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatSigned(s.totalMovement)}
                    </Text>
                  </Col>
                </Row>

                {s.drivers?.length > 0 ? (
                  <Table
                    rowKey="code"
                    columns={driverColumns(s.code)}
                    dataSource={s.drivers}
                    size="small"
                    pagination={false}
                    scroll={{ x: 520 }}
                  />
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>Nothing moved.</Text>
                )}
              </Card>
            ))}

            <Alert type="info" showIcon
              title="A rise can reduce ESI to nothing"
              description="The ESI wage ceiling is a cliff rather than a cap: past it no contribution is
                due at all. So a month where everybody was paid more can show ESI falling, and those
                employees appear under 'stopped being liable' rather than as a wage change." />
          </Space>
        )}
      </Spin>

      <StatutoryDriverDrawer drill={drill} params={params} onClose={() => setDrill(null)} />
    </>
  );
};

export default StatutoryVariance;
