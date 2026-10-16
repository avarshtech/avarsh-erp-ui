import { useState } from 'react';
import { App, Space, Table, Tag } from 'antd';
import PermissionGuard from '../../../components/PermissionGuard';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { toastUnlessHandled } from '../../../utils/apiError';
import { createCategory, deleteCategory, updateCategory } from '../../../services/asset/assetService';
import AssetCategoryDrawer from './AssetCategoryDrawer';

/**
 * The category tree. Sub-categories are expandable rows, not a second table,
 * because what matters is which category a sub-category belongs to.
 */
const AssetCategoryTab = ({ lookups }) => {
  const { message, modal } = App.useApp();
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

  /**
   * The server refuses a category anything depends on and says to switch it off
   * instead, so there is nothing to check here - just ask, then report.
   */
  const remove = (row) => modal.confirm({
    title: `Delete ${row.name}?`,
    content: row.parentId
      ? 'The sub-category is removed. Assets already filed under it keep it.'
      : 'The category is removed. This cannot be undone.',
    okText: 'Delete',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await deleteCategory(row.id);
        message.success(`${row.name} deleted`);
        lookups.reload();
      } catch (e) {
        toastUnlessHandled(message, e, 'Could not delete the category');
      }
    },
  });

  const columns = [
    // Name is the only flexible column; the rest are sized, so no header drifts
    // away from the value beneath it the way it did under scroll.x 'max-content'.
    {
      title: 'Category',
      dataIndex: 'name',
      render: (v, row) => (row.parentId ? v : <strong>{v}</strong>),
    },
    {
      title: 'Issuable',
      dataIndex: 'assignable',
      width: 110,
      // Only an issuable category can be handed to a person - a laptop can, a
      // compressor bolted to the floor cannot.
      align: 'center',
      render: (value) => (value ? <Tag color="blue">Yes</Tag> : <span style={{ opacity: 0.4 }}>&mdash;</span>),
    },
    {
      title: 'Service every',
      dataIndex: 'maintIntervalDays',
      width: 130,
      align: 'center',
      render: (value) => (value ? `${value} days` : <span style={{ opacity: 0.4 }}>&mdash;</span>),
    },
    {
      title: 'Extra fields',
      dataIndex: 'fieldDefs',
      width: 120,
      align: 'center',
      render: (value) => {
        let count = 0;
        try { count = JSON.parse(value || '[]').length; } catch { count = 0; }
        return count || <span style={{ opacity: 0.4 }}>&mdash;</span>;
      },
    },
    {
      title: 'Active',
      dataIndex: 'active',
      width: 110,
      align: 'center',
      // Inactive is a state, not an error.
      render: (value) => (value ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      align: 'right',
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
            <ActionButton
              action="delete"
              size="small"
              aria-label={`Delete ${row.name}`}
              onClick={() => remove(row)}
            />
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
        size="middle"
        pagination={false}
        className="asset-setup-table"
        scroll={{ x: 860 }}
        expandable={{
          rowExpandable: (row) => (row.subCategories?.length ?? 0) > 0,
          // Sub-categories hold the same fields as their parent, so they reuse
          // its columns and stay in the same tracks. The header is not repeated
          // and the block is indented, so they read as the inside of the row
          // above rather than as a second table.
          expandedRowRender: (row) => (
            <div className="asset-subtable">
              <div className="asset-sublist-head">
                {row.subCategories.length} sub-categor
                {row.subCategories.length === 1 ? 'y' : 'ies'} under {row.name}
              </div>
              <Table
                columns={columns}
                dataSource={row.subCategories}
                rowKey="id"
                size="small"
                pagination={false}
                showHeader={false}
              />
            </div>
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
