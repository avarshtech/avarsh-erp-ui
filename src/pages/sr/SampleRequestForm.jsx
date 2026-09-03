import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Form, Card, Row, Col, Space, Skeleton, Alert, Result } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import { ActionButton } from '../../components/buttons';
import {
  createSampleRequest, updateSampleRequest, changeStatus,
  listSampleTypes,
} from '../../services/sr/srService';
import { SR_STATUS } from '../../utils/sampleRequestConstants';
import { computeSampleQtyRequired } from '../../utils/sampleBomMapper';
import { toastUnlessHandled } from '../../utils/apiError';
import useSampleRequestDraft from './useSampleRequestDraft';
import SampleBomPicker from './form/SampleBomPicker';
import SectionHeader from './form/SectionHeader';
import SectionDetails from './form/SectionDetails';
import SectionDeadlines from './form/SectionDeadlines';
import MaterialsTable from './form/MaterialsTable';
import SummaryBar from './form/SummaryBar';
import { getStockStatus } from '../../services/sr/srService';

const toDate = (v) => (v ? dayjs(v) : null);

// Same sticky header card as the Supplier PO form — actions stay reachable
// however far down the materials table the user has scrolled.
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };

const SampleRequestForm = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  // Set by the bare-entry BOM picker; the ?bomId/?orderNo query params carry
  // the same pair when the SR is raised from the BOM screen.
  const [picked, setPicked] = useState(null);
  const bomId = picked?.bomId || searchParams.get('bomId') || undefined;
  const orderNo = picked?.orderNo || searchParams.get('orderNo') || undefined;

  const draft = useSampleRequestDraft({ id, bomId, orderNo });
  const [form] = Form.useForm();
  const [materials, setMaterials] = useState([]);
  const [sampleTypes, setSampleTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [savedId, setSavedId] = useState(id ? Number(id) : null);
  // Optimistic-lock version of the last save — authoritative once we have one,
  // since draft.record still carries the version the form was loaded with
  const [savedVersion, setSavedVersion] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const substitution = Form.useWatch('colourSubstitutionAllowed', form);
  const sampleTypeId = Form.useWatch('sampleTypeId', form);
  const sampleQty = Form.useWatch('sampleQty', form);
  const watchedSizes = Form.useWatch('sizes', form);
  const sizes = useMemo(() => watchedSizes || [], [watchedSizes]);
  const typeName = sampleTypes.find((t) => t.id === sampleTypeId)?.name || draft.record?.sampleTypeName || '';

  useEffect(() => {
    listSampleTypes().then(setSampleTypes).catch(() => {}).finally(() => setTypesLoading(false));
  }, []);

  // Initialise once the draft resolves
  useEffect(() => {
    if (draft.loading || draft.error || draft.needsPicker) return;
    setMaterials(draft.materials);
    if (draft.mode === 'edit' && draft.record) {
      const r = draft.record;
      form.setFieldsValue({
        sampleTypeId: r.sampleTypeId,
        colourSubstitutionAllowed: Boolean(r.colourSubstitutionAllowed),
        sampleQty: r.sampleQty,
        sizes: r.sizes,
        colourReference: r.colourReference,
        priority: r.priority || 'NORMAL',
        specialInstructions: r.specialInstructions,
        inHandDate: toDate(r.inHandDate),
        dispatchDeadline: toDate(r.dispatchDeadline),
        buyerApprovalDeadline: toDate(r.buyerApprovalDeadline),
        remarks: r.remarks,
      });
    } else {
      form.setFieldsValue({ priority: 'NORMAL', sizes: draft.orderSizes });
    }
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.loading, draft.mode]);

  // Toggling substitution OFF resets any edited colours back to BOM values
  useEffect(() => {
    if (substitution === false) {
      setMaterials((prev) => prev.map((l) => ({ ...l, colourDesign: l.originalColourDesign })));
    }
  }, [substitution]);

  const onColourChange = useCallback((lineNo, value) => {
    setIsDirty(true);
    setMaterials((prev) => prev.map((l) => (l.lineNo === lineNo ? { ...l, colourDesign: value } : l)));
  }, []);

  const onMandatoryChange = useCallback((lineNo, checked) => {
    setIsDirty(true);
    setMaterials((prev) => prev.map((l) => {
      if (l.lineNo !== lineNo) return l;
      // Marking a trim mandatory re-locks its colour to the BOM value
      return { ...l, mandatory: checked, colourDesign: checked ? l.originalColourDesign : l.colourDesign };
    }));
  }, []);

  const srForRules = useMemo(() => ({
    colourSubstitutionAllowed: Boolean(substitution),
    status: SR_STATUS.DRAFT,
  }), [substitution]);

  const totals = useMemo(() => {
    let shortfall = 0;
    materials.forEach((l) => {
      const required = computeSampleQtyRequired(l, sampleQty, sizes);
      if (getStockStatus(l, required).status !== 'IN_STOCK') shortfall += 1;
    });
    return {
      total: materials.length,
      fabric: materials.filter((l) => l.section === 'FABRIC').length,
      trims: materials.filter((l) => l.section !== 'FABRIC').length,
      available: materials.length - shortfall,
      shortfall,
    };
  }, [materials, sampleQty, sizes]);

  const buildPayload = () => {
    const v = form.getFieldsValue();
    return {
      ...draft.header,
      // Optimistic locking — the server rejects a stale version with 409
      version: savedVersion ?? draft.record?.version,
      sampleTypeId: v.sampleTypeId ?? null,
      sampleTypeName: typeName,
      colourSubstitutionAllowed: Boolean(v.colourSubstitutionAllowed),
      sampleQty: v.sampleQty ?? null,
      sizes: v.sizes || [],
      colourReference: v.colourReference || '',
      priority: v.priority || 'NORMAL',
      specialInstructions: v.specialInstructions || '',
      inHandDate: v.inHandDate ? v.inHandDate.format('YYYY-MM-DD') : null,
      dispatchDeadline: v.dispatchDeadline ? v.dispatchDeadline.format('YYYY-MM-DD') : null,
      buyerApprovalDeadline: v.buyerApprovalDeadline ? v.buyerApprovalDeadline.format('YYYY-MM-DD') : null,
      remarks: v.remarks || '',
      materials: materials.map((l) => ({
        ...l,
        sampleQtyRequired: computeSampleQtyRequired(l, v.sampleQty, v.sizes || []),
      })),
    };
  };

  const persist = async () => {
    const payload = buildPayload();
    const saved = savedId
      ? await updateSampleRequest(savedId, payload)
      : await createSampleRequest(payload);
    setSavedId(saved.id);
    setSavedVersion(saved.version ?? null);
    setIsDirty(false);
    return saved;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const saved = await persist();
      message.success(`${saved.srNo} saved as draft`);
      navigate('/sample-requests/list');
    } catch (e) { toastUnlessHandled(message, e, 'Failed to save'); } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    try { await form.validateFields(); } catch { message.warning('Complete the mandatory fields first'); return; }
    setSaving(true);
    try {
      const saved = await persist();
      await changeStatus(saved.id, SR_STATUS.SUBMITTED, saved.version);
      message.success(`${saved.srNo} submitted`);
      navigate('/sample-requests/list');
    } catch (e) { toastUnlessHandled(message, e, 'Failed to submit'); } finally { setSaving(false); }
  };

  const handleCancel = () => {
    if (!isDirty) { navigate('/sample-requests/list'); return; }
    modal.confirm({
      title: 'Discard changes?',
      content: 'Unsaved changes will be lost.',
      okText: 'Discard',
      okButtonProps: { danger: true },
      onOk: () => navigate('/sample-requests/list'),
    });
  };

  if (draft.needsPicker) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="New Sample Request" style={STICKY_HEADER} />
        <SampleBomPicker
          onPick={setPicked}
          resolving={draft.loading && Boolean(picked)}
          pickedBomId={picked?.bomId}
        />
      </div>
    );
  }
  if (draft.loading) {
    return (
      <div className="animate-fade-in-up">
        <div className="page-header" style={STICKY_HEADER}>
          <Space>
            <Skeleton.Button active size="small" style={{ width: 32, height: 32 }} />
            <Skeleton.Input active style={{ width: 200 }} />
          </Space>
          <Space>
            <Skeleton.Button active style={{ width: 90 }} />
            <Skeleton.Button active style={{ width: 130 }} />
            <Skeleton.Button active style={{ width: 180 }} />
          </Space>
        </div>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 180, marginBottom: 16 }} />
          <Row gutter={[24, 16]}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Col xs={12} sm={8} md={6} key={i}>
                <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 4 }} block={false} />
                <Skeleton.Input active size="small" block />
              </Col>
            ))}
          </Row>
        </Card>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 180, marginBottom: 24 }} />
          <Row gutter={16}>
            {[[1, 6], [2, 6], [3, 4], [4, 8]].map(([k, lg]) => (
              <Col xs={24} sm={12} md={8} lg={lg} key={k} style={{ marginBottom: 16 }}>
                <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
                <Skeleton.Input active block />
              </Col>
            ))}
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={10} lg={8} style={{ marginBottom: 16 }}>
              <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
              <Skeleton.Input active block />
            </Col>
            <Col xs={24} sm={12} md={6} lg={4} style={{ marginBottom: 16 }}>
              <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
              <Skeleton.Input active block />
            </Col>
            <Col xs={24} md={8} lg={12} style={{ marginBottom: 16 }}>
              <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
              <Skeleton.Input active block />
            </Col>
          </Row>
        </Card>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 180, marginBottom: 24 }} />
          <Row gutter={16}>
            {[1, 2, 3].map((i) => (
              <Col xs={24} sm={8} key={i} style={{ marginBottom: 16 }}>
                <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
                <Skeleton.Input active block />
              </Col>
            ))}
          </Row>
        </Card>
        <Card size="small">
          <Skeleton.Input active style={{ width: 180, marginBottom: 24 }} />
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
      </div>
    );
  }
  if (draft.error === 'NOT_EDITABLE') {
    return (
      <Result
        status="warning"
        title="This Sample Request is no longer editable"
        subTitle={`Only Draft SRs can be edited — ${draft.record?.srNo} is ${draft.record?.status}.`}
        extra={<ActionButton action="view" text="Back to SR List" onClick={() => navigate('/sample-requests/list')} />}
      />
    );
  }
  if (draft.error) {
    return <Alert type="error" showIcon message="Failed to load" description={draft.error} style={{ margin: 24 }} />;
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={savedId ? 'Edit Sample Request' : 'New Sample Request'}
        onBack={handleCancel}
        style={STICKY_HEADER}
      >
        <ActionButton action="close" text="Cancel" onClick={handleCancel} />
        <ActionButton action="save" variant="draft" text="Save as Draft" loading={saving} onClick={handleSaveDraft} />
        <ActionButton action="send" text="Submit Sample Request" loading={saving} onClick={handleSubmit} />
      </PageHeader>
      <SectionHeader
        srNo={draft.record?.srNo}
        header={draft.header}
      />
      <Form form={form} layout="vertical" onValuesChange={() => setIsDirty(true)}>
        <SectionDetails
          form={form}
          sampleTypes={sampleTypes}
          typesLoading={typesLoading}
          orderSizes={draft.orderSizes}
        />
        <SectionDeadlines form={form} />
        <MaterialsTable
          materials={materials}
          sr={srForRules}
          sampleQty={sampleQty}
          sizes={sizes}
          typeName={typeName}
          onColourChange={onColourChange}
          onMandatoryChange={onMandatoryChange}
        />
        <SummaryBar totals={totals} />
      </Form>
    </div>
  );
};

export default SampleRequestForm;
