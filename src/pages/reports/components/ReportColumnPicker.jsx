import { useMemo } from 'react';
import { Table, Checkbox, Tag, Typography, Empty } from 'antd';

const { Text } = Typography;

const TYPE_COLOR = { STRING: 'default', NUMBER: 'blue', CURRENCY: 'green', DATE: 'purple', BOOLEAN: 'gold' };

/**
 * Column chooser for the Report Designer.
 *
 * value: { [columnKey]: { isDefault, isFilterable, isSortable } } — a column is
 * included in the report exactly when it has an entry.
 */
const ReportColumnPicker = ({ columns = [], value = {}, onChange, disabled = false }) => {
  const toggleInclude = (col, checked) => {
    const next = { ...value };
    if (checked) {
      next[col.key] = { isDefault: col.defaultVisible, isFilterable: false, isSortable: col.sortable };
    } else {
      delete next[col.key];
    }
    onChange?.(next);
  };

  const toggleFlag = (colKey, flag, checked) => {
    if (!value[colKey]) return;
    onChange?.({ ...value, [colKey]: { ...value[colKey], [flag]: checked } });
  };

  const tableColumns = useMemo(() => [
    {
      title: 'Column',
      dataIndex: 'label',
      key: 'label',
      render: (label, col) => (
        <span>
          <Text strong={!!value[col.key]}>{label}</Text>{' '}
          <Tag color={TYPE_COLOR[col.type] || 'default'} style={{ marginInlineStart: 4 }}>
            {col.type}
          </Tag>
        </span>
      ),
    },
    {
      title: 'Include',
      key: 'include',
      width: 90,
      align: 'center',
      render: (_, col) => (
        <Checkbox
          checked={!!value[col.key]}
          disabled={disabled}
          onChange={(e) => toggleInclude(col, e.target.checked)}
        />
      ),
    },
    {
      title: 'Show by default',
      key: 'isDefault',
      width: 130,
      align: 'center',
      render: (_, col) => (
        <Checkbox
          checked={!!value[col.key]?.isDefault}
          disabled={disabled || !value[col.key]}
          onChange={(e) => toggleFlag(col.key, 'isDefault', e.target.checked)}
        />
      ),
    },
    {
      title: 'Filterable',
      key: 'isFilterable',
      width: 100,
      align: 'center',
      render: (_, col) => (
        <Checkbox
          checked={!!value[col.key]?.isFilterable}
          disabled={disabled || !value[col.key] || !col.filterable}
          onChange={(e) => toggleFlag(col.key, 'isFilterable', e.target.checked)}
        />
      ),
    },
    {
      title: 'Sortable',
      key: 'isSortable',
      width: 100,
      align: 'center',
      render: (_, col) => (
        <Checkbox
          checked={!!value[col.key]?.isSortable}
          disabled={disabled || !value[col.key] || !col.sortable}
          onChange={(e) => toggleFlag(col.key, 'isSortable', e.target.checked)}
        />
      ),
    },
  ], [value, disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!columns.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select a data source to choose columns" />;
  }

  return (
    <Table
      rowKey="key"
      size="small"
      columns={tableColumns}
      dataSource={columns}
      pagination={false}
      scroll={{ y: 320 }}
    />
  );
};

export default ReportColumnPicker;
