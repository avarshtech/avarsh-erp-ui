import { memo } from 'react';
import { Progress, Space, Tooltip, Typography } from 'antd';
import { fmtQty, pct } from '../jwFormat';

const { Text } = Typography;

/**
 * A job's stages as compact progress chips: "Stitched 1,200 / 1,702". `stages` =
 * [{ stage, label, cum, plan, received }]. `compact` drops the bars for dense tables.
 */
const StageChips = memo(function StageChips({ stages = [], compact = false }) {
  return (
    <Space size={[10, 4]} wrap>
      {stages.map((s) => {
        const done = pct(s.cum, s.plan);
        return (
          <Tooltip
            key={s.stage}
            title={`${s.label}: ${fmtQty(s.cum)} of ${fmtQty(s.plan)}${s.received ? ` · ${fmtQty(s.received)} received` : ''}`}
          >
            <span style={{ display: 'inline-flex', flexDirection: 'column', minWidth: compact ? 0 : 76 }}>
              <Text style={{ fontSize: 11, lineHeight: '14px' }} type="secondary">{s.label}</Text>
              <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }} strong={done >= 100}>
                {fmtQty(s.cum)}<Text type="secondary" style={{ fontSize: 11 }}> / {fmtQty(s.plan)}</Text>
              </Text>
              {!compact && (
                <Progress percent={done} showInfo={false} size={{ height: 4 }} railColor="var(--border-color, #f0f0f0)" status={done >= 100 ? 'success' : 'normal'} />
              )}
            </span>
          </Tooltip>
        );
      })}
    </Space>
  );
});

export default StageChips;
