import {
  Button, Space, Switch, Tag, Tooltip, Typography,
} from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';

/**
 * Move / remove buttons for one row of an ordered list. `subject` names the row for a
 * screen reader ("Remove face MAIN", "Move line PO NO. up"); without it they read "Remove".
 */
export const RowTools = ({ index, count, list, disabled, subject }) => {
  const named = (action, after = '') => `${action}${subject ? ` ${subject}` : ''}${after}`;
  return (
    <Space size={0}>
      <Button type="text" size="small" aria-label={named('Move', ' up')} icon={<ArrowUpOutlined />} disabled={disabled || index === 0} onClick={() => list.move(index, -1)} />
      <Button type="text" size="small" aria-label={named('Move', ' down')} icon={<ArrowDownOutlined />} disabled={disabled || index === count - 1} onClick={() => list.move(index, 1)} />
      <Button type="text" size="small" danger aria-label={named('Remove')} icon={<DeleteOutlined />} disabled={disabled} onClick={() => list.remove(index)} />
    </Space>
  );
};

/**
 * A switch with its name beside it. The label element holds both, so clicking the name
 * flips the switch and a screen reader announces the switch by that name.
 */
export const LabeledSwitch = ({ label, checked, onChange, disabled, hint }) => (
  <Tooltip title={hint}>
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <Switch size="small" checked={checked} onChange={onChange} disabled={disabled} />
      <span>{label}</span>
    </label>
  </Tooltip>
);

const CONFIDENCE_COLOR = { HIGH: 'green', MEDIUM: 'gold', LOW: 'red' };

/**
 * Where the AI reader found a template row: the cell or page, how sure it was, and
 * whether its label is really in the document. Clicking it shows that place in the
 * uploaded document, when the screen has it open.
 */
export const EvidenceTag = ({ meta, onEvidence }) => {
  if (!meta) return null;
  const notFound = meta.found === false;
  const tip = [
    meta.sample ? `Printed: ${meta.sample}` : null,
    meta.confidence ? `Reader confidence: ${String(meta.confidence).toLowerCase()}` : null,
    notFound ? 'Not found in the document — check this row.' : null,
    meta.suggestedBinding ? `The reader suggested "${meta.suggestedBinding}", which the ERP does not have.` : null,
  ].filter(Boolean).join('\n');
  const clickable = Boolean(onEvidence && meta.evidence);
  return (
    <Tooltip title={tip ? <span style={{ whiteSpace: 'pre-line' }}>{tip}</span> : undefined}>
      <Space size={4}>
        {meta.evidence && (
          <Tag
            color={CONFIDENCE_COLOR[meta.confidence] || 'default'}
            style={{ marginInlineEnd: 0, cursor: clickable ? 'pointer' : 'default' }}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `Show ${meta.evidence} in the document` : undefined}
            onClick={clickable ? () => onEvidence(meta.evidence) : undefined}
            onKeyDown={clickable ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEvidence(meta.evidence); }
            } : undefined}
          >
            {meta.evidence}
          </Tag>
        )}
        {notFound && (
          <Typography.Text type="warning"><WarningOutlined aria-label="Not found in the document" /></Typography.Text>
        )}
      </Space>
    </Tooltip>
  );
};
