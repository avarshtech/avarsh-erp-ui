import { memo, useMemo } from 'react';
import { Button, Card, Col, Row, Space, Table, Typography } from 'antd';
import { CheckCircleFilled, ExclamationCircleFilled, FileExcelOutlined, PrinterOutlined, WarningFilled } from '@ant-design/icons';
import { buildColourSummary, buildProcessRollup, runPreSubmitChecks } from '../../../utils/cutPanelCalc';
import CprColourSummary from './CprColourSummary';

const { Text } = Typography;

const ROLLUP_COLUMNS = [
  { title: 'Process', dataIndex: 'process', key: 'process' },
  { title: 'Colours', dataIndex: 'colors', key: 'colors', render: (v) => v.join(', ') },
  { title: 'Panels', dataIndex: 'panels', key: 'panels', render: (v) => v.join(', ') },
  { title: 'Total Qty', dataIndex: 'totalQty', key: 'totalQty', align: 'right', render: (v) => Number(v).toLocaleString('en-IN') },
];

const checkIcon = (c) => {
  if (c.ok) return <CheckCircleFilled style={{ color: 'var(--success-color, #52c41a)' }} aria-label="passed" />;
  if (c.warning) return <WarningFilled style={{ color: 'var(--warning-color, #faad14)' }} aria-label="warning" />;
  return <ExclamationCircleFilled style={{ color: 'var(--error-color, #ff4d4f)' }} aria-label="failed" />;
};

/**
 * Section 4 — Requirement Summary (PRD §8.4): colour-wise summary, process-wise roll-up
 * and pre-submit checks. Printable and exportable; carries no vendor, rate or value.
 */
const CprSummarySection = memo(function CprSummarySection({ doc, order, showChecks, onPrint, onExport }) {
  const colourSummary = useMemo(() => buildColourSummary(doc.lines, order), [doc.lines, order]);
  const rollup = useMemo(() => buildProcessRollup(doc.lines), [doc.lines]);
  const { checks } = useMemo(() => runPreSubmitChecks(doc.lines, order, doc.orderAllowancePct), [doc.lines, order, doc.orderAllowancePct]);

  return (
    <Card
      title="Requirement Summary"
      size="small"
      style={{ marginBottom: 16 }}
      extra={(
        <Space>
          <Button icon={<PrinterOutlined />} onClick={onPrint} disabled={!doc.lines.length}>Print statement</Button>
          <Button icon={<FileExcelOutlined />} onClick={onExport} disabled={!doc.lines.length}>Export CSV</Button>
        </Space>
      )}
    >
      <Row gutter={[24, 16]}>
        <Col xs={24} xl={showChecks ? 9 : 12}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Colour-wise summary</Text>
          <CprColourSummary summary={colourSummary} />
        </Col>
        <Col xs={24} xl={showChecks ? 9 : 12}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Process-wise roll-up</Text>
          <Table size="small" rowKey="process" columns={ROLLUP_COLUMNS} dataSource={rollup} pagination={false} locale={{ emptyText: 'No processes yet' }} />
        </Col>
        {showChecks && (
          <Col xs={24} xl={6}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Pre-submit checks</Text>
            <ul aria-label="Pre-submit checks" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
              {checks.map((c) => (
                <li key={c.key}>
                  <Space align="start">
                    {checkIcon(c)}
                    <span>
                      {c.label}
                      {!c.ok && c.detail && <div><Text type="secondary" style={{ fontSize: 12 }}>{c.detail}</Text></div>}
                    </span>
                  </Space>
                </li>
              ))}
            </ul>
          </Col>
        )}
      </Row>
    </Card>
  );
});

export default CprSummarySection;
