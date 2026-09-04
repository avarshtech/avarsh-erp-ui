import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Alert, App, Col, Collapse, Form, Result, Row, Select, Skeleton, Space, Spin, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import StatCard from '../../../components/StatCard';
import { ActionButton } from '../../../components/buttons';
import { FormSection, FormInput, FormSelect } from '../../../components/form';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import useBusyAction from '../../../hooks/useBusyAction';
import { hasPermission } from '../../../utils/permissions';
import { validate } from '../../../utils/expDocValidation';
import { PACKING_ENTRY_STATUS_CONFIG } from '../../../utils/statusConfig';
import {
  EXPDOC_MODULE, PACKING_ENTRY_STATUS, PACKING_ENTRY_STATUS_LABELS,
  PACKABLE_ORDER_STATUSES, SECTION_KEY, SECTION_TITLES, PHASE, DOC_TYPE,
} from '../../../utils/expDocConstants';
import { sectionTotals } from '../../../utils/expDocCalc';
import { searchOrders } from '../../../services/orders/orderService';
import { getAllSizePresets } from '../../../services/master/sizePresetService';
import {
  getPackingEntry, createPackingEntry, updatePackingEntry, setPackingEntryStatus,
  listShipmentOptions, getBuyerCommercial, resolveTemplateFor,
} from '../../../services/expdoc/expDocService';
import CartonGroupEditor from './CartonGroupEditor';

const { Text } = Typography;
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };
const SECTION_KEYS = [SECTION_KEY.MAIN, SECTION_KEY.EXTRA];

