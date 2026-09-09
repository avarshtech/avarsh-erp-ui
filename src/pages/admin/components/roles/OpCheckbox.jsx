import { Checkbox, Tooltip, Typography } from 'antd';
import { OP_COLORS, opLabel } from './permissionMatrixModel';

const { Text } = Typography;

/**
 * One operation. `bare` renders just the box, for the four aligned CRUD columns
 * where the column header already says which right it is. Otherwise it renders
 * a labelled chip, used in the Approvals & Special column.
 */
const OpCheckbox = ({ screen, op, checked, disabled, reason, bare = false, onChange }) => {
  const colour = OP_COLORS[op] ?? 'var(--text-secondary)';

  const box = (
    <Checkbox
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(op, e.target.checked)}
      aria-label={`${opLabel(screen, op)} on ${screen.name}`}
    />
  );

  const node = bare ? box : (
    <span
      className="perm-chip"
      style={{
        borderColor: checked ? `${colour}66` : 'var(--border-color)',
        background: checked ? `${colour}1a` : 'transparent',
      }}
    >
      {box}
      <Text style={{ fontSize: 12, color: checked ? colour : 'var(--text-secondary)', fontWeight: checked ? 600 : 400 }}>
        {opLabel(screen, op)}
      </Text>
    </span>
  );

  return reason ? <Tooltip title={reason}>{node}</Tooltip> : node;
};

export default OpCheckbox;
