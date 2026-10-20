import { memo, Fragment } from 'react';
import { Button, Typography, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * The document hero of the Supplier PO view: an accent border in the status colour, the title with its status and
 * tags, a subtitle, a meta row of icon + text, and a highlighted figure on the right. ViewDialog renders it at the top
 * of its modal; a full-page document screen renders it with `page` — framed as a card, wrapping on a narrow screen
 * instead of scrolling — plus `onBack` (an arrow before the title) and `actions` (buttons under the highlight).
 *
 * `hero` = { title, status, tags, subtitle, subtitleIcon, meta: [{ icon, text }], highlight: { label, value },
 *            accentColor, image }
 */
const DocumentHero = memo(function DocumentHero({ hero, page = false, onBack, actions }) {
  if (!hero) return null;
  const accentColor = hero.accentColor || 'var(--primary-color)';
  const frame = page
    ? {
      padding: '20px 24px', border: '1px solid var(--border-color)', borderLeft: `4px solid ${accentColor}`,
      borderRadius: 'var(--radius-md)', marginBottom: 16, flexWrap: 'wrap', rowGap: 12,
    }
    : { padding: '28px 32px 20px', borderLeft: `4px solid ${accentColor}`, borderBottom: '2px solid var(--border-color)' };
  return (
    <div
      style={{
        flexShrink: 0,
        ...frame,
        background: 'var(--card-bg)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 24,
      }}
    >
      {/* Image (optional) */}
      {hero.image && (
        <div style={{ flexShrink: 0 }}>
          {hero.image}
        </div>
      )}

      {/* Left side */}
      <div style={{ flex: page ? '1 1 420px' : 1, minWidth: 0 }}>
        {/* Title + Status + Tags row */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
          {onBack && <Button type="text" icon={<ArrowLeftOutlined />} aria-label="Back" onClick={onBack} />}
          <Title level={3} style={{ margin: 0, lineHeight: 1.3 }}>
            {hero.title}
          </Title>
          {/* Own gap: `status` is usually several badges, and relying on each
              tag's trailing margin leaves them touching */}
          {hero.status && (
            <span className="status-badge-group" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              {hero.status}
            </span>
          )}
          {hero.tags?.length > 0 && (
            <Space size={4} wrap>
              {hero.tags.map((tag, i) => (
                <Fragment key={i}>{tag}</Fragment>
              ))}
            </Space>
          )}
        </div>

        {/* Subtitle */}
        {hero.subtitle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--text-secondary)' }}>
            {hero.subtitleIcon && <span style={{ fontSize: 14, display: 'flex' }}>{hero.subtitleIcon}</span>}
            <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{hero.subtitle}</Text>
          </div>
        )}

        {/* Meta items */}
        {hero.meta?.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginTop: 4 }}>
            {hero.meta.map((item, i) => (
              <span key={item.text ?? i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                {item.icon && <span style={{ display: 'flex', fontSize: 13 }}>{item.icon}</span>}
                <span>{item.text}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right side — highlight, then the page's actions */}
      {(hero.highlight || actions) && (
        <div style={{ flexShrink: 0, textAlign: 'right', ...(page && { marginLeft: 'auto' }) }}>
          {hero.highlight && (
            <>
              <div style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                fontWeight: 500,
                marginBottom: 4,
              }}>
                {hero.highlight.label}
              </div>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'var(--primary-color)',
                lineHeight: 1.2,
              }}>
                {hero.highlight.value}
              </div>
            </>
          )}
          {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: hero.highlight ? 12 : 0 }}>{actions}</div>}
        </div>
      )}
    </div>
  );
});

export default DocumentHero;
