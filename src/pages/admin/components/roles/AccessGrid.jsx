import { useMemo } from 'react';
import { Table } from 'antd';
import { gridScroll } from '../../../../utils/gridScroll';
import { ACCESS_TABLE_X, buildAccessColumns } from './accessGridColumns';
import './accessGrid.css';

/**
 * One section's access table — ticks in the view dialog, boxes in the editor. The editor's
 * table pins its header only when the section overflows the screen (gridScroll); the dialog's
 * tables never scroll themselves, the dialog body does.
 */
const AccessGrid = ({ mode, section, rows, permissions, changedKeys, blockedFor, on, emptyText }) => {
  const columns = useMemo(
    () => buildAccessColumns({ mode, section, permissions, changedKeys, blockedFor, on }),
    [mode, section, permissions, changedKeys, blockedFor, on],
  );
  const rowClassName = (row) => [
    row.bundle && 'ag-row-bundle',
    mode === 'edit' && blockedFor(row.screen.id) && 'ag-row-blocked',
  ].filter(Boolean).join(' ');

  return (
    <Table
      className="access-grid"
      size="small"
      rowKey="key"
      columns={columns}
      dataSource={rows}
      pagination={false}
      tableLayout="fixed"
      scroll={mode === 'edit' ? gridScroll(ACCESS_TABLE_X, rows.length) : { x: ACCESS_TABLE_X }}
      rowClassName={rowClassName}
      locale={emptyText ? { emptyText } : undefined}
    />
  );
};

export default AccessGrid;
