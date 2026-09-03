import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Card, Steps, Space, Skeleton, Tag, Spin, Segmented, Alert, Typography, Row, Col } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import {
  getInvoice, createInvoice, updateInvoice, issueInvoice, listEligibleSrs, getHsnDefault,
  getDispatch,
} from '../../../services/sr/srService';
import { getOrderByOrderNo } from '../../../services/orders/orderService';
import {
  SAMPLE_INVOICE_STATUS, DISPATCH_MODE_LABELS,
  INVOICE_TYPES, INVOICE_TYPE_LABELS, INVOICE_TYPE_SERIES,
} from '../../../utils/sampleRequestConstants';
import { printSampleInvoice } from '../../../utils/sampleInvoicePdfGenerator';
import { toastUnlessHandled } from '../../../utils/apiError';
import useCompanyProfile from './useCompanyProfile';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import InvoiceStepStyles from './InvoiceStepStyles';
import InvoiceStepHeader from './InvoiceStepHeader';
import InvoiceStepLines from './InvoiceStepLines';
import InvoiceStepDeclaration from './InvoiceStepDeclaration';

const { Text } = Typography;

const LIST_PATH = '/sample-requests/invoices/list';
// Sticky header card carrying the wizard's actions (Supplier PO form pattern)
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };

const termsFromMode = (mode) => (mode && mode !== 'HAND_CARRY'
  ? `DELIVERY AT PLACE — BY ${DISPATCH_MODE_LABELS[mode]?.toUpperCase() || 'COURIER'}`
  : 'DELIVERY AT PLACE — BY COURIER');

/**
 * A blank invoice of one type. Used both when opening the wizard and when the
 * user switches type — a switch is a fresh start, because the eligible SRs,
 * the series, the declaration and the consignee all differ between the two.
 * `keep` carries over the identity of a draft being edited plus the few fields
 * that are type-independent (date, country of origin).
 */
const makeBlankInvoice = (type, keep = {}) => ({
  invoiceType: type,
  series: INVOICE_TYPE_SERIES[type],
  status: SAMPLE_INVOICE_STATUS.DRAFT,
  invoiceNo: null,
  invoiceDate: dayjs().format('YYYY-MM-DD'),
  consigneeName: '', consigneeAddress: '', consigneeContact: '',
  buyerOrderNoDate: '', otherReferences: '', buyerOtherThanConsignee: '', notifyParty: '',
  countryOfOrigin: 'India',
  destinationCountry: '',
  preCarriage: 'N.A.', placeOfReceipt: 'N.A.', vesselFlightNo: '',
  portOfLoading: '', portOfDischarge: '', finalDestination: '',
  termsOfDelivery: '', paymentTerms: '', containerNo: '', marksAndNos: '', packages: '',
  currency: 'USD',
  lines: [], srIds: [],
  ...keep,
});

/**
 * Create / edit invoice — 4-step wizard, type-aware (R2):
 *  - COMMERCIAL (EXSG): customs doc raised BEFORE dispatch; `?dispatchId=`
 *    preselects that dispatch's uncovered SRs so the overseas gate can pass.
 *  - SAMPLE (SA): chargeable recovery invoice raised AFTER dispatch for
 *    non-converted samples (2× guidance is wizard-only, never printed).
 * Issued invoices render read-only (immutable — cancel + duplicate).
 */
