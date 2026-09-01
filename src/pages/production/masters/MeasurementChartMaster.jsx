import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Button, Alert, Tag, Empty } from 'antd';
import { FileExcelOutlined, ReloadOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { hasPermission } from '../../../utils/permissions';
import { getOrders } from '../../../services/production/sewingService';
import { getMeasurementChart } from '../../../services/production/productionMasterApi';
import MeasurementChartUpload from '../sewing/MeasurementChartUpload';
import { MODULE_ID } from './ProductionMasterPanel';

/**
 * The buyer measurement chart per style. There is no per-row edit here on
 * purpose: a chart is the buyer's document and is uploaded whole, so this
 * screen shows what is loaded and lets it be replaced.
 */
const MeasurementChartMaster = () => {
  const { message } = App.useApp();
  const [styles, setStyles] = useState([]);
  const [styleNo, setStyleNo] = useState(null);
  const [chart, setChart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const canUpload = hasPermission(MODULE_ID, 'add') || hasPermission(MODULE_ID, 'update');

  useEffect(() => {
    getOrders()
      .then((orders) => {
        // One entry per style, not per order — a chart belongs to the style.
        const seen = new Map();
        orders.forEach((o) => { if (o.styleNo && !seen.has(o.styleNo)) seen.set(o.styleNo, o); });
        setStyles([...seen.values()]);
      })
      .catch(() => message.error('Failed to load styles'));
  }, [message]);

  const load = useCallback(async (style) => {
    if (!style) { setChart([]); return; }
    setLoading(true);
    try {
      setChart(await getMeasurementChart(style));
    } catch {
      message.error('Failed to load the measurement chart');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(styleNo); }, [styleNo, load]);

  /** One row per point, one column per size — the sheet as the buyer wrote it. */
  const { rows, columns, sizes, sourceFile } = useMemo(() => {
    // Sizes read left to right in the order's own size run, not alphabetically:
    // "104/4" sorting before "92/2" makes a size ladder meaningless.
    const runOrder = styles.find((o) => o.styleNo === styleNo)?.sizes ?? [];
    const sizeList = [...new Set(chart.map((c) => c.size))].sort((a, b) => {
      const ai = runOrder.indexOf(a);
      const bi = runOrder.indexOf(b);
      if (ai < 0 && bi < 0) return a.localeCompare(b);
      if (ai < 0) return 1;
      if (bi < 0) return -1;
      return ai - bi;
    });
    const byPoint = new Map();
    chart.forEach((c) => {
      const row = byPoint.get(c.point) || { point: c.point, tolerance: c.tolerance };
      row[c.size] = c.spec;
      byPoint.set(c.point, row);
    });
    return {
      sizes: sizeList,
      sourceFile: chart[0]?.sourceFileName,
      rows: [...byPoint.values()],
      columns: [
        { title: 'Measurement Point', dataIndex: 'point', width: 220, fixed: 'left' },
        { title: 'Tol ±', dataIndex: 'tolerance', width: 90, align: 'center', render: (v) => Number(v) },
        ...sizeList.map((size) => ({
          title: size, dataIndex: size, width: 100, align: 'right',
          render: (v) => (v == null ? '—' : Number(v)),
        })),
      ],
    };
  }, [chart, styles, styleNo]);

  return (
    <Card
      title={<span style={{ fontWeight: 600 }}>Measurement Charts</span>}
      extra={(
        <Space wrap>
          <FormSelect value={styleNo} style={{ width: 280 }} placeholder="Select style" showSearch
            optionFilterProp="label"
            options={styles.map((o) => ({ value: o.styleNo, label: `${o.styleNo} · ${o.buyer || o.orderNo}` }))}
            onChange={setStyleNo} />
          <Button icon={<ReloadOutlined />} disabled={!styleNo} onClick={() => load(styleNo)}>Refresh</Button>
          {canUpload && (
            <Button type="primary" icon={<FileExcelOutlined />} disabled={!styleNo}
              onClick={() => setUploadOpen(true)}>
              Upload Chart
            </Button>
          )}
        </Space>
      )}
    >
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        title="Charts are uploaded, not typed row by row"
        description="A chart is the buyer's document: uploading one replaces the style's chart outright. Measurement reports already saved keep the spec they were measured against, so replacing a chart never rewrites an inspection that already happened." />

      {!styleNo && <Empty description="Select a style to see its measurement chart" />}

      {styleNo && !loading && chart.length === 0 && (
        <Empty description={`No chart uploaded for ${styleNo} yet`} />
      )}

      {styleNo && chart.length > 0 && (
        <>
          <Space style={{ marginBottom: 12 }} wrap>
            <Tag color="blue">{rows.length} points</Tag>
            <Tag color="blue">{sizes.length} sizes</Tag>
            {sourceFile && <span style={{ color: 'var(--text-secondary)' }}>from <code>{sourceFile}</code></span>}
          </Space>
          <Table rowKey="point" size="small" columns={columns} dataSource={rows} loading={loading}
            pagination={false} scroll={{ x: 'max-content', y: 460 }} />
        </>
      )}

      <MeasurementChartUpload open={uploadOpen} styleNo={styleNo}
        onClose={() => setUploadOpen(false)}
        onSaved={() => { setUploadOpen(false); load(styleNo); }} />
    </Card>
  );
};

export default MeasurementChartMaster;
