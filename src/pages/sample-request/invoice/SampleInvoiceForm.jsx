import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Card, Steps, Space, Skeleton, Tag, Spin } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import {
  getInvoice, createInvoice, updateInvoice, issueInvoice, listEligibleSrs, getHsnDefault,
} from '../../../services/sr/srService';
import { getOrderByOrderNo } from '../../../services/orders/orderService';
import { SAMPLE_INVOICE_STATUS, DISPATCH_MODE_LABELS } from '../../../utils/sampleRequestConstants';
import { printSampleInvoice } from '../../../utils/sampleInvoicePdfGenerator';
import useCompanyProfile from './useCompanyProfile';
import InvoiceStepStyles from './InvoiceStepStyles';
import InvoiceStepHeader from './InvoiceStepHeader';
import InvoiceStepLines from './InvoiceStepLines';
import InvoiceStepDeclaration from './InvoiceStepDeclaration';

const termsFromMode = (mode) => (mode && mode !== 'HAND_CARRY'
  ? `DELIVERY AT PLACE — BY ${DISPATCH_MODE_LABELS[mode]?.toUpperCase() || 'COURIER'}`
  : 'DELIVERY AT PLACE — BY COURIER');

/**
 * Create / edit Commercial Invoice — 4-step wizard (PRD §10.3–10.6) with the
 * EXSG print (§10.7). Issued invoices render read-only (immutable — §10.8).
 */
const SampleInvoiceForm = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const preselectSrId = searchParams.get('srId') ? Number(searchParams.get('srId')) : null;
  const profile = useCompanyProfile();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(preselectSrId || id ? 1 : 0);
  const [eligible, setEligible] = useState([]);
  const [inv, setInv] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const locked = inv && inv.status !== SAMPLE_INVOICE_STATUS.DRAFT;
  const patch = useCallback((p) => setInv((prev) => ({ ...prev, ...p })), []);

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
        const rows = await listEligibleSrs();
        setEligible(rows);
        if (id) {
          setInv(await getInvoice(id));
        } else {
          const base = {
            series: 'EXSG',
            status: SAMPLE_INVOICE_STATUS.DRAFT,
            invoiceNo: null,
            invoiceDate: dayjs().format('YYYY-MM-DD'),
            consigneeName: '', consigneeAddress: '',
            buyerOrderNoDate: '', otherReferences: '', buyerOtherThanConsignee: '', notifyParty: '',
            countryOfOrigin: 'India',
            destinationCountry: '',
            preCarriage: 'N.A.', placeOfReceipt: 'N.A.', vesselFlightNo: '',
            portOfLoading: '', portOfDischarge: '', finalDestination: '',
            termsOfDelivery: '', marksAndNos: '', packages: '',
            currency: 'USD',
            lines: [], srIds: [],
          };
          // ?srId= deep link (dispatch panel / SR list "Generate Invoice"):
          // pre-tick the originating SR and prefill its consignee (PRD §10.3)
          if (preselectSrId) {
            const row = rows.find((r) => r.id === preselectSrId && r.eligible);
            if (row) {
              const [line, prefill] = await Promise.all([addSrLine(row), prefillFromRow(row)]);
              Object.assign(base, prefill, { srIds: [row.id], lines: [line] });
            }
          }
          setInv(base);
        }
      } catch (e) {
        message.error(e.message || 'Failed to load');
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, preselectSrId, message]);

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

  // ── Persistence ──
  const persist = async () => {
    if (inv.id) return updateInvoice(inv.id, inv);
    const created = await createInvoice(inv);
    setInv(created);
    return created;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await persist();
      message.success('Invoice saved as draft — number is assigned on issue');
      navigate('/sample-requests/invoices/list');
    } catch (e) { message.error(e.message || 'Failed to save'); } finally { setSaving(false); }
  };

  const handleIssue = () => {
    modal.confirm({
      title: 'Issue invoice?',
      content: 'Issue assigns the invoice number, locks the document permanently (corrections = cancel + duplicate), and links it to every SR it covers — unlocking Mark as Dispatched for them.',
      okText: 'Issue Invoice',
      onOk: async () => {
        setSaving(true);
        try {
          const saved = await persist();
          const issued = await issueInvoice(saved.id);
          message.success(`Invoice ${issued.invoiceNo} issued — ${issued.currency} ${issued.declaredValue?.toFixed(2)}`);
          navigate('/sample-requests/invoices/list');
        } catch (e) { message.error(e.message || 'Failed to issue'); } finally { setSaving(false); }
      },
    });
  };

  const handlePrint = () => {
    if (!printSampleInvoice(inv, profile)) message.error('Pop-up blocked — allow pop-ups to print');
  };

  if (loading || !inv || profile.loading) {
    return <Card style={{ margin: 24 }}><Skeleton active paragraph={{ rows: 8 }} /></Card>;
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
        title={inv.invoiceNo ? `Commercial Invoice ${inv.invoiceNo}` : 'New Commercial Invoice'}
      >
        <Tag color={locked ? 'blue' : 'default'}>{locked ? inv.status : 'DRAFT — number assigned on issue'}</Tag>
      </PageHeader>

      <Card>
        <Steps size="small" current={step} items={steps} onChange={setStep} style={{ marginBottom: 24, maxWidth: 900 }} />
        {step === 0 && (
          <Spin spinning={selecting} tip="Adding style…">
            <InvoiceStepStyles eligible={eligible} selectedIds={inv.srIds} onToggle={toggleSr} locked={locked} />
          </Spin>
        )}
        {step === 1 && <InvoiceStepHeader inv={inv} patch={patch} profile={profile} locked={locked} />}
        {step === 2 && <InvoiceStepLines inv={inv} patch={patch} locked={locked} onAddFromSr={() => setStep(0)} />}
        {step === 3 && <InvoiceStepDeclaration inv={inv} patch={patch} profile={profile} totals={totals} locked={locked} />}

        <Space style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <Space>
            {step > 0 && <ActionButton action="back" text="Back" onClick={() => setStep(step - 1)} />}
            {step < 3 && <ActionButton action="view" text="Next" onClick={() => setStep(step + 1)} />}
          </Space>
          <Space>
            <ActionButton action="print" text="Print Preview" onClick={handlePrint} />
            <ActionButton action="close" text="Close" onClick={() => navigate('/sample-requests/invoices/list')} />
            {!locked && (
              <>
                <ActionButton action="save" variant="draft" text="Save as Draft" loading={saving} onClick={handleSaveDraft} />
                <ActionButton
                  action="send" text="Issue Invoice" loading={saving}
                  disabled={totals.ratesMissing || !inv.lines.length}
                  tooltip={totals.ratesMissing ? 'Blocked — every selected line must carry a rate' : undefined}
                  onClick={handleIssue}
                />
              </>
            )}
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default SampleInvoiceForm;
