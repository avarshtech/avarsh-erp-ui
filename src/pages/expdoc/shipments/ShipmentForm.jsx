import { useState, useEffect, useMemo, useCallback } from 'react';
import { App, Form, Result, Skeleton, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { hasPermission } from '../../../utils/permissions';
import { EXPDOC_MODULE } from '../../../utils/expDocConstants';
import { useStore } from '../../../context/StoreContext';
import { getBuyers } from '../../../services/master/buyerService';
import {
  getShipment, createShipment, updateShipment,
  listPorts, listIncoterms, getBuyerCommercial,
} from '../../../services/expdoc/expDocService';
import { notifyValueOf } from './shipmentParties';
import useShipmentParties from './useShipmentParties';
import ShipmentConsigneeSection from './ShipmentConsigneeSection';
import ShipmentTransportSections from './ShipmentTransportSections';

const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };
const DATE_FIELDS = ['etd', 'eta', 'blAwbDate'];

const SHIPMENT_STATUS_CONFIG = {
  OPEN: { color: 'processing' },
  CLOSED: { color: 'default' },
};

/**
 * Shipment create / edit.
 *
 * The consignee is the buyer itself, read from the real buyer master; the notify
 * party is that buyer's bank or one of its shipping locations (useShipmentParties).
 * Ports and incoterms still come from the mock master — no port master or incoterm
 * list exists in the ERP yet.
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
        const values = {
          ...data,
          notifyValue: notifyValueOf(data.notifyParty),
          orderNos: (data.orders || []).map((o) => o.orderNo),
        };
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

  const parties = useShipmentParties(form, buyers, record);
  const { onPartiesChange, partiesPayload } = parties;

  const handleValuesChange = useCallback((changed) => {
    setIsDirty(true);
    onPartiesChange(changed);
  }, [onPartiesChange]);

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
      const { notifyValue, consigneeLocationId, orderNos, ...rest } = values;
      const payload = { ...rest, ...partiesPayload(values) };
      DATE_FIELDS.forEach((f) => {
        payload[f] = values[f] ? dayjs(values[f]).format('YYYY-MM-DD') : null;
      });
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
  }, [form, message, isEdit, id, record, partiesPayload, navigate, clearDirty]);

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
          onValuesChange={handleValuesChange}
          initialValues={{ mode: 'SEA', incoterm: 'FOB', preCarriageBy: 'ROAD', containerNos: [], orderNos: [] }}
        >
          <ShipmentConsigneeSection parties={parties} buyerOptions={buyerOptions} incotermOptions={incotermOptions} />
          <ShipmentTransportSections portOptions={portOptions} />
        </Form>
      </Spin>
    </div>
  );
};

export default ShipmentForm;
