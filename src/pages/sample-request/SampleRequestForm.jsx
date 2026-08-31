import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Form, Card, Row, Col, Space, Skeleton, Alert, Result, Spin } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import { ActionButton } from '../../components/buttons';
import {
  createSampleRequest, updateSampleRequest, changeStatus, getSampleRequest,
  listSampleTypes,
} from '../../services/sr/srService';
import { SR_STATUS } from '../../utils/sampleRequestConstants';
import { computeSampleQtyRequired } from '../../utils/sampleBomMapper';
import useSampleRequestDraft from './useSampleRequestDraft';
import SampleOrderPicker from './form/SampleOrderPicker';
import SectionHeader from './form/SectionHeader';
import SectionDetails from './form/SectionDetails';
import SectionDeadlines from './form/SectionDeadlines';
import MaterialsTable from './form/MaterialsTable';
import SummaryBar from './form/SummaryBar';
import RaisePoDrawer from './form/RaisePoDrawer';
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
  const [pickedOrderNo, setPickedOrderNo] = useState(null);
  const bomId = searchParams.get('bomId') || undefined;
  const orderNo = pickedOrderNo || searchParams.get('orderNo') || undefined;

  const draft = useSampleRequestDraft({ id, bomId, orderNo });
  const [form] = Form.useForm();
  const [materials, setMaterials] = useState([]);
  const [sampleTypes, setSampleTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [poPreparing, setPoPreparing] = useState(false);
  const [savedId, setSavedId] = useState(id ? Number(id) : null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [poDrawer, setPoDrawer] = useState({ open: false, focusLine: null, sr: null });

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
      posRaised: materials.filter((l) => l.poRef).length,
    };
  }, [materials, sampleQty, sizes]);

  const buildPayload = () => {
    const v = form.getFieldsValue();
    return {
      ...draft.header,
      sampleTypeId: v.sampleTypeId ?? null,
      sampleTypeName: typeName,
      colourSubstitutionAllowed: Boolean(v.colourSubstitutionAllowed),
      round: 1, // rounds unused in R2 — dormant internal field
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
    setIsDirty(false);
    return saved;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const saved = await persist();
      message.success(`${saved.srNo} saved as draft`);
      navigate('/sample-requests/list');
    } catch (e) { message.error(e.message || 'Failed to save'); } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    try { await form.validateFields(); } catch { message.warning('Complete the mandatory fields first'); return; }
    setSaving(true);
    try {
      const saved = await persist();
      await changeStatus(saved.id, SR_STATUS.SUBMITTED);
      message.success(`${saved.srNo} submitted`);
      navigate('/sample-requests/list');
    } catch (e) { message.error(e.message || 'Failed to submit'); } finally { setSaving(false); }
  };

  const handleRaisePo = useCallback(async (focusLine) => {
    setPoPreparing(true);
    try {
      let srId = savedId;
      if (!srId) {
        const saved = await persist();
        srId = saved.id;
        message.info(`${saved.srNo} saved as draft so the PO can link to it`);
      }
      const fresh = await getSampleRequest(srId);
      setPoDrawer({ open: true, focusLine, sr: fresh });
    } catch (e) {
      message.error(e.message || 'Save the draft before raising a PO');
    } finally { setPoPreparing(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId, materials]);

  const afterPoCreated = useCallback(async () => {
    if (!savedId && !poDrawer.sr) return;
    const fresh = await getSampleRequest(poDrawer.sr?.id || savedId);
    setMaterials(fresh.materials || []);
  }, [savedId, poDrawer.sr]);

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
        <SampleOrderPicker
          onPick={setPickedOrderNo}
          resolving={draft.loading && Boolean(pickedOrderNo)}
          pickedOrderNo={pickedOrderNo}
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
      <Spin spinning={poPreparing} tip="Preparing sample PO…">
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
          onRaisePo={handleRaisePo}
        />
        <SummaryBar totals={totals} onRaisePoFromShortfall={() => handleRaisePo(null)} />
      </Form>
      </Spin>
      <RaisePoDrawer
        open={poDrawer.open}
        sr={poDrawer.sr}
        focusLine={poDrawer.focusLine}
        onClose={() => setPoDrawer({ open: false, focusLine: null, sr: poDrawer.sr })}
        onCreated={afterPoCreated}
      />
    </div>
  );
};

export default SampleRequestForm;
