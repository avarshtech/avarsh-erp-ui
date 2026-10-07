import { Checkbox } from 'antd';
import ScreenCell from './ScreenCell';
import { OpCell, OtherRightsCell } from './AccessCells';
import { CRUD_OPS, OP_LABELS, sectionState } from './permissionMatrixModel';
import { changeKey, columnState } from './accessGridModel';

const SCREEN_WIDTH = 260;
const RIGHT_WIDTH = 82;

/**
 * The table's least width: Screen and the four rights, plus room for Other rights. A pane
 * narrower than this scrolls sideways with Screen pinned; a wider one gives Other rights the rest.
 */
export const ACCESS_TABLE_X = SCREEN_WIDTH + 4 * RIGHT_WIDTH + 252;

/**
 * The access table's columns, shared by the view dialog (`mode` 'view': ticks) and the editor
 * ('edit': boxes). Every table uses the same fixed widths, so the dialog's section cards line up.
 * In the editor the headers carry boxes: Screen's grants every right in the section, each right's
 * grants that right on every screen of the section that has it.
 */
export const buildAccessColumns = ({ mode, section, permissions, changedKeys, blockedFor, on }) => {
  const editing = mode === 'edit';
  const blocked = (screen) => (editing ? blockedFor(screen.id) : null);
  const all = editing ? sectionState(permissions, section.screens) : null;

  return [
    {
      title: editing ? (
        <Checkbox
          checked={all.checked}
          indeterminate={all.indeterminate}
          onChange={(e) => on.section(e.target.checked)}
          aria-label={`All rights in ${section.label}`}
        >
          Screen
        </Checkbox>
      ) : 'Screen',
      key: 'screen',
      fixed: 'left',
      width: SCREEN_WIDTH,
      className: 'ag-col-screen',
      render: (_, row) => (
        <ScreenCell
          row={row} mode={mode} permissions={permissions} blocked={blocked(row.screen)}
          onToggleScreen={on?.screen} onJump={on?.jump}
        />
      ),
    },
    ...CRUD_OPS.map((op) => {
      const column = editing ? columnState(permissions, section.screens, op) : null;
      return {
        title: editing ? (
          <Checkbox
            checked={column.checked}
            indeterminate={column.indeterminate}
            disabled={column.disabled}
            onChange={(e) => on.column(op, e.target.checked)}
            aria-label={`${OP_LABELS[op]} on every screen in ${section.label}`}
          >
            {OP_LABELS[op]}
          </Checkbox>
        ) : OP_LABELS[op],
        key: op,
        width: RIGHT_WIDTH,
        align: 'center',
        onCell: (row) => ({ className: changedKeys?.has(changeKey(row.screen.id, op)) ? 'is-changed' : undefined }),
        render: (_, row) => (
          <OpCell
            screen={row.screen} op={op} mode={mode} permissions={permissions}
            disabled={Boolean(blocked(row.screen))} onToggle={on?.op}
          />
        ),
      };
    }),
    {
      title: 'Other rights',
      key: 'other',
      className: 'ag-col-other',
      render: (_, row) => (
        <OtherRightsCell
          screen={row.screen} mode={mode} permissions={permissions} changedKeys={changedKeys}
          disabled={Boolean(blocked(row.screen))} onToggle={on?.op}
        />
      ),
    },
  ];
};
