import { Space, Typography } from 'antd';
import { BarcodeOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

/**
 * Presentation shared by the fabric and accessories stock drawers.
 *
 * The two are siblings — a store keeper moving between the registers should not have to
 * re-learn the layout — so the hero lives here instead of being copied into both files
 * and drifting apart. The layout constants sit in ./stockDrawerStyles.
 */

const STAT_LABEL = {
  fontSize: 11,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const CODE_CHIP = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 12px',
  borderRadius: 6,
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 13.5,
  fontWeight: 600,
  letterSpacing: '0.02em',
  color: 'var(--text-primary)',
  lineHeight: 1.3,
};

/** One headline figure in the hero. `suffix` is the unit, set quieter beside the number. */
export const Stat = ({ label, value, suffix, color }) => (
  <div>
    <Text type="secondary" style={STAT_LABEL}>{label}</Text>
    <Text strong style={{ fontSize: 22, letterSpacing: '-0.02em', color }}>
      {value}
      {suffix ? (
        <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, marginLeft: 4 }}>
          {suffix}
        </Text>
      ) : null}
    </Text>
  </div>
);

/**
 * The drawer opens on what identifies the stock: its variant code, what it is, and the
 * figures a buyer came to read. `children` carries the figure row.
 *
 * These drawers render no header of their own — the footer already holds Close — so this
 * block sits flush against the top of the panel and needs the top padding itself. Dropping
 * the header also drops antd's own `aria-labelledby` target, so `titleId` puts it back:
 * the drawer points at this heading for its accessible name.
 */
export const StockDrawerHero = ({ code, tag, title, titleId, accent = 'var(--primary-color)', children }) => (
  <div
    style={{
      padding: '28px 28px 20px',
      borderBottom: '2px solid var(--border-color)',
      borderLeft: `4px solid ${accent}`,
    }}
  >
    <Space align="center" size={10} style={{ marginBottom: 8 }}>
      <span style={CODE_CHIP}>
        <BarcodeOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
        {code || '—'}
      </span>
      {tag}
    </Space>
    <Title id={titleId} level={4} style={{ margin: 0, letterSpacing: '-0.01em' }}>
      {title}
    </Title>
    {children}
  </div>
);
