import { useState } from 'react';
import { Badge, Button, Drawer, Tabs } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { attentionCount } from '../engine/attention';
import AttentionList from './AttentionList';
import DocumentRail from './DocumentRail';
import EventTicker from './EventTicker';
import HealthCard from './HealthCard';

/** On phones and tablets the floor keeps the screen; the panels open from a button into a bottom drawer. */
export default function MobilePanels({ view, events, focus, onRules }) {
  const [open, setOpen] = useState(false);
  if (!view.insights) return null;
  const pick = (fn) => (arg) => {
    setOpen(false);
    fn(arg);
  };
  const items = [
    { key: 'health', label: 'Health', children: <HealthCard health={view.insights.health} onRules={pick(onRules)} /> },
    { key: 'attention', label: 'Attention', children: <AttentionList items={view.insights.attention} onPick={pick((item) => focus.focus(item.target))} /> },
    { key: 'orders', label: 'Orders', children: <DocumentRail snapshot={view.snapshot} followed={focus.followed} selection={focus.selection} onFollow={pick(focus.follow)} onSelect={pick(focus.focus)} /> },
    { key: 'events', label: 'Events', children: <EventTicker events={events} onPick={pick((e) => focus.focus(e.ref || { type: 'zone', id: e.zone }))} /> },
  ];
  return (
    <>
      <div className="vf-mobile-toggle">
        <Badge count={attentionCount(view.insights.attention)} size="small">
          <Button type="primary" icon={<AppstoreOutlined />} onClick={() => setOpen(true)}>Panels</Button>
        </Badge>
      </div>
      <Drawer title="Factory panels" placement="bottom" size={520} open={open} onClose={() => setOpen(false)}>
        <Tabs items={items} />
      </Drawer>
    </>
  );
}
