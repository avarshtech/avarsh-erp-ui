import { memo, Fragment, useMemo } from 'react';
import { Modal, Typography, Skeleton, Space } from 'antd';

const { Title, Text } = Typography;

const ViewDialog = memo(({
  open,
  onClose,
  width = 1200,
  loading = false,
  hero,
  footer,
  children,
  className,
  style,
  ...restProps
}) => {
  const accentColor = hero?.accentColor || 'var(--primary-color)';

  const heroSection = useMemo(() => {
    if (!hero) return null;
    return (
      <div
        style={{
          flexShrink: 0,
          borderLeft: `4px solid ${accentColor}`,
          padding: '28px 32px 20px',
          borderBottom: '2px solid var(--border-color)',
          background: 'var(--card-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 24,
        }}
      >
        {/* Left side */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + Status + Tags row */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            <Title level={3} style={{ margin: 0, lineHeight: 1.3 }}>
              {hero.title}
            </Title>
            {hero.status && <span>{hero.status}</span>}
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

        {/* Right side — highlight */}
        {hero.highlight && (
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
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
          </div>
        )}
      </div>
    );
  }, [hero, accentColor]);

  const footerSection = useMemo(() => {
    if (!footer) return null;
    return (
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid var(--border-color)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--card-bg)',
      }}>
        {footer}
      </div>
    );
  }, [footer]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={width}
      footer={null}
      centered
      destroyOnHidden
      className={className}
      style={style}
      styles={{
        header: { display: 'none' },
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: 'calc(90vh - 40px)',
        },
      }}
      {...restProps}
    >
      {heroSection}

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          children
        )}
      </div>

      {footerSection}
    </Modal>
  );
});

ViewDialog.displayName = 'ViewDialog';

export default ViewDialog;
