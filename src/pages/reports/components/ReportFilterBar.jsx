import { memo, useState, useEffect, useCallback } from 'react';
import { Card, DatePicker, Select, Input, InputNumber, Space, Button, Typography, Badge } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getFilterOptions } from '../../../services/reportService';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const FilterLabel = ({ filter }) => (
  <Text style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>
    {filter.displayName}
    {filter.required && <span style={{ color: 'var(--error-color)', marginLeft: 2 }}>*</span>}
  </Text>
);

const DropdownFilter = memo(function DropdownFilter({
  filter,
  value,
  onChange,
  reportDefId,
  mode,
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchOptions = async () => {
      setLoading(true);
      try {
        const data = await getFilterOptions(reportDefId, filter.filterCode);
        if (!cancelled) {
          setOptions(
            (data || []).map((opt) => ({
              label: opt.label || opt.name || opt.value,
              value: opt.value ?? opt.id,
            }))
          );
        }
      } catch {
        // Error already handled by axiosInstance
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchOptions();
    return () => { cancelled = true; };
  }, [reportDefId, filter.filterCode]);

  return (
    <Select
      value={value}
      onChange={(val) => onChange(filter.filterCode, val)}
      options={options}
      loading={loading}
      placeholder={`Select ${filter.displayName}`}
      allowClear
      style={{ width: '100%' }}
      mode={mode}
      showSearch
      optionFilterProp="label"
    />
  );
});

const ReportFilterBar = memo(function ReportFilterBar({
  filters = [],
  values = {},
  onChange,
  onClear,
  reportDefId,
}) {
  const handleChange = useCallback(
    (filterCode, value) => onChange(filterCode, value),
    [onChange]
  );

  const renderFilter = (filter) => {
    const val = values[filter.filterCode];

    switch (filter.filterType) {
      case 'DATE_RANGE':
        return (
          <RangePicker
            value={val && val.length === 2 ? [dayjs(val[0]), dayjs(val[1])] : null}
            onChange={(dates) =>
              handleChange(filter.filterCode, dates ? [dates[0], dates[1]] : null)
            }
            style={{ width: '100%' }}
          />
        );

      case 'DATE':
        return (
          <DatePicker
            value={val ? dayjs(val) : null}
            onChange={(date) => handleChange(filter.filterCode, date)}
            style={{ width: '100%' }}
          />
        );

      case 'DROPDOWN':
        return (
          <DropdownFilter
            filter={filter}
            value={val}
            onChange={handleChange}
            reportDefId={reportDefId}
          />
        );

      case 'MULTI_SELECT':
        return (
          <DropdownFilter
            filter={filter}
            value={val}
            onChange={handleChange}
            reportDefId={reportDefId}
            mode="multiple"
          />
        );

      case 'TEXT':
        return (
          <Input.Search
            value={val || ''}
            onChange={(e) => handleChange(filter.filterCode, e.target.value)}
            placeholder={`Search ${filter.displayName}`}
            allowClear
          />
        );

      case 'NUMBER_RANGE':
        return (
          <Space>
            <InputNumber
              value={val?.min}
              onChange={(v) =>
                handleChange(filter.filterCode, { ...val, min: v })
              }
              placeholder="Min"
              style={{ width: 110 }}
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <InputNumber
              value={val?.max}
              onChange={(v) =>
                handleChange(filter.filterCode, { ...val, max: v })
              }
              placeholder="Max"
              style={{ width: 110 }}
            />
          </Space>
        );

      default:
        return null;
    }
  };

  const activeFilterCount = Object.values(values).filter(
    (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
  ).length;

  if (!filters.length) return null;

  return (
    <Card
      title={
        <Space size={8}>
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <Badge count={activeFilterCount} size="small" color="var(--primary-color)" />
          )}
        </Space>
      }
      size="small"
      extra={
        <Button type="link" icon={<ClearOutlined />} onClick={onClear} size="small">
          Clear Filters
        </Button>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {filters.map((filter) => (
          <div key={filter.filterCode} style={{ minWidth: 200, flex: '1 1 220px', maxWidth: 320 }}>
            <FilterLabel filter={filter} />
            {renderFilter(filter)}
          </div>
        ))}
      </div>
    </Card>
  );
});

export default ReportFilterBar;
