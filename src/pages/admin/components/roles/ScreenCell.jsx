import { Checkbox, Tooltip } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { screenState } from './permissionMatrixModel';

const details = (screen) => [
  screen.path,
  screen.routes?.length > 1 ? `Covers ${screen.routes.length} routes` : null,
  screen.description,
].filter(Boolean);

/**
 * The Screen column. The name carries its path, routes and description in a tooltip; an approval
 * bundle sits indented under the screen it belongs to. In the editor a box grants or clears every
 * right on the row, and a row whose parent is not granted says so and links to it.
 */
const ScreenCell = ({ row, mode, permissions, blocked, onToggleScreen, onJump }) => {
  const { screen, bundle } = row;
  const lines = details(screen);
  const state = screenState(permissions, screen);

  return (
    <div className={`ag-screen${bundle ? ' is-bundle' : ''}`}>
      {bundle && <span className="ag-bundle-glyph" aria-hidden="true">└</span>}
      {mode === 'edit' && (
        <Checkbox
          checked={state.checked}
          indeterminate={state.indeterminate}
          disabled={Boolean(blocked)}
          onChange={(e) => onToggleScreen(screen, e.target.checked)}
          aria-label={`All rights on ${screen.name}`}
        />
      )}
      <Tooltip title={lines.length ? lines.map((line) => <div key={line}>{line}</div>) : undefined}>
        <span className="ag-screen-name">{screen.name}</span>
      </Tooltip>
      {mode === 'edit' && blocked && (
        <button type="button" className="ag-blocked" onClick={() => onJump(blocked.requiresId)}>
          <LockOutlined aria-hidden="true" /> Needs View on {blocked.requiresName}
        </button>
      )}
    </div>
  );
};

export default ScreenCell;
