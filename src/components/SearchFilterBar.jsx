import React from 'react';
import { Row, Col, Input, Select, DatePicker, Button, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { DATE_FORMAT } from '../utils/uiConstants';

const { RangePicker } = DatePicker;

const renderFilter = (filter, index) => {
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
    <Col key={index} {...colSpan}>
      {content}
    </Col>
  );
};

const SearchFilterBar = React.memo(function SearchFilterBar({
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

      {filters.map((filter, index) => renderFilter(filter, index))}

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
