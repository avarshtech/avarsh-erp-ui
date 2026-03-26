import { memo, useCallback } from 'react';
import { Card, Checkbox, Button, Space, Typography } from 'antd';

const { Text } = Typography;

const ReportFieldSelector = memo(function ReportFieldSelector({
  fields = [],
  selectedFields = [],
  onChange,
}) {
  const options = fields.map((f) => ({
    label: f.displayName,
    value: f.fieldCode,
  }));

  const allFieldCodes = fields.map((f) => f.fieldCode);
  const allSelected = selectedFields.length === fields.length && fields.length > 0;

  const handleSelectAll = useCallback(() => {
    onChange(allSelected ? [] : allFieldCodes);
  }, [allSelected, allFieldCodes, onChange]);

  return (
    <Card
      title="Select Columns"
      size="small"
      extra={
        <Space size={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {selectedFields.length} of {fields.length}
          </Text>
          <Button type="link" size="small" onClick={handleSelectAll} style={{ padding: 0 }}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
        </Space>
      }
    >
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
