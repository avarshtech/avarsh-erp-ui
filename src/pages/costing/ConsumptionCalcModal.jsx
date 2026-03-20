/**
 * ConsumptionCalcModal
 *
 * AI-powered fabric consumption calculator from measurement chart + optional techpack.
 *
 * Formulas (applied by backend Gemini AI):
 *   Knits: L × W × NOP × GSM / 10000 per panel → grams → kg (with waste factor)
 *   Woven: panel area / fabric_width / marker_efficiency → meters (with wastage)
 *
 * Apply options:
 *   "Use this value"    → sets consumption on the current fabric row for that specific size
 *   "Apply average"     → sets average consumption on the current fabric row
 *   "Apply per size"    → splits the current row into one row per size with correct consumption
 */
import { useState } from 'react';
import {
  Modal, Upload, Button, Spin, Alert, Tag, Table, Typography,
  Space, Row, Col, Divider, message, Statistic, Tooltip,
} from 'antd';
import {
  ThunderboltOutlined, FileImageOutlined, FileTextOutlined,
  SplitCellsOutlined, CheckCircleOutlined, CalculatorOutlined,
} from '@ant-design/icons';
import { calculateConsumption } from '../../services/costingService';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

export default function ConsumptionCalcModal({ open, onClose, onApply, onOpenKnitsCalc, fabricRow }) {
  const [step, setStep]               = useState('upload');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [measurementFile, setMeasurementFile] = useState(null);
  const [techpackFile, setTechpackFile]       = useState(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCalculate = async () => {
    if (!measurementFile) {
      message.warning('Please upload the size spec / measurement chart');
      return;
    }
    setLoading(true);
    try {
      const data = await calculateConsumption(measurementFile, techpackFile);
      setResult(data);
      setStep('result');
    } catch {
      message.error('AI calculation failed. Ensure the measurement chart is clearly readable.');
    } finally {
      setLoading(false);
    }
  };

  /** Apply a single specific size's consumption to the parent fabric row */
  const handleApplyValue = (size, value) => {
    onApply({ splitBySizes: false, consumption: value, uom: result.uom });
    handleClose();
  };

  /** Apply the average across all sizes to the parent fabric row */
  const handleApplyAverage = () => {
    const values = Object.values(result.consumptionPerSize || {});
    if (!values.length) return;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    onApply({ splitBySizes: false, consumption: Math.round(avg * 10000) / 10000, uom: result.uom });
    handleClose();
  };

  /** Split the current fabric row into one row per size */
  const handleApplyPerSize = () => {
    onApply({
      splitBySizes: true,
      consumptionPerSize: result.consumptionPerSize,
      uom: result.uom,
      sizes: result.sizes || Object.keys(result.consumptionPerSize || {}),
    });
    handleClose();
  };

  const handleClose = () => {
    onClose();
  };

  const handleAfterClose = () => {
    setStep('upload');
    setResult(null);
    setMeasurementFile(null);
    setTechpackFile(null);
  };

  // ── Derived values ───────────────────────────────────────────────────────────

  const sizeEntries = Object.entries(result?.consumptionPerSize || {});
  const sizeData    = sizeEntries.map(([size, value]) => ({ key: size, size, value }));
  const sizeValues  = sizeEntries.map(([, v]) => v);
  const avg         = sizeValues.length
    ? (sizeValues.reduce((a, b) => a + b, 0) / sizeValues.length).toFixed(4)
    : '—';
  const minVal = sizeValues.length ? Math.min(...sizeValues).toFixed(4) : '—';
  const maxVal = sizeValues.length ? Math.max(...sizeValues).toFixed(4) : '—';

  // ── Per-size table ───────────────────────────────────────────────────────────

  const isKnits = result?.classification === 'Knits';

  const sizeColumns = [
    {
      title: 'Size',
      dataIndex: 'size',
      width: 70,
      render: (v) => <Tag style={{ fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: `Consumption (${result?.uom || ''})`,
      dataIndex: 'value',
      render: (v) => (
        <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {Number(v).toFixed(4)}
        </Text>
      ),
    },
    {
      title: '',
      width: 140,
      render: (_, r) => (
        <Button
          size="small" type="primary" ghost
          icon={<CheckCircleOutlined />}
          onClick={() => handleApplyValue(r.size, r.value)}
        >
          Use this value
        </Button>
      ),
    },
    // For Knits: allow opening the manual parts calculator pre-filled with AI data
    ...(isKnits && onOpenKnitsCalc ? [{
      title: '',
      width: 155,
      render: (_, r) => (
        <Tooltip title="Pre-fill the Knits Parts Calculator with AI values for this size — review & adjust before applying">
          <Button
            size="small"
            icon={<CalculatorOutlined />}
            onClick={() => onOpenKnitsCalc(result.parts, result.gsm, r.size)}
          >
            Verify in Calculator
          </Button>
        </Tooltip>
      ),
    }] : []),
  ];

  // ── Parts breakdown columns (first 6 sizes shown) ───────────────────────────

  const shownSizes = (result?.sizes || []).slice(0, 6);
  const partsData  = (result?.parts || []).map((p, i) => ({ ...p, key: i }));
  const partsColumns = [
    {
      title: 'Panel / Part',
      dataIndex: 'partName',
      ellipsis: true,
    },
    {
      title: 'Pcs',
      dataIndex: 'numberOfPieces',
      width: 45,
    },
    ...shownSizes.map((s) => ({
      title: s,
      width: 70,
      render: (_, r) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>
          {r.contributionPerSize?.[s] != null ? Number(r.contributionPerSize[s]).toFixed(3) : '—'}
        </Text>
      ),
    })),
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      afterClose={handleAfterClose}
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#faad14' }} />
          AI Fabric Consumption Calculator
        </Space>
      }
      width={860}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      footer={
        step === 'result' ? (
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button onClick={() => setStep('upload')}>Upload Different Files</Button>
            <Space>
              <Button onClick={handleClose}>Cancel</Button>
              <Tooltip title={`Creates ${sizeData.length} fabric rows — one per size`}>
                <Button icon={<SplitCellsOutlined />} onClick={handleApplyPerSize}>
                  Apply per size
                </Button>
              </Tooltip>
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleApplyAverage}>
                Apply average ({avg} {result?.uom})
              </Button>
            </Space>
          </Space>
        ) : null
      }
      destroyOnClose
    >

      {/* ── Step 1: Upload ──────────────────────────────────────────── */}
      {step === 'upload' && (
        <Spin spinning={loading} tip="AI is reading measurements and calculating consumption…">
          <Row gutter={16} style={{ marginBottom: 12 }}>
            {/* Measurement chart — required */}
            <Col span={15}>
              <Text strong>
                Size Spec / Measurement Chart <Text type="danger">*</Text>
              </Text>
              <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
                The table of sizes with body measurements — PNG, JPG or PDF
              </Text>
              <Dragger
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                multiple={false}
                beforeUpload={(f) => { setMeasurementFile(f); return false; }}
                showUploadList={false}
                style={{ padding: '18px 8px' }}
              >
                <FileImageOutlined
                  style={{ fontSize: 38, color: measurementFile ? '#52c41a' : '#1677ff' }}
                />
                <p style={{ fontSize: 12, margin: '8px 0 4px' }}>
                  {measurementFile
                    ? <Text style={{ color: '#52c41a' }}>✓ {measurementFile.name}</Text>
                    : 'Click or drag size spec chart here'
                  }
                </p>
                <p style={{ fontSize: 11, color: '#8c8c8c', margin: 0 }}>
                  PNG / JPG / PDF accepted
                </p>
              </Dragger>
            </Col>

            {/* Techpack — optional */}
            <Col span={9}>
              <Text strong>Techpack PDF <Text type="secondary">(optional)</Text></Text>
              <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
                Provides GSM, Woven/Knits classification, panel construction
              </Text>
              <Dragger
                accept=".pdf"
                multiple={false}
                beforeUpload={(f) => { setTechpackFile(f); return false; }}
                showUploadList={false}
                style={{ padding: '18px 8px' }}
              >
                <FileTextOutlined
                  style={{ fontSize: 38, color: techpackFile ? '#52c41a' : '#8c8c8c' }}
                />
                <p style={{ fontSize: 12, margin: '8px 0 4px' }}>
                  {techpackFile
                    ? <Text style={{ color: '#52c41a' }}>✓ {techpackFile.name}</Text>
                    : 'Click or drag techpack PDF'
                  }
                </p>
                <p style={{ fontSize: 11, color: '#8c8c8c', margin: 0 }}>PDF only</p>
              </Dragger>
            </Col>
          </Row>

          {fabricRow && (
            <Alert
              type="info" showIcon style={{ marginBottom: 12 }}
              message={`Fabric row: ${fabricRow.fabricType || fabricRow.description || '—'} · ${fabricRow.classification || 'classification unknown'}`}
            />
          )}

          <Button
            type="primary" block icon={<ThunderboltOutlined />}
            onClick={handleCalculate} loading={loading}
            disabled={!measurementFile}
            style={{ marginBottom: 12 }}
          >
            Calculate Consumption with AI
          </Button>

          <Alert
            type="info" showIcon
            message="How it works"
            description={
              <>
                AI reads your measurement chart, identifies garment panels, and applies standard
                formulas: <b>Knits</b> → L × W × GSM ÷ 10000 per panel in grams → kg total;{' '}
                <b>Woven</b> → panel area ÷ fabric width ÷ marker efficiency in meters.
                Seam allowances, cutting waste, and garment-wash shrinkage are added automatically.
              </>
            }
          />
        </Spin>
      )}

      {/* ── Step 2: Result ──────────────────────────────────────────── */}
      {step === 'result' && result && (
        <div>
          {/* Classification / UOM / spec tags */}
          <Space wrap style={{ marginBottom: 12 }}>
            <Tag
              color={result.classification === 'Knits' ? 'purple' : 'blue'}
              style={{ fontSize: 13, padding: '2px 8px' }}
            >
              {result.classification}
            </Tag>
            <Tag color="geekblue" style={{ fontSize: 13, padding: '2px 8px' }}>
              {result.uom}
            </Tag>
            {result.gsm             && <Tag>GSM: {result.gsm}</Tag>}
            {result.fabricWidth     && <Tag>Width: {result.fabricWidth} cm</Tag>}
            {result.markerEfficiency && <Tag>Marker: {result.markerEfficiency}%</Tag>}
            {result.wastagePercent  && <Tag>Waste: {result.wastagePercent}%</Tag>}
          </Space>

          {/* AI assumptions */}
          {result.assumptions && (
            <Alert
              type="info" showIcon style={{ marginBottom: 12 }}
              message="AI Analysis"
              description={
                <Paragraph style={{ margin: 0, fontSize: 12 }}>
                  {result.assumptions}
                </Paragraph>
              }
            />
          )}

          {/* Parts breakdown (collapsible) */}
          {partsData.length > 0 && (
            <details style={{ marginBottom: 12 }}>
              <summary
                style={{ cursor: 'pointer', fontSize: 12, color: '#1677ff', userSelect: 'none' }}
              >
                Panel breakdown — {partsData.length} parts
                {result.sizes?.length > 6
                  ? ` · first 6 of ${result.sizes.length} sizes shown`
                  : ''}
              </summary>
              <Table
                size="small" pagination={false}
                dataSource={partsData} columns={partsColumns}
                style={{ marginTop: 8 }}
                scroll={{ x: 500 }}
              />
            </details>
          )}

          <Divider style={{ margin: '8px 0' }} />

          {/* Summary statistics */}
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={8}>
              <Statistic
                title="Smallest size"
                value={minVal}
                suffix={result.uom}
                valueStyle={{ fontSize: 15 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Average"
                value={avg}
                suffix={result.uom}
                valueStyle={{ fontSize: 15, color: 'var(--primary-color)' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Largest size"
                value={maxVal}
                suffix={result.uom}
                valueStyle={{ fontSize: 15 }}
              />
            </Col>
          </Row>

          {/* Per-size consumption table */}
          <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
            Consumption per Size — {sizeData.length} sizes
          </Text>
          <Table
            size="small" pagination={false}
            dataSource={sizeData} columns={sizeColumns}
            scroll={{ y: 280 }}
          />
        </div>
      )}
    </Modal>
  );
}
