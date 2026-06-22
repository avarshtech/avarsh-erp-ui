import { Dropdown, Button } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';

/**
 * Small icon-trigger dropdown listing recently created records, meant to sit in an
 * Input's `suffix` slot. Renders nothing when there are no items, so it never disturbs
 * the existing input layout while the list is empty/loading.
 */
const RecentSuggestionsButton = ({ items = [], onSelect, disabled = false, placement = 'bottomLeft' }) => {
  if (!items.length) return null;

  return (
    <Dropdown
      menu={{
        items: items.map((item) => ({ key: item.value, label: item.label })),
        onClick: ({ key }) => onSelect(key),
      }}
      trigger={['click']}
      disabled={disabled}
      placement={placement}
    >
      <Button
        type="text"
        size="small"
        icon={<HistoryOutlined />}
        title="Recently created"
        onClick={(e) => e.preventDefault()}
      />
    </Dropdown>
  );
};

export default RecentSuggestionsButton;
