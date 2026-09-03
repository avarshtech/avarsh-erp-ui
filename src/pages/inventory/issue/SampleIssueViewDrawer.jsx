import { useState, useEffect } from 'react';
import { App, Drawer, Card, Row, Col, Table, Tag, Typography, Skeleton } from 'antd';
import { getSampleIssue } from '../../../services/sr/srService';
import { formatDate } from '../../../utils/formatters';
import { toastUnlessHandled } from '../../../utils/apiError';

const { Text, Title } = Typography;

const labelStyle = {
  fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', marginBottom: 2,
};

const Field = ({ label, children, span = { xs: 12, sm: 8, md: 6 } }) => (
  <Col {...span}>
    <Text type="secondary" style={labelStyle}>{label}</Text>
    <Text strong style={{ fontSize: 14 }}>{children || '—'}</Text>
  </Col>
);

/** Fabric and trims print the same columns; width only matters for fabric. */
const lineColumns = (withWidth) => [
  { title: '#', dataIndex: 'lineNo', key: 'lineNo', width: 50, align: 'center' },
  { title: 'Classification', dataIndex: 'classification', key: 'classification', width: 150 },
  { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: 'Colour / Design', dataIndex: 'colourDesign', key: 'colourDesign', width: 170, ellipsis: true },
  ...(withWidth ? [{ title: 'Width', dataIndex: 'width', key: 'width', width: 80, align: 'center', render: (v) => v || '—' }] : []),
  {
    title: 'Required', dataIndex: 'requiredQty', key: 'requiredQty', width: 100, align: 'right',
    render: (v, r) => <Text type="secondary">{v ?? '—'} {r.uom}</Text>,
  },
  {
    title: 'Issued', dataIndex: 'issueQty', key: 'issueQty', width: 110, align: 'right',
    render: (v, r) => <Text strong>{v} {r.uom}</Text>,
  },
];

/**
 * Read-only sample issue (SRI) — one document covering a whole sample request:
 * the fabric AND the trims handed over to production in one go.
 */
const SampleIssueViewDrawer = ({ open, issueId, onClose }) => {
  const { message } = App.useApp();
  const [issue, setIssue] = useState(null);
  // Derived, never set synchronously in the effect: a stale/absent record = loading
  const loading = open && issueId != null && issue?.id !== issueId;

  useEffect(() => {
    if (!open || issueId == null) return undefined;
    let cancelled = false;
    getSampleIssue(issueId)
      .then((data) => { if (!cancelled) setIssue(data); })
      .catch((e) => {
        if (!cancelled) { toastUnlessHandled(message, e, 'Failed to load the sample issue'); onClose?.(); }
      });
    return () => { cancelled = true; };
  }, [open, issueId, message, onClose]);

  const current = !loading && issue ? issue : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={980}
      destroyOnHidden
      title={current ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>{current.issueNo}</span>
          <Tag color="purple" style={{ marginInlineEnd: 0 }}>{current.sampleTypeName}</Tag>
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>{current.srNo}</Text>
        </span>
      ) : 'Sample Issue'}
    >
      {!current ? (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[24, 16]}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Col xs={12} sm={8} md={6} key={i}>
                  <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
                  <Skeleton.Input active size="small" block />
                </Col>
              ))}
            </Row>
          </Card>
          <Card size="small" style={{ marginBottom: 16 }}><Skeleton active title={false} paragraph={{ rows: 3 }} /></Card>
          <Card size="small"><Skeleton active title={false} paragraph={{ rows: 3 }} /></Card>
        </>
      ) : (
        <>
          <Card size="small" title={<Title level={5} style={{ margin: 0 }}>Issue Details</Title>} style={{ marginBottom: 16 }}>
            <Row gutter={[24, 16]}>
              <Field label="Issued On">{formatDate(current.issuedDate)}</Field>
              <Field label="Issued By">{current.issuedBy}</Field>
              <Field label="Received By">{current.receivedBy}</Field>
              <Field label="Sample Request">{current.srNo}</Field>
              <Field label="Order No">{current.orderNo}</Field>
              <Field label="Style No">{current.styleNo}</Field>
              <Field label="Garment" span={{ xs: 24, sm: 16, md: 12 }}>{current.garmentName}</Field>
              <Field label="Buyer">{current.buyerName}</Field>
              <Field label="Season">{current.season}</Field>
              <Field label="Sample Qty">
                {current.sampleQty != null ? `${current.sampleQty} pcs per size` : '—'}
              </Field>
              <Field label="Sizes" span={{ xs: 24, sm: 16, md: 12 }}>{(current.sizes || []).join(' · ')}</Field>
            </Row>
            {current.remarks && (
              <div style={{ marginTop: 14 }}>
                <Text type="secondary" style={labelStyle}>Remarks</Text>
                <Text>{current.remarks}</Text>
              </div>
            )}
          </Card>

          <Card
            size="small"
            title={<Title level={5} style={{ margin: 0 }}>Fabric</Title>}
            extra={<Tag color="blue" style={{ marginInlineEnd: 0 }}>{current.fabricCount} line{current.fabricCount === 1 ? '' : 's'}</Tag>}
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="lineNo" size="small" pagination={false} scroll={{ x: 860 }}
              columns={lineColumns(true)}
              dataSource={current.fabricLines || []}
              locale={{ emptyText: 'No fabric issued on this document' }}
            />
          </Card>

          <Card
            size="small"
            title={<Title level={5} style={{ margin: 0 }}>Trims &amp; Accessories</Title>}
            extra={<Tag color="geekblue" style={{ marginInlineEnd: 0 }}>{current.trimCount} line{current.trimCount === 1 ? '' : 's'}</Tag>}
          >
            <Table
              rowKey="lineNo" size="small" pagination={false} scroll={{ x: 780 }}
              columns={lineColumns(false)}
              dataSource={current.trimLines || []}
              locale={{ emptyText: 'No trims issued on this document' }}
            />
          </Card>
        </>
      )}
    </Drawer>
  );
};

export default SampleIssueViewDrawer;
