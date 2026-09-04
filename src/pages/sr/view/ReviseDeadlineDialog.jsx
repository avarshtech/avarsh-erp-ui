import { useState, useEffect } from 'react';
import { Modal, DatePicker, Input, Typography, Tag, App } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reviseDeadline } from '../../../services/sr/srService';
import {
  getEffectiveDispatchDeadline, getEffectiveBuyerApprovalDeadline,
} from '../../../utils/sampleRequestConstants';
import { toastUnlessHandled } from '../../../utils/apiError';

const { Text } = Typography;
const { TextArea } = Input;

const fmt = (d) => (d ? dayjs(d).format('DD MMM YYYY') : '—');

const Label = ({ children, required }) => (
  <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
    {children}{required && <span style={{ color: 'var(--error-color)' }}> *</span>}
  </Text>
);

/**
 * Re-agree the deadlines of a Submitted / In Production sample request. The originals stay
 * as raised; the new dates sit beside them as a revision with the reason on the trail, and
 * the order the sample was raised for picks up the slip on its own dispatch date. The buyer
 * approval deadline follows the dispatch deadline by the same number of days unless changed.
 */
const ReviseDeadlineDialog = ({ open, sr, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [newDispatch, setNewDispatch] = useState(null);
  const [newApproval, setNewApproval] = useState(null);
  const [approvalTouched, setApprovalTouched] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const currentDispatch = getEffectiveDispatchDeadline(sr);
  const currentApproval = getEffectiveBuyerApprovalDeadline(sr);
  const shiftDays = newDispatch && currentDispatch ? newDispatch.diff(dayjs(currentDispatch), 'day') : null;

  useEffect(() => {
    if (open) {
      setNewDispatch(null);
      setNewApproval(null);
      setApprovalTouched(false);
      setReason('');
    }
  }, [open]);

  // The buyer's window moves with the dispatch date until the user sets it themselves.
  useEffect(() => {
    if (!newDispatch || approvalTouched) return;
    setNewApproval(currentApproval && currentDispatch
      ? dayjs(currentApproval).add(newDispatch.diff(dayjs(currentDispatch), 'day'), 'day')
      : newDispatch);
  }, [newDispatch, approvalTouched, currentApproval, currentDispatch]);

  const approvalBeforeDispatch = Boolean(newDispatch && newApproval && newApproval.isBefore(newDispatch, 'day'));
  const canSave = Boolean(newDispatch) && reason.trim().length > 0 && !approvalBeforeDispatch && shiftDays !== 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const updated = await reviseDeadline(sr.id, {
        revisedDispatchDeadline: newDispatch.format('YYYY-MM-DD'),
        revisedBuyerApprovalDeadline: newApproval ? newApproval.format('YYYY-MM-DD') : null,
        reason: reason.trim(),
        version: sr.version,
      });
      message.success('Deadline revised — change logged in the activity trail');
      onSaved?.(updated);
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to revise the deadline');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Revise Deadline"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save Revision"
      confirmLoading={saving}
      okButtonProps={{ disabled: !canSave }}
      width={640}
      destroyOnHidden
    >
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <Label>Original Dispatch</Label>
          <Text strong style={{ fontSize: 14 }}>{fmt(sr?.dispatchDeadline)}</Text>
        </div>
        {sr?.revisedDispatchDeadline && (
          <div>
            <Label>Current Revised</Label>
            <Text strong style={{ fontSize: 14 }}>{fmt(sr.revisedDispatchDeadline)}</Text>
          </div>
        )}
        <div style={{ minWidth: 200 }}>
          <Label required>New Dispatch Deadline</Label>
          <DatePicker
            format="DD-MMM-YYYY"
            style={{ width: '100%' }}
            value={newDispatch}
            allowClear={false}
            onChange={setNewDispatch}
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

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <Label>Current Buyer Approval</Label>
          <Text strong style={{ fontSize: 14 }}>{fmt(currentApproval)}</Text>
        </div>
        <div style={{ minWidth: 200 }}>
          <Label>New Buyer Approval Deadline</Label>
          <DatePicker
            format="DD-MMM-YYYY"
            style={{ width: '100%' }}
            value={newApproval}
            allowClear={false}
            disabled={!newDispatch}
            status={approvalBeforeDispatch ? 'error' : undefined}
            onChange={(v) => { setApprovalTouched(true); setNewApproval(v); }}
            disabledDate={(current) => Boolean(current && newDispatch && current.isBefore(newDispatch, 'day'))}
          />
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
            {approvalBeforeDispatch
              ? 'Must be on or after the dispatch deadline'
              : 'Moves with the dispatch deadline unless you change it'}
          </Text>
        </div>
      </div>

      <div>
        <Label required>Reason</Label>
        <TextArea
          placeholder="Why is the deadline being revised?"
          rows={2}
          maxLength={500}
          showCount
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
};

export default ReviseDeadlineDialog;
