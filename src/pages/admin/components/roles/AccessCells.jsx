import { Checkbox, Tooltip } from 'antd';
import { CheckOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { OP_LABELS, isGranted, opLabel, specialOps } from './permissionMatrixModel';
import { changeKey, isBundle } from './accessGridModel';

/** A CRUD right the screen words its own way ("Delete draft", "Delete item (API only)"): a marker that says how. */
const Renamed = ({ screen, op }) => {
  const label = screen.opLabels?.[op];
  if (!label) return null;
  return (
    <Tooltip title={`${OP_LABELS[op]} here means: ${label}`}>
      <InfoCircleOutlined className="ag-renamed" tabIndex={0} aria-label={`${OP_LABELS[op]} here means: ${label}`} />
    </Tooltip>
  );
};

const Tick = ({ label }) => <CheckOutlined className="ag-tick" aria-label={label} />;

/**
 * One of the four aligned rights. Editing: a box, named "<right> on <screen>". Viewing: a tick
 * with the same name when granted, nothing when not. A dash where the screen has no such right;
 * an approval bundle's row leaves the four columns empty — it is not a screen.
 */
export const OpCell = ({ screen, op, mode, permissions, disabled, onToggle }) => {
  if (isBundle(screen)) return null;
  if (!screen.ops.includes(op)) return <span className="ag-na" role="img" aria-label="Not applicable">–</span>;
  const label = `${opLabel(screen, op)} on ${screen.name}`;
  const granted = isGranted(permissions, screen.id, op);
  if (mode === 'edit') {
    return (
      <span className="ag-op">
        <Checkbox checked={granted} disabled={disabled} onChange={(e) => onToggle(screen, op, e.target.checked)} aria-label={label} />
        <Renamed screen={screen} op={op} />
      </span>
    );
  }
  return granted ? <span className="ag-op"><Tick label={label} /><Renamed screen={screen} op={op} /></span> : null;
};

/** Approvals, payments, dispatch and the rest, in the screen's own wording; wraps when the wording is long. */
export const OtherRightsCell = ({ screen, mode, permissions, changedKeys, disabled, onToggle }) => {
  const ops = specialOps(screen);
  if (mode === 'edit') {
    return ops.length > 0 && (
      <div className="ag-other">
        {ops.map((op) => (
          <Checkbox
            key={op}
            checked={isGranted(permissions, screen.id, op)}
            disabled={disabled}
            className={changedKeys?.has(changeKey(screen.id, op)) ? 'is-changed' : undefined}
            onChange={(e) => onToggle(screen, op, e.target.checked)}
            aria-label={`${opLabel(screen, op)} on ${screen.name}`}
          >
            {opLabel(screen, op)}
          </Checkbox>
        ))}
      </div>
    );
  }
  const granted = ops.filter((op) => isGranted(permissions, screen.id, op));
  return granted.length > 0 && (
    <div className="ag-other">
      {granted.map((op) => (
        <span key={op} className="ag-other-item">
          <Tick label={`${opLabel(screen, op)} on ${screen.name}`} />
          {opLabel(screen, op)}
        </span>
      ))}
    </div>
  );
};
