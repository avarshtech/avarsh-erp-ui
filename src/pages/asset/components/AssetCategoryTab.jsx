import { useState } from 'react';
import { App, Space, Table, Tag } from 'antd';
import PermissionGuard from '../../../components/PermissionGuard';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { toastUnlessHandled } from '../../../utils/apiError';
import { createCategory, updateCategory } from '../../../services/asset/assetService';
import AssetCategoryDrawer from './AssetCategoryDrawer';

/**
 * The category tree. Sub-categories are expandable rows, not a second table,
 * because what matters is which category a sub-category belongs to.
 */
const AssetCategoryTab = ({ lookups }) => {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const start = (category, parentId) => {
    setEditing(category ?? { parentId });
    setOpen(true);
  };

  const save = async (values) => {
    try {
      if (editing?.id) await updateCategory(editing.id, { ...values, version: editing.version });
      else await createCategory(values);
      message.success(editing?.id ? 'Category updated' : 'Category added');
      setOpen(false);
      lookups.reload();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not save the category');
      throw e;
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', width: 110 },
    { title: 'Name', dataIndex: 'name' },
    {
      title: 'Issuable',
      dataIndex: 'assignable',
      width: 110,
      // Only an issuable category can be handed to a person - a laptop can, a
      // compressor bolted to the floor cannot.
      render: (value) => (value ? <Tag color="blue">Yes</Tag> : <Tag>No</Tag>),
    },
    {
      title: 'Service every',
      dataIndex: 'maintIntervalDays',
      width: 130,
      render: (value) => (value ? `${value} days` : '-'),
    },
    {
      title: 'Extra fields',
      dataIndex: 'fieldDefs',
      width: 120,
      render: (value) => {
        try { return JSON.parse(value || '[]').length || '-'; } catch { return '-'; }
      },
    },
    {
      title: 'Active',
      dataIndex: 'active',
      width: 90,
      render: (value) => (value ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, row) => (
        <PermissionGuard module="asset-setup" operation="update">
          <Space size={0}>
            <ActionButton action="edit" size="small" aria-label={`Edit ${row.name}`} onClick={() => start(row)} />
            {/* Only a top-level category may gain a sub-category; the server refuses deeper nesting. */}
            {!row.parentId && (
              <ActionButton
                action="create"
                size="small"
                tooltip="Add sub-category"
                aria-label={`Add a sub-category under ${row.name}`}
                onClick={() => start(null, row.id)}
              />
            )}
          </Space>
        </PermissionGuard>
      ),
    },
  ];

  return (
    <>
      <PermissionGuard module="asset-setup" operation="add">
        <ActionButton action="create" text="Add Category" onClick={() => start(null, null)} style={{ marginBottom: 16 }} />
      </PermissionGuard>

      <Table
        columns={columns}
        dataSource={lookups.categories}
        loading={lookups.loading}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        expandable={{
          rowExpandable: (row) => (row.subCategories?.length ?? 0) > 0,
          expandedRowRender: (row) => (
            <Table
              columns={columns}
              dataSource={row.subCategories}
              rowKey="id"
              size="small"
              pagination={false}
              showHeader={false}
            />
          ),
        }}
        locale={{
          emptyText: (
            <EmptyState
              title="No categories yet"
              description="Add one before adding assets - its code becomes the first part of every asset ID under it."
            />
          ),
        }}
      />

      <AssetCategoryDrawer
        open={open}
        category={editing}
        parentOptions={lookups.options.categories}
        onClose={() => setOpen(false)}
        onSave={save}
      />
    </>
  );
};

export default AssetCategoryTab;
