import { Card, Typography, theme } from 'antd';

const { Text } = Typography;

/**
 * The headcount identity, shown as the identity rather than as four unrelated
 * tiles: opening plus joiners minus leavers is closing. Reading it left to
 * right is the explanation, so the arithmetic is the layout.
 */
const HeadcountFlow = ({ total, onSelect }) => {
  const { token } = theme.useToken();

  const steps = [
    { key: 'OPENING', label: 'Opening', value: total.opening, sign: null },
    { key: 'JOINERS', label: 'Joiners', value: total.joiners, sign: '+', colour: token.colorSuccess },
    { key: 'LEAVERS', label: 'Leavers', value: total.leavers, sign: '−', colour: token.colorWarning },
    { key: 'CLOSING', label: 'Closing', value: total.closing, sign: '=' },
  ];

  return (
    <Card size="small">
      <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', gap: 4 }}>
        {steps.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 130px' }}>
            {s.sign && (
              <Text style={{ fontSize: 22, color: token.colorTextTertiary, padding: '0 2px' }}>
                {s.sign}
              </Text>
            )}
            <button
              type="button"
              onClick={() => onSelect(s.key, s.label)}
              style={{
                flex: 1, textAlign: 'left', cursor: 'pointer',
                background: 'transparent', border: '1px solid transparent',
                borderRadius: token.borderRadius, padding: '8px 10px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = token.colorFillQuaternary; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text>
              </div>
              <Text strong style={{ fontSize: 24, color: s.colour, fontVariantNumeric: 'tabular-nums' }}>
                {s.value}
              </Text>
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 6, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Net change {total.netChange > 0 ? '+' : ''}{total.netChange}
        </Text>
        {total.attritionPercent != null && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Attrition {total.attritionPercent}% over the period
          </Text>
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>Select any figure to see the people in it.</Text>
      </div>
    </Card>
  );
};

export default HeadcountFlow;
