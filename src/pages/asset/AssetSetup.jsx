import { useState } from 'react';
import { Card, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import useAssetLookups from '../../hooks/useAssetLookups';
import AssetCategoryTab from './components/AssetCategoryTab';
import AssetLocationTab from './components/AssetLocationTab';

/**
 * Asset Setup - the categories every asset is filed under and the section and
 * line levels of a location.
 *
 * Its own permission key: a category's code becomes part of every asset ID
 * printed under it, so inventing categories is a different job from adding
 * assets. Unit and Department are not here - they are HR's masters, shared on
 * purpose so "assets in Sewing" and "people in Sewing" cannot drift apart.
 */
const AssetSetup = () => {
  const navigate = useNavigate();
  const lookups = useAssetLookups();
  const [tab, setTab] = useState('categories');

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Asset Setup"
        subtitle="Categories and their extra fields, and the sections and lines an asset can sit in"
        onBack={() => navigate('/assets')}
      />
      <Card>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'categories',
              label: 'Categories',
              children: <AssetCategoryTab lookups={lookups} />,
            },
            {
              key: 'locations',
              label: 'Sections & lines',
              children: <AssetLocationTab lookups={lookups} />,
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AssetSetup;
