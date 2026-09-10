import { Card, Typography, theme } from 'antd';
import { formatRupees, formatSigned } from './bridgeFormat';

const { Text, Title } = Typography;

/**
 * States, in words, which of the two causes actually moved the total.
 *
 * The split is the entire point of this screen, and leaving the reader to work
 * it out from two signed numbers in a table is how the total gets misread in
 * the first place. So the answer is written out, with the figures beside it.
 */
const CostPerHeadVerdict = ({ overall, measureLabel }) => {
  const { token } = theme.useToken();
  if (!overall) return null;

  const total = Number(overall.totalChange) || 0;
  const volume = Number(overall.volumeEffect) || 0;
  const rate = Number(overall.rateEffect) || 0;
  const colour = total > 0 ? token.colorWarning : total < 0 ? token.colorSuccess : undefined;

  const dominant = Math.abs(volume) >= Math.abs(rate) ? 'people' : 'pay';
  const share = Math.abs(volume) + Math.abs(rate) === 0
    ? 0
    : Math.round((Math.max(Math.abs(volume), Math.abs(rate))
        / (Math.abs(volume) + Math.abs(rate))) * 100);

  const sentence = total === 0 && (volume !== 0 || rate !== 0)
    ? 'The total barely moved, but both sides of it did.'
    : dominant === 'people'
      ? `Mostly people: ${share}% of the move is headcount, not pay per head.`
      : `Mostly pay: ${share}% of the move is cost per head, not headcount.`;

  return (
    <Card size="small">
      <Text type="secondary" style={{ fontSize: 12 }}>
        {measureLabel}, {overall.fromLabel} to {overall.toLabel}
      </Text>
      <Title level={4} style={{ margin: '2px 0 10px', color: colour }}>
        {total === 0 ? 'No change' : `${total > 0 ? 'Up' : 'Down'} ${formatRupees(Math.abs(total))}`}
      </Title>

      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 10 }}>
        <Part
          label="More or fewer people"
          value={formatSigned(volume)}
          hint={`${overall.headcountChange > 0 ? '+' : ''}${overall.headcountChange} paid`}
        />
        <Part
          label="More or less per head"
          value={formatSigned(rate)}
          hint={overall.costPerHeadChange == null
            ? null
            : `${formatSigned(overall.costPerHeadChange)} each`}
        />
      </div>

      <Text>{sentence}</Text>
    </Card>
  );
};

const Part = ({ label, value, hint }) => (
  <div>
    <div><Text type="secondary" style={{ fontSize: 12 }}>{label}</Text></div>
    <Text strong style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{value}</Text>
    {hint && <div><Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text></div>}
  </div>
);

export default CostPerHeadVerdict;
