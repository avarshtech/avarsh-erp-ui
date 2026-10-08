import { useMemo, useState } from 'react';
import {
  Card, Empty, Input, Space, Tag, Typography, theme,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTheme } from '../../../context/ThemeContext';
import { RAIL_KEY } from './registerModel';

const { Text } = Typography;

/**
 * The selected row's background — the pair MasterSplitView uses. Dark mode is hand-set
 * tokens with no dark algorithm, so antd's derived colorPrimaryBg stays a light tint
 * there and turns the selected row white under white text.
 */
const SELECTED_BG = { light: '#e6f7ff', dark: '#312e81' };

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** What a buyer has, in words rather than PL / INV codes. */
const Counts = ({ counts }) => {
  const parts = [
    counts.pl > 0 && plural(counts.pl, 'packing list', 'packing lists'),
    counts.inv > 0 && plural(counts.inv, 'invoice', 'invoices'),
    counts.stk > 0 && plural(counts.stk, 'sticker', 'stickers'),
  ].filter(Boolean);
  return (
    <Space size={6} wrap>
      {parts.length > 0 && <Text type="secondary" style={{ fontSize: 12 }}>{parts.join(' · ')}</Text>}
      {counts.drafts > 0 && (
        <Tag color="gold" style={{ marginInlineEnd: 0 }}>{plural(counts.drafts, 'draft', 'drafts')}</Tag>
      )}
    </Space>
  );
};

const RailItem = ({ group, selected, selectedStyle, onSelect }) => (
  <div
    role="button"
    tabIndex={0}
    aria-pressed={selected}
    aria-label={`${group.title} templates`}
    onClick={() => onSelect(group.key)}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(group.key); } }}
    style={{
      padding: '8px 10px',
      borderRadius: 6,
      cursor: 'pointer',
      marginBottom: 4,
      borderLeft: '3px solid transparent',
      ...(selected ? selectedStyle : null),
    }}
  >
    <Text strong={selected} ellipsis style={{ display: 'block' }} type={group.inactive ? 'secondary' : undefined}>
      {group.title}
    </Text>
    {group.counts.total > 0 ? <Counts counts={group.counts} /> : (
      <Text type="secondary" style={{ fontSize: 12 }}>{group.standard ? 'Built-in layouts' : 'No templates yet'}</Text>
    )}
  </div>
);

/**
 * The buyer list down the left of the register: the built-in layouts, then only the
 * buyers that have templates. A template for a new buyer starts from the page header's
 * "New buyer template", so buyers with nothing yet do not crowd the list.
 */
const TemplateBuyerRail = ({ groups, selectedKey, onSelect }) => {
  const [search, setSearch] = useState('');
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const selectedStyle = useMemo(() => ({
    background: isDarkMode ? SELECTED_BG.dark : SELECTED_BG.light,
    borderLeftColor: token.colorPrimary,
  }), [isDarkMode, token.colorPrimary]);
  const item = (g) => (
    <RailItem key={g.key} group={g} selected={g.key === selectedKey} selectedStyle={selectedStyle} onSelect={onSelect} />
  );

  const { pinned, withTemplates } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (g) => !q || String(g.title).toLowerCase().includes(q);
    const special = groups.filter((g) => g.key === RAIL_KEY.STANDARD);
    return {
      pinned: special.filter(match),
      withTemplates: groups
        .filter((g) => !special.includes(g) && g.counts.total > 0 && match(g))
        .sort((a, b) => String(a.title).localeCompare(String(b.title))),
    };
  }, [groups, search]);

  return (
    <Card size="small" styles={{ body: { padding: 8 } }}>
      <Input
        name="templateBuyerSearch" allowClear prefix={<SearchOutlined />} placeholder="Search buyers"
        value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 8 }}
      />
      {pinned.map(item)}
      <Text type="secondary" style={{ display: 'block', fontSize: 11, margin: '8px 4px 4px', textTransform: 'uppercase' }}>
        Buyers with templates
      </Text>
      {withTemplates.length ? withTemplates.map(item) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={search.trim() ? 'No buyer with templates matches' : 'None yet — use “New buyer template” above'}
        />
      )}
    </Card>
  );
};

export default TemplateBuyerRail;
