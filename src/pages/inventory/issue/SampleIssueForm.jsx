import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Card, Row, Col, Select, Table, InputNumber, Input, Button, Space, Tag, Typography,
  Skeleton, Alert, Result,
} from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { listIssuableSrs, createSampleIssue } from '../../../services/sr/srService';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { hasPermission } from '../../../utils/permissions';
import { RAG_TAG_COLOR, deadlineLabel } from '../../../utils/deadlineUtils';
import { formatDate } from '../../../utils/formatters';

const { Text, Title } = Typography;
const { TextArea } = Input;

// Return to the segment the user came from, not the Fabric default
const BACK_TO_LIST = '/inventory/issue?segment=SampleRequest';
// Sticky header card carrying the issue actions (Supplier PO form pattern)
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };

const labelStyle = {
  fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', marginBottom: 2,
};

const Field = ({ label, children, span = { xs: 12, sm: 8, md: 6 } }) => (
  <Col {...span}>
    <Text type="secondary" style={labelStyle}>{label}</Text>
    <Text strong style={{ fontSize: 14 }}>{children || '—'}</Text>
  </Col>
);

/**
 * Sample Request Issue — create (R2). One document issues BOTH the fabric and
 * the trims of a single submitted SR, mirroring the Fabric / Accessories issue
 * forms but against the sample request rather than a Cutting PO. Saving is the
 * ONLY thing that moves an SR from Submitted to In Production.
 */
