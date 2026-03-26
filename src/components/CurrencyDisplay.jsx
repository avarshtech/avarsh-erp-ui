import { memo } from 'react';
import { Typography } from 'antd';
import { formatCurrency } from '../utils/formatters';

const { Text } = Typography;

const CurrencyDisplay = memo(function CurrencyDisplay({
  amount,
  currency = 'INR',
  strong = true,
  color = 'var(--success-color)',
  secondary,
  className,
  style,
  ...restProps
}) {
  return (
    <div className={className} style={style} {...restProps}>
      <Text strong={strong} style={{ color }}>
        {formatCurrency(amount, currency)}
      </Text>
      {secondary && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {secondary}
        </div>
      )}
    </div>
  );
});

export default CurrencyDisplay;
