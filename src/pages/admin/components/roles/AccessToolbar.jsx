import { Button, Dropdown, Input, Select, Space } from 'antd';
import { DownOutlined, SearchOutlined } from '@ant-design/icons';
import { SHOW_FILTERS } from './permissionMatrixModel';

/**
 * Find a screen or right, narrow the list, and the setup aids under More: View on every screen
 * (added to what is granted), starting from another role's rights, and clearing everything.
 */
const AccessToolbar = ({ query, onQuery, filter, onFilter, roles, onMore }) => {
  const copy = roles.length
    ? { key: 'copy', label: 'Copy from another role', children: roles.map((r) => ({ key: `copy:${r.id}`, label: r.name })) }
    : { key: 'copy', label: 'Copy from another role', disabled: true };

  return (
    <Space wrap size={8}>
      <Input
        name="accessSearch"
        allowClear
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Find a screen or right"
        prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
        style={{ width: 220 }}
      />
      <Select id="accessShow" aria-label="Show" value={filter} onChange={onFilter} options={SHOW_FILTERS} style={{ width: 160 }} />
      <Dropdown
        menu={{
          items: [
            { key: 'view', label: 'Add View on every screen' },
            copy,
            { type: 'divider' },
            { key: 'clear', label: 'Clear all rights', danger: true },
          ],
          onClick: ({ key }) => onMore(key),
        }}
      >
        <Button>More <DownOutlined /></Button>
      </Dropdown>
    </Space>
  );
};

export default AccessToolbar;
