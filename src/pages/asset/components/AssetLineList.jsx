import { Space, Tag } from 'antd';
import PermissionGuard from '../../../components/PermissionGuard';
import { ActionButton } from '../../../components/buttons';

/**
 * The lines on one floor.
 *
 * An indented list rather than a nested table. A line has a name and little
 * else, so a second table's worth of chrome - its own grey header bar repeating
 * "Name / Active / Actions" above a single row reading "Line 05" - said nothing
 * and read as a separate object rather than as the inside of the row above it.
 *
 * Only an inactive line is tagged. The eye should catch the exception, not
 * confirm the normal case once per row.
 */
const AssetLineList = ({ floor, onEdit, onDelete }) => (
  <div className="asset-sublist">
    <div className="asset-sublist-head">
      {floor.lines.length} line{floor.lines.length === 1 ? '' : 's'} on {floor.name}
    </div>
    {floor.lines.map((line) => (
      <div className="asset-subrow" key={line.id}>
        <span className="asset-subrow-name">{line.name}</span>
        {!line.active && <Tag>Inactive</Tag>}
        <PermissionGuard module="asset-setup" operation="update">
          <Space size={0}>
            <ActionButton
              action="edit"
              size="small"
              aria-label={`Edit ${line.name}`}
              onClick={() => onEdit(line)}
            />
            <ActionButton
              action="delete"
              size="small"
              aria-label={`Delete ${line.name}`}
              onClick={() => onDelete(line)}
            />
          </Space>
        </PermissionGuard>
      </div>
    ))}
  </div>
);

export default AssetLineList;
