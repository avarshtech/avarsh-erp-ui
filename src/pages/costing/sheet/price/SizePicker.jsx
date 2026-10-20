import { Radio, Typography } from 'antd';

/**
 * Which size the live panel prices. When rows are limited to some sizes each size is its own
 * garment with its own price — adding every row together would price no real garment.
 */
export default function SizePicker({ sizes, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
        Rows differ by size — price shown for size
      </Typography.Text>
      <Radio.Group
        name="priceSize" size="small" optionType="button" buttonStyle="solid" value={value}
        onChange={(e) => onChange(e.target.value)}
        options={sizes.map((p) => ({ value: p.size, label: `${p.size} · $${p.usd.toFixed(2)}` }))}
      />
    </div>
  );
}
