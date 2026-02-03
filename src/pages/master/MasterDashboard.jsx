import React from 'react';
import { Tabs } from 'antd';
import { DatabaseOutlined, AppstoreOutlined, TagsOutlined, ExperimentOutlined, GoldOutlined, SkinOutlined } from '@ant-design/icons';
import CategoryMaster from './CategoryMaster';
import SubCategoryMaster from './SubCategoryMaster';
import ItemTypeMaster from './ItemTypeMaster';
import VariantMaster from './VariantMaster';
import UomMaster from './UomMaster';
import ItemMaster from './ItemMaster';

const MasterDashboard = () => {
  const items = [
    {
      key: 'item',
      label: <span><SkinOutlined /> Items</span>,
      children: <ItemMaster />,
    },
    {
      key: 'category',
      label: <span><AppstoreOutlined /> Categories</span>,
      children: <CategoryMaster />,
    },
    {
      key: 'subcategory',
      label: <span><TagsOutlined /> Sub Categories</span>,
      children: <SubCategoryMaster />,
    },
    {
      key: 'type',
      label: <span><ExperimentOutlined /> Item Types</span>,
      children: <ItemTypeMaster />,
    },
    {
      key: 'uom',
      label: <span><DatabaseOutlined /> UOM</span>,
      children: <UomMaster />,
    },
    {
      key: 'variant',
      label: <span><GoldOutlined /> Variants</span>,
      children: <VariantMaster />,
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 0 }}>Master Data Management</h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>Manage inventory items, categories, and configurations</p>
      </div>
      
      <Tabs 
        defaultActiveKey="item" 
        items={items} 
        size="large"
        tabBarStyle={{ marginBottom: 24, background: '#fff', padding: '0 16px', borderRadius: '8px' }}
      />
    </div>
  );
};

export default MasterDashboard;
