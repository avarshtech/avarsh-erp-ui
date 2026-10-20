import { memo } from 'react';
import { Row, Col, Input, Select, DatePicker, Button, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { DATE_FORMAT } from '../utils/uiConstants';

const { RangePicker } = DatePicker;

const renderFilter = (filter, key) => {
  const { type, props: filterProps = {}, span = {}, colStyle } = filter;

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
    <Col key={key} {...colSpan} style={colStyle}>
      {content}
    </Col>
  );
};

/**
 * Search box, `filters` ({ type, props, span, colStyle?, key? }), Clear, Refresh. A bar that must stay
 * on one line gives each filter a pixel `span.lg` flex with `colStyle: { minWidth: 0 }` (a long value
 * is cut short, not widening its column) and a `searchFlex` basis, which applies from lg up — below
 * that, and by default ('auto'), the search box grows into the rest of its line.
 */
const SearchFilterBar = memo(function SearchFilterBar({
  searchText,
  onSearchChange,
  searchPlaceholder = 'Search...',
  searchFlex = 'auto',
  filters = [],
  onClear,
  onRefresh,
  extra,
  className,
  style,
  ...restProps
}) {
  // Col's plain `flex` is an inline style at every width, so a custom basis goes in lg's slot.
  const searchCol = searchFlex === 'auto' ? { flex: 'auto' } : { xs: { flex: 'auto' }, lg: { flex: searchFlex } };
  return (
    <Row
      gutter={[16, 16]}
      align="middle"
      className={className}
      style={style}
      {...restProps}
    >
      <Col {...searchCol}>
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
