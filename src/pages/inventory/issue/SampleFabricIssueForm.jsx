import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Alert, Card, Col, DatePicker, Divider, Form, Input, Progress, Result, Row, Select,
  Skeleton, Typography,
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { listIssuableSrs, getSampleIssuableRolls, createSampleFabricIssue } from '../../../services/sr/srService';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { hasPermission, getCurrentUser } from '../../../utils/permissions';
import { errorText, toastUnlessHandled } from '../../../utils/apiError';
import { formatNumber } from '../../../utils/formatters';
import { SAMPLE_TYPE_LIST } from '../../../utils/sampleRequestConstants';
import FabricIssueRollPicker from './FabricIssueRollPicker';
import SampleIssueSummaryPanel from './SampleIssueSummaryPanel';
import SampleIssueSrPicker from './SampleIssueSrPicker';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Return to the segment and the toggle side the user came from
const BACK_TO_LIST = '/inventory/issue?segment=SampleRequest&issueType=FABRIC';
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };

const UOM_MISMATCH = 'UOM mismatch between the sample request line and the available stock rolls — cannot proceed with this issue';

/**
 * Sample fabric issue — one fabric line of one sample request, picked roll by
 * roll off the rack. Mirrors the bulk FabricIssueForm (same picker, same split
 * model: the remnant keeps the original roll number and stays in stock) but is
 * raised against the sample request rather than a Cutting PO.
 *
 * Fabric and trims are separate documents because the store picks rolls and
 * counts trims on different days. Saving the first completed document of either
 * kind is what moves the request into production.
 */
