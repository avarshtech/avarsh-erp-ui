import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Alert, App, Col, Collapse, Form, Result, Row, Skeleton, Space, Spin, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import StatCard from '../../../components/StatCard';
import { ActionButton } from '../../../components/buttons';
import { FormSection, FormInput, FormSelect, FormDatePicker } from '../../../components/form';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import useBusyAction from '../../../hooks/useBusyAction';
import { hasPermission } from '../../../utils/permissions';
import { validate } from '../../../utils/expDocValidation';
import { PACKING_ENTRY_STATUS_CONFIG } from '../../../utils/statusConfig';
import {
  PACKING_ENTRY_STATUS, PACKING_ENTRY_STATUS_LABELS,
  PACKABLE_ORDER_STATUSES, SECTION_KEY, SECTION_TITLES, PHASE,
} from '../../../utils/expDocConstants';
import { sectionTotals } from '../../../utils/expDocCalc';
import { MODULE_ID } from './packingModule';
import { searchOrders, getOrderById } from '../../../services/orders/orderService';
import { getAllSizePresets } from '../../../services/master/sizePresetService';
import {
  getPackingEntry, createPackingEntry, updatePackingEntry, setPackingEntryStatus,
} from '../../../services/production/packingService';
import { afterPackingEntrySaved, packingListsOfEntries } from '../../../services/expdoc/expDocService';
import { resolveOrderSizes, orderPosOf } from '../../../utils/orderSizes';
import CartonGroupEditor from './CartonGroupEditor';
import PackAsPlan from './PackAsPlan';

const { Text } = Typography;
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };
const SECTION_KEYS = [SECTION_KEY.MAIN, SECTION_KEY.EXTRA];

