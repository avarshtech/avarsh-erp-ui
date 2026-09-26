import { memo } from 'react';
import { Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import ColorDot from '../shared/ColorDot';
import { NO_PROCESS_LABEL } from '../../../utils/cutPanelConstants';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');

/**
 * Colour-wise summary (PRD §8.4, BR-08, AC-16): every order colour, its panels and the
 * process chain in sequence. A colour with no line is listed as "No cut-panel process",
 * never omitted.
 */
const CprColourSummary = memo(function CprColourSummary({ summary }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {summary.map(({ color, panels }) => (
        <div key={color.name} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'start' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ColorDot hex={color.hex} name={color.name} /><strong>{color.name}</strong>
          </span>
          <div style={{ display: 'grid', gap: 4 }}>
            {panels.length === 0 && <Text type="secondary" italic>{NO_PROCESS_LABEL}</Text>}
            {panels.map((p) => (
              <div key={`${p.fabricName}|${p.panelName}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <Text strong>{p.panelName}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>({p.fabricName})</Text>
                {p.chain.map((c, i) => (
                  <span key={`${c.seq}-${c.process}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {i > 0 && <ArrowRightOutlined style={{ fontSize: 10, color: 'var(--text-muted)' }} aria-hidden />}
                    <span>{c.process} <Text type="secondary" style={{ fontSize: 12 }}>{n(c.qty)}</Text></span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

export default CprColourSummary;
