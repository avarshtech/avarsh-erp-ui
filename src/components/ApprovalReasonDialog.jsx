import { useMemo } from 'react';
import { Modal, Input, Typography, Button, Tooltip } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Title, Text } = Typography;

/**
 * Shared approval-flow reason dialog — used by PO (via an inline copy), GRN
 * approval actions, and QC approval actions. Mirrors the polished PO reason
 * modal design:
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │ [icon] Title                                       │  ← colour-tinted banner
 *   │        Subtitle                                    │     (per action)
 *   ├────────────────────────────────────────────────────┤
 *   │ [doc info strip: label · docNumber · flow label]  │
 *   │                                                    │
 *   │ (optional) Reason textarea with min-char counter  │
 *   │                                                    │
 *   ├────────────────────────────────────────────────────┤
 *   │                         [Go Back]  [Action Btn]   │  ← action btn uses
 *   └────────────────────────────────────────────────────┘     the action's colour
 *
 * Props
 * ─────
 * open         — modal open flag
 * onCancel     — cancel handler
 * onConfirm    — (reason: string) callback, reason is '' when requiresReason=false
 * loading      — confirm button loading state
 * action       — {
 *                  key, label, color, icon, title, subtitle, flowLabel,
 *                  btnText, placeholder, danger, requiresReason, minChars
 *                }
 * docLabel     — e.g. "Goods Received Note", "QC Inspection"
 * docNumber    — e.g. "GRN/25-26/1001"
 * reason       — controlled textarea value (optional; otherwise use internal state)
 * onReasonChange — controlled textarea setter
 */
const ApprovalReasonDialog = ({
  open,
  onCancel,
  onConfirm,
  loading = false,
  action,
  docLabel,
  docNumber,
  reason = '',
  onReasonChange,
  extraContent = null,
}) => {
  const cfg = action || {};
  const minChars = cfg.minChars ?? (cfg.requiresReason ? 20 : 0);

  const charCount = (reason || '').trim().length;
  const charsRemaining = Math.max(0, minChars - charCount);
  const reasonValid = !cfg.requiresReason || charCount >= minChars;

  const tintBg = useMemo(
    () => `color-mix(in srgb, ${cfg.color || 'var(--primary-color)'} 8%, transparent)`,
    [cfg.color],
  );

  const confirmDisabled = !reasonValid;

  const handleConfirm = () => {
    onConfirm?.(cfg.requiresReason ? reason : '');
  };

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
      centered
      width={520}
      styles={{ body: { padding: 0 } }}
    >
      {action && (
        <div>
          {/* ─── Header banner ───────────────────────────────────────── */}
          <div
            style={{
              padding: '22px 28px 18px',
              background: tintBg,
              borderBottom: `2px solid ${cfg.color || 'var(--primary-color)'}`,
              borderRadius: '8px 8px 0 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div
                style={{
                  color: cfg.color || 'var(--primary-color)',
                  flexShrink: 0,
                  marginTop: 2,
                  fontSize: 28,
                  display: 'flex',
                }}
              >
                {cfg.icon || <ExclamationCircleOutlined />}
              </div>
              <div>
                <Title level={4} style={{ margin: '0 0 4px', color: cfg.color || 'var(--primary-color)' }}>
                  {cfg.title || cfg.label || 'Confirm Action'}
                </Title>
                {cfg.subtitle && (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {cfg.subtitle}
                  </Text>
                )}
              </div>
            </div>
          </div>

          {/* ─── Doc info + flow strip ───────────────────────────────── */}
          <div style={{ padding: '16px 28px 0' }}>
            {(docNumber || cfg.flowLabel) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--primary-color) 5%, transparent)',
                  border: '1px solid var(--border-color, #f0f0f0)',
                  marginBottom: cfg.requiresReason ? 20 : 12,
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    {docLabel || 'Document'}
                  </Text>
                  <Text strong style={{ fontSize: 14 }}>
                    {docNumber || '—'}
                  </Text>
                </div>
                {cfg.flowLabel && (
                  <div style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                      Status Flow
                    </Text>
                    <Text style={{ fontSize: 12, color: cfg.color || 'var(--primary-color)', fontWeight: 600 }}>
                      {cfg.flowLabel}
                    </Text>
                  </div>
                )}
              </div>
            )}

            {/* ─── Extra content slot (e.g. Conditional Pass toggle) ── */}
            {extraContent && (
              <div style={{ marginBottom: 20 }}>
                {extraContent}
              </div>
            )}

            {/* ─── Reason (if required) or confirmation prompt ───────── */}
            {cfg.requiresReason ? (
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <Text strong style={{ fontSize: 13 }}>
                    Reason <span style={{ color: 'var(--error-color)' }}>*</span>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Min {minChars} characters
                  </Text>
                </div>
                <TextArea
                  rows={4}
                  placeholder={cfg.placeholder || 'Enter a clear reason for this action...'}
                  value={reason}
                  onChange={(e) => onReasonChange?.(e.target.value)}
                  maxLength={500}
                  showCount
                  style={{ fontSize: 13 }}
                  status={charCount > 0 && charCount < minChars ? 'warning' : undefined}
                  autoFocus
                />
                {charCount > 0 && charCount < minChars && (
                  <Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                    {charsRemaining} more character{charsRemaining !== 1 ? 's' : ''} required
                  </Text>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Are you sure you want to {(cfg.label || 'perform this action').toLowerCase()}?
                </Text>
              </div>
            )}
          </div>

          {/* ─── Footer ──────────────────────────────────────────────── */}
          <div
            style={{
              padding: '16px 28px 20px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              borderTop: '1px solid var(--border-color, #f0f0f0)',
              marginTop: 4,
            }}
          >
            <Button onClick={onCancel} style={{ minWidth: 80 }}>
              Go Back
            </Button>
            <Tooltip
              title={
                confirmDisabled && cfg.requiresReason
                  ? `Enter at least ${minChars} characters`
                  : ''
              }
            >
              <Button
                type="primary"
                danger={cfg.danger}
                icon={cfg.icon}
                loading={loading}
                disabled={confirmDisabled}
                onClick={handleConfirm}
                style={{
                  minWidth: 130,
                  ...(cfg.color && !cfg.danger
                    ? { backgroundColor: cfg.color, borderColor: cfg.color }
                    : {}),
                }}
              >
                {cfg.btnText || cfg.label || 'Confirm'}
              </Button>
            </Tooltip>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ApprovalReasonDialog;
