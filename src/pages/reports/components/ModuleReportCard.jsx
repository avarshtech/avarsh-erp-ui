import { memo } from 'react';
import { Card, Tag, Button, Typography } from 'antd';
import { getModuleColor, getModuleIcon } from '../../../utils/reportConstants';

const { Paragraph } = Typography;

// Re-export for backward compatibility
export { getModuleColor };

const ModuleReportCard = memo(function ModuleReportCard({ report, onOpen }) {
  const Icon = getModuleIcon(report.module);
  const color = getModuleColor(report.module);

  // Map Ant Design tag color names to CSS color values for the accent bar
  const accentColorMap = {
    blue: 'var(--primary-color)',
    purple: '#722ed1',
    green: 'var(--success-color)',
    red: 'var(--error-color)',
    orange: 'var(--warning-color)',
    cyan: '#13c2c2',
    magenta: '#eb2f96',
    geekblue: '#2f54eb',
    volcano: '#fa541c',
  };

  const accentColor = accentColorMap[color] || 'var(--primary-color)';

  return (
    <Card
      hoverable
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 'var(--radius-lg)',
      }}
      styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accentColor,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-md)',
            background: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: accentColor,
            flexShrink: 0,
          }}
        >
          <Icon />
        </div>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{report.displayName}</span>
      </div>

      <Tag color={color} style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
        {report.module?.replace(/_/g, ' ')}
      </Tag>

      <Paragraph
        type="secondary"
        ellipsis={{ rows: 2 }}
        style={{ flex: 1, marginBottom: 12 }}
      >
        {report.description || 'No description available.'}
      </Paragraph>

      <Button type="primary" block onClick={() => onOpen(report.id)}>
        Open Report
      </Button>
    </Card>
  );
});

export default ModuleReportCard;
