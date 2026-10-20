import { memo, useMemo } from 'react';
import { Space, Tag, Typography } from 'antd';
import { fabricPanelSummary } from '../../../utils/cutPanelCalc';

const { Text } = Typography;

/**
 * "Fabrics & panels added" — each fabric on the requirement with its panels and their line
 * counts, so a second panel or fabric added from the selection strip is plain to see.
 */
const CprFabricPanelSummary = memo(function CprFabricPanelSummary({ lines }) {
  const fabrics = useMemo(() => fabricPanelSummary(lines), [lines]);
  if (!fabrics.length) return null;
  return (
    <div role="group" aria-label="Fabrics and panels added" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 20px', marginBottom: 12 }}>
      <Text type="secondary">Fabrics &amp; panels added</Text>
      {fabrics.map((f) => (
        <Space key={f.fabricId} size={4} wrap>
          <Text strong>{f.fabricName}</Text>
          {f.panels.map((p) => <Tag key={p.panelName}>{p.panelName} · {p.lines} line{p.lines === 1 ? '' : 's'}</Tag>)}
        </Space>
      ))}
    </div>
  );
});

export default CprFabricPanelSummary;
