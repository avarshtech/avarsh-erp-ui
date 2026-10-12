import { useState } from 'react';
import { Alert, App, Space, Table, Tag } from 'antd';
import PermissionGuard from '../../../components/PermissionGuard';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { toastUnlessHandled } from '../../../utils/apiError';
import {
  createLine, createSection, updateLine, updateSection,
} from '../../../services/asset/assetService';
import AssetLocationDrawer from './AssetLocationDrawer';

/**
 * Sections and the lines inside them - the only two location levels this
 * module owns. Unit and Department are HR's masters, shared on purpose.
 */
const AssetLocationTab = ({ lookups }) => {
  const { message } = App.useApp();
  const [drawer, setDrawer] = useState(null);

  const save = async (values) => {
    const { kind, record } = drawer;
    try {
      if (kind === 'section') {
        if (record?.id) await updateSection(record.id, { ...values, version: record.version });
        else await createSection(values);
      } else if (record?.id) await updateLine(record.id, { ...values, version: record.version });
      else await createLine(values);
      message.success(record?.id ? 'Saved' : 'Added');
      setDrawer(null);
      lookups.reload();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not save');
      throw e;
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', width: 110 },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Department', dataIndex: 'departmentName', width: 180 },
    { title: 'Lines', key: 'lines', width: 90, render: (_, row) => row.lines?.length ?? 0 },
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
            <ActionButton
              action="edit"
              size="small"
              aria-label={`Edit ${row.name}`}
              onClick={() => setDrawer({ kind: 'section', record: row })}
            />
            <ActionButton
              action="create"
              size="small"
              tooltip="Add line"
              aria-label={`Add a line in ${row.name}`}
              onClick={() => setDrawer({ kind: 'line', record: { sectionId: row.id } })}
            />
          </Space>
        </PermissionGuard>
      ),
    },
  ];

  const lineColumns = [
    { title: 'Code', dataIndex: 'code', width: 110 },
    { title: 'Name', dataIndex: 'name' },
    {
      title: 'Active',
      dataIndex: 'active',
      width: 90,
      render: (value) => (value ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 90,
      render: (_, row) => (
        <PermissionGuard module="asset-setup" operation="update">
          <ActionButton
            action="edit"
            size="small"
            aria-label={`Edit ${row.name}`}
            onClick={() => setDrawer({ kind: 'line', record: row })}
          />
        </PermissionGuard>
      ),
    },
  ];

  return (
    <>
      <Alert
        type="info"
        showIcon
        title="Units and departments come from HR"
        description="An asset's department is the same record HR uses for its employees, so assets and people in Sewing can never disagree. Add them under HR Masters."
        style={{ marginBottom: 16 }}
      />

      <PermissionGuard module="asset-setup" operation="add">
        <ActionButton
          action="create"
          text="Add Section"
          onClick={() => setDrawer({ kind: 'section', record: null })}
          style={{ marginBottom: 16 }}
        />
      </PermissionGuard>

      <Table
        columns={columns}
        dataSource={lookups.sections}
        loading={lookups.loading}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        expandable={{
          rowExpandable: (row) => (row.lines?.length ?? 0) > 0,
          expandedRowRender: (row) => (
            <Table columns={lineColumns} dataSource={row.lines} rowKey="id" size="small" pagination={false} />
          ),
        }}
        locale={{
          emptyText: (
            <EmptyState
              title="No sections yet"
              description="Sections and lines are optional - an asset only needs a unit and a department."
            />
          ),
        }}
      />

      <AssetLocationDrawer
        drawer={drawer}
        departmentOptions={lookups.departmentsOf()}
        sectionOptions={lookups.sections.map((s) => ({ value: s.id, label: s.name }))}
        onClose={() => setDrawer(null)}
        onSave={save}
      />
    </>
  );
};

export default AssetLocationTab;
