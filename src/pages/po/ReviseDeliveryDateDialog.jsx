import { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, DatePicker, Input, Table, Typography, Tag, Alert, App } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reviseDeliveryDate } from '../../services/po/purchaseOrderService';
import { getEffectiveDeliveryDate } from '../../utils/poStatusConstants';

const { Text } = Typography;
const { TextArea } = Input;

const fmt = (d) => (d ? dayjs(d).format('DD MMM YYYY') : '—');

/** Flatten the PO's line items into the incomplete stages only — a completed stage keeps
 *  the target its delay was measured against, so it is never re-dated. */
const collectOpenStages = (po) =>
  (po?.lineItems || []).flatMap((li) =>
    (li.processingStages || [])
      .map((stage, stageIndex) => ({ stage, stageIndex }))
      .filter(({ stage }) => !stage.isCompleted)
      .map(({ stage, stageIndex }) => ({
        key: `${li.id}-${stageIndex}`,
        lineItemId: li.id,
        stageIndex,
        itemLabel: li.variantName || li.variantCode || li.itemName || 'Item',
        stageName: stage.stageName || `Stage ${stageIndex + 1}`,
        currentTarget: stage.completionDate || null,
      }))
  );

/**
 * Revise the delivery date of a PO that is with the supplier. The new date carries the
 * open stage targets with it by the same number of days; any row can be overridden before
 * saving, and an override survives a further change of the delivery date.
 */
const ReviseDeliveryDateDialog = ({ open, po, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [newDate, setNewDate] = useState(null);
  const [reason, setReason] = useState('');
  const [targets, setTargets] = useState({});
  const [touched, setTouched] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const currentEffective = getEffectiveDeliveryDate(po);
  const openStages = useMemo(() => collectOpenStages(po), [po]);
  const shiftDays = newDate && currentEffective ? newDate.diff(dayjs(currentEffective), 'day') : null;

  useEffect(() => {
    if (open) {
      setNewDate(null);
      setReason('');
      setTargets({});
      setTouched(new Set());
    }
  }, [open]);

  // Re-propose every untouched stage target whenever the delivery date moves. A manual
  // override is kept, but still clamped into range — pulling the delivery date back in
  // would otherwise leave an override sitting beyond it, which the API rejects.
  useEffect(() => {
    if (!newDate || !currentEffective) return;
    const delta = newDate.diff(dayjs(currentEffective), 'day');
    const floor = po?.poDate ? dayjs(po.poDate) : null;
    setTargets((prev) => {
      const next = { ...prev };
      openStages.forEach((row) => {
        if (!touched.has(row.key)) {
          if (!row.currentTarget) return;
          next[row.key] = dayjs(row.currentTarget).add(delta, 'day');
        }
        const value = next[row.key];
        if (!value) return;
        if (value.isAfter(newDate, 'day')) next[row.key] = newDate;
        else if (floor && value.isBefore(floor, 'day')) next[row.key] = floor;
      });
      return next;
    });
  }, [newDate, currentEffective, openStages, touched, po?.poDate]);

  const handleTargetChange = useCallback((key, value) => {
    setTouched((prev) => new Set(prev).add(key));
    setTargets((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    if (!newDate) {
      message.warning('Please select the revised delivery date');
      return;
    }
    if (!reason.trim()) {
      message.warning('Please enter a reason for the revision');
      return;
    }
    const missing = openStages.filter((row) => row.currentTarget && !targets[row.key]);
    if (missing.length > 0) {
      message.warning('Please set a new target date for every open processing stage');
      return;
    }
    const outOfRange = openStages.find((row) => targets[row.key]?.isAfter(newDate, 'day'));
    if (outOfRange) {
      message.warning(`"${outOfRange.stageName}" is targeted after the revised delivery date`);
      return;
    }

    setSaving(true);
    try {
      const updated = await reviseDeliveryDate(po.id, {
        revisedDeliveryDate: newDate.format('YYYY-MM-DD'),
        reason: reason.trim(),
        stageUpdates: openStages
          .filter((row) => targets[row.key])
          .map((row) => ({
            lineItemId: row.lineItemId,
            stageIndex: row.stageIndex,
            completionDate: targets[row.key].format('YYYY-MM-DD'),
          })),
      });
      message.success('Delivery date revised');
      onSaved(updated);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to revise the delivery date');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      { title: 'Item', dataIndex: 'itemLabel', key: 'itemLabel', ellipsis: true },
      { title: 'Stage', dataIndex: 'stageName', key: 'stageName', width: 150, ellipsis: true },
      {
        title: 'Current Target',
        dataIndex: 'currentTarget',
        key: 'currentTarget',
        width: 130,
        render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{fmt(v)}</Text>,
      },
      {
        title: 'New Target',
        key: 'newTarget',
        width: 170,
        render: (_, row) => (
          <DatePicker
            size="small"
            format="DD-MMM-YYYY"
            style={{ width: '100%' }}
            disabled={!newDate}
            allowClear={false}
            value={targets[row.key] || null}
            onChange={(v) => handleTargetChange(row.key, v)}
            disabledDate={(current) => {
              if (!current) return false;
              if (po?.poDate && current.isBefore(dayjs(po.poDate), 'day')) return true;
              if (newDate && current.isAfter(newDate, 'day')) return true;
              return false;
            }}
          />
        ),
      },
    ],
    [targets, newDate, po?.poDate, handleTargetChange]
  );

  return (
    <Modal
      title="Revise Delivery Date"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save Revision"
      confirmLoading={saving}
      okButtonProps={{ disabled: !newDate || !reason.trim() }}
      width={760}
      destroyOnHidden
    >
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Original</Text>
          <Text strong style={{ fontSize: 14 }}>{fmt(po?.deliveryDate)}</Text>
        </div>
        {po?.revisedDeliveryDate && (
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Revised</Text>
            <Text strong style={{ fontSize: 14 }}>{fmt(po.revisedDeliveryDate)}</Text>
          </div>
        )}
        <div style={{ minWidth: 200 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            New Revised Date <span style={{ color: 'var(--error-color)' }}>*</span>
          </Text>
          <DatePicker
            format="DD-MMM-YYYY"
            style={{ width: '100%' }}
            value={newDate}
            allowClear={false}
            onChange={setNewDate}
            disabledDate={(current) => current && !current.isAfter(dayjs(), 'day')}
          />
        </div>
        {shiftDays != null && shiftDays !== 0 && (
          <div style={{ alignSelf: 'flex-end', paddingBottom: 4 }}>
            <Tag color={shiftDays > 0 ? 'error' : 'success'} icon={<CalendarOutlined />} style={{ margin: 0 }}>
              {shiftDays > 0 ? `+${shiftDays}` : shiftDays} day{Math.abs(shiftDays) === 1 ? '' : 's'}
            </Tag>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Reason <span style={{ color: 'var(--error-color)' }}>*</span>
        </Text>
        <TextArea
          placeholder="Why is the delivery date being revised?"
          rows={2}
          maxLength={500}
          showCount
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {openStages.length > 0 ? (
        <>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Processing stage targets ({openStages.length})
          </Text>
          <Table
            size="small"
            rowKey="key"
            columns={columns}
            dataSource={openStages}
            pagination={false}
            scroll={{ y: 240 }}
          />
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
            Completed stages keep their original targets and are not listed here.
          </Text>
        </>
      ) : (
        <Alert
          type="info"
          showIcon
          message="This PO has no open processing stages — only the delivery date will change."
        />
      )}
    </Modal>
  );
};

export default ReviseDeliveryDateDialog;