const num = (v, dp = 0) =>
  (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/**
 * Carton Packing Entry.
 *
 * Sizes are FROZEN onto the entry at creation, copied from the order's size preset
 * in preset order. A later edit to the preset must not reorder the columns of an
 * entry a document has already been built from.
 */
const CartonPackingForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();

  const isEdit = Boolean(id);
  const [record, setRecord] = useState(null);
  const [groups, setGroups] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [orderBreakdown, setOrderBreakdown] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  // 'save' | 'complete' | 'reopen' | null — each header button spins only for its own action
  const { busy, setBusy, busyProps } = useBusyAction();
  const [loadError, setLoadError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  const [orderOptions, setOrderOptions] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [shipmentOptions, setShipmentOptions] = useState([]);
  const presetsRef = useRef([]);

  const { searchText: orderSearch, setSearchText: setOrderSearch, debouncedSearch: debouncedOrder } =
    useDebouncedSearch();

  const { clearDirty } = useUnsavedChanges(isDirty);
  const canWrite = hasPermission(EXPDOC_MODULE.PACKING, isEdit ? 'update' : 'add');

  // ── Load the record ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    setLoading(true);
    getPackingEntry(id)
      .then((data) => {
        if (cancelled) return;
        setRecord(data);
        setGroups(data.groups || []);
        setSizes(data.sizes || []);
        setOrderBreakdown(data.orderBreakdown || []);
        form.setFieldsValue({
          orderNo: data.orderNo,
          buyerName: data.buyerName,
          subClientCode: data.subClientCode,
          styleNo: data.styleNo,
          garmentName: data.garmentName,
          compositionText: data.compositionText,
          shipmentId: data.shipmentId,
        });
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Failed to load packing entry'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // ── Pickers ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    listShipmentOptions().then(setShipmentOptions).catch(() => setShipmentOptions([]));
    getAllSizePresets()
      .then((res) => { presetsRef.current = res?.data ?? res ?? []; })
      .catch(() => { presetsRef.current = []; });
  }, []);

  useEffect(() => {
    if (isEdit) return undefined;
    let cancelled = false;
    setOrderLoading(true);
    // searchOrders takes one status, but the PRD allows two, so fetch both and merge.
    Promise.all(
      PACKABLE_ORDER_STATUSES.map((status) =>
        searchOrders({ status, search: debouncedOrder || undefined, page: 0, size: 25 })
          .then((r) => r.content || [])
          .catch(() => []),
      ),
    )
      .then((lists) => {
        if (cancelled) return;
        const merged = [];
        const seen = new Set();
        lists.flat().forEach((o) => {
          if (seen.has(o.id)) return;
          seen.add(o.id);
          merged.push(o);
        });
        setOrderOptions(merged);
      })
      .finally(() => { if (!cancelled) setOrderLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedOrder, isEdit]);

  /** Sizes in preset order — the persisted qty maps are unordered. */
  const resolveSizes = useCallback((order) => {
    const fromLines = new Set();
    (order.orderLines || []).forEach((l) => {
      Object.keys(l.sizePrices || {}).forEach((s) => fromLines.add(s));
    });
    const presetId = (order.orderLines || [])[0]?.sizePresetId;
    const preset = presetsRef.current.find((p) => p.id === presetId);
    if (preset?.sizes?.length) {
      const ordered = preset.sizes.filter((s) => fromLines.has(s));
      // Anything on the order but absent from the preset still has to appear.
      const extras = [...fromLines].filter((s) => !preset.sizes.includes(s));
      return [...ordered, ...extras];
    }
    return [...fromLines];
  }, []);

  const handleOrderSelect = useCallback(
    (orderNo) => {
      const order = orderOptions.find((o) => o.orderNo === orderNo);
      if (!order) return;
      const commercial = getBuyerCommercial({ buyerName: order.buyerName });
      setSizes(resolveSizes(order));
      // Snapshot the ordered quantities now, while the real order is in hand. The
      // packing list reads them from here rather than re-fetching an order that may
      // since have changed (PRD §7.4: ordered qty never comes from packed data).
      setOrderBreakdown((order.orderLines || []).flatMap((line) =>
        (line.colorRows || []).flatMap((cr) =>
          Object.entries(cr.quantities || {})
            .filter(([, qty]) => Number(qty))
            .map(([size, qty]) => ({
              styleNo: order.styleNo,
              colorName: cr.colorName,
              size,
              orderQty: Number(qty),
            })))));
      form.setFieldsValue({
        buyerName: order.buyerName,
        styleNo: order.styleNo,
        garmentName: order.garmentName,
        compositionText: order.fabricDescription,
        subClientCode: undefined,
      });
      setIsDirty(true);
      if (!commercial.buyerCode) {
        message.info('This buyer has no commercial profile yet — defaults will be used on the documents.');
      }
    },
    [orderOptions, form, resolveSizes, message],
  );

  const watchedBuyerName = Form.useWatch('buyerName', form);
  const watchedSubClient = Form.useWatch('subClientCode', form);

  /*
   * The buyer's packing-list template, resolved before any document exists, so the
   * pack types on offer are the ones this buyer's layout can actually print (§10.1).
   */
  const [buyerTemplate, setBuyerTemplate] = useState(null);
  useEffect(() => {
    if (!watchedBuyerName) { setBuyerTemplate(null); return; }
    const buyerCode = getBuyerCommercial({ buyerName: watchedBuyerName }).buyerCode;
    resolveTemplateFor({ buyerCode, subClientCode: watchedSubClient, docType: DOC_TYPE.PACKING_LIST })
      .then((r) => setBuyerTemplate(r.template))
      .catch(() => setBuyerTemplate(null));
  }, [watchedBuyerName, watchedSubClient]);
  const subClientOptions = useMemo(() => {
    if (!watchedBuyerName) return [];
    return (getBuyerCommercial({ buyerName: watchedBuyerName }).subClients || []).map((s) => ({
      value: s.code,
      label: `${s.code} — ${s.name}`,
    }));
  }, [watchedBuyerName]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const totals = useMemo(() => sectionTotals(groups), [groups]);

  const issuesByRow = useMemo(() => {
    const map = {};
    (record?.issues || []).forEach((i) => {
      if (!i.rowId) return;
      map[i.rowId] = map[i.rowId] || [];
      map[i.rowId].push(i);
    });
    return map;
  }, [record]);

  const errors = useMemo(() => (record?.issues || []).filter((i) => i.severity === 'ERROR'), [record]);
  const warnings = useMemo(() => (record?.issues || []).filter((i) => i.severity === 'WARN'), [record]);

  /*
   * What blocks "Mark complete" is what is ON SCREEN, not what was last saved.
   *
   * `record.issues` is the state of the entry at its last save, so with unsaved edits
   * the button disagreed with the grid in both directions: still disabled after an
   * error was fixed, and still enabled after one was introduced.
   */
  const liveErrors = useMemo(
    () => validate({ pl: { sections: [{ key: SECTION_KEY.MAIN, rows: groups }] } }, { phase: PHASE.SAVE }).errors,
    [groups],
  );

  const readOnly = !canWrite || (isEdit && record?.status !== PACKING_ENTRY_STATUS.OPEN);

  const handleGroupsChange = useCallback((next) => {
    setGroups(next);
    setIsDirty(true);
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const persist = useCallback(async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      sizes,
      orderBreakdown,
      groups,
      buyerCode: getBuyerCommercial({ buyerName: values.buyerName }).buyerCode ?? null,
    };
    const saved = isEdit
      ? await updatePackingEntry(id, { ...payload, version: record?.version })
      : await createPackingEntry(payload);
    setRecord(saved);
    setGroups(saved.groups || []);
    setIsDirty(false);
    clearDirty();
    return saved;
  }, [form, sizes, orderBreakdown, groups, isEdit, id, record, clearDirty]);

  const handleSave = useCallback(async () => {
    setBusy('save');
    try {
      const saved = await persist();
      message.success(`${saved.packingNo} saved`);
      if (!isEdit) navigate(`/export-docs/packing/edit/${saved.id}`, { replace: true });
    } catch (e) {
      if (e?.errorFields) message.warning('Complete the mandatory fields first');
      else if (!e.isOptimisticLockConflict) message.error(e.message || 'Failed to save');
    } finally {
      setBusy(null);
    }
  }, [persist, message, isEdit, navigate, setBusy]);

  const handleComplete = useCallback(() => {
    modal.confirm({
      title: 'Mark this packing entry complete?',
      content: 'Packing lists can then bind it without a warning. You can reopen it later, which will flag any document built from it as stale.',
      okText: 'Mark complete',
      onOk: async () => {
        setBusy('complete');
        try {
          if (isDirty) await persist();
          const saved = await setPackingEntryStatus(id, PACKING_ENTRY_STATUS.COMPLETED);
          setRecord(saved);
          setGroups(saved.groups || []);
          message.success(`${saved.packingNo} marked complete`);
        } catch (e) {
          message.error(e.message || 'Could not complete this entry');
        } finally {
          setBusy(null);
        }
      },
    });
  }, [modal, id, isDirty, persist, message, setBusy]);

  const handleReopen = useCallback(() => {
    modal.confirm({
      title: 'Reopen for editing?',
      content: 'Any packing list already built from this entry will be flagged as stale.',
      okText: 'Reopen',
      okButtonProps: { danger: true },
      onOk: async () => {
        setBusy('reopen');
        try {
          const saved = await setPackingEntryStatus(id, PACKING_ENTRY_STATUS.OPEN);
          setRecord(saved);
          setGroups(saved.groups || []);
          message.success(`${saved.packingNo} reopened`);
        } catch (e) {
          message.error(e.message || 'Could not reopen this entry');
        } finally {
          setBusy(null);
        }
      },
    });
  }, [modal, id, message, setBusy]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <Result
        status="warning"
        title="Packing entry could not be opened"
        subTitle={loadError}
        extra={<ActionButton action="back" text="Back to packing" onClick={() => navigate('/export-docs/packing/list')} />}
      />
    );
  }

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="Carton Packing" style={STICKY_HEADER} />
        <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 16 }} />
        <Skeleton active paragraph={{ rows: 8 }} style={{ marginTop: 16 }} />
      </div>
    );
  }

  const collapseItems = SECTION_KEYS.map((key) => ({
    key,
    label: (
      <Space size={8}>
        <Text strong>{SECTION_TITLES[key]}</Text>
        <Tag>{groups.filter((g) => (g.sectionKey || SECTION_KEY.MAIN) === key).length} group(s)</Tag>
        {key === SECTION_KEY.EXTRA && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Leftover cartons — reported separately, included in the grand total
          </Text>
        )}
      </Space>
    ),
    children: (
      <CartonGroupEditor
        sizes={sizes}
        groups={groups}
        sectionKey={key}
        readOnly={readOnly}
        issuesByRow={issuesByRow}
        styleNo={form.getFieldValue('styleNo')}
        buyerPoNo={null}
        allowedPackingTypes={buyerTemplate?.packingTypesAllowed}
        onChange={handleGroupsChange}
      />
    ),
  }));

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={record?.packingNo || 'New Packing Entry'}
        subtitle={record ? `${record.orderNo} · ${record.styleNo}` : 'Record carton ranges, quantities, weights and dimensions'}
        onBack={() => navigate('/export-docs/packing/list')}
        status={record ? (
          <StatusTag
            status={record.status}
            config={PACKING_ENTRY_STATUS_CONFIG}
            getLabel={(s) => PACKING_ENTRY_STATUS_LABELS[s] || s}
          />
        ) : null}
        style={STICKY_HEADER}
      >
        <ActionButton action="close" text="Cancel" onClick={() => navigate('/export-docs/packing/list')} />
        {!readOnly && <ActionButton action="save" text="Save" {...busyProps('save')} onClick={handleSave} />}
        {isEdit && record?.status === PACKING_ENTRY_STATUS.OPEN && canWrite && (
          <ActionButton
            action="approve"
            text="Mark complete"
            {...busyProps('complete', liveErrors.length > 0 || !groups.length)}
            tooltip={
              liveErrors.length
                ? `Blocked — ${liveErrors.length} structural error(s) must be fixed first`
                : (!groups.length ? 'Add at least one carton group first' : undefined)
            }
            onClick={handleComplete}
          />
        )}
        {isEdit && record?.status === PACKING_ENTRY_STATUS.COMPLETED && canWrite && (
          <ActionButton action="edit" text="Reopen" {...busyProps('reopen')} onClick={handleReopen} />
        )}
      </PageHeader>

      {errors.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${errors.length} structural issue(s) block completion`}
          description={<ul style={{ margin: 0, paddingInlineStart: 18 }}>{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>}
        />
      )}
      {warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${warnings.length} warning(s)`}
          description={<ul style={{ margin: 0, paddingInlineStart: 18 }}>{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>}
        />
      )}

      <Spin spinning={busy !== null}>
        <Form form={form} layout="vertical" disabled={readOnly} onValuesChange={() => setIsDirty(true)}>
          <FormSection title="Order & Style" columns={4}>
            <Form.Item name="orderNo" label="Order" rules={[{ required: true, message: 'Select an order' }]}>
              <FormSelect
                placeholder="Search confirmed or in-production orders"
                disabled={isEdit || readOnly}
                loading={orderLoading}
                onSearch={setOrderSearch}
                searchValue={orderSearch}
                filterOption={false}
                onChange={handleOrderSelect}
                options={
                  isEdit && record
                    ? [{ value: record.orderNo, label: record.orderNo }]
                    : orderOptions.map((o) => ({
                      value: o.orderNo,
                      label: `${o.orderNo} — ${o.buyerName} — ${o.styleNo}`,
                    }))
                }
              />
            </Form.Item>
            <Form.Item name="shipmentId" label="Shipment" rules={[{ required: true, message: 'Select a shipment' }]}>
              <FormSelect placeholder="Select shipment" options={shipmentOptions} />
            </Form.Item>
            <Form.Item name="buyerName" label="Buyer">
              <FormInput disabled style={{ backgroundColor: 'var(--bg-tertiary)' }} />
            </Form.Item>
            <Form.Item
              name="subClientCode"
              label="Sub-client / End customer"
              tooltip="Mock-only: the ERP has no sub-client concept yet. It drives buyer template resolution."
            >
              <FormSelect
                options={subClientOptions}
                placeholder={subClientOptions.length ? 'Optional' : 'None configured'}
                disabled={!subClientOptions.length || readOnly}
              />
            </Form.Item>
            <Form.Item name="styleNo" label="Style">
              <FormInput disabled style={{ backgroundColor: 'var(--bg-tertiary)' }} />
            </Form.Item>
            <Form.Item name="garmentName" label="Garment">
              <FormInput disabled style={{ backgroundColor: 'var(--bg-tertiary)' }} />
            </Form.Item>
            <Form.Item
              name="compositionText"
              label="Composition"
              tooltip="Mock-only: stl_styles has no composition column yet. Printed on the invoice description."
            >
              <FormInput placeholder="95% COTTON 5% ELASTANE" />
            </Form.Item>
            <Form.Item label="Sizes">
              <Space size={4} wrap>
                {sizes.length
                  ? sizes.map((s) => <Tag key={s}>{s}</Tag>)
                  : <Text type="secondary">Select an order to resolve the size set</Text>}
              </Space>
            </Form.Item>
          </FormSection>
        </Form>

        <Row gutter={[16, 16]} align="stretch" style={{ margin: '16px 0' }}>
          <Col xs={12} md={6}><StatCard title="Cartons" value={num(totals.cartons)} color="var(--primary-color)" /></Col>
          <Col xs={12} md={6}><StatCard title="Pieces" value={num(totals.pieces)} color="var(--info-color)" /></Col>
          <Col xs={12} md={6}><StatCard title="Gross weight (kg)" value={num(totals.grossWeightKg, 3)} color="var(--accent-color)" /></Col>
          <Col xs={12} md={6}><StatCard title="CBM" value={num(totals.cbm, 3)} color="var(--secondary-color)" /></Col>
        </Row>

        {!sizes.length ? (
          <Alert
            type="info"
            showIcon
            title="Select an order first"
            description="Carton quantities are entered per size, so the size set has to be resolved from the order before groups can be added."
          />
        ) : (
          <Collapse defaultActiveKey={SECTION_KEYS} items={collapseItems} />
        )}
      </Spin>
    </div>
  );
};

export default CartonPackingForm;
