import { useEffect, useState } from 'react';
import {
  App, Button, Card, Tabs,
} from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { getMeta, resyncAll } from '../../../services/tna/tnaService';
import { hasPermission } from '../../../utils/permissions';
import AsOfNote from '../components/AsOfNote';
import TemplatesTab from './TemplatesTab';
import CalendarTab from './CalendarTab';
import ThresholdsTab from './ThresholdsTab';

const TABS = [
  { key: 'templates', label: 'Buyer templates', children: <TemplatesTab /> },
  { key: 'calendar', label: 'Working calendar', children: <CalendarTab /> },
  { key: 'thresholds', label: 'Thresholds & rules', children: <ThresholdsTab /> },
];

/**
 * WF-09 — the masters behind every plan: a template per buyer decides which milestones apply and how
 * long each is planned to take; every date still comes from the order's own source records.
 */
const TnaMastersPage = () => {
  const { message } = App.useApp();
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState(null);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => { getMeta().then(setMeta).catch(() => {}); }, []);

  const resync = async () => {
    setSyncing(true);
    try {
      const { result } = await resyncAll();
      message.success(`Every order re-read from its source records — ${result}`);
    } catch (e) {
      message.error(e?.response?.data?.message || 'The re-sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="T&A masters"
        subtitle="Buyer templates, working calendar and thresholds — versioned; a plan keeps the template version it was generated with"
        extra={(
          <>
            <AsOfNote asOf={meta?.asOf} />
            {hasPermission('tna-masters', 'update') && (
              <Button icon={<SyncOutlined />} loading={syncing} onClick={resync}>Re-sync all orders</Button>
            )}
          </>
        )}
      />
      <Card size="small">
        <Tabs activeKey={params.get('tab') || 'templates'} onChange={(k) => setParams({ tab: k })} items={TABS} destroyOnHidden />
      </Card>
    </div>
  );
};

export default TnaMastersPage;
