import React from 'react';
import { Card, Tag, Button, Typography } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';

const { Paragraph } = Typography;

const MODULE_COLORS = {
  ORDER: 'blue',
  PURCHASE_ORDER: 'purple',
  COSTING: 'green',
  ADMIN: 'red',
  INVENTORY: 'orange',
  PRODUCTION: 'cyan',
  STYLE: 'magenta',
  BOM: 'geekblue',
  GRN: 'volcano',
};

export const getModuleColor = (module) => MODULE_COLORS[module] || 'default';

const ModuleReportCard = React.memo(function ModuleReportCard({ report, onOpen }) {
  return (
    <Card
      hoverable
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <BarChartOutlined style={{ fontSize: 18, color: 'var(--primary-color)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>{report.displayName}</span>
      </div>
      <Tag color={getModuleColor(report.module)} style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
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
