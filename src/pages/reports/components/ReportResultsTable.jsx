import { memo, useMemo } from 'react';
import { Table, Empty } from 'antd';
import dayjs from 'dayjs';
import { formatCurrency, formatNumber } from '../../../utils/formatters';

/**
 * Formats a cell value based on the field type from the report definition.
 */
const formatCellValue = (value, fieldType) => {
  if (value === null || value === undefined) return '\u2014';

  switch (fieldType) {
    case 'DATE':
      return dayjs(value).isValid() ? dayjs(value).format('DD-MMM-YYYY') : '\u2014';
    case 'DATETIME':
      return dayjs(value).isValid() ? dayjs(value).format('DD-MMM-YYYY HH:mm') : '\u2014';
    case 'CURRENCY':
      return formatCurrency(value);
    case 'NUMBER':
      return formatNumber(value, 2);
    case 'BOOLEAN':
      return value ? 'Yes' : 'No';
    default:
      return String(value);
  }
};

const ReportResultsTable = memo(function ReportResultsTable({
  columns = [],
  data = [],
  loading = false,
  pagination,
  onTableChange,
}) {
  const tableColumns = useMemo(() => {
    return columns.map((col) => ({
      title: col.displayName,
      dataIndex: col.fieldCode,
      key: col.fieldCode,
      sorter: col.isSortable !== false,
      ellipsis: true,
      render: (value) => formatCellValue(value, col.fieldType),
    }));
  }, [columns]);

  const tablePagination = useMemo(() => {
    if (!pagination) return false;
    return {
      current: pagination.current,
      pageSize: pagination.pageSize,
      total: pagination.total,
      showSizeChanger: true,
      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
      pageSizeOptions: ['10', '20', '50', '100'],
    };
  }, [pagination]);

  return (
    <Table
      columns={tableColumns}
      dataSource={data}
      loading={loading}
      pagination={tablePagination}
      onChange={onTableChange}
      rowKey={(record, index) => record.id ?? index}
      scroll={{ x: 'max-content' }}
      sticky
      size="middle"
      locale={{
        emptyText: (
          <Empty
            description="No report data. Configure filters and click Generate Report."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ),
      }}
    />
  );
});

export default ReportResultsTable;
