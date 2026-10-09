import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert, App, Form, Result, Skeleton, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { hasPermission } from '../../../utils/permissions';
import {
  EXPDOC_MODULE, EXPORT_PORTS, INCOTERMS, SHIPMENT_STATUS, SHIPMENT_STATUS_LABELS,
} from '../../../utils/expDocConstants';
import { SHIPMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { useStore } from '../../../context/StoreContext';
import { getBuyers } from '../../../services/master/buyerService';
import { getShipment, createShipment, updateShipment } from '../../../services/expdoc/expDocService';
import { notifyValueOf } from './shipmentParties';
import useShipmentParties from './useShipmentParties';
import ShipmentConsigneeSection from './ShipmentConsigneeSection';
import ShipmentTransportSections from './ShipmentTransportSections';

const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };
const DATE_FIELDS = ['etd', 'eta', 'blAwbDate'];
const PORT_OPTIONS = EXPORT_PORTS.map((p) => ({ value: p.name, label: `${p.name} (${p.code})` }));
const INCOTERM_OPTIONS = INCOTERMS.map((i) => ({ value: i, label: i }));
const statusLabel = (status) => SHIPMENT_STATUS_LABELS[status] || status;

/** The API's 422 for a location id Buyer Master has since renewed: the buyers are read again. */
const isStaleLocation = (e) => e?.response?.status === 422 && /shipping location/i.test(e?.message || '');

/** A saved shipment as the form holds it. */
const valuesOf = (shipment) => {
  const values = {
    ...shipment,
    notifyValue: notifyValueOf(shipment.notifyParty),
    orderIds: (shipment.orders || []).map((o) => o.orderId),
  };
  DATE_FIELDS.forEach((f) => { values[f] = shipment[f] ? dayjs(shipment[f]) : null; });
  return values;
};

/**
 * Shipment create / edit, on the API (/export-docs/shipments).
 *
 * The consignee is the buyer itself, read from the real buyer master; the notify
 * party is that buyer's bank or one of its shipping locations (useShipmentParties).
 * The form sends ids and the server builds what prints. A CLOSED shipment opens
 * read-only: every document on it is released.
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

  const { clearDirty } = useUnsavedChanges(isDirty);
  // A record in hand is saved with an update, even before the URL has moved to /edit/:id
  const canUpdate = hasPermission(EXPDOC_MODULE.SHIPMENTS, isEdit || record ? 'update' : 'add');
  const isClosed = record?.status === SHIPMENT_STATUS.CLOSED;
  const canEdit = canUpdate && !isClosed;
  // Documents raised against the shipment name its consignee; this browser's are all there are, for now.
  const consigneeLocked = Boolean(record) && (record.packingListCount || 0) + (record.invoiceCount || 0) > 0;

  // Buyers come from the real master, cached in StoreContext like everywhere else.
  const { buyers: storeBuyers, setData, isCacheValid, setLoading: setStoreLoading } = useStore();
  const [buyers, setBuyers] = useState(storeBuyers || []);

  const reloadBuyers = useCallback(async () => {
    setStoreLoading('buyers', true);
    try {
      const data = await getBuyers();
      const list = Array.isArray(data) ? data : data?.content || [];
      setBuyers(list);
      setData('buyers', list);
    } catch {
      // The interceptor has toasted; the list we had stays
    } finally {
      setStoreLoading('buyers', false);
    }
  }, [setData, setStoreLoading]);

  useEffect(() => {
    if (!isCacheValid('buyers') || !storeBuyers.length) reloadBuyers();
    // Once, on open: the store's cache is the source after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEdit) return undefined;
    // Just created here: the router keeps this instance for /edit/:id and the saved record is
    // already in hand. Reloading it unmounted the form under a Save clicked meanwhile.
    if (record && String(record.id) === String(id)) return undefined;
    let cancelled = false;
    setLoading(true);
    // Silent: a shipment that cannot be opened says why on the page itself
    getShipment(id, { silent: true })
      .then((data) => {
        if (cancelled) return;
        setRecord(data);
        form.setFieldsValue(valuesOf(data));
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Failed to load shipment'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // Active buyers, and the saved consignee however Buyer Master has since marked it.
  const buyerOptions = useMemo(
    () => (buyers || [])
      .filter((b) => b.active !== false || b.id === record?.buyerId)
      .map((b) => ({ value: b.id, label: b.name })),
    [buyers, record],
  );

  const parties = useShipmentParties(form, buyers, record);
  const { onPartiesChange, partiesPayload } = parties;
  // A sea shipment travels in containers, so its container numbers are mandatory
  const mode = Form.useWatch('mode', form);

  const handleValuesChange = useCallback((changed) => {
    setIsDirty(true);
    onPartiesChange(changed);
  }, [onPartiesChange]);

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
      const payload = { ...values, ...partiesPayload(values) };
      DATE_FIELDS.forEach((f) => {
        payload[f] = values[f] ? dayjs(values[f]).format('YYYY-MM-DD') : null;
      });

      // The record in hand decides, not the route: after a create the URL moves to /edit/:id in a
      // router transition, and a Save clicked before it lands must update, not create a second one.
      const existingId = record?.id ?? (isEdit ? id : null);
      const saved = existingId != null
        ? await updateShipment(existingId, { ...payload, version: record?.version })
        : await createShipment(payload);

      // Adopt the saved record: its version, and what the server stored (blocks, container numbers)
      setRecord(saved);
      form.setFieldsValue(valuesOf(saved));
      setIsDirty(false);
      clearDirty();
      message.success(`${saved.shipmentNo} saved`);
      if (existingId == null) navigate(`/export-docs/shipments/edit/${saved.id}`, { replace: true });
    } catch (e) {
      // An API error was shown by the interceptor; a version clash opens the ConflictDialog.
      if (!e?.isAxiosError) message.error(e?.message || 'Failed to save shipment');
      if (isStaleLocation(e)) reloadBuyers();
    } finally {
      setSaving(false);
    }
  }, [form, message, isEdit, id, record, partiesPayload, navigate, clearDirty, reloadBuyers]);

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
        subtitle={record ? `${record.buyerName} · ETD ${record.etd || '—'}` : 'Consignee, orders, ports, vessel and container for one consignment'}
        onBack={() => navigate('/export-docs/shipments/list')}
        status={record ? <StatusTag status={record.status} config={SHIPMENT_STATUS_CONFIG} getLabel={statusLabel} /> : null}
        style={STICKY_HEADER}
      >
        <ActionButton action="close" text={canEdit ? 'Cancel' : 'Close'} onClick={() => navigate('/export-docs/shipments/list')} />
        {canEdit && (
          <ActionButton action="save" text="Save" loading={saving} onClick={handleSave} />
        )}
      </PageHeader>

      {isClosed && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Closed: every packing list and invoice on this shipment is released"
          description="It opens for editing again when one of them is cancelled or revised."
        />
      )}

      <Spin spinning={saving}>
        <Form
          form={form}
          layout="vertical"
          disabled={!canEdit}
          onValuesChange={handleValuesChange}
          initialValues={{ mode: 'SEA', incoterm: 'FOB', preCarriageBy: 'ROAD', containerNos: [], orderIds: [] }}
        >
          <ShipmentConsigneeSection
            parties={parties}
            buyerOptions={buyerOptions}
            incotermOptions={INCOTERM_OPTIONS}
            consigneeLocked={consigneeLocked}
          />
          <ShipmentTransportSections portOptions={PORT_OPTIONS} containersRequired={mode === 'SEA'} />
        </Form>
      </Spin>
    </div>
  );
};

export default ShipmentForm;
