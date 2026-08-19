import { useCallback, useState } from 'react';
import { Card, Tabs } from 'antd';
import PageHeader from '../../../components/PageHeader';
import ActivityMasterTab from './ActivityMasterTab';
import TemplatesTab from './TemplatesTab';
import TemplateBuilder from './TemplateBuilder';

/** §7 — TNA master data: the activity library and the leadtime-proportional templates. */
const TnaMastersPage = () => {
  const [builder, setBuilder] = useState(null); // { template, activities }
  const [refreshKey, setRefreshKey] = useState(0);

  const openBuilder = useCallback((template, activities) => setBuilder({ template, activities }), []);
  const closeBuilder = useCallback(() => setBuilder(null), []);
  const onSaved = useCallback(() => { setBuilder(null); setRefreshKey((k) => k + 1); }, []);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="TNA Masters"
        subtitle="The engine is only as good as these masters — templates are authored once and serve every leadtime"
      />
      <Card size="small" styles={{ body: { paddingTop: 4 } }}>
        <Tabs
          items={[
            { key: 'templates', label: 'Templates', children: <TemplatesTab onEdit={openBuilder} refreshKey={refreshKey} /> },
            { key: 'activities', label: 'Activity Master', children: <ActivityMasterTab /> },
          ]}
        />
      </Card>
      <TemplateBuilder
        open={!!builder}
        template={builder?.template}
        activities={builder?.activities || []}
        onClose={closeBuilder}
        onSaved={onSaved}
      />
    </div>
  );
};

export default TnaMastersPage;