const SampleFabricIssueForm = () => {
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
  const [selectedLineNo, setSelectedLineNo] = useState(null);
  const [availableRolls, setAvailableRolls] = useState([]);
  const [selectedRollIds, setSelectedRollIds] = useState([]);
  const [rollSplits, setRollSplits] = useState({});
  const [deepLinkMissed, setDeepLinkMissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  const canAdd = hasPermission('inventory-issue', 'add');
  const currentUserName = getCurrentUser()?.name || '—';

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
            // both — the state drives the panel, the field drives the control.
            setSelectedSrId(hit.id);
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
  }, [deepLinkSrId, message, form]);

  const visibleSrs = useMemo(
    () => (sampleTypeId ? srs.filter((r) => r.sampleTypeId === sampleTypeId) : srs),
    [srs, sampleTypeId],
  );
  const sampleTypeName = useMemo(
    () => SAMPLE_TYPE_LIST.find((t) => t.id === sampleTypeId)?.name || null,
    [sampleTypeId],
  );

  const selectedSr = useMemo(() => srs.find((r) => r.id === selectedSrId) || null, [srs, selectedSrId]);
  const selectedLine = useMemo(
    () => (selectedSr?.fabricLines || []).find((l) => l.lineNo === selectedLineNo) || null,
    [selectedSr, selectedLineNo],
  );

  const resetRollState = useCallback(() => {
    setSelectedRollIds([]);
    setRollSplits({});
    setAvailableRolls([]);
  }, []);

  const lineOptions = useMemo(() => (selectedSr?.fabricLines || []).map((l) => ({
    value: l.lineNo,
    label: `${l.description || l.itemCode} — ${formatNumber(l.requiredQty, 2)} ${l.uom || ''}`.trim(),
  })), [selectedSr]);

  const loadRolls = useCallback(async (srId, lineNo) => {
    try {
      // Server-ordered: this order's rolls first, then free stock, then rolls
      // earmarked to another order (flagged) — a bulk PO legitimately supplies
      // sample material, so those are offered rather than hidden.
      setAvailableRolls(await getSampleIssuableRolls(srId, lineNo));
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to load available rolls');
    }
  }, [message]);

  const handleSrChange = useCallback((id) => {
    setSelectedSrId(id);
    setSelectedLineNo(null);
    form.setFieldsValue({ lineNo: undefined });
    resetRollState();
    setDeepLinkMissed(false);
    setIsDirty(true);
  }, [form, resetRollState]);

  const handleLineChange = useCallback((lineNo) => {
    setSelectedLineNo(lineNo);
    resetRollState();
    if (selectedSrId != null && lineNo != null) loadRolls(selectedSrId, lineNo);
    setIsDirty(true);
  }, [selectedSrId, loadRolls, resetRollState]);

  const handleSelectionChange = useCallback((keys) => {
    setSelectedRollIds(keys);
    setIsDirty(true);
  }, []);

  const handleSplit = useCallback((parentRollId, issueQty) => {
    const roll = availableRolls.find((r) => r.id === parentRollId);
    if (!roll) return;
    const remainingQty = Number((roll.weight - issueQty).toFixed(2));
    setRollSplits((prev) => ({ ...prev, [parentRollId]: { issueQty, remainingQty } }));
    setSelectedRollIds((prev) => {
      const withoutParent = prev.filter((k) => k !== parentRollId);
      const issuedKey = `${parentRollId}::issued`;
      return withoutParent.includes(issuedKey) ? withoutParent : [...withoutParent, issuedKey];
    });
    setIsDirty(true);
  }, [availableRolls]);

  const handleCancelSplit = useCallback((parentRollId) => {
    setRollSplits((prev) => {
      const { [parentRollId]: _removed, ...rest } = prev;
      return rest;
    });
    setSelectedRollIds((prev) => prev.filter(
      (k) => k !== `${parentRollId}::issued` && k !== `${parentRollId}::remnant`,
    ));
    setIsDirty(true);
  }, []);

  const uom = selectedLine?.uom || 'kg';
  const requiredQty = Number(selectedLine?.requiredQty) || 0;

  const uomMismatch = useMemo(() => {
    if (!selectedLine || !availableRolls.length) return false;
    return availableRolls.some((r) => r.uom !== selectedLine.uom);
  }, [selectedLine, availableRolls]);

  const borrowedOffered = useMemo(
    () => availableRolls.filter((r) => r.earmarkedTo).length,
    [availableRolls],
  );

  // Mirrors the bulk form: a split contributes its issued slice as a NEW
  // sub-roll (-A suffix); `stockId` keeps the real inv_fabric_stock row id,
  // which is the only key the save payload can use.
  const selectedRolls = useMemo(() => {
    const splitMap = new Map();
    Object.entries(rollSplits).forEach(([parentId, split]) => {
      splitMap.set(`${parentId}::issued`, { ...split, parentId });
    });
    const rolls = [];
    selectedRollIds.forEach((key) => {
      const split = splitMap.get(key);
      if (split) {
        // Object.entries stringifies keys — compare as strings so numeric
        // stock ids still match
        const parent = availableRolls.find((r) => String(r.id) === String(split.parentId));
        if (parent) {
          rolls.push({
            ...parent, id: key, stockId: parent.id,
            rollNumber: `${parent.rollNumber}-A`, weight: split.issueQty,
          });
        }
        return;
      }
      const direct = availableRolls.find((r) => r.id === key);
      if (direct) rolls.push({ ...direct, stockId: direct.id });
    });
    return rolls;
  }, [selectedRollIds, availableRolls, rollSplits]);

  const totals = useMemo(() => {
    const selectedQty = selectedRolls.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
    // Earlier documents against the same line count towards the demand, so the
    // bar keeps advancing across a fabric issue split over two days.
    const covered = (Number(selectedLine?.issuedCumulative) || 0) + selectedQty;
    return {
      selectedQty,
      borrowed: selectedRolls.filter((r) => r.earmarkedTo).length,
      shortfall: Math.max(0, requiredQty - covered),
      pct: requiredQty > 0 ? Math.min((covered / requiredQty) * 100, 100) : 0,
    };
  }, [selectedRolls, selectedLine, requiredQty]);

  const stats = useMemo(() => {
    if (!selectedLine) return [];
    return [
      { label: 'Rolls Selected', value: selectedRolls.length },
      { label: 'Total Selected', value: `${formatNumber(totals.selectedQty, 2)} ${uom}` },
      ...(totals.borrowed > 0
        ? [{ label: 'Borrowed Rolls', value: totals.borrowed, color: 'var(--warning-color)' }]
        : []),
      {
        label: 'Shortfall',
        value: `${formatNumber(totals.shortfall, 2)} ${uom}`,
        color: totals.shortfall > 0 ? 'var(--error-color)' : 'var(--success-color)',
      },
    ];
  }, [selectedLine, selectedRolls, totals, uom]);

  const handleSubmit = useCallback(() => {
    form.validateFields().then(async (values) => {
      if (!selectedRolls.length) {
        message.warning('Select at least one roll to issue');
        return;
      }
      if (uomMismatch) {
        message.error('UOM mismatch — resolve before submitting');
        return;
      }
      setSaving(true);
      try {
        const saved = await createSampleFabricIssue({
          sampleRequestId: selectedSr.id,
          lineNo: selectedLine.lineNo,
          receivedBy: values.receivedBy,
          issueDate: values.issueDate?.format('YYYY-MM-DD'),
          remarks: values.remarks,
          rolls: selectedRolls.map((r) => ({ fabricStockId: r.stockId, issuedQty: r.weight })),
        });
        message.success(`${saved.issueNumber} issued — stock cleared for ${selectedSr.srNo}`);
        clearDirty();
        navigate(BACK_TO_LIST);
      } catch (e) {
        toastUnlessHandled(message, e, 'Failed to create the sample fabric issue');
      } finally {
        setSaving(false);
      }
    }).catch(() => message.warning('Please fill all required fields'));
  }, [form, message, navigate, clearDirty, selectedRolls, uomMismatch, selectedSr, selectedLine]);

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="New Sample Fabric Issue" backPath={BACK_TO_LIST} style={STICKY_HEADER} />
        <Card style={{ marginBottom: 24 }}><Skeleton active paragraph={{ rows: 4 }} /></Card>
        <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
      </div>
    );
  }

  if (loadError || visibleSrs.length === 0) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="New Sample Fabric Issue" backPath={BACK_TO_LIST} style={STICKY_HEADER} />
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
      <PageHeader title="New Sample Fabric Issue" backPath={BACK_TO_LIST} style={STICKY_HEADER}>
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
                  <Form.Item name="lineNo" label="Fabric Line" rules={[{ required: true, message: 'Select a fabric line' }]}>
                    <Select
                      placeholder={selectedSr && !lineOptions.length ? 'No fabric lines on this request' : 'Select fabric line'}
                      options={lineOptions}
                      onChange={handleLineChange}
                      disabled={!selectedSr || !lineOptions.length}
                      showSearch
                      optionFilterProp="label"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item name="receivedBy" label="Received By" rules={[{ required: true, message: 'Enter receiver name' }]}>
                    <Input placeholder="Who signed for the materials" />
                  </Form.Item>
                </Col>
              </Row>
              {/* Hidden fields carry submit-time values without rendering inputs */}
              <Form.Item name="issueDate" initialValue={dayjs()} hidden><DatePicker /></Form.Item>
              <Form.Item name="issuedBy" initialValue={currentUserName} hidden><Input /></Form.Item>
              {selectedLine && (
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
                </>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <SampleIssueSummaryPanel sr={selectedSr} line={selectedLine} stats={stats} />
          </Col>
        </Row>

        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>Roll Selection</Title>
          {borrowedOffered > 0 && (
            <Alert
              type="info" showIcon style={{ marginBottom: 12 }}
              message={`${borrowedOffered} of the offered rolls are earmarked to another order`}
              description="A bulk order's fabric may be borrowed for a sample — those rolls are listed last."
            />
          )}
          <FabricIssueRollPicker
            availableRolls={availableRolls}
            selectedRollIds={selectedRollIds}
            onSelectionChange={handleSelectionChange}
            rollSplits={rollSplits}
            onSplit={handleSplit}
            onCancelSplit={handleCancelSplit}
            bomRequired={requiredQty}
            uom={uom}
            uomMismatch={uomMismatch}
            uomMismatchMessage={UOM_MISMATCH}
          />
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

export default SampleFabricIssueForm;
