import { memo } from 'react';
import { Row, Col, Input, Select, DatePicker, Button, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { DATE_FORMAT } from '../utils/uiConstants';

const { RangePicker } = DatePicker;

const renderFilter = (filter, key) => {
  const { type, props: filterProps = {}, span = {} } = filter;

  const colSpan = {
    xs: span.xs || 24,
    sm: span.sm || 12,
    md: span.md || 8,
    lg: span.lg || 6,
  };

  let content;
  switch (type) {
    case 'select':
      content = (
        <Select
          showSearch
          optionFilterProp="label"
          allowClear
          style={{ width: '100%' }}
          {...filterProps}
        />
      );
      break;
    case 'rangePicker':
      content = (
        <RangePicker
          format={DATE_FORMAT}
          style={{ width: '100%' }}
          {...filterProps}
        />
      );
      break;
    case 'input':
      content = <Input {...filterProps} />;
      break;
    case 'custom':
      content = filterProps.render ? filterProps.render() : null;
      break;
    default:
      content = null;
  }

  return (
    <Col key={key} {...colSpan}>
      {content}
    </Col>
  );
};

const SearchFilterBar = memo(function SearchFilterBar({
  searchText,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onClear,
  onRefresh,
  extra,
  className,
  style,
  ...restProps
}) {
  return (
    <Row
      gutter={[16, 16]}
      align="middle"
      className={className}
      style={style}
      {...restProps}
    >
      <Col flex="auto">
        <Input
          prefix={<SearchOutlined />}
          allowClear
          placeholder={searchPlaceholder}
          value={searchText}
          onChange={onSearchChange}
        />
      </Col>

      {/* The index is part of the fallback key on purpose: a screen with two
          unkeyed filters of the same type (three selects on the SR list) gave
          every one of them the key "select", which React reports as duplicate
          children and is free to omit or duplicate. The arrays are static per
          screen, so the index is stable. */}
      {filters.map((filter, index) => renderFilter(filter, filter.key ?? `${filter.type}-${index}`))}

      {extra && <Col>{extra}</Col>}

      {onClear && (
        <Col>
          <Button type="link" onClick={onClear}>
            Clear
          </Button>
        </Col>
      )}

      {onRefresh && (
        <Col>
          <Tooltip title="Refresh">
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={onRefresh}
            />
          </Tooltip>
        </Col>
      )}
    </Row>
  );
});

export default SearchFilterBar;
