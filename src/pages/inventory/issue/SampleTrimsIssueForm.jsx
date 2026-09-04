import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Alert, Card, Col, DatePicker, Divider, Form, Input, Progress, Result, Row, Skeleton, Typography,
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { listIssuableSrs, createSampleTrimsIssue } from '../../../services/sr/srService';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { hasPermission, getCurrentUser } from '../../../utils/permissions';
import { errorText, toastUnlessHandled } from '../../../utils/apiError';
import { formatNumber } from '../../../utils/formatters';
import { SAMPLE_TYPE_LIST } from '../../../utils/sampleRequestConstants';
import AccessoriesIssueItemTable from './AccessoriesIssueItemTable';
import SampleIssueSummaryPanel from './SampleIssueSummaryPanel';
import SampleIssueSrPicker from './SampleIssueSrPicker';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Return to the segment and the toggle side the user came from
const BACK_TO_LIST = '/inventory/issue?segment=SampleRequest&issueType=ACCESSORY';
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };

/**
 * Sample trims issue — the trim lines of one sample request, issued by
 * quantity. The server consumes lots FIFO with the matching colour first, so
 * this form never names a lot; it names a line and a number, exactly as the
 * bulk AccessoriesIssueForm does against a Work Order.
 *
 * Lines left blank are skipped: a sample often ships with part of its trims
 * already on the floor, so a partial issue is the normal case.
 */
const SampleTrimsIssueForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const deepLinkSrId = searchParams.get('srId') ? Number(searchParams.get('srId')) : null;
  // The register opens this form from a sample-type tab; carrying that tab
  // through keeps the picker showing the requests the storekeeper was looking at
  const sampleTypeId = searchParams.get('sampleTypeId') ? Number(searchParams.get('sampleTypeId')) : null;

  const [srs, setSrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedSrId, setSelectedSrId] = useState(null);
  const [items, setItems] = useState([]);
  const [deepLinkMissed, setDeepLinkMissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  const canAdd = hasPermission('inventory-issue', 'add');
  const currentUserName = getCurrentUser()?.name || '—';

  /**
   * The shared item table speaks the bulk vocabulary — what the sample request
   * needs is its `bomQty`, live stock its `availableStock`. Quantities start
   * blank rather than prefilled: over-issuing a sample wastes bulk material.
   */
  const toItems = useCallback((sr) => (sr?.trimLines || []).map((l) => ({
    id: l.lineNo,
    lineNo: l.lineNo,
    itemCode: l.itemCode,
    description: l.description,
    color: l.colourDesign,
    uom: l.uom,
    bomQty: Number(l.requiredQty) || 0,
    availableStock: Number(l.currentStock) || 0,
    issuedCumulative: Number(l.issuedCumulative) || 0,
    issueQty: null,
  })), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listIssuableSrs();
        if (cancelled) return;
        setSrs(rows);
        if (deepLinkSrId) {
          const hit = rows.find((r) => r.id === deepLinkSrId);
          if (hit) {
            // The Select reads the form store, so preselecting means setting
            // both — the state drives the table, the field drives the control.
            setSelectedSrId(hit.id);
            setItems(toItems(hit));
            form.setFieldsValue({ sampleRequest: hit.id });
          } else {
            setDeepLinkMissed(true);
          }
        }
      } catch (e) {
        // Without this the empty-list branch below would show a green
        // "nothing awaiting issue" all-clear for what is actually a failure
        if (!cancelled) {
          setLoadError(errorText(e, 'Failed to load issuable sample requests'));
          toastUnlessHandled(message, e, 'Failed to load issuable sample requests');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [deepLinkSrId, message, form, toItems]);

  const visibleSrs = useMemo(
    () => (sampleTypeId ? srs.filter((r) => r.sampleTypeId === sampleTypeId) : srs),
    [srs, sampleTypeId],
  );
  const sampleTypeName = useMemo(
    () => SAMPLE_TYPE_LIST.find((t) => t.id === sampleTypeId)?.name || null,
    [sampleTypeId],
  );

  const selectedSr = useMemo(() => srs.find((r) => r.id === selectedSrId) || null, [srs, selectedSrId]);

  const handleSrChange = useCallback((id) => {
    const sr = srs.find((r) => r.id === id) || null;
    setSelectedSrId(id);
    setItems(toItems(sr));
    setDeepLinkMissed(false);
    setIsDirty(true);
  }, [srs, toItems]);

  const handleItemChange = useCallback((index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    setIsDirty(true);
  }, []);

  const totals = useMemo(() => {
    const withQty = items.filter((i) => (i.issueQty || 0) > 0);
    const shortage = items.filter((i) => (i.availableStock || 0) < (i.bomQty || 0)).length;
    // Fulfilment counts earlier documents against the same request, each line
    // capped at its own demand so an over-issue cannot inflate the bar.
    const fulfilled = items.reduce(
      (sum, i) => sum + Math.min(i.bomQty || 0, (i.issuedCumulative || 0) + (i.issueQty || 0)), 0,
    );
    const demand = items.reduce((sum, i) => sum + (i.bomQty || 0), 0);
    return {
      lines: items.length,
      issuing: withQty.length,
      shortage,
      pct: demand > 0 ? (fulfilled / demand) * 100 : 0,
    };
  }, [items]);

  const stats = useMemo(() => {
    if (!selectedSr) return [];
    return [
      { label: 'Trim Lines', value: totals.lines },
      { label: 'Lines to Issue', value: totals.issuing },
      {
        label: 'Short of Stock',
        value: totals.shortage,
        color: totals.shortage > 0 ? 'var(--error-color)' : undefined,
      },
    ];
  }, [selectedSr, totals]);

  const handleSubmit = useCallback(() => {
    form.validateFields().then(async (values) => {
      const withQty = items.filter((it) => (it.issueQty || 0) > 0);
      if (!withQty.length) {
        message.warning('Enter Issue Qty for at least one trim line');
        return;
      }
      setSaving(true);
      try {
        const saved = await createSampleTrimsIssue({
          sampleRequestId: selectedSr.id,
          receivedBy: values.receivedBy,
          issueDate: values.issueDate?.format('YYYY-MM-DD'),
          remarks: values.remarks,
          items: withQty.map((it) => ({ lineNo: it.lineNo, issueQty: it.issueQty })),
        });
        message.success(`${saved.issueNumber} issued — stock cleared for ${selectedSr.srNo}`);
        clearDirty();
        navigate(BACK_TO_LIST);
      } catch (e) {
        toastUnlessHandled(message, e, 'Failed to create the sample trims issue');
      } finally {
        setSaving(false);
      }
    }).catch(() => message.warning('Please fill all required fields'));
  }, [form, message, navigate, clearDirty, items, selectedSr]);

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="New Sample Trims Issue" backPath={BACK_TO_LIST} style={STICKY_HEADER} />
        <Card style={{ marginBottom: 24 }}><Skeleton active paragraph={{ rows: 4 }} /></Card>
        <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
      </div>
    );
  }

  if (loadError || visibleSrs.length === 0) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="New Sample Trims Issue" backPath={BACK_TO_LIST} style={STICKY_HEADER} />
        <Result
          status={loadError ? 'warning' : 'success'}
          title={loadError ? 'Could not load the sample requests' : 'Nothing awaiting material issue'}
          subTitle={loadError
            || `No ${sampleTypeName ? `${sampleTypeName} ` : ''}sample request is submitted or in production. Requests appear here as soon as they are submitted.`}
          extra={<ActionButton action="view" text="Back to Material Issue" onClick={() => navigate(BACK_TO_LIST)} />}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="New Sample Trims Issue" backPath={BACK_TO_LIST} style={STICKY_HEADER}>
        {canAdd && <ActionButton action="save" text="Issue" loading={saving} onClick={handleSubmit} />}
      </PageHeader>

      {deepLinkMissed && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message="That sample request cannot be issued to"
          description="It is not submitted or in production any more. Pick another request below."
        />
      )}

      <Form form={form} layout="vertical" onValuesChange={() => setIsDirty(true)}>
        <Row gutter={24} align="stretch" style={{ marginBottom: 24 }}>
          <Col xs={24} lg={16}>
            <Card style={{ height: '100%' }}>
              <Title level={5} style={{ marginBottom: 24 }}>Issue Details</Title>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="sampleRequest"
                    label="Sample Request"
                    extra={sampleTypeName ? `Showing ${sampleTypeName} requests only` : undefined}
                    rules={[{ required: true, message: 'Select a sample request' }]}
                  >
                    {/* Form.Item supplies value/onChange; handleSrChange still runs after the store updates */}
                    <SampleIssueSrPicker srs={visibleSrs} onChange={handleSrChange} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="receivedBy" label="Received By" rules={[{ required: true, message: 'Enter receiver name' }]}>
                    <Input placeholder="Who signed for the materials" />
                  </Form.Item>
                </Col>
              </Row>
              {/* Hidden fields carry submit-time values without rendering inputs */}
              <Form.Item name="issueDate" initialValue={dayjs()} hidden><DatePicker /></Form.Item>
              <Form.Item name="issuedBy" initialValue={currentUserName} hidden><Input /></Form.Item>
              {selectedSr && (
                <>
                  <Divider style={{ margin: '20px 0 16px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>Issue Progress</Text>
                    <Text strong style={{ fontSize: 13 }}>{formatNumber(totals.pct, 1)}%</Text>
                  </div>
                  <Progress
                    percent={Number(totals.pct.toFixed(1))}
                    status={totals.pct >= 100 ? 'success' : 'active'}
                    showInfo={false}
                  />
                  {totals.shortage > 0 && (
                    <Alert
                      type="warning" showIcon style={{ marginTop: 12 }}
                      message={`${totals.shortage} trim line(s) have less stock than this sample needs`}
                    />
                  )}
                </>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <SampleIssueSummaryPanel sr={selectedSr} stats={stats} />
          </Col>
        </Row>

        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>Trim Lines</Title>
          <AccessoriesIssueItemTable items={items} onItemChange={handleItemChange} />
        </Card>

        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>Remarks</Title>
          <Form.Item name="remarks" noStyle>
            <TextArea rows={3} placeholder="Anything the sampling room should know about this hand-over" />
          </Form.Item>
        </Card>
      </Form>
    </div>
  );
};

export default SampleTrimsIssueForm;
