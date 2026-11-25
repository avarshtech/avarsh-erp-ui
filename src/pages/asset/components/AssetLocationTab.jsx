import { useState } from 'react';
import { Alert, App, Space, Table, Tag } from 'antd';
import PermissionGuard from '../../../components/PermissionGuard';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { toastUnlessHandled } from '../../../utils/apiError';
import { createLine, deleteLine, updateLine } from '../../../services/asset/assetService';
import AssetLocationDrawer from './AssetLocationDrawer';
import AssetLineList from './AssetLineList';

/**
 * The lines inside each floor - the only location level this module owns.
 *
 * Unit, department and floor are all HR's masters, shared on purpose: an asset's
 * floor is the same record HR files its people against, so "machines on B1's 1st
 * floor" and "people on B1's 1st floor" cannot drift apart. The floors are listed
 * here to hang the lines off, and are added and renamed under HR Masters.
 */
const AssetLocationTab = ({ lookups }) => {
  const { message, modal } = App.useApp();
  const [drawer, setDrawer] = useState(null);

  const save = async (values) => {
    const { record } = drawer;
    try {
      if (record?.id) await updateLine(record.id, { ...values, version: record.version });
      else await createLine(values);
      message.success(record?.id ? 'Saved' : 'Added');
      setDrawer(null);
      lookups.reload();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not save');
      throw e;
    }
  };

  const remove = (row) => modal.confirm({
    title: `Delete ${row.name}?`,
    content: 'The line is removed. This cannot be undone.',
    okText: 'Delete',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await deleteLine(row.id);
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
    { title: 'Floor', dataIndex: 'name', width: 220, render: (v) => <strong>{v}</strong> },
    { title: 'Department', dataIndex: 'departmentName' },
    { title: 'Unit', dataIndex: 'unitName', width: 160 },
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
      width: 110,
      align: 'right',
      render: (_, row) => (
        <PermissionGuard module="asset-setup" operation="add">
          <ActionButton
            action="create"
            size="small"
            tooltip="Add line"
            aria-label={`Add a line on ${row.name}`}
            onClick={() => setDrawer({ record: { floorId: row.id } })}
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
        title="Units, departments and floors come from HR"
        description="An asset's floor is the same record HR uses for its employees, so the machines and the people on B1's 1st floor can never disagree. Add and rename them under HR Masters; the lines on each floor are added here."
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={lookups.floors}
        loading={lookups.loading}
        rowKey="id"
        size="middle"
        pagination={false}
        className="asset-setup-table"
        scroll={{ x: 860 }}
        expandable={{
          rowExpandable: (row) => (row.lines?.length ?? 0) > 0,
          expandedRowRender: (row) => (
            <AssetLineList
              floor={row}
              onEdit={(line) => setDrawer({ record: line })}
              onDelete={(line) => remove(line)}
            />
          ),
        }}
        locale={{
          emptyText: (
            <EmptyState
              title="No floors yet"
              description="Floors are added under HR Masters, under the department they belong to. An asset only needs a unit and a department until then."
            />
          ),
        }}
      />

      <AssetLocationDrawer
        drawer={drawer}
        floorOptions={lookups.floors.map((f) => ({
          value: f.id,
          label: f.departmentName ? `${f.departmentName} / ${f.name}` : f.name,
        }))}
        onClose={() => setDrawer(null)}
        onSave={save}
      />
    </>
  );
};

export default AssetLocationTab;
