import { Checkbox, Tag, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined, LinkOutlined } from '@ant-design/icons';
import OpCheckbox from './OpCheckbox';
import { CRUD_OPS, screenState, specialOps, isGranted } from './permissionMatrixModel';

const { Text } = Typography;

/**
 * One screen. On desktop this is a CSS-grid row whose four CRUD columns line up
 * with every other row, so a right can be scanned down a column. A screen that
 * does not support an operation shows a dash, never a checkbox — that is what
 * makes a read-only screen read as read-only instead of offering three boxes
 * that grant nothing.
 */
const ScreenRow = ({ screen, permissions, blocked, onToggleOp, onToggleScreen, onJumpToParent, compact }) => {
  const state = screenState(permissions, screen);
  const specials = specialOps(screen);
  const isApproval = screen.kind === 'approval';
  const disabled = Boolean(blocked);
  const reason = blocked ? `Requires "${blocked.requiresName}" access` : undefined;

  const name = (
    <div className="perm-name">
      <Checkbox
        checked={state.checked}
        indeterminate={state.indeterminate}
        disabled={disabled}
        onChange={(e) => onToggleScreen(screen, e.target.checked)}
        aria-label={`All rights on ${screen.name}`}
      />
      <div className="perm-name-text">
        <Text strong style={{ fontSize: 13 }}>
          {isApproval && <span className="perm-approval-glyph" aria-hidden="true">⤷ </span>}
          {screen.name}
        </Text>
        <span className="perm-meta">
          {isApproval ? 'Action rights, inside the screen above' : screen.path}
          {screen.routes?.length > 1 && (
            <Tooltip title={screen.routes.join('\n')}>
              <InfoCircleOutlined style={{ marginLeft: 6 }} /> covers {screen.routes.length} routes
            </Tooltip>
          )}
        </span>
        {screen.description && <span className="perm-meta perm-meta-desc">{screen.description}</span>}
        {blocked && (
          <button type="button" className="perm-blocked" onClick={() => onJumpToParent(blocked.requiresId)}>
            <LinkOutlined /> Needs “{blocked.requiresName}” — grant it first
          </button>
        )}
      </div>
    </div>
  );

  const crud = CRUD_OPS.map((op) =>
    screen.ops.includes(op) ? (
      <div className="perm-cell perm-cell-c" key={op}>
        <OpCheckbox
          bare
          screen={screen}
          op={op}
          checked={isGranted(permissions, screen.id, op)}
          disabled={disabled}
          reason={reason}
          onChange={(o, v) => onToggleOp(screen, o, v)}
        />
        {screen.opLabels?.[op] && <span className="perm-oplabel">{screen.opLabels[op]}</span>}
      </div>
    ) : (
      <div className="perm-cell perm-cell-c perm-dash" key={op} aria-label="not applicable">—</div>
    ),
  );

  const special = (
    <div className="perm-cell perm-special">
      {specials.length === 0 ? (
        state.total === 1 && screen.ops[0] === 'view'
          ? <Tag className="perm-viewonly">View only</Tag>
          : <span className="perm-dash">—</span>
      ) : specials.map((op) => (
        <OpCheckbox
          key={op}
          screen={screen}
          op={op}
          checked={isGranted(permissions, screen.id, op)}
          disabled={disabled}
          reason={reason}
          onChange={(o, v) => onToggleOp(screen, o, v)}
        />
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className={`perm-card${disabled ? ' is-blocked' : ''}`}>
        {name}
        <div className="perm-card-ops">
          {screen.ops.filter((op) => CRUD_OPS.includes(op)).map((op) => (
            <OpCheckbox
              key={op}
              screen={screen}
              op={op}
              checked={isGranted(permissions, screen.id, op)}
              disabled={disabled}
              reason={reason}
              onChange={(o, v) => onToggleOp(screen, o, v)}
            />
          ))}
        </div>
        {specials.length > 0 && (
          <>
            <div className="perm-rule">Approvals &amp; Special</div>
            <div className="perm-card-ops">
              {specials.map((op) => (
                <OpCheckbox
                  key={op}
                  screen={screen}
                  op={op}
                  checked={isGranted(permissions, screen.id, op)}
                  disabled={disabled}
                  reason={reason}
                  onChange={(o, v) => onToggleOp(screen, o, v)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`perm-row${disabled ? ' is-blocked' : ''}${isApproval ? ' is-approval' : ''}`}>
      <div className="perm-cell">{name}</div>
      {isApproval
        ? <div className="perm-cell perm-merged">not a screen</div>
        : crud}
      {special}
    </div>
  );
};

export default ScreenRow;
