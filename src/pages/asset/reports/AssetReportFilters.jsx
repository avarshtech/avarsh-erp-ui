import { Card, Select, Space } from 'antd';
import { ActionButton } from '../../../components/buttons';
import { widgetFor } from './assetReportFilterBar';

const lookup = (width, placeholder, value, onChange, options) => (
  <Select
    allowClear
    showSearch
    optionFilterProp="label"
    style={{ width }}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    options={options}
  />
);

/**
 * The filter bar and the four actions (PRD screen S13).
 *
 * Unit and category are drawn for every report; the rest come from the
 * report's own `filters` list, which the server declares beside the report.
 *
 * Excel, PDF and Print stay disabled until the report has been run once.
 * Exporting a report nobody has looked at invites somebody to send out a
 * spreadsheet they have not read.
 */
const AssetReportFilters = ({
  definition, values, set, range, onRange, lookups, extra,
  onRun, onExport, onPrint, running, busy, hasReport,
}) => (
  <Card style={{ marginBottom: 16 }}>
    <div style={{ marginBottom: 10, opacity: 0.7 }}>{definition?.description}</div>

    <Space size={[12, 12]} wrap align="center">
      {lookup(160, 'Unit', values.unitId, set('unitId'), lookups.options.units)}
      {lookup(190, 'Category', values.categoryId, set('categoryId'), lookups.options.categories)}
      {(definition?.filters ?? []).map((key) => (
        <span key={key}>
          {widgetFor(key, values, set, {
            ...extra,
            units: lookups.options.units,
            departments: lookups.departmentsOf(values.unitId),
            onEmployeeSearch: extra.onEmployeeSearch,
            range,
            onRange,
          })}
        </span>
      ))}
    </Space>

    <div style={{ marginTop: 14 }}>
      <Space wrap>
        <ActionButton action="custom" text="Run Report" onClick={onRun} loading={running} />
        <ActionButton action="download" text="Excel" disabled={!hasReport}
          loading={busy === 'EXCEL'} onClick={() => onExport('EXCEL')} />
        <ActionButton action="download" text="PDF" disabled={!hasReport}
          loading={busy === 'PDF'} onClick={() => onExport('PDF')} />
        <ActionButton action="print" text="Print" disabled={!hasReport} onClick={onPrint} />
      </Space>
    </div>
  </Card>
);

export default AssetReportFilters;
