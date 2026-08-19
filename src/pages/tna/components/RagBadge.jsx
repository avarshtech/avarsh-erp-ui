import { memo } from 'react';
import { Tooltip } from 'antd';
import { RAG } from '../../../utils/tnaConstants';

/** Order-level RAG (§12.3) — dot + label. Driven by projected delay, not late-activity counts. */
const RagBadge = memo(function RagBadge({ rag, showLabel = true, tooltip }) {
  const cfg = RAG[rag] || RAG.GREEN;
  const dot = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 10, height: 10, borderRadius: '50%', background: cfg.color, flexShrink: 0,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${cfg.color} 18%, transparent)`,
        }}
      />
      {showLabel && <span style={{ fontWeight: 600, fontSize: 13 }}>{cfg.label}</span>}
    </span>
  );
  return tooltip ? <Tooltip title={tooltip}>{dot}</Tooltip> : dot;
});

export default RagBadge;
