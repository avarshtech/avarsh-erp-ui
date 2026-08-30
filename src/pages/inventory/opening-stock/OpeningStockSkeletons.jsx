import { Card, Skeleton, Row, Col, Space } from 'antd';

/**
 * Skeleton for the Opening Stock batch form when loading an existing batch
 * (edit/view mode). Mirrors the real layout — page header, status strip,
 * details card, and an inline-edit table placeholder — so the user perceives
 * the form shape immediately instead of a bare spinner.
 *
 * Only used on the form; the dashboard keeps its inline Card/Statistic/Table
 * spinners so navigation-level loads stay snappy.
 */
export const BatchFormSkeleton = () => (
  <div className="animate-fade-in-up" style={{ padding: 4 }}>
    {/* Title row */}
    <Space style={{ width: '100%', marginBottom: 20 }} align="center">
      <Skeleton.Button active size="small" style={{ width: 36, height: 36, borderRadius: 8 }} />
      <Skeleton.Input active size="default" style={{ width: 320, height: 28 }} />
      <Skeleton.Button active size="small" style={{ width: 72, height: 24, borderRadius: 12 }} />
    </Space>

    {/* Optional read-only / status alert placeholder */}
    <Skeleton.Input active size="small" style={{ width: '100%', height: 54, marginBottom: 16, borderRadius: 8 }} />

    {/* Batch details card */}
    <Card
      size="small"
      title={<Skeleton.Input active size="small" style={{ width: 120, height: 16 }} />}
      style={{ marginBottom: 16 }}
    >
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Skeleton.Input active size="small" style={{ width: 100, height: 14, marginBottom: 8 }} />
          <Skeleton.Input active size="default" style={{ width: '100%', height: 32 }} />
        </Col>
        <Col xs={24} md={16}>
          <Skeleton.Input active size="small" style={{ width: 80, height: 14, marginBottom: 8 }} />
          <Skeleton.Input active size="default" style={{ width: '100%', height: 56 }} />
        </Col>
      </Row>
    </Card>

    {/* Rows card — skeleton rows mimic the inline-edit table */}
    <Card
      size="small"
      title={<Skeleton.Input active size="small" style={{ width: 100, height: 16 }} />}
    >
      {/* Column-header strip */}
      <div style={{
        display: 'flex', gap: 12, padding: '8px 0',
        borderBottom: '1px solid var(--border-color, #f0f0f0)', marginBottom: 8,
      }}>
        {[40, 220, 110, 80, 80, 100, 100, 70, 110, 100].map((w, i) => (
          <Skeleton.Input key={i} active size="small" style={{ width: w, height: 14 }} />
        ))}
      </div>
      {/* Body rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex', gap: 12, padding: '10px 0',
            borderBottom: '1px dashed var(--border-color, #f0f0f0)',
          }}
        >
          {[40, 220, 110, 80, 80, 100, 100, 70, 110, 100].map((w, j) => (
            <Skeleton.Input key={j} active size="small" style={{ width: w, height: 24 }} />
          ))}
        </div>
      ))}
      {/* Footer summary strip */}
      <Space style={{ width: '100%', justifyContent: 'space-between', marginTop: 16 }}>
        <Skeleton.Button active size="small" style={{ width: 110, height: 28 }} />
        <Space>
          <Skeleton.Input active size="small" style={{ width: 100, height: 14 }} />
          <Skeleton.Input active size="small" style={{ width: 140, height: 14 }} />
          <Skeleton.Input active size="small" style={{ width: 160, height: 14 }} />
        </Space>
      </Space>
    </Card>

    {/* Action-button strip */}
    <Space style={{ marginTop: 16 }}>
      <Skeleton.Button active size="default" style={{ width: 80 }} />
      <Skeleton.Button active size="default" style={{ width: 110 }} />
      <Skeleton.Button active size="default" style={{ width: 120 }} />
    </Space>
  </div>
);

export default { BatchFormSkeleton };