const SampleInvoiceForm = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const dispatchId = searchParams.get('dispatchId') ? Number(searchParams.get('dispatchId')) : null;
  const profile = useCompanyProfile();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(id ? 1 : 0);
  const [eligible, setEligible] = useState([]);
  const [dispatchNo, setDispatchNo] = useState(null);
  const [inv, setInv] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  const locked = inv && inv.status !== SAMPLE_INVOICE_STATUS.DRAFT;
  const invType = inv?.invoiceType || INVOICE_TYPES.COMMERCIAL;
  const patch = useCallback((p) => {
    setIsDirty(true);
    setInv((prev) => ({ ...prev, ...p }));
  }, []);

  const leave = useCallback((path) => { clearDirty(); navigate(path); }, [clearDirty, navigate]);

  // Eligibility depends on the invoice type; ?dispatchId= scopes COMMERCIAL
  const fetchEligible = useCallback(async (type) => {
    const rows = await listEligibleSrs({
      type,
      dispatchId: type === INVOICE_TYPES.COMMERCIAL ? dispatchId || undefined : undefined,
    });
    setEligible(rows);
    return rows;
  }, [dispatchId]);

  // Consignee / destination / refs / terms / currency derived from an SR row
  const prefillFromRow = useCallback(async (row) => {
    const prefill = {
      consigneeName: row.buyerName,
      destinationCountry: row.buyerCountry || '',
      finalDestination: row.buyerCountry || '',
      buyerOrderNoDate: row.orderNo || '',
      termsOfDelivery: termsFromMode(row.dispatchMode),
    };
    try {
      if (row.orderNo) {
        const order = await getOrderByOrderNo(row.orderNo);
        if (order?.currency) prefill.currency = order.currency; // defaults from the linked order
      }
    } catch { /* keep default currency */ }
    return prefill;
  }, []);

  // ── Init ──
  useEffect(() => {
    (async () => {
      try {
        if (id) {
          const loaded = await getInvoice(id);
          setInv(loaded);
          await fetchEligible(loaded.invoiceType || INVOICE_TYPES.COMMERCIAL);
        } else {
          const rows = await fetchEligible(INVOICE_TYPES.COMMERCIAL);
          const base = makeBlankInvoice(INVOICE_TYPES.COMMERCIAL);
          // ?dispatchId= deep link (Dispatches → Generate Commercial Invoice):
          // pre-tick every uncovered SR on that dispatch so the overseas gate
          // can pass in one issue
          if (dispatchId) {
            try {
              const d = await getDispatch(dispatchId);
              setDispatchNo(d.dispatchNo);
            } catch { /* banner simply stays generic */ }
            const picks = rows.filter((r) => r.eligible);
            if (picks.length) {
              const [lines, prefill] = await Promise.all([
                Promise.all(picks.map((row) => addSrLine(row))),
                prefillFromRow(picks[0]),
              ]);
              Object.assign(base, prefill, { srIds: picks.map((r) => r.id), lines });
            }
          }
          setInv(base);
        }
      } catch (e) {
        toastUnlessHandled(message, e, 'Failed to load');
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, dispatchId, message]);

  useEffect(() => {
    if (!loading && profile.exporterCountry && inv && !id) {
      patch({ countryOfOrigin: profile.exporterCountry });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile.exporterCountry]);

  // ── SR selection sync (Step 1 → lines) ──
  const addSrLine = useCallback(async (row) => {
    const hsn = await getHsnDefault('Woven').catch(() => '6206');
    return {
      key: `sr${row.id}`,
      srId: row.id,
      srNo: row.srNo,
      styleNo: row.styleNo,
      hsnCode: hsn,
      description: (row.garmentName || '').toUpperCase(),
      quantity: row.quantity,
      uom: 'PCS',
      rate: null,
      manual: false,
    };
  }, []);

  const toggleSr = useCallback(async (srId) => {
    const row = eligible.find((r) => r.id === srId);
    if (!row) return;
    const selectedNow = inv.srIds.includes(srId);
    if (selectedNow) {
      patch({
        srIds: inv.srIds.filter((x) => x !== srId),
        lines: inv.lines.filter((l) => l.srId !== srId),
      });
      return;
    }
    setSelecting(true);
    try {
      const line = await addSrLine(row);
      const patchObj = {
        srIds: [...inv.srIds, srId],
        lines: [...inv.lines, line],
      };
      // First selection prefills consignee / destination / refs / terms / currency
      if (inv.srIds.length === 0) {
        const prefill = await prefillFromRow(row);
        patchObj.consigneeName = inv.consigneeName || prefill.consigneeName;
        patchObj.destinationCountry = inv.destinationCountry || prefill.destinationCountry;
        patchObj.finalDestination = inv.finalDestination || prefill.finalDestination;
        patchObj.buyerOrderNoDate = inv.buyerOrderNoDate || prefill.buyerOrderNoDate;
        patchObj.termsOfDelivery = inv.termsOfDelivery || prefill.termsOfDelivery;
        if (prefill.currency) patchObj.currency = prefill.currency;
      }
      patch(patchObj);
    } finally { setSelecting(false); }
  }, [eligible, inv, patch, addSrLine, prefillFromRow]);

  // ── Type switch (draft only) ──
  // The two types share almost nothing: different eligible SRs, series,
  // consignee, declaration and print layout. So a switch starts the invoice
  // over rather than carrying half-entered commercial data into a sample
  // invoice — but never silently: anything already entered is confirmed away
  // first, in the same language as the global unsaved-changes guard.
  const applyTypeChange = useCallback((type) => {
    setSelecting(true);
    setInv((prev) => makeBlankInvoice(type, {
      // A saved draft keeps its identity; the type change persists on next save
      ...(prev.id ? { id: prev.id, version: prev.version, activity: prev.activity } : {}),
      invoiceDate: prev.invoiceDate,
      countryOfOrigin: prev.countryOfOrigin,
    }));
    setStep(0);
    fetchEligible(type)
      .catch(() => message.error('Failed to load eligible SRs'))
      .finally(() => setSelecting(false));
  }, [fetchEligible, message]);

  const handleTypeChange = useCallback((type) => {
    if (type === invType || locked) return;
    const entered = Boolean(inv?.srIds?.length || inv?.lines?.length || isDirty);
    if (!entered) { applyTypeChange(type); return; }
    modal.confirm({
      title: 'Unsaved Changes',
      icon: <ExclamationCircleOutlined />,
      content: inv.id
        ? `This draft is saved as a ${INVOICE_TYPE_LABELS[invType]}. Switching to ${INVOICE_TYPE_LABELS[type]} clears its styles, lines and header details — the change is written when you save the draft.`
        : `Switching to ${INVOICE_TYPE_LABELS[type]} clears the styles, lines and header details entered so far, because the two types draw on different sample requests. Continue?`,
      okText: 'Switch & Clear',
      okType: 'danger',
      cancelText: 'Stay',
      onOk: () => {
        applyTypeChange(type);
        message.info(`Switched to ${INVOICE_TYPE_LABELS[type]} — start by picking its styles`);
      },
    });
  }, [invType, locked, inv, isDirty, applyTypeChange, modal, message]);

  // ── Totals ──
  const totals = useMemo(() => {
    const lines = inv?.lines || [];
    const totalQty = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
    const ratesMissing = lines.some((l) => l.rate == null || l.rate === '');
    return {
      totalQty,
      ratesMissing,
      declaredValue: ratesMissing ? null
        : lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0),
    };
  }, [inv]);

  // ── Issue readiness (type-aware) ──
  // Mirrors the rules issueInvoice enforces, so the button explains what is
  // missing instead of failing after the click. The Sample type adds payment
  // terms — it is a chargeable document the buyer has to settle.
  const issueBlockers = useMemo(() => {
    if (!inv) return [];
    const missing = [];
    if (!inv.consigneeName) missing.push('Consignee');
    if (!inv.invoiceDate) missing.push('Invoice Date');
    if (!inv.countryOfOrigin) missing.push('Country of Origin');
    if (!inv.destinationCountry) missing.push('Country of Final Destination');
    if (!inv.termsOfDelivery) missing.push('Terms of Delivery & Payment');
    if (!inv.lines?.length) missing.push('at least one line');
    else if (totals.ratesMissing) missing.push('a Rate on every line');
    if (invType === INVOICE_TYPES.SAMPLE && !inv.paymentTerms) missing.push('Payment Terms');
    return missing;
  }, [inv, invType, totals.ratesMissing]);

  // ── Persistence ──
  const persist = async () => {
    // Both branches adopt the saved record so a second save — Issue retried
    // after a validation failure — sends the version the server just wrote
    const saved = inv.id ? await updateInvoice(inv.id, inv) : await createInvoice(inv);
    setInv(saved);
    return saved;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await persist();
      setIsDirty(false);
      message.success('Invoice saved as draft — number is assigned on issue');
      leave(LIST_PATH);
    } catch (e) { toastUnlessHandled(message, e, 'Failed to save'); } finally { setSaving(false); }
  };

  const handleIssue = () => {
    modal.confirm({
      title: 'Issue invoice?',
      content: invType === INVOICE_TYPES.SAMPLE
        ? `Issue assigns the invoice number (series ${inv.series || 'SA'}), locks the document permanently (corrections = cancel + duplicate), and links this chargeable invoice to every SR it covers.`
        : 'Issue assigns the invoice number, locks the document permanently (corrections = cancel + duplicate), and links it to every SR it covers — unlocking Mark as Dispatched for them.',
      okText: 'Issue Invoice',
      onOk: async () => {
        setSaving(true);
        try {
          const saved = await persist();
          const issued = await issueInvoice(saved.id, saved.version);
          setIsDirty(false);
          message.success(`Invoice ${issued.invoiceNo} issued — ${issued.currency} ${issued.declaredValue?.toFixed(2)}`);
          leave(LIST_PATH);
        } catch (e) { toastUnlessHandled(message, e, 'Failed to issue'); } finally { setSaving(false); }
      },
    });
  };

  const handlePrint = () => {
    if (!printSampleInvoice(inv, profile)) message.error('Pop-up blocked — allow pop-ups to print');
  };

  if (loading || !inv || profile.loading) {
    return (
      <div className="animate-fade-in-up">
        <div className="page-header" style={STICKY_HEADER}>
          <Space>
            <Skeleton.Button active size="small" style={{ width: 32, height: 32 }} />
            <Skeleton.Input active style={{ width: 200 }} />
            <Skeleton.Button active size="small" style={{ width: 90 }} />
          </Space>
          <Space>
            <Skeleton.Button active style={{ width: 130 }} />
            <Skeleton.Button active style={{ width: 90 }} />
            <Skeleton.Button active style={{ width: 130 }} />
            <Skeleton.Button active style={{ width: 130 }} />
          </Space>
        </div>
        <Card>
          <div style={{ marginBottom: 16 }}>
            <Skeleton.Button active block style={{ height: 32 }} />
            <Skeleton.Input active size="small" style={{ width: 320, marginTop: 8 }} block={false} />
          </div>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            {[1, 2, 3, 4].map((i) => (
              <Col span={6} key={i}>
                <Skeleton.Input active size="small" block />
              </Col>
            ))}
          </Row>
          <Row gutter={24}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Col xs={24} md={12} key={i} style={{ marginBottom: 16 }}>
                <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
                <Skeleton.Input active block />
              </Col>
            ))}
          </Row>
          <Space style={{ marginTop: 24 }}>
            <Skeleton.Button active style={{ width: 80 }} />
            <Skeleton.Button active style={{ width: 80 }} />
          </Space>
        </Card>
      </div>
    );
  }

  const steps = [
    { title: 'Styles', description: `${inv.srIds.length} selected` },
    { title: 'Invoice Header' },
    { title: 'Lines & Valuation' },
    { title: 'Declaration & Totals' },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={inv.invoiceNo ? `${INVOICE_TYPE_LABELS[invType]} ${inv.invoiceNo}` : 'New Invoice'}
        backPath={LIST_PATH}
        style={STICKY_HEADER}
        status={(
          <>
            <Tag color={invType === INVOICE_TYPES.SAMPLE ? 'gold' : 'geekblue'}>{INVOICE_TYPE_LABELS[invType]}</Tag>
            <Tag color={locked ? 'blue' : 'default'}>{locked ? inv.status : 'DRAFT — number assigned on issue'}</Tag>
          </>
        )}
      >
        <ActionButton action="print" text="Print Preview" onClick={handlePrint} />
        <ActionButton action="close" text="Close" onClick={() => navigate(LIST_PATH)} />
        {!locked && (
          <>
            <ActionButton action="save" variant="draft" text="Save as Draft" loading={saving} onClick={handleSaveDraft} />
            <ActionButton
              action="send" text="Issue Invoice" loading={saving}
              disabled={issueBlockers.length > 0}
              tooltip={issueBlockers.length ? `Blocked — still missing: ${issueBlockers.join(', ')}` : undefined}
              onClick={handleIssue}
            />
          </>
        )}
      </PageHeader>

      <Card>
        {!locked && (
          <div style={{ marginBottom: 16 }}>
            <Segmented
              block
              value={invType}
              onChange={handleTypeChange}
              options={[
                { label: 'Commercial — customs, before dispatch', value: INVOICE_TYPES.COMMERCIAL },
                { label: 'Sample — chargeable, after dispatch', value: INVOICE_TYPES.SAMPLE },
              ]}
            />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
              {invType === INVOICE_TYPES.SAMPLE
                ? `Series ${inv.series || 'SA'} · recovery charge for samples that did not convert to a bulk order`
                : `Series ${inv.series || 'EXSG'} · travels with the parcel — required before an overseas dispatch can ship`}
              {' · switching type starts the invoice over'}
            </Text>
          </div>
        )}
        {dispatchId && !id && invType === INVOICE_TYPES.COMMERCIAL && (
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message={`Styles preselected from ${dispatchNo || 'the dispatch'}`}
            description="Every SR on the dispatch must be covered by an issued commercial invoice before it can be marked dispatched."
          />
        )}
        <Steps size="small" current={step} items={steps} onChange={setStep} style={{ marginBottom: 24 }} />
        {step === 0 && (
          <Spin spinning={selecting} tip="Adding style…">
            <InvoiceStepStyles eligible={eligible} selectedIds={inv.srIds} onToggle={toggleSr} locked={locked} />
          </Spin>
        )}
        {step === 1 && <InvoiceStepHeader inv={inv} patch={patch} profile={profile} locked={locked} />}
        {step === 2 && <InvoiceStepLines inv={inv} patch={patch} locked={locked} onAddFromSr={() => setStep(0)} />}
        {step === 3 && <InvoiceStepDeclaration inv={inv} patch={patch} profile={profile} totals={totals} locked={locked} />}

        {/* Step navigation only — the invoice's actions live in the sticky header */}
        <Space style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 24 }}>
          {step > 0 && <ActionButton action="back" text="Back" onClick={() => setStep(step - 1)} />}
          {step < 3 && <ActionButton action="view" text="Next" onClick={() => setStep(step + 1)} />}
        </Space>
      </Card>
    </div>
  );
};

export default SampleInvoiceForm;
