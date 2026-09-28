import { useCallback, useRef } from 'react';
import { Table, Typography } from 'antd';
import { SectionAddButton } from '../../../../components/buttons';
import { formatCurrency } from '../../../../utils/costingConstants';
import { useSheet } from '../CostingSheetContext';
import { SECTION_CONFIG } from '../model/sectionConfig';
import RowDetails from './RowDetails';
import useSectionColumns from './useSectionColumns';
import useGridKeyboard from './useGridKeyboard';

const { Text } = Typography;

/**
 * One section's rows as an editable grid — the same component for fabric, both trim tables,
 * manufacturing and overheads. Less-used fields open under a row; the total sits under the
 * amount column; Enter on the last row adds the next one.
 */
export default function SectionGrid({ sectionKey, color }) {
  const { sheet, dispatch, header, totals } = useSheet();
  const config = SECTION_CONFIG[sectionKey];
  const rows = sheet.sections[sectionKey];
  const wrapperRef = useRef(null);
  const columns = useSectionColumns(sectionKey, { currency: header.currency, showSizes: header.sizes.length > 1, dispatch });
  const addRow = useCallback(() => dispatch({ type: 'ADD_ROW', section: sectionKey }), [dispatch, sectionKey]);
  const onKeyDown = useGridKeyboard(wrapperRef, addRow);
  const hasDetails = config.details.length > 0;
  const amountIndex = columns.findIndex((c) => c.key === config.amountField) + (hasDetails ? 1 : 0);
  const totalColumns = columns.length + (hasDetails ? 1 : 0);
  const highlight = new Set(sheet.highlight);

  const summary = () => (rows.length === 0 ? null : (
    <Table.Summary.Row>
      <Table.Summary.Cell index={0} colSpan={amountIndex}><Text strong>{config.total.label}</Text></Table.Summary.Cell>
      <Table.Summary.Cell index={amountIndex} align="right">
        <Text strong style={{ color: 'var(--primary-color)' }}>
          {formatCurrency(totals[config.total.key], config.total.currency || header.currency)}
        </Text>
      </Table.Summary.Cell>
      {totalColumns - amountIndex - 1 > 0 && <Table.Summary.Cell index={amountIndex + 1} colSpan={totalColumns - amountIndex - 1} />}
    </Table.Summary.Row>
  ));

  return (
    <div ref={wrapperRef} onKeyDown={onKeyDown} data-genie-anchor={`section-${sectionKey}`}>
      <Table
        dataSource={rows}
        columns={columns}
        rowKey="key"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        rowClassName={(record) => (highlight.has(record.key) ? 'sheet-row-new' : '')}
        expandable={hasDetails ? {
          expandedRowRender: (record) => <RowDetails sectionKey={sectionKey} record={record} />,
          columnWidth: 32,
        } : undefined}
        locale={{ emptyText: config.emptyText }}
        summary={summary}
      />
      <SectionAddButton text={config.addText} color={color} onClick={addRow} style={{ marginTop: 8 }} />
    </div>
  );
}
