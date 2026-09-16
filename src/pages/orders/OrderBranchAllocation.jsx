import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Drawer, Table, Select, InputNumber, Input, Button, Space, Tag, Typography, App } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useBranch } from '../../context/BranchContext';
import { getActiveFactories } from '../../services/master/factoryService';
import { getOrderAllocations, saveOrderAllocations } from '../../services/orders/orderAllocationService';
import { toastUnlessHandled } from '../../utils/apiError';

const { Text } = Typography;

/**
 * Splits an order across branches: this many pieces in Tirupur, that many in
 * Erode. The unit is optional — production picks it later. The whole split is
 * saved at once; the server holds a lock on the order while it checks the total
 * against the order quantity. Only ever opened when the company has more than
 * one branch.
 */
const OrderBranchAllocation = ({ open, orderId, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { branches } = useBranch();
  const [view, setView] = useState(null);
  const [rows, setRows] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const nextKey = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, activeUnits] = await Promise.all([getOrderAllocations(orderId), getActiveFactories()]);
      setView(data);
      setRows((data.rows || []).map((r) => ({
        key: ++nextKey.current, branchId: r.branchId, unitId: r.unitId, qty: r.qty, remarks: r.remarks || '',
      })));
      setUnits(Array.isArray(activeUnits) ? activeUnits : []);
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to load branch allocation');
    } finally {
      setLoading(false);
    }
  }, [orderId, message]);

  useEffect(() => { if (open && orderId) load(); }, [open, orderId, load]);

  const total = view?.totalOrderQty ?? 0;
  const allocated = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const unallocated = total - allocated;
  const duplicateBranch = rows.some((r, i) => r.branchId && rows.findIndex((o) => o.branchId === r.branchId) !== i);
  const canSave = rows.length > 0 && !duplicateBranch && unallocated >= 0
    && rows.every((r) => r.branchId && Number(r.qty) > 0);

  const branchOptions = useMemo(() => branches.map((b) => ({ value: b.id, label: b.branchName })), [branches]);

  const patch = useCallback((key, changes) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { key: ++nextKey.current, branchId: null, unitId: null, qty: Math.max(unallocated, 0), remarks: '' }]);
  }, [unallocated]);

  const removeRow = useCallback((key) => setRows((prev) => prev.filter((r) => r.key !== key)), []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await saveOrderAllocations(orderId, rows.map(({ branchId, unitId, qty, remarks }) => ({
        branchId, unitId: unitId ?? null, qty: Number(qty), remarks: remarks || null,
      })));
      message.success('Branch allocation saved');
      onSaved?.(saved);
      onClose?.();
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to save branch allocation');
    } finally {
      setSaving(false);
    }
  }, [orderId, rows, message, onSaved, onClose]);

  const columns = useMemo(() => [
    {
      title: 'Branch',
      dataIndex: 'branchId',
      width: 200,
      render: (v, r) => (
        <Select
          aria-label="Branch"
          value={v}
          placeholder="Select branch"
          options={branchOptions}
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          status={r.branchId && rows.filter((o) => o.branchId === r.branchId).length > 1 ? 'error' : undefined}
          onChange={(val) => patch(r.key, { branchId: val, unitId: null })}
        />
      ),
    },
    {
      title: 'Unit (optional)',
      dataIndex: 'unitId',
      width: 200,
      render: (v, r) => (
        <Select
          aria-label="Unit"
          value={v}
          placeholder="Any unit"
          allowClear
          disabled={!r.branchId}
          options={units.filter((u) => u.branchId === r.branchId).map((u) => ({ value: u.id, label: u.factoryName }))}
          style={{ width: '100%' }}
          onChange={(val) => patch(r.key, { unitId: val ?? null })}
        />
      ),
    },
    {
      title: 'Qty (pcs)',
      dataIndex: 'qty',
      width: 130,
      align: 'right',
      render: (v, r) => (
        <InputNumber
          aria-label="Quantity"
          value={v}
          min={1}
          max={total || undefined}
          precision={0}
          style={{ width: '100%' }}
          onChange={(val) => patch(r.key, { qty: val })}
        />
      ),
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      render: (v, r) => (
        <Input aria-label="Remarks" value={v} maxLength={500} onChange={(e) => patch(r.key, { remarks: e.target.value })} />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      align: 'center',
      render: (_, r) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Remove branch" onClick={() => removeRow(r.key)} disabled={rows.length <= 1} />
      ),
    },
  ], [branchOptions, units, rows, total, patch, removeRow]);

  return (
    <Drawer
      title={`Branch Allocation${view?.orderNo ? ` — ${view.orderNo}` : ''}`}
      size="large"
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} icon={<CloseOutlined />}>Cancel</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!canSave}>Save Allocation</Button>
        </Space>
      )}
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Tag>Order qty: <Text strong>{total.toLocaleString()}</Text></Tag>
        <Tag color="blue">Allocated: <Text strong>{allocated.toLocaleString()}</Text></Tag>
        <Tag color={unallocated < 0 ? 'error' : unallocated > 0 ? 'warning' : 'success'}>
          {unallocated < 0 ? `Over by ${Math.abs(unallocated).toLocaleString()}` : `Unallocated: ${unallocated.toLocaleString()}`}
        </Tag>
        {duplicateBranch && <Tag color="error">A branch appears twice</Tag>}
      </Space>
      <Table
        size="small"
        rowKey="key"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={false}
        locale={{ emptyText: 'No branches yet' }}
      />
      <Button type="dashed" icon={<PlusOutlined />} onClick={addRow} style={{ marginTop: 12 }} block>
        Add branch
      </Button>
    </Drawer>
  );
};

export default OrderBranchAllocation;