const SampleIssueForm = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkSrId = searchParams.get('srId') ? Number(searchParams.get('srId')) : null;

  const [srs, setSrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [qty, setQty] = useState({});
  const [remarks, setRemarks] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deepLinkMissed, setDeepLinkMissed] = useState(false);
  const [loadError, setLoadError] = useState(null);
  // Everything lives in local state, so leaving would silently discard it
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  const canAdd = hasPermission('inventory-issue', 'add');
  const leave = useCallback((path) => { clearDirty(); navigate(path); }, [clearDirty, navigate]);

  // Issue quantities default to what the BOM requires — the storekeeper edits
  // down when part of the material is already on the floor.
  const prefill = useCallback((sr) => {
    const next = {};
    [...(sr?.fabricLines || []), ...(sr?.trimLines || [])].forEach((l) => { next[l.lineNo] = l.requiredQty; });
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listIssuableSrs();
        if (cancelled) return;
        setSrs(rows);
        const preselect = deepLinkSrId ? rows.find((r) => r.id === deepLinkSrId) : null;
        if (preselect) {
          setSelectedId(preselect.id);
          setQty(prefill(preselect));
        } else if (deepLinkSrId) {
          setDeepLinkMissed(true);
        }
      } catch (e) {
        // Without this the empty-list branch below would show a green
        // "nothing awaiting issue" all-clear for what is actually a failure
        if (!cancelled) {
          setLoadError(e.message || 'Failed to load submitted sample requests');
          message.error(e.message || 'Failed to load submitted sample requests');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [deepLinkSrId, message, prefill]);

  const selected = useMemo(() => srs.find((r) => r.id === selectedId) || null, [srs, selectedId]);

  const handleSelect = useCallback((id) => {
    const sr = srs.find((r) => r.id === id);
    setSelectedId(id);
    setQty(prefill(sr));
    setReceivedBy('');
    setDeepLinkMissed(false);
    setIsDirty(true);
  }, [srs, prefill]);

  const allLines = useMemo(
    () => [...(selected?.fabricLines || []), ...(selected?.trimLines || [])],
    [selected],
  );
  const issuingCount = useMemo(
    () => allLines.filter((l) => Number(qty[l.lineNo]) > 0).length,
    [allLines, qty],
  );

  const columns = useCallback((withWidth) => [
    { title: '#', dataIndex: 'lineNo', key: 'lineNo', width: 50, align: 'center' },
    { title: 'Classification', dataIndex: 'classification', key: 'classification', width: 150 },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Colour / Design', dataIndex: 'colourDesign', key: 'colourDesign', width: 170, ellipsis: true },
    ...(withWidth ? [{ title: 'Width', dataIndex: 'width', key: 'width', width: 80, align: 'center', render: (v) => v || '—' }] : []),
    { title: 'UOM', dataIndex: 'uom', key: 'uom', width: 70, align: 'center' },
    {
      title: 'Required', dataIndex: 'requiredQty', key: 'requiredQty', width: 100, align: 'right',
      render: (v) => <Text type="secondary">{v ?? '—'}</Text>,
    },
    {
      title: 'Issue Qty', key: 'issueQty', width: 130, align: 'right',
      render: (_, l) => (
        <InputNumber
          size="small" min={0} step={0.01} style={{ width: '100%' }}
          value={qty[l.lineNo]}
          placeholder="0"
          onChange={(v) => { setIsDirty(true); setQty((s) => ({ ...s, [l.lineNo]: v })); }}
        />
      ),
    },
  ], [qty]);

  const fillRequired = useCallback((lines) => {
    setIsDirty(true);
    setQty((s) => {
      const next = { ...s };
      lines.forEach((l) => { next[l.lineNo] = l.requiredQty; });
      return next;
    });
  }, []);

  const handleSubmit = () => {
    modal.confirm({
      title: 'Create issue and start production?',
      content: `${selected.srNo} moves to In Production. ${issuingCount} material line(s) will be recorded as issued — this is the only way a sample enters production.`,
      okText: 'Create Issue',
      onOk: async () => {
        setSubmitting(true);
        try {
          const lines = allLines
            .filter((l) => Number(qty[l.lineNo]) > 0)
            .map((l) => ({ ...l, issueQty: Number(qty[l.lineNo]) }));
          const issue = await createSampleIssue(selected.id, { lines, remarks, receivedBy: receivedBy.trim() });
          setIsDirty(false);
          message.success(`${issue.issueNo} created — ${selected.srNo} is now In Production`);
          leave(BACK_TO_LIST);
        } catch (e) {
          message.error(e.message || 'Failed to create the sample issue');
        } finally { setSubmitting(false); }
      },
    });
  };

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <div className="page-header" style={STICKY_HEADER}>
          <Space>
            <Skeleton.Button active size="small" style={{ width: 32, height: 32 }} />
            <Skeleton.Input active style={{ width: 240 }} />
          </Space>
          <Space>
            <Skeleton.Button active style={{ width: 90 }} />
            <Skeleton.Button active style={{ width: 210 }} />
          </Space>
        </div>
        <Card style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 180, marginBottom: 24 }} />
          <Row gutter={24}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Col xs={24} md={12} key={i} style={{ marginBottom: 16 }}>
                <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
                <Skeleton.Input active block />
              </Col>
            ))}
          </Row>
        </Card>
        <Card style={{ marginBottom: 16 }}><Skeleton active paragraph={{ rows: 4 }} /></Card>
        <Card><Skeleton active paragraph={{ rows: 4 }} /></Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="New Sample Request Issue" onBack={() => navigate(BACK_TO_LIST)} style={STICKY_HEADER} />
        <Result
          status="warning"
          title="Could not load the submitted sample requests"
          subTitle={loadError}
          extra={<ActionButton action="view" text="Back to Material Issue" onClick={() => navigate(BACK_TO_LIST)} />}
        />
      </div>
    );
  }

  if (srs.length === 0) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="New Sample Request Issue" onBack={() => navigate(BACK_TO_LIST)} style={STICKY_HEADER} />
        <Result
          status="success"
          title="Nothing awaiting material issue"
          subTitle="Every submitted sample request has had its material issued. New requests appear here as soon as they are submitted."
          extra={<ActionButton action="view" text="Back to Material Issue" onClick={() => navigate(BACK_TO_LIST)} />}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="New Sample Request Issue"
        onBack={() => navigate(BACK_TO_LIST)}
        style={STICKY_HEADER}
        status={selected && (
          <Tag color={RAG_TAG_COLOR[selected.inHandRag]} style={{ whiteSpace: 'nowrap' }}>
            In-hand {deadlineLabel(selected.inHandDays)}
          </Tag>
        )}
      >
        <ActionButton action="close" text="Cancel" onClick={() => navigate(BACK_TO_LIST)} />
        <Button
          type="primary"
          icon={<ToolOutlined />}
          loading={submitting}
          disabled={!canAdd || !selected || issuingCount === 0 || !receivedBy.trim()}
          onClick={handleSubmit}
        >
          Create Issue &amp; Start Production
        </Button>
      </PageHeader>

      {deepLinkMissed && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message="That sample request is no longer awaiting issue"
          description="Its material has already been issued, or it is not submitted yet. Pick another request below."
        />
      )}

      <Card size="small" title={<Title level={5} style={{ margin: 0 }}>Sample Request</Title>} style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={12} lg={10}>
            <Text type="secondary" style={labelStyle}>Submitted Sample Request <Text type="danger">*</Text></Text>
            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder="Select a submitted sample request"
              value={selectedId}
              onChange={handleSelect}
              optionFilterProp="name"
              options={srs.map((r) => ({
                value: r.id,
                name: `${r.srNo} ${r.styleNo} ${r.garmentName} ${r.buyerName} ${r.sampleTypeName}`,
                // alignItems centres the tag against the text — without it the
                // tag stretches to the control height and its label rides high
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.srNo} · {r.styleNo} — {r.buyerName}
                    </span>
                    <Tag color="purple" style={{ marginInlineEnd: 0, flexShrink: 0 }}>{r.sampleTypeName}</Tag>
                  </span>
                ),
              }))}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Only Submitted requests appear — issuing material is what starts production.
            </Text>
          </Col>
        </Row>

        {selected && (
          <Row gutter={[24, 16]} style={{ marginTop: 16 }}>
            <Field label="Sample Type">
              <Tag color="purple" style={{ whiteSpace: 'nowrap' }}>{selected.sampleTypeName}</Tag>
            </Field>
            <Field label="Order No">{selected.orderNo}</Field>
            <Field label="Style No">{selected.styleNo}</Field>
            <Field label="Garment" span={{ xs: 24, sm: 16, md: 12 }}>{selected.garmentName}</Field>
            <Field label="Buyer">{selected.buyerName}</Field>
            <Field label="Season">{selected.season}</Field>
            <Field label="Quantity">{`${selected.sampleQty ?? '—'} pcs per size`}</Field>
            <Field label="Sizes" span={{ xs: 24, sm: 16, md: 12 }}>{(selected.sizes || []).join(' · ')}</Field>
            <Field label="In-Hand Date">{formatDate(selected.inHandDate)}</Field>
            <Field label="Colour / Print Ref" span={{ xs: 24, sm: 16, md: 12 }}>{selected.colourReference}</Field>
            {selected.specialInstructions && (
              <Field label="Special Instructions" span={{ xs: 24 }}>{selected.specialInstructions}</Field>
            )}
          </Row>
        )}
      </Card>

      {selected && (
        <>
          <Card
            size="small"
            title={<Title level={5} style={{ margin: 0 }}>Fabric</Title>}
            extra={<Button size="small" onClick={() => fillRequired(selected.fabricLines)}>Fill required</Button>}
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="lineNo" size="small" pagination={false} scroll={{ x: 940 }}
              columns={columns(true)}
              dataSource={selected.fabricLines}
              locale={{ emptyText: 'No fabric lines on this sample request' }}
            />
          </Card>

          <Card
            size="small"
            title={<Title level={5} style={{ margin: 0 }}>Trims &amp; Accessories</Title>}
            extra={<Button size="small" onClick={() => fillRequired(selected.trimLines)}>Fill required</Button>}
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="lineNo" size="small" pagination={false} scroll={{ x: 860 }}
              columns={columns(false)}
              dataSource={selected.trimLines}
              locale={{ emptyText: 'No trim lines on this sample request' }}
            />
          </Card>

          <Card size="small">
            <Row gutter={16}>
              <Col xs={24} md={10} lg={8}>
                <Text type="secondary" style={labelStyle}>Received By <Text type="danger">*</Text></Text>
                <Input
                  placeholder="Who signed for the materials"
                  value={receivedBy}
                  onChange={(e) => { setIsDirty(true); setReceivedBy(e.target.value); }}
                  style={{ marginBottom: 12 }}
                />
              </Col>
            </Row>
            <Text type="secondary" style={labelStyle}>Remarks</Text>
            <TextArea
              rows={2}
              value={remarks}
              placeholder="Anything the sampling room should know about this hand-over"
              onChange={(e) => { setIsDirty(true); setRemarks(e.target.value); }}
            />
            <Text type="secondary" style={{ display: 'block', marginTop: 10 }}>
              {issuingCount === 0
                ? 'Enter an issue quantity on at least one line.'
                : (!receivedBy.trim()
                  ? `${issuingCount} of ${allLines.length} line(s) ready — enter who received them to create the issue.`
                  : `${issuingCount} of ${allLines.length} material line(s) will be issued — leave a line at 0 when it is already on the floor.`)}
            </Text>
          </Card>
        </>
      )}
    </div>
  );
};

export default SampleIssueForm;
