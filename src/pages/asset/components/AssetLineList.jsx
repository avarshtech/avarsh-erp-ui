import { Space, Tag } from 'antd';
import PermissionGuard from '../../../components/PermissionGuard';
import { ActionButton } from '../../../components/buttons';

/**
 * The lines inside one section.
 *
 * An indented list rather than a nested table. A line has a name and little
 * else, so a second table's worth of chrome - its own grey header bar repeating
 * "Name / Active / Actions" above a single row reading "Line 05" - said nothing
 * and read as a separate object rather than as the inside of the row above it.
 *
 * Only an inactive line is tagged. The eye should catch the exception, not
 * confirm the normal case once per row.
 */
const AssetLineList = ({ section, onEdit, onDelete }) => (
  <div className="asset-sublist">
    <div className="asset-sublist-head">
      {section.lines.length} line{section.lines.length === 1 ? '' : 's'} in {section.name}
    </div>
    {section.lines.map((line) => (
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
