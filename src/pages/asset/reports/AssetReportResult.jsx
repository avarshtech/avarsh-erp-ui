import { useMemo } from 'react';
import { Card, Empty, Table, Typography } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;

const money = (v) => (v === null || v === undefined || v === '' ? '' : `₹${Number(v).toLocaleString('en-IN')}`);
const day = (v) => (v ? dayjs(v).format('DD-MM-YYYY') : '');

/** Formats a cell by the column's declared type, so dates and money read right. */
const formatter = (type) => {
  if (type === 'DATE') return day;
  if (type === 'CURRENCY') return money;
  return (v) => (v === null || v === undefined ? '' : String(v));
};

/**
 * A fixed report's results.
 *
 * Columns come from the server with their types, so this renders any of the
 * nine without knowing which - and a tenth would need nothing here.
 *
 * Paging is deliberately client-side. A report is a whole answer: somebody
 * exports it, prints it, or reads down it, and server paging would make the
 * sub-totals of a grouped report arrive on a different page from their rows.
 */
const AssetReportResult = ({ report, ranAt, title, loading }) => {
  const columns = useMemo(() => (report?.columns ?? []).map((col, index) => {
    const format = formatter(col.fieldType);
    return {
      title: col.displayName,
      dataIndex: col.fieldCode,
      key: col.fieldCode,
      align: col.fieldType === 'CURRENCY' || col.fieldType === 'NUMBER' ? 'right' : 'left',
      // The first column carries a group heading or a sub-total label, so it
      // stays readable while the rest of that row is blank.
      render: index === 0
        ? (v, row) => (isGroupRow(row, report.columns) ? <Text strong>{format(v)}</Text> : format(v))
        : (v) => format(v),
    };
  }), [report]);

  const rows = useMemo(() => (report?.rows ?? []).map((row, index) => ({ ...row, __key: index })), [report]);

  if (!report && !loading) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Pick a report on the left, set your filters, then Run."
        />
      </Card>
    );
  }

  return (
    <Card
      title={title}
      loading={loading && !report}
      extra={report && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {report.totalRows} row{report.totalRows === 1 ? '' : 's'}
          {' · '}
          {report.executionTimeMs} ms
          {ranAt && `${' · '}run ${ranAt.format('DD-MM-YYYY HH:mm')}`}
        </Text>
      )}
    >
      <Table
        columns={columns}
        dataSource={rows}
        rowKey="__key"
        loading={loading}
        size="small"
        bordered
        scroll={{ x: 'max-content', y: 520 }}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 500] }}
        rowClassName={(row) => (isGroupRow(row, report?.columns) ? 'asset-report-group' : '')}
      />
    </Card>
  );
};

/** A heading or sub-total: a label in the first column and nothing in the rest. */
const isGroupRow = (row, columns = []) => {
  if (columns.length < 2) return false;
  const first = row[columns[0].fieldCode];
  if (typeof first !== 'string' || !first) return false;
  return columns.slice(1).every((c) => {
    const v = row[c.fieldCode];
    return v === null || v === undefined || v === '';
  }) || first.startsWith('Sub-total');
};

export default AssetReportResult;
