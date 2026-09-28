import { useMemo, useState } from 'react';
import {
  Badge, Button, Card, Empty, Input, Space, Tag, Typography,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { RAIL_KEY } from './registerModel';

const { Text } = Typography;

const Counts = ({ counts }) => (
  <Space size={4} wrap>
    {counts.pl > 0 && <Tag color="blue" style={{ marginInlineEnd: 0 }}>{`PL ${counts.pl}`}</Tag>}
    {counts.inv > 0 && <Tag color="purple" style={{ marginInlineEnd: 0 }}>{`INV ${counts.inv}`}</Tag>}
    {counts.stk > 0 && <Tag style={{ marginInlineEnd: 0 }}>{`STK ${counts.stk}`}</Tag>}
    {counts.drafts > 0 && <Tag color="gold" style={{ marginInlineEnd: 0 }}>{`${counts.drafts} draft`}</Tag>}
  </Space>
);

const RailItem = ({ group, selected, onSelect }) => (
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
      background: selected ? 'var(--ant-color-primary-bg, #e6f4ff)' : undefined,
      borderLeft: `3px solid ${selected ? 'var(--ant-color-primary, #1677ff)' : 'transparent'}`,
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
 * The buyer list down the left of the register. Buyers with templates come first; the
 * rest are one click away, because "which buyers have nothing yet?" is the question an
 * export team asks before a new shipment.
 */
const TemplateBuyerRail = ({ groups, selectedKey, onSelect }) => {
  const [search, setSearch] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);

  const { pinned, withTemplates, without } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (g) => !q || String(g.title).toLowerCase().includes(q);
    const special = groups.filter((g) => g.key === RAIL_KEY.STANDARD || g.key === RAIL_KEY.DEMO_STICKERS);
    const buyers = groups.filter((g) => !special.includes(g) && match(g))
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));
    return {
      pinned: special.filter(match),
      withTemplates: buyers.filter((g) => g.counts.total > 0),
      without: buyers.filter((g) => g.counts.total === 0 && !g.inactive),
    };
  }, [groups, search]);

  return (
    <Card size="small" styles={{ body: { padding: 8 } }}>
      <Input
        name="templateBuyerSearch" allowClear prefix={<SearchOutlined />} placeholder="Search buyers"
        value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 8 }}
      />
      {pinned.map((g) => <RailItem key={g.key} group={g} selected={g.key === selectedKey} onSelect={onSelect} />)}
      <Text type="secondary" style={{ display: 'block', fontSize: 11, margin: '8px 4px 4px', textTransform: 'uppercase' }}>
        Buyers with templates
      </Text>
      {withTemplates.length
        ? withTemplates.map((g) => <RailItem key={g.key} group={g} selected={g.key === selectedKey} onSelect={onSelect} />)
        : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="None yet" />}
      {without.length > 0 && (
        <>
          <Button type="link" size="small" onClick={() => setShowEmpty((v) => !v)} style={{ paddingInline: 4 }}>
            <Badge count={without.length} color="gray" size="small" offset={[10, -2]}>
              {showEmpty ? 'Hide buyers without templates' : 'Buyers without templates'}
            </Badge>
          </Button>
          {showEmpty && without.map((g) => <RailItem key={g.key} group={g} selected={g.key === selectedKey} onSelect={onSelect} />)}
        </>
      )}
    </Card>
  );
};

export default TemplateBuyerRail;
