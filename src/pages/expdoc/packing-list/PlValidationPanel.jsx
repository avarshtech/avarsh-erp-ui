import { Alert, Empty, Space, Tag, Tooltip, Typography } from 'antd';
import {
  CloseCircleFilled, WarningFilled, InfoCircleFilled, CheckCircleFilled,
} from '@ant-design/icons';
import { ActionButton } from '../../../components/buttons';
import { SEVERITY } from '../../../utils/expDocConstants';

const { Text } = Typography;

const TONE = {
  [SEVERITY.ERROR]: { colour: 'var(--error-color)', icon: <CloseCircleFilled />, label: 'Error' },
  [SEVERITY.WARN]: { colour: 'var(--warning-color)', icon: <WarningFilled />, label: 'Warning' },
  [SEVERITY.INFO]: { colour: 'var(--info-color)', icon: <InfoCircleFilled />, label: 'Info' },
};

/**
 * The validation panel — the single place a user sees what is wrong with a document.
 *
 * Errors block. Warnings block only until someone with edit rights records a reason,
 * and that reason travels to the approval screen and the audit trail, which is why
 * acknowledged findings stay visible rather than disappearing (PRD §14).
 */
const PlValidationPanel = ({ validation, canAcknowledge, onAcknowledge, onNavigateTarget }) => {
  const findings = validation?.findings || [];

  if (!findings.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={(
          <Space orientation="vertical" size={2}>
            <Text strong style={{ color: 'var(--success-color)' }}>
              <CheckCircleFilled /> Nothing to flag
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              No errors or warnings are open on this document.
            </Text>
          </Space>
        )}
      />
    );
  }

  const ordered = [SEVERITY.ERROR, SEVERITY.WARN, SEVERITY.INFO]
    .flatMap((sev) => findings.filter((f) => f.severity === sev));

  return (
    <Space orientation="vertical" size={10} style={{ width: '100%' }}>
      {ordered.map((f) => {
        const tone = TONE[f.severity] || TONE[SEVERITY.INFO];
        return (
          <div
            key={`${f.targetKey}-${f.message}`}
            style={{
              border: `1px solid ${f.acknowledged ? 'var(--border-color)' : `color-mix(in srgb, ${tone.colour} 40%, transparent)`}`,
              background: f.acknowledged
                ? 'transparent'
                : `color-mix(in srgb, ${tone.colour} 6%, transparent)`,
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              opacity: f.acknowledged ? 0.75 : 1,
            }}
          >
            <Space align="start" size={10} style={{ width: '100%' }}>
              <span style={{ color: tone.colour, fontSize: 15, lineHeight: '20px' }}>{tone.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Space size={6} wrap>
                  <Tag color={f.severity === SEVERITY.ERROR ? 'red' : f.severity === SEVERITY.WARN ? 'gold' : 'blue'}>
                    {f.code}
                  </Tag>
                  <Text strong>{f.title}</Text>
                  {f.acknowledged && <Tag color="green">Acknowledged</Tag>}
                </Space>
                <div style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 13 }}>{f.message}</Text>
                </div>
                {f.targets?.length > 0 && (
                  <Space size={4} wrap style={{ marginTop: 6 }}>
                    {f.targets.map((t) => (
                      <Tag
                        key={`${t.type}-${t.id}`}
                        style={{ cursor: onNavigateTarget ? 'pointer' : 'default' }}
                        onClick={() => onNavigateTarget?.(t)}
                      >
                        {t.label}
                      </Tag>
                    ))}
                  </Space>
                )}
                {f.acknowledged && (
                  <div style={{ marginTop: 6 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {`"${f.acknowledgement.reason}" — ${f.acknowledgement.user}, ${f.acknowledgement.at}`}
                    </Text>
                  </div>
                )}
              </div>
              {f.acknowledgeable && !f.acknowledged && (
                <Tooltip title={canAcknowledge ? 'Record a reason and proceed' : 'You need edit rights to acknowledge a warning'}>
                  <span>
                    <ActionButton
                      action="custom"
                      text="Acknowledge"
                      size="small"
                      disabled={!canAcknowledge}
                      onClick={() => onAcknowledge(f)}
                    />
                  </span>
                </Tooltip>
              )}
            </Space>
          </div>
        );
      })}

      {validation?.blocking?.length > 0 && (
        <Alert
          type="error"
          showIcon
          title={`${validation.blocking.length} issue(s) block this document`}
          description="Errors must be fixed in the packing entry. Warnings need a reason before the document can move on."
        />
      )}
    </Space>
  );
};

export default PlValidationPanel;
