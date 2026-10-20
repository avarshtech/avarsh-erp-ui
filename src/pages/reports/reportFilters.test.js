// Which filters a report run offers, and the shape the API reads them in (U305, U306).
//   npx vitest run src/pages/reports/reportFilters.test.js
import { describe, test, expect } from 'vitest';
import dayjs from 'dayjs';
import { reportFiltersOf, toServerFilters } from './reportFilters';

describe('reportFiltersOf', () => {
  test('a Designer report offers the fields ticked Filterable', () => {
    const definition = {
      filters: [],
      fields: [
        { fieldCode: 'order_no', displayName: 'Order No', isFilterable: false },
        { fieldCode: 'status', displayName: 'Status', isFilterable: true, filterType: 'DROPDOWN' },
        { fieldCode: 'order_date', displayName: 'Order Date', isFilterable: true, filterType: 'DATE_RANGE' },
        { fieldCode: 'notes', displayName: 'Notes', isFilterable: true, filterType: null },
      ],
    };
    expect(reportFiltersOf(definition)).toEqual([
      { filterCode: 'status', displayName: 'Status', filterType: 'DROPDOWN' },
      { filterCode: 'order_date', displayName: 'Order Date', filterType: 'DATE_RANGE' },
    ]);
  });

  test('a raw definition keeps its filter rows, and a field never repeats one', () => {
    const legacy = { filterCode: 'status', displayName: 'Order Status', filterType: 'MULTI_SELECT', required: true };
    const definition = { filters: [legacy], fields: [{ fieldCode: 'status', displayName: 'Status', isFilterable: true, filterType: 'DROPDOWN' }] };
    expect(reportFiltersOf(definition)).toEqual([legacy]);
    expect(reportFiltersOf(null)).toEqual([]);
  });
});

describe('toServerFilters', () => {
  const filters = [
    { filterCode: 'order_date', filterType: 'DATE_RANGE' },
    { filterCode: 'value', filterType: 'NUMBER_RANGE' },
    { filterCode: 'ship_date', filterType: 'DATE' },
    { filterCode: 'status', filterType: 'MULTI_SELECT' },
    { filterCode: 'buyer', filterType: 'TEXT' },
  ];

  test('a date range is sent as <code>_start and <code>_end, as local days', () => {
    // 1 Oct IST midnight is 30 Sep in UTC: the day sent must still be 1 Oct
    const out = toServerFilters({ order_date: [dayjs('2026-10-01T00:00:00'), dayjs('2026-10-31T00:00:00')] }, filters);
    expect(out).toEqual({ order_date_start: '2026-10-01', order_date_end: '2026-10-31' });
  });

  test('a number range is sent as <code>_min and <code>_max; a bound left empty is not sent', () => {
    expect(toServerFilters({ value: { min: 1000, max: 20000 } }, filters)).toEqual({ value_min: 1000, value_max: 20000 });
    expect(toServerFilters({ value: { min: 0, max: null } }, filters)).toEqual({ value_min: 0 });
  });

  test('a date is the local day; other filters go as they are; empty values are dropped', () => {
    expect(toServerFilters({
      ship_date: dayjs('2026-10-05T00:00:00'), status: ['OPEN', 'DRAFT'], buyer: 'Zara', order_date: null, value: undefined,
    }, filters)).toEqual({ ship_date: '2026-10-05', status: ['OPEN', 'DRAFT'], buyer: 'Zara' });
    expect(toServerFilters({ status: [] }, filters)).toEqual({});
  });
});
