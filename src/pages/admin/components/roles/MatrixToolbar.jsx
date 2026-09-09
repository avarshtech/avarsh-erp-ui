import { Button, Dropdown, Input, Segmented, Select, Space, Tag } from 'antd';
import { SearchOutlined, DownOutlined } from '@ant-design/icons';
import { SHOW_FILTERS } from './permissionMatrixModel';

/**
 * Search, filter, the Configure/Review switch, and the two setup aids. With 64
 * screens, starting a role from another one beats ticking boxes 40 times.
 */
const MatrixToolbar = ({
  query, onQuery, filter, onFilter, tab, onTab,
  granted, total, screensGranted, roles, onCopyFrom, onPreset, compact,
}) => (
  <div className="perm-toolbar">
    <div className="perm-toolbar-row">
      <Segmented
        value={tab}
        onChange={onTab}
        options={[{ label: 'Configure', value: 'configure' }, { label: 'Review', value: 'review' }]}
      />
      <Tag className={`perm-counter${granted === 0 ? ' is-empty' : ''}`}>
        {granted} of {total} rights · {screensGranted} screen{screensGranted === 1 ? '' : 's'}
      </Tag>
    </div>

    {tab === 'configure' && (
      <div className="perm-toolbar-row">
        <Input
          allowClear
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search screens or rights…"
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          className="perm-search"
        />
        <Select
          value={filter}
          onChange={onFilter}
          options={SHOW_FILTERS}
          className="perm-filter"
          popupMatchSelectWidth={false}
        />
        <Space size={8} wrap>
          <Dropdown
            menu={{
              items: roles.length
                ? roles.map((r) => ({ key: String(r.id), label: r.name }))
                : [{ key: 'none', label: 'No other roles yet', disabled: true }],
              onClick: ({ key }) => onCopyFrom(key),
            }}
          >
            <Button size={compact ? 'small' : 'middle'}>
              Copy from <DownOutlined />
            </Button>
          </Dropdown>
          <Dropdown
            menu={{
              items: [
                { key: 'viewAll', label: 'Grant View on every screen' },
                { key: 'clear', label: 'Clear all rights', danger: true },
              ],
              onClick: ({ key }) => onPreset(key),
            }}
          >
            <Button size={compact ? 'small' : 'middle'}>
              Preset <DownOutlined />
            </Button>
          </Dropdown>
        </Space>
      </div>
    )}
  </div>
);

export default MatrixToolbar;
