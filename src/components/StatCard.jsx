import { memo } from 'react';
import { Card, Statistic, Skeleton } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const StatCard = memo(function StatCard({
  title,
  value,
  prefix,
  suffix,
  precision,
  trend,
  trendValue,
  icon,
  color = 'var(--primary-color)',
  loading = false,
  className,
  style,
  ...restProps
}) {
  if (loading) {
    return (
      <Card
        className={className}
        style={{
          borderRadius: 'var(--radius-lg)',
          ...style,
        }}
        styles={{ body: { padding: 20 } }}
        {...restProps}
      >
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  return (
    <Card
      className={className}
      style={{
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        ...style,
      }}
      styles={{ body: { padding: 20 } }}
      {...restProps}
    >
      {/* Accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: color,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {icon && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-md)',
              background: `color-mix(in srgb, ${color} 6%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              color: color,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <Statistic
            title={title}
            value={value}
            prefix={prefix}
            suffix={suffix}
            precision={precision}
          />

          {trend && trendValue !== undefined && (
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                color:
                  trend === 'up'
                    ? 'var(--success-color)'
                    : 'var(--error-color)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {trend === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

export default StatCard;
