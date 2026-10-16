import { useState } from 'react';
import { Alert, App, Space, Table, Tag } from 'antd';
import PermissionGuard from '../../../components/PermissionGuard';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { toastUnlessHandled } from '../../../utils/apiError';
import {
  createLine, createSection, deleteLine, deleteSection, updateLine, updateSection,
} from '../../../services/asset/assetService';
import AssetLocationDrawer from './AssetLocationDrawer';
import AssetLineList from './AssetLineList';

/**
 * Sections and the lines inside them - the only two location levels this
 * module owns. Unit and Department are HR's masters, shared on purpose.
 */
const AssetLocationTab = ({ lookups }) => {
  const { message, modal } = App.useApp();
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

  /** Sections and lines delete the same way; the server decides what is allowed. */
  const remove = (kind, row) => modal.confirm({
    title: `Delete ${row.name}?`,
    content: kind === 'section'
      ? 'The section is removed. Its lines must be gone first.'
      : 'The line is removed. This cannot be undone.',
    okText: 'Delete',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await (kind === 'section' ? deleteSection(row.id) : deleteLine(row.id));
        message.success(`${row.name} deleted`);
        lookups.reload();
      } catch (e) {
        toastUnlessHandled(message, e, 'Could not delete it');
      }
    },
  });

  const columns = [
    // Only Department is left flexible. With every column unsized and
    // scroll.x 'max-content', Name absorbed all the slack and its header sat
    // centred half a screen from the name under it.
    { title: 'Section', dataIndex: 'name', width: 260, render: (v) => <strong>{v}</strong> },
    { title: 'Department', dataIndex: 'departmentName' },
    {
      title: 'Lines',
      key: 'lines',
      width: 90,
      align: 'center',
      render: (_, row) => (row.lines?.length
        ? row.lines.length
        : <span style={{ opacity: 0.4 }}>&mdash;</span>),
    },
    {
      title: 'Active',
      dataIndex: 'active',
      width: 110,
      align: 'center',
      // Inactive is a state, not an error: a red tag made every switched-off
      // row look like something had gone wrong.
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
            <ActionButton
              action="delete"
              size="small"
              aria-label={`Delete ${row.name}`}
              onClick={() => remove('section', row)}
            />
          </Space>
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
        size="middle"
        pagination={false}
        className="asset-setup-table"
        scroll={{ x: 760 }}
        expandable={{
          rowExpandable: (row) => (row.lines?.length ?? 0) > 0,
          expandedRowRender: (row) => (
            <AssetLineList
              section={row}
              onEdit={(line) => setDrawer({ kind: 'line', record: line })}
              onDelete={(line) => remove('line', line)}
            />
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
