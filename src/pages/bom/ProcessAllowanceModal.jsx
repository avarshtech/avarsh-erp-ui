import { Modal, Table, InputNumber, Typography, Space, Tag } from 'antd';
import { useState, useEffect, useRef, useCallback } from 'react';
import { HolderOutlined } from '@ant-design/icons';
import { calcPurchaseQty, calcPurchaseWidth } from '../../utils/bomConstants';

const { Text } = Typography;

/**
 * ProcessAllowanceModal
 *
 * Appears when a user selects process(es) on a BOM line.
 * Lets the user specify shrinkage, process-loss %, rejection %,
 * and shipment allowance % per process, then previews the resulting
 * purchase width / qty before applying back to the BOM line.
 *
 * Includes a drag-and-drop process series section (when >1 process)
 * to define execution order.
 */
const ProcessAllowanceModal = ({
  open,
  processes = [],
  finishedWidth = 0,
  baseQty = 0,
  isFabric = true,
  onApply,
  onCancel,
}) => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (open && processes.length > 0) {
      setRows(
        processes.map((p, idx) => ({
          processId: p.id,
          processName: p.processName,
          sortOrder: idx,
          shrinkageInches: p.defaultShrinkageInches ?? 0,
          processLossPercent: p.defaultProcessLossPercent ?? 0,
          rejectionPercent: p.defaultRejectionPercent ?? 0,
          shipmentAllowancePercent: p.defaultShipmentAllowancePercent ?? 0,
        })),
      );
    }
  }, [open, processes]);

  const updateRow = (processId, field, value) => {
    setRows((prev) =>
      prev.map((r) =>
        r.processId === processId ? { ...r, [field]: value } : r,
      ),
    );
  };

  // On blur, reset to default from master if empty
  const defaultFieldMap = {
    shrinkageInches: 'defaultShrinkageInches',
    processLossPercent: 'defaultProcessLossPercent',
    rejectionPercent: 'defaultRejectionPercent',
    shipmentAllowancePercent: 'defaultShipmentAllowancePercent',
  };
  const handleBlur = (processId, field, e) => {
    if (!e.target.value && e.target.value !== '0') {
      const proc = processes.find((p) => p.id === processId);
      const defaultVal = proc?.[defaultFieldMap[field]] ?? 0;
      updateRow(processId, field, defaultVal);
    }
  };

  // ── Drag & Drop for process series reorder ──────────────────────
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleDragStart = useCallback((idx) => {
    dragItem.current = idx;
  }, []);

  const handleDragEnter = useCallback((idx) => {
    dragOverItem.current = idx;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    setRows((prev) => {
      const updated = [...prev];
      const [dragged] = updated.splice(dragItem.current, 1);
      updated.splice(dragOverItem.current, 0, dragged);
      return updated.map((r, i) => ({ ...r, sortOrder: i }));
    });
    dragItem.current = null;
    dragOverItem.current = null;
  }, []);

  // Aggregate allowances across all processes
  const totalShrinkage = rows.reduce((s, r) => s + (Number(r.shrinkageInches) || 0), 0);
  const totalLossPercent = rows.reduce((s, r) => s + (Number(r.processLossPercent) || 0), 0);
  const totalRejPercent = rows.reduce((s, r) => s + (Number(r.rejectionPercent) || 0), 0);
  const totalShipmentPercent = rows.reduce((s, r) => s + (Number(r.shipmentAllowancePercent) || 0), 0);

  const purchaseWidth = calcPurchaseWidth(finishedWidth, totalShrinkage);
  const purchaseQty = calcPurchaseQty(baseQty, totalLossPercent, totalRejPercent + totalShipmentPercent);

  const columns = [
    {
      title: '#',
      width: 45,
      align: 'center',
      render: (_, __, idx) => <Text type="secondary" style={{ fontSize: 12 }}>{idx + 1}</Text>,
    },
    {
      title: 'Process',
      dataIndex: 'processName',
      width: 160,
      render: (text) => <Text strong>{text}</Text>,
    },
    // Shrinkage & Process Loss — fabric only
    ...(isFabric ? [
      {
        title: 'Shrinkage',
        dataIndex: 'shrinkageInches',
        width: 140,
        render: (value, record) => (
          <InputNumber
            min={0}
            step={0.25}
            precision={2}
            controls={false}
            style={{ width: '100%' }}
            value={value}
            onChange={(v) => updateRow(record.processId, 'shrinkageInches', v)}
            onBlur={(e) => handleBlur(record.processId, 'shrinkageInches', e)}
            addonAfter="in"
          />
        ),
      },
      {
        title: 'Process Loss',
        dataIndex: 'processLossPercent',
        width: 140,
        render: (value, record) => (
          <InputNumber
            min={0}
            max={100}
            step={0.5}
            precision={2}
            controls={false}
            style={{ width: '100%' }}
            value={value}
            onChange={(v) => updateRow(record.processId, 'processLossPercent', v)}
            onBlur={(e) => handleBlur(record.processId, 'processLossPercent', e)}
            addonAfter="%"
          />
        ),
      },
    ] : []),
    {
      title: 'Rejection',
      dataIndex: 'rejectionPercent',
      width: 140,
      render: (value, record) => (
        <InputNumber
          min={0}
          max={100}
          step={0.5}
          precision={2}
          controls={false}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => updateRow(record.processId, 'rejectionPercent', v)}
          onBlur={(e) => handleBlur(record.processId, 'rejectionPercent', e)}
          addonAfter="%"
        />
      ),
    },
    {
      title: 'Shipment',
      dataIndex: 'shipmentAllowancePercent',
      width: 140,
      render: (value, record) => (
        <InputNumber
          min={0}
          max={100}
          step={0.5}
          precision={2}
          controls={false}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => updateRow(record.processId, 'shipmentAllowancePercent', v)}
          onBlur={(e) => handleBlur(record.processId, 'shipmentAllowancePercent', e)}
          addonAfter="%"
        />
      ),
    },
  ];

  const handleApply = () => {
    onApply?.(
      rows.map((r, idx) => ({
        processId: r.processId,
        processName: r.processName,
        sortOrder: idx,
        shrinkageInches: r.shrinkageInches,
        processLossPercent: r.processLossPercent,
        rejectionPercent: r.rejectionPercent,
        shipmentAllowancePercent: r.shipmentAllowancePercent,
      })),
    );
  };

  const showSeries = rows.length > 1;

  return (
    <Modal
      title="Process Allowances"
      open={open}
      width={isFabric ? 850 : 700}
      destroyOnClose
      onCancel={onCancel}
      okText="Apply Allowances"
      onOk={handleApply}
      cancelText="Cancel"
    >
      {/* Process Execution Series — drag & drop reorder */}
      {showSeries && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ fontSize: 13 }}>Process Execution Series</Text>
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>Drag to reorder the execution sequence</Text>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            overflowX: 'auto',
            padding: '4px 0',
          }}>
            {rows.map((r, idx) => (
              <div key={r.processId} style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color, #d9d9d9)',
                    background: 'var(--card-bg, #fff)',
                    cursor: 'grab',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'box-shadow 0.2s',
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <HolderOutlined style={{ color: 'var(--text-muted, #bfbfbf)', fontSize: 12 }} />
                  <Tag
                    color="blue"
                    style={{ margin: 0, fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: 'center', lineHeight: '18px' }}
                  >
                    {idx + 1}
                  </Tag>
                  <Text style={{ fontSize: 12 }}>{r.processName}</Text>
                </div>
                {idx < rows.length - 1 && (
                  <div style={{
                    width: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted, #bfbfbf)',
                    fontSize: 14,
                    flexShrink: 0,
                  }}>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted, #8c8c8c)' }}>
        Default allowance values are populated from the Process Master. You can modify them below.
      </div>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="processId"
        pagination={false}
        size="middle"
        style={{ marginBottom: 16 }}
      />

      {/* Live calculation preview */}
      <div
        style={{
          background: 'var(--bg-secondary, #f6f8fa)',
          borderRadius: 8,
          padding: '12px 16px',
          border: '1px solid var(--border-color, #e8e8e8)',
        }}
      >
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {isFabric && (
            <Text>
              <Text strong>Purchase Width</Text> = Finished Width ({finishedWidth}") + Shrinkage ({totalShrinkage}") ={' '}
              <Text strong style={{ color: '#6366f1' }}>
                {purchaseWidth}"
              </Text>
            </Text>
          )}
          <Text>
            <Text strong>Purchase Qty</Text> = Base Qty ({baseQty.toLocaleString()})
            {isFabric && <> + Loss ({((baseQty * totalLossPercent) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })})</>}
            {' '}+ Rejection ({((baseQty * totalRejPercent) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })})
            {' '}+ Shipment ({((baseQty * totalShipmentPercent) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}) ={' '}
            <Text strong style={{ color: '#6366f1' }}>
              {purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </Text>
          </Text>
        </Space>
      </div>
    </Modal>
  );
};

export default ProcessAllowanceModal;
