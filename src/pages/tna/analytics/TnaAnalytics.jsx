import { useEffect, useState } from 'react';
import { App, Card, Skeleton, Tabs } from 'antd';
import PageHeader from '../../../components/PageHeader';
import { getAnalytics } from '../../../services/tna/tnaService';
import AnalyticsPerformance from './AnalyticsPerformance';
import AnalyticsDelay from './AnalyticsDelay';
import AnalyticsGovernance from './AnalyticsGovernance';

/** §15 — TNA analytics: performance, delay attribution, governance. */
const TnaAnalytics = () => {
  const { message } = App.useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    getAnalytics().then(setData).catch(() => message.error('Failed to load TNA analytics'));
  }, [message]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="TNA Analytics"
        subtitle="On-time performance, delay attribution and the reports that keep the templates honest"
      />
      {!data ? <Card><Skeleton active paragraph={{ rows: 8 }} /></Card> : (
        <Tabs
          items={[
            { key: 'performance', label: 'Performance', children: <AnalyticsPerformance data={data} /> },
            { key: 'delay', label: 'Delay Analysis', children: <AnalyticsDelay data={data} /> },
            { key: 'governance', label: 'Governance', children: <AnalyticsGovernance data={data} /> },
          ]}
        />
      )}
    </div>
  );
};

export default TnaAnalytics;