const num = (v, dp = 0) =>
  (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** Packing is recorded as it happens, so a future day is never a valid packing date. */
const isFutureDay = (d) => Boolean(d) && d.isAfter(dayjs(), 'day');

/**
 * Carton Packing Entry — one order's cartons for one packing day.
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
  // The entry in hand decides whether it exists, not the route: after a create the URL moves to
  // /edit/:id in a router transition, and until that lands `id` is still empty. A Save clicked
  // meanwhile must update the new entry, never create a second one.
  const entryId = record?.id ?? (isEdit ? id : null);
  const isSaved = entryId != null;
  const [groups, setGroups] = useState([]);
  const [orderId, setOrderId] = useState(null);
  const [sizes, setSizes] = useState([]);
  const [orderBreakdown, setOrderBreakdown] = useState([]);
  // The order's buyer POs: what each carton range's PO cell picks from (owner, 2026-10-09)
  const [orderPos, setOrderPos] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  // 'save' | 'complete' | 'reopen' | null — each header button spins only for its own action
  const { busy, setBusy, busyProps } = useBusyAction();
  const [loadError, setLoadError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  const [orderOptions, setOrderOptions] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const presetsRef = useRef([]);
  // Read once at mount: a new entry defaults to the day it is opened.
  const initialValues = useMemo(() => ({ packingDate: dayjs() }), []);

  const { searchText: orderSearch, setSearchText: setOrderSearch, debouncedSearch: debouncedOrder } =
    useDebouncedSearch();

  const { clearDirty } = useUnsavedChanges(isDirty);
  const canWrite = hasPermission(MODULE_ID, isSaved ? 'update' : 'add');

  // ── Load the record ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return undefined;
    // Just created here: the router keeps this instance for /edit/:id and the saved entry is
    // already in hand. Reloading it would unmount the form under a click made meanwhile.
    if (record && String(record.id) === String(id)) return undefined;
    let cancelled = false;
    setLoading(true);
    getPackingEntry(id)
      .then((data) => {
        if (cancelled) return;
        setRecord(data);
        setGroups(data.groups || []);
        setOrderId(data.orderId);
        setSizes(data.sizes || []);
        setOrderBreakdown(data.orderBreakdown || []);
        // The order's POs for the PO cell; an order that cannot be read leaves the cell as text
        getOrderById(data.orderId, { silent: true })
          .then((order) => { if (!cancelled) setOrderPos(orderPosOf(order)); })
          .catch(() => { if (!cancelled) setOrderPos([]); });
        form.setFieldsValue({
          orderNo: data.orderNo,
          packingDate: data.packingDate ? dayjs(data.packingDate) : null,
          buyerName: data.buyerName,
          styleNo: data.styleNo,
          garmentName: data.garmentName,
          compositionText: data.compositionText,
        });
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Failed to load packing entry'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // ── Pickers ──────────────────────────────────────────────────────────────────
  useEffect(() => {
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

  /** Sizes in preset order — the persisted qty maps are unordered (utils/orderSizes). */
  const resolveSizes = useCallback((order) => resolveOrderSizes(order, presetsRef.current), []);

  const handleOrderSelect = useCallback(
    (orderNo) => {
      const order = orderOptions.find((o) => o.orderNo === orderNo);
      if (!order) return;
      setOrderId(order.id);
      setSizes(resolveSizes(order));
      setOrderPos(orderPosOf(order));
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
      });
      setIsDirty(true);
    },
    [orderOptions, form, resolveSizes],
  );

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

  const readOnly = !canWrite || (isSaved && record?.status !== PACKING_ENTRY_STATUS.OPEN);
  // An order with several POs: every range must name its PO, or no packing list can place it
  const missingPo = orderPos.length > 1 && groups.some((g) => !g.buyerPoNo
    // The same PO to two destinations: the range must say which
    || (!g.destination && orderPos.filter((p) => p.buyerPoNo === g.buyerPoNo).length > 1));
  // The packing lists in this browser holding this entry (Export Docs still keeps them here)
  const onLists = useMemo(() => (record?.id ? packingListsOfEntries([record.id])[record.id] || [] : []), [record]);

  const handleGroupsChange = useCallback((next) => {
    setGroups(next);
    setIsDirty(true);
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const persist = useCallback(async () => {
    const values = await form.validateFields();
    // Order number, buyer, style and garment are snapshotted server-side from the order.
    const payload = {
      orderId,
      packingDate: values.packingDate.format('YYYY-MM-DD'),
      compositionText: values.compositionText,
      sizes,
      orderBreakdown,
      groups,
    };
    const saved = isSaved
      ? await updatePackingEntry(entryId, { ...payload, version: record?.version })
      : await createPackingEntry(payload);
    setRecord(saved);
    setGroups(saved.groups || []);
    setIsDirty(false);
    clearDirty();
    afterPackingEntrySaved(saved);
    return saved;
  }, [form, orderId, sizes, orderBreakdown, groups, isSaved, entryId, record, clearDirty]);

  const handleSave = useCallback(async () => {
    setBusy('save');
    try {
      const saved = await persist();
      message.success(`${saved.packingNo} saved`);
      if (!isSaved) navigate(`/production/packing/edit/${saved.id}`, { replace: true });
    } catch (e) {
      if (e?.errorFields) message.warning('Complete the mandatory fields first');
      else if (!e.isOptimisticLockConflict) message.error(e.message || 'Failed to save');
    } finally {
      setBusy(null);
    }
  }, [persist, message, isSaved, navigate, setBusy]);

  const handleComplete = useCallback(() => {
    modal.confirm({
      title: 'Mark this packing entry complete?',
      content: 'Packing lists can then bind it without a warning. You can reopen it later, which will flag any document built from it as stale.',
      okText: 'Mark complete',
      onOk: async () => {
        setBusy('complete');
        try {
          // Unsaved edits are saved first; the complete command goes with the version the entry holds then
          const current = isDirty ? await persist() : record;
          const saved = await setPackingEntryStatus(current.id, PACKING_ENTRY_STATUS.COMPLETED, current.version);
          afterPackingEntrySaved(saved);
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
  }, [modal, isDirty, persist, record, message, setBusy]);

  const handleReopen = useCallback(() => {
    modal.confirm({
      title: 'Reopen for editing?',
      content: onLists.length
        ? `${[...new Set(onLists.map((l) => l.plNo))].join(', ')} ${onLists.length > 1 ? 'hold' : 'holds'} these cartons and will be flagged as stale.`
        : 'Any packing list already built from this entry will be flagged as stale.',
      okText: 'Reopen',
      okButtonProps: { danger: true },
      onOk: async () => {
        setBusy('reopen');
        try {
          const saved = await setPackingEntryStatus(record.id, PACKING_ENTRY_STATUS.OPEN, record.version);
          afterPackingEntrySaved(saved);
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
  }, [modal, record, message, setBusy, onLists]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <Result
        status="warning"
        title="Packing entry could not be opened"
        subTitle={loadError}
        extra={<ActionButton action="back" text="Back to packing" onClick={() => navigate('/production/packing/list')} />}
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
        poOptions={orderPos}
        onChange={handleGroupsChange}
      />
    ),
  }));

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={record?.packingNo || 'New Packing Entry'}
        subtitle={record ? `${record.orderNo} · ${record.styleNo}` : 'Record carton ranges, quantities, weights and dimensions'}
        onBack={() => navigate('/production/packing/list')}
        status={record ? (
          <StatusTag
            status={record.status}
            config={PACKING_ENTRY_STATUS_CONFIG}
            getLabel={(s) => PACKING_ENTRY_STATUS_LABELS[s] || s}
          />
        ) : null}
        style={STICKY_HEADER}
      >
        <ActionButton action="close" text="Cancel" onClick={() => navigate('/production/packing/list')} />
        {!readOnly && <ActionButton action="save" text="Save" {...busyProps('save')} onClick={handleSave} />}
        {isSaved && record?.status === PACKING_ENTRY_STATUS.OPEN && canWrite && (
          <ActionButton
            action="approve"
            text="Mark complete"
            {...busyProps('complete', liveErrors.length > 0 || !groups.length || missingPo)}
            tooltip={
              liveErrors.length
                ? `Blocked — ${liveErrors.length} structural error(s) must be fixed first`
                : (!groups.length ? 'Add at least one carton group first'
                  : (missingPo ? 'Pick the buyer PO for every carton range first' : undefined))
            }
            onClick={handleComplete}
          />
        )}
        {isSaved && record?.status === PACKING_ENTRY_STATUS.COMPLETED && canWrite && (
          <ActionButton action="edit" text="Reopen" {...busyProps('reopen')} onClick={handleReopen} />
        )}
      </PageHeader>

      {onLists.length > 0 && (
        <Space size={6} wrap style={{ marginBottom: 12 }}>
          <Text type="secondary">On packing list</Text>
          {onLists.map((l) => <Tag key={`${l.plId}|${l.buyerPoNo ?? ''}`} color="blue">{`${l.plNo}${l.buyerPoNo ? ` · PO ${l.buyerPoNo}` : ''}`}</Tag>)}
        </Space>
      )}
      {missingPo && !readOnly && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Pick the buyer PO for every carton range"
          description="This order has several buyer POs and they can go on different shipments, so each range must say which PO it is packed for."
        />
      )}
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
        <Form
          form={form}
          layout="vertical"
          disabled={readOnly}
          initialValues={initialValues}
          onValuesChange={() => setIsDirty(true)}
        >
          <FormSection title="Order & Style" columns={4}>
            <Form.Item name="orderNo" label="Order" rules={[{ required: true, message: 'Select an order' }]}>
              <FormSelect
                placeholder="Search confirmed or in-production orders"
                disabled={isSaved || readOnly}
                loading={orderLoading}
                onSearch={setOrderSearch}
                searchValue={orderSearch}
                filterOption={false}
                onChange={handleOrderSelect}
                options={
                  isSaved && record
                    ? [{ value: record.orderNo, label: record.orderNo }]
                    : orderOptions.map((o) => ({
                      value: o.orderNo,
                      label: `${o.orderNo} — ${o.buyerName} — ${o.styleNo}`,
                    }))
                }
              />
            </Form.Item>
            <Form.Item
              name="packingDate"
              label="Packing Date"
              tooltip="The day these cartons were packed — the daily packing summary counts them on this date."
              rules={[{ required: true, message: 'Select the packing date' }]}
            >
              <FormDatePicker disabledDate={isFutureDay} allowClear={false} />
            </Form.Item>
            <Form.Item name="buyerName" label="Buyer">
              <FormInput disabled style={{ backgroundColor: 'var(--bg-tertiary)' }} />
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
              tooltip="Pre-filled from the order's fabric description. Printed on the invoice description."
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

        {!readOnly && orderId != null && (
          <PackAsPlan
            orderId={orderId}
            groups={groups}
            refreshKey={record?.version}
            onFill={(rows) => handleGroupsChange([...groups, ...rows])}
          />
        )}
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
