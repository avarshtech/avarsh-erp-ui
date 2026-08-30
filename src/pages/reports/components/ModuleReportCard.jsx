import { memo } from 'react';
import { Card, Tag, Button, Typography, Space, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getModuleColor, getModuleIcon, getModuleLabel } from '../../../utils/reportConstants';
import PermissionGuard from '../../../components/PermissionGuard';
import { DeleteConfirm } from '../../../components/buttons';

const { Paragraph } = Typography;

// Re-export for backward compatibility
export { getModuleColor };

const ModuleReportCard = memo(function ModuleReportCard({ report, onOpen, onEdit, onDelete }) {
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

      {report.module && (
        <Tag color={color} style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
          {getModuleLabel(report.module)}
        </Tag>
      )}

      <Paragraph
        type="secondary"
        ellipsis={{ rows: 2 }}
        style={{ flex: 1, marginBottom: 12 }}
      >
        {report.description || 'No description available.'}
      </Paragraph>

      <Space.Compact block>
        {/* flex:1 rather than `block` — `block` forces 100% width inside a compact
            group and squeezes the edit/delete buttons out of view entirely. */}
        <Button type="primary" style={{ flex: 1 }} onClick={() => onOpen(report.id)}>
          Open Report
        </Button>
        {onEdit && (
          <PermissionGuard module="reports" operation="update">
            <Tooltip title="Edit report">
              <Button icon={<EditOutlined />} onClick={() => onEdit(report)} />
            </Tooltip>
          </PermissionGuard>
        )}
        {onDelete && (
          <PermissionGuard module="reports" operation="delete">
            <DeleteConfirm
              title="Delete Report"
              recordLabel={report.displayName}
              onConfirm={() => onDelete(report)}
            >
              {/* Native title rather than <Tooltip>: nesting Tooltip inside Popconfirm
                  interferes with the trigger that opens the confirmation. */}
              <Button danger icon={<DeleteOutlined />} title="Delete report" />
            </DeleteConfirm>
          </PermissionGuard>
        )}
      </Space.Compact>
    </Card>
  );
});

export default ModuleReportCard;
