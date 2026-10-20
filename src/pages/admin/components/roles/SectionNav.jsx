import { Button, Tooltip } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import SectionIcon from './SectionIcon';
import './accessGrid.css';

const countText = (item) => (item.matches != null ? `${item.matches} found` : `${item.granted}/${item.total}`);

const spoken = (item) => [
  item.label,
  item.matches != null ? `${item.matches} found` : `${item.granted} of ${item.total} screens`,
  item.dirty && 'unsaved changes',
].filter(Boolean).join(', ');

/**
 * The editor's sections, in the Master Data workspace's look: a card-coloured panel, the accent
 * bar on the open section, folding to icons. Every item is a button, so the keyboard reaches it —
 * Master Data's own items are click-only, which is not copied here.
 */
const SectionNav = ({ items, activeKey, onSelect, collapsed, onToggle }) => (
  <nav className={`ag-nav${collapsed ? ' is-collapsed' : ''}`} aria-label="Sections">
    <ul className="ag-nav-list">
      {items.map((item) => {
        const active = item.key === activeKey;
        const className = [
          'ag-nav-item',
          active && 'is-active',
          item.granted === 0 && 'is-empty',
          item.matches === 0 && 'is-dimmed',
        ].filter(Boolean).join(' ');
        const button = (
          <button
            type="button"
            className={className}
            aria-current={active ? 'true' : undefined}
            aria-label={spoken(item)}
            onClick={() => onSelect(item.key)}
          >
            <SectionIcon name={item.icon} />
            {!collapsed && <span className="ag-nav-label">{item.label}</span>}
            {!collapsed && <span className="ag-nav-count">{countText(item)}</span>}
            {item.dirty && <span className="ag-nav-dot" aria-hidden="true" />}
          </button>
        );
        return (
          <li key={item.key}>
            {collapsed ? <Tooltip title={spoken(item)} placement="right">{button}</Tooltip> : button}
          </li>
        );
      })}
    </ul>
    <div className="ag-nav-foot">
      <Tooltip title={collapsed ? 'Show section names' : 'Fold to icons'} placement="right">
        <Button
          type="text"
          size="small"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          aria-label={collapsed ? 'Show section names' : 'Fold to icons'}
          onClick={onToggle}
        />
      </Tooltip>
    </div>
  </nav>
);

export default SectionNav;
