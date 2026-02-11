import React, { useEffect, useCallback } from 'react';
import { Tabs, Spin, message } from 'antd';
import { DatabaseOutlined, AppstoreOutlined, TagsOutlined, ExperimentOutlined, GoldOutlined, SkinOutlined, TeamOutlined, FileProtectOutlined } from '@ant-design/icons';
import CategoryMaster from './CategoryMaster';
import SubCategoryMaster from './SubCategoryMaster';
import ItemTypeMaster from './ItemTypeMaster';
import VariantMaster from './VariantMaster';
import UomMaster from './UomMaster';
import ItemMaster from './ItemMaster';
import SupplierMaster from './SupplierMaster';
import TermsConditionsMaster from './TermsConditionsMaster';
import { useStore } from '../../context/StoreContext';
import { useTheme } from '../../context/ThemeContext';
import {
  getAllCategories,
  getAllSubCategories,
  getAllItemTypes,
  getAllAttributes,
  getAllUOMs,
} from '../../services/masterDataService';

const MasterDashboard = () => {
  const { isDarkMode } = useTheme();
  const { 
    categories, subCategories, itemTypes, attributes, uoms,
    setData, setLoading, loading, isCacheValid 
  } = useStore();

  // Fetch all metadata when component mounts
  const fetchAllMetaData = useCallback(async () => {
    const fetchPromises = [];

    // Fetch categories
    if (!isCacheValid('categories') || categories.length === 0) {
      setLoading('categories', true);
      fetchPromises.push(
        getAllCategories()
          .then(({ data }) => {
            setData('categories', data);
            console.debug('MasterDashboard: categories fetched, count=', data?.length);
          })
          .catch(error => {
            console.error('Failed to fetch categories:', error);
            message.error('Failed to load categories');
          })
          .finally(() => setLoading('categories', false))
      );
    }

    // Fetch sub-categories
    if (!isCacheValid('subCategories') || subCategories.length === 0) {
      setLoading('subCategories', true);
      fetchPromises.push(
        getAllSubCategories()
          .then(({ data }) => {
            setData('subCategories', data);
            console.debug('MasterDashboard: subCategories fetched, count=', data?.length);
          })
          .catch(error => {
            console.error('Failed to fetch sub-categories:', error);
            message.error('Failed to load sub-categories');
          })
          .finally(() => setLoading('subCategories', false))
      );
    }

    // Fetch item types
    if (!isCacheValid('itemTypes') || itemTypes.length === 0) {
      setLoading('itemTypes', true);
      fetchPromises.push(
        getAllItemTypes()
          .then(({ data }) => {
            setData('itemTypes', data);
            console.debug('MasterDashboard: itemTypes fetched, count=', data?.length);
          })
          .catch(error => {
            console.error('Failed to fetch item types:', error);
            message.error('Failed to load item types');
          })
          .finally(() => setLoading('itemTypes', false))
      );
    }

    // Fetch attributes
    if (!isCacheValid('attributes') || attributes.length === 0) {
      setLoading('attributes', true);
      fetchPromises.push(
        getAllAttributes()
          .then(({ data }) => {
            setData('attributes', data);
            console.debug('MasterDashboard: attributes fetched, count=', data?.length);
          })
          .catch(error => {
            console.error('Failed to fetch attributes:', error);
            message.error('Failed to load attributes');
          })
          .finally(() => setLoading('attributes', false))
      );
    }

    // Fetch UOMs
    if (!isCacheValid('uoms') || uoms.length === 0) {
      setLoading('uoms', true);
      fetchPromises.push(
        getAllUOMs()
          .then(({ data }) => {
            setData('uoms', data);
            console.debug('MasterDashboard: uoms fetched, count=', data?.length);
          })
          .catch(error => {
            console.error('Failed to fetch UOMs:', error);
            message.error('Failed to load UOMs');
          })
          .finally(() => setLoading('uoms', false))
      );
    }

    // Wait for all fetches to complete (use allSettled so one failing request
    // doesn't short-circuit other metadata fetches)
    if (fetchPromises.length > 0) {
      const results = await Promise.allSettled(fetchPromises);
      console.debug('MasterDashboard: fetchAllMetaData results', results);
    }
  }, [categories, subCategories, itemTypes, attributes, uoms, isCacheValid, setData, setLoading]);

  useEffect(() => {
    fetchAllMetaData();
  }, []);

  const items = [
    {
      key: 'supplier',
      label: <span><TeamOutlined /> Suppliers</span>,
      children: <SupplierMaster />,
    },
    {
      key: 'item',
      label: <span><SkinOutlined /> Items</span>,
      children: <ItemMaster />,
    },
    {
      key: 'category',
      label: <span><AppstoreOutlined /> Categories</span>,
      children: loading.categories ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" tip="Loading categories..." />
        </div>
      ) : <CategoryMaster />,
    },
    {
      key: 'subcategory',
      label: <span><TagsOutlined /> Sub Categories</span>,
      children: loading.subCategories ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" tip="Loading sub-categories..." />
        </div>
      ) : <SubCategoryMaster />,
    },
    {
      key: 'type',
      label: <span><ExperimentOutlined /> Item Types</span>,
      children: loading.itemTypes ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" tip="Loading item types..." />
        </div>
      ) : <ItemTypeMaster />,
    },
    {
      key: 'uom',
      label: <span><DatabaseOutlined /> UOM</span>,
      children: loading.uoms ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" tip="Loading UOMs..." />
        </div>
      ) : <UomMaster />,
    },
    {
      key: 'variant',
      label: <span><GoldOutlined /> Attributes</span>,
      children: loading.attributes ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" tip="Loading attributes..." />
        </div>
      ) : <VariantMaster />,
    },
    {
      key: 'terms',
      label: <span><FileProtectOutlined /> Terms & Conditions</span>,
      children: <TermsConditionsMaster />,
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 0 }}>Master Data Management</h1>
        <p style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 4 }}>Manage suppliers, inventory items, categories, and configurations</p>
      </div>
      
      <Tabs 
        defaultActiveKey="supplier" 
        items={items} 
        size="large"
        tabBarStyle={{ 
          marginBottom: 24, 
          background: isDarkMode ? '#1e293b' : '#fff', 
          padding: '0 16px', 
          borderRadius: '8px',
          border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
        }}
      />
    </div>
  );
};

export default MasterDashboard;
