import { useState, useEffect, useMemo, useCallback } from 'react';
import { App, Form, Result, Skeleton, Select, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import {
  FormSection, FormInput, FormSelect, FormDatePicker, FormInputNumber,
} from '../../../components/form';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { hasPermission } from '../../../utils/permissions';
import { EXPDOC_MODULE } from '../../../utils/expDocConstants';
import { useStore } from '../../../context/StoreContext';
import { getBuyers } from '../../../services/master/buyerService';
import {
  getShipment, createShipment, updateShipment,
  listPorts, listIncoterms, getBuyerCommercial,
} from '../../../services/expdoc/expDocService';

const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };
const DATE_FIELDS = ['etd', 'eta', 'blAwbDate'];

const SHIPMENT_STATUS_CONFIG = {
  OPEN: { color: 'processing' },
  CLOSED: { color: 'default' },
};

const MODE_OPTIONS = [
  { value: 'SEA', label: 'Sea' },
  { value: 'AIR', label: 'Air' },
  { value: 'COURIER', label: 'Courier' },
];

/**
 * Shipment create / edit.
 *
 * Every field here is a data gap: no shipment record, port master or incoterm list
 * exists in the ERP today (see the plan's data-gap ledger). Ports and incoterms
 * come from the mock master so the API phase has a shape to adopt.
 */
const ShipmentForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const isEdit = Boolean(id);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [ports, setPorts] = useState([]);
  const [incoterms, setIncoterms] = useState([]);

  const { clearDirty } = useUnsavedChanges(isDirty);
  const canUpdate = hasPermission(EXPDOC_MODULE.SHIPMENTS, isEdit ? 'update' : 'add');

  // Buyers come from the real master, cached in StoreContext like everywhere else.
  const { buyers: storeBuyers, setData, isCacheValid, setLoading: setStoreLoading } = useStore();
  const [buyers, setBuyers] = useState(storeBuyers || []);

  useEffect(() => {
    let cancelled = false;
    const loadBuyers = async () => {
      if (isCacheValid('buyers') && storeBuyers.length) {
        setBuyers(storeBuyers);
        return;
      }
      setStoreLoading('buyers', true);
      try {
        const data = await getBuyers();
        const list = Array.isArray(data) ? data : data?.content || [];
        if (cancelled) return;
        setBuyers(list);
        setData('buyers', list);
      } catch {
        if (!cancelled) setBuyers([]);
      } finally {
        setStoreLoading('buyers', false);
      }
    };
    loadBuyers();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPorts(), listIncoterms()])
      .then(([p, i]) => {
        if (cancelled) return;
        setPorts(p);
        setIncoterms(i);
      })
      .catch(() => { /* pickers degrade to free text */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    setLoading(true);
    getShipment(id)
      .then((data) => {
        if (cancelled) return;
        setRecord(data);
        const values = { ...data };
        DATE_FIELDS.forEach((f) => { values[f] = data[f] ? dayjs(data[f]) : null; });
        form.setFieldsValue(values);
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Failed to load shipment'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const buyerOptions = useMemo(
    () => (buyers || []).map((b) => ({ value: b.name, label: b.name, id: b.id })),
    [buyers],
  );

  const watchedBuyerName = Form.useWatch('buyerName', form);

  // Sub-clients are a mock-only concept — no buyer in the ERP has one.
  const subClientOptions = useMemo(() => {
    if (!watchedBuyerName) return [];
    return (getBuyerCommercial({ buyerName: watchedBuyerName }).subClients || []).map((s) => ({
      value: s.code,
      label: `${s.code} — ${s.name}`,
    }));
  }, [watchedBuyerName]);

  /*
   * The consignee and notify party are chosen HERE, on the shipment, because that is
   * where they vary: the same buyer ships to DM Karlsruhe on one shipment and DM Bor
   * on the next, and Prenatal's D/A terms consign to a bank (§8.2, §24).
   *
   * Without these two controls every shipment a user created produced an invoice
   * with empty Consignee and Notify blocks, with nowhere in the UI to fix it.
   */
  const consigneeOptions = useMemo(() => {
    if (!watchedBuyerName) return [];
    return (getBuyerCommercial({ buyerName: watchedBuyerName }).consigneeProfiles || [])
      .map((c) => ({ value: c.id, label: `${c.name} — ${c.city || c.country || ''}`.trim() }));
  }, [watchedBuyerName]);

  const notifyOptions = useMemo(() => {
    if (!watchedBuyerName) return [];
    return (getBuyerCommercial({ buyerName: watchedBuyerName }).notifyProfiles || [])
      .map((c) => ({ value: c.id, label: `${c.name} — ${c.city || c.country || ''}`.trim() }));
  }, [watchedBuyerName]);

  const portOptions = useMemo(
    () => ports.map((p) => ({ value: p.name, label: `${p.name} (${p.code})` })),
    [ports],
  );

  const incotermOptions = useMemo(
    () => incoterms.map((i) => ({ value: i, label: i })),
    [incoterms],
  );

  const handleSave = useCallback(async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      message.warning('Complete the mandatory fields first');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...values };
      DATE_FIELDS.forEach((f) => {
        payload[f] = values[f] ? dayjs(values[f]).format('YYYY-MM-DD') : null;
      });
      const buyer = buyerOptions.find((b) => b.value === values.buyerName);
      payload.buyerId = buyer?.id ?? null;
      payload.buyerCode = getBuyerCommercial({ buyerName: values.buyerName }).buyerCode ?? null;

      const saved = isEdit
        ? await updateShipment(id, { ...payload, version: record?.version })
        : await createShipment(payload);

      setRecord(saved);
      setIsDirty(false);
      clearDirty();
      message.success(`${saved.shipmentNo} saved`);
      if (!isEdit) navigate(`/export-docs/shipments/edit/${saved.id}`, { replace: true });
    } catch (e) {
      // A version clash is surfaced by the global ConflictDialog, not a toast.
      if (!e.isOptimisticLockConflict) message.error(e.message || 'Failed to save shipment');
    } finally {
      setSaving(false);
    }
  }, [form, message, isEdit, id, record, buyerOptions, navigate, clearDirty]);

  if (loadError) {
    return (
      <Result
        status="warning"
        title="Shipment could not be opened"
        subTitle={loadError}
        extra={<ActionButton action="back" text="Back to shipments" onClick={() => navigate('/export-docs/shipments/list')} />}
      />
    );
  }

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="Shipment" style={STICKY_HEADER} />
        <Skeleton active paragraph={{ rows: 8 }} style={{ marginTop: 16 }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={record?.shipmentNo || 'New Shipment'}
        subtitle={record ? `${record.buyerName} · ETD ${record.etd || '—'}` : 'Ports, vessel and container for one consignment'}
        onBack={() => navigate('/export-docs/shipments/list')}
        status={record ? <StatusTag status={record.status} config={SHIPMENT_STATUS_CONFIG} /> : null}
        style={STICKY_HEADER}
      >
        <ActionButton action="close" text="Cancel" onClick={() => navigate('/export-docs/shipments/list')} />
        {canUpdate && (
          <ActionButton action="save" text="Save" loading={saving} onClick={handleSave} />
        )}
      </PageHeader>

      <Spin spinning={saving}>
        <Form
          form={form}
          layout="vertical"
          disabled={!canUpdate}
          onValuesChange={() => setIsDirty(true)}
          initialValues={{ mode: 'SEA', incoterm: 'FOB', preCarriageBy: 'ROAD', containerNos: [] }}
        >
          <FormSection title="Buyer & Consignment" columns={4}>
            <Form.Item name="buyerName" label="Buyer" rules={[{ required: true, message: 'Select a buyer' }]}>
              <FormSelect options={buyerOptions} placeholder="Select buyer" />
            </Form.Item>
            <Form.Item
              name="subClientCode"
              label="Sub-client / End customer"
              tooltip="Mock-only: the ERP has no sub-client concept yet. It drives buyer template resolution."
            >
              <FormSelect options={subClientOptions} placeholder={subClientOptions.length ? 'Optional' : 'None configured'} disabled={!subClientOptions.length} />
            </Form.Item>
            <Form.Item name="mode" label="Mode" rules={[{ required: true }]}>
              <FormSelect variant="default" options={MODE_OPTIONS} />
            </Form.Item>
            <Form.Item name="incoterm" label="Incoterm" rules={[{ required: true, message: 'Select an incoterm' }]}>
              <FormSelect variant="default" options={incotermOptions} />
            </Form.Item>
            <Form.Item
              name="consigneeProfileId"
              label="Consignee"
              tooltip="Printed on the invoice. It can differ per shipment — the same buyer may ship to a different delivery centre, and D/A terms consign to a bank."
            >
              <FormSelect
                options={consigneeOptions}
                placeholder={consigneeOptions.length
                  ? 'Select consignee'
                  : (watchedBuyerName
                    // Naming the cause: consignee profiles are a mock master keyed by
                    // buyer code, so a real ERP buyer that the mock does not know has
                    // none to offer. Silence here would read as "this buyer has none".
                    ? 'No consignee profile configured for this buyer'
                    : 'Pick a buyer first')}
                disabled={!consigneeOptions.length}
              />
            </Form.Item>
            <Form.Item name="notifyProfileId" label="Notify party">
              <FormSelect
                options={notifyOptions}
                placeholder={notifyOptions.length ? 'Optional' : 'None configured for this buyer'}
                disabled={!notifyOptions.length}
              />
            </Form.Item>
            <Form.Item name="deliveryCentre" label="Delivery centre" tooltip="Free text, printed where the buyer's layout shows one.">
              <FormInput placeholder="e.g. DM Verteilzentrum Karlsruhe" />
            </Form.Item>
          </FormSection>

          <FormSection title="Routing" columns={3}>
            <Form.Item name="preCarriageBy" label="Pre-carriage by">
              <FormInput placeholder="ROAD" />
            </Form.Item>
            <Form.Item name="placeOfReceipt" label="Place of receipt">
              <FormInput placeholder="Tiruppur" />
            </Form.Item>
            <Form.Item name="vesselFlightNo" label="Vessel / Flight No.">
              <FormInput placeholder="MAERSK CHENNAI V.214W" />
            </Form.Item>
            <Form.Item name="portOfLoading" label="Port of loading" rules={[{ required: true, message: 'Select the port of loading' }]}>
              <FormSelect options={portOptions} placeholder="Select port" />
            </Form.Item>
            <Form.Item name="portOfDischarge" label="Port of discharge" rules={[{ required: true, message: 'Select the port of discharge' }]}>
              <FormSelect options={portOptions} placeholder="Select port" />
            </Form.Item>
            <Form.Item name="finalDestination" label="Final destination">
              <FormInput placeholder="Valkenswaard, Netherlands" />
            </Form.Item>
            <Form.Item name="countryOfFinalDestination" label="Country of final destination">
              <FormInput placeholder="Netherlands" />
            </Form.Item>
            <Form.Item name="etd" label="ETD" rules={[{ required: true, message: 'Enter the ETD' }]}>
              <FormDatePicker />
            </Form.Item>
            <Form.Item
              name="eta"
              label="ETA"
              dependencies={['etd']}
              rules={[
                () => ({
                  validator: (_, value) => {
                    const etd = form.getFieldValue('etd');
                    if (value && etd && dayjs(value).isBefore(dayjs(etd), 'day')) {
                      return Promise.reject(new Error('ETA cannot be before ETD'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <FormDatePicker />
            </Form.Item>
          </FormSection>

          <FormSection title="Container & Documents" columns={3}>
            <Form.Item name="containerNos" label="Container No(s)" tooltip="Type a number and press Enter to add another.">
              <Select mode="tags" tokenSeparators={[',']} placeholder="MSKU7712345" open={false} suffixIcon={null} />
            </Form.Item>
            <Form.Item name="sealNo" label="Seal No.">
              <FormInput />
            </Form.Item>
            <Form.Item name="totalPallets" label="Total pallets">
              {/* Not variant="quantity": that variant exists to render a UOM addon,
                  and a pallet count has no unit. Passing it without a `uom` emits an
                  empty addonAfter, which AntD 6 deprecates. */}
              <FormInputNumber min={0} precision={0} />
            </Form.Item>
            <Form.Item name="blAwbNo" label="BL / AWB No.">
              <FormInput />
            </Form.Item>
            <Form.Item name="blAwbDate" label="BL / AWB date">
              <FormDatePicker />
            </Form.Item>
            <Form.Item name="forwarder" label="Forwarder">
              <FormInput />
            </Form.Item>
          </FormSection>
        </Form>
      </Spin>
    </div>
  );
};

export default ShipmentForm;
