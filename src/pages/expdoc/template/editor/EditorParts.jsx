import { Button, Space, Tag, Tooltip } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';

/** Move / remove buttons for one row of an ordered list. */
export const RowTools = ({ index, count, list, disabled }) => (
  <Space size={0}>
    <Button type="text" size="small" aria-label="Move up" icon={<ArrowUpOutlined />} disabled={disabled || index === 0} onClick={() => list.move(index, -1)} />
    <Button type="text" size="small" aria-label="Move down" icon={<ArrowDownOutlined />} disabled={disabled || index === count - 1} onClick={() => list.move(index, 1)} />
    <Button type="text" size="small" danger aria-label="Remove" icon={<DeleteOutlined />} disabled={disabled} onClick={() => list.remove(index)} />
  </Space>
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
        {notFound && <WarningOutlined style={{ color: '#d48806' }} aria-label="Not found in the document" />}
      </Space>
    </Tooltip>
  );
};
