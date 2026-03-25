import React from 'react';
import { Card, Checkbox } from 'antd';

const ReportFieldSelector = React.memo(function ReportFieldSelector({
  fields = [],
  selectedFields = [],
  onChange,
}) {
  const options = fields.map((f) => ({
    label: f.displayName,
    value: f.fieldCode,
  }));

  return (
    <Card title="Select Columns" size="small">
      <Checkbox.Group
        value={selectedFields}
        onChange={onChange}
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        options={options}
      />
    </Card>
  );
});

export default ReportFieldSelector;
