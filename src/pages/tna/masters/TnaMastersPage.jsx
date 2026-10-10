import { useEffect, useState } from 'react';
import { Card, Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { getMeta } from '../../../services/tna/tnaService';
import MockDataNote from '../components/MockDataNote';
import ActivityMasterTab from './ActivityMasterTab';
import DurationOverridesTab from './DurationOverridesTab';
import CalendarTab from './CalendarTab';
import ThresholdsTab from './ThresholdsTab';

const TABS = [
  { key: 'activities', label: 'Activity master', children: <ActivityMasterTab /> },
  { key: 'durations', label: 'Lead-time precedence', children: <DurationOverridesTab /> },
  { key: 'calendar', label: 'Working calendar', children: <CalendarTab /> },
  { key: 'thresholds', label: 'Thresholds & rules', children: <ThresholdsTab /> },
];

/**
 * WF-09 — the governed masters behind every derived plan. There are no templates: the activity
 * set is derived per order from its own source records (FR-2.1).
 */
const TnaMastersPage = () => {
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState(null);
  useEffect(() => { getMeta().then(setMeta).catch(() => {}); }, []);
  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="T&A masters"
        subtitle="Activity definitions and source-event mapping, durations, calendar and thresholds — versioned"
        extra={<MockDataNote asOf={meta?.asOf} />}
      />
      <Card size="small">
        <Tabs activeKey={params.get('tab') || 'activities'} onChange={(k) => setParams({ tab: k })} items={TABS} destroyOnHidden />
      </Card>
    </div>
  );
};

export default TnaMastersPage;
