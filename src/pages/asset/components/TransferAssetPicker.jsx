import { useCallback, useEffect, useState } from 'react';
import { App, Alert, Button, Select, Space, Table, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import EmptyState from '../../../components/EmptyState';
import { getAssets } from '../../../services/asset/assetService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { statusMeta } from '../../../utils/assetConstants';

/**
 * Picks the assets for one transfer.
 *
 * <p>Two rules it enforces as you go, so the server never has to refuse the
 * whole request over one bad row:</p>
 *
 * <ul>
 *   <li>Everything leaves the same unit. The first asset settles it and the
 *       search narrows to that unit afterwards - the challan has to be able to
 *       say where the load came from.</li>
 *   <li>Only Active, Available and Idle machines can go. One under repair is
 *       somewhere a fitter put it, and moving it on paper would send the next
 *       person looking in the wrong building.</li>
 * </ul>
 */

const MOVABLE = ['ACTIVE', 'AVAILABLE', 'IDLE'];

const TransferAssetPicker = ({ value = [], onChange, lockedUnitId, lookups }) => {
  const { message } = App.useApp();
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (term) => {
    setSearching(true);
    try {
      const page = await getAssets({
        search: term || undefined,
        unitId: lockedUnitId || undefined,
        excludeDisposed: true,
        size: 30,
      });
      const chosen = new Set(value.map((a) => a.id));
      setOptions((page?.content ?? [])
        .filter((a) => MOVABLE.includes(a.status) && !chosen.has(a.id)));
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not search the register');
    } finally {
      setSearching(false);
    }
  }, [lockedUnitId, value, message]);

  useEffect(() => { search(''); }, [search]);

  const add = (assetId) => {
    const asset = options.find((a) => a.id === assetId);
    if (!asset) return;
    onChange([...value, asset]);
  };

  const remove = (assetId) => onChange(value.filter((a) => a.id !== assetId));

  const columns = [
    { title: 'Asset ID', dataIndex: 'assetId', width: 170 },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Category', dataIndex: 'categoryName', width: 160 },
    {
      title: 'Standing at',
      key: 'where',
      width: 240,
      render: (_, row) => [row.unitName, row.departmentName, row.sectionName, row.lineName]
        .filter(Boolean).join(' / ') || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (v) => <Tag color={statusMeta(v).color}>{statusMeta(v).label}</Tag>,
    },
    {
      title: '',
      key: 'remove',
      width: 60,
      render: (_, row) => (
        <Button type="text" size="small" danger icon={<DeleteOutlined />}
          aria-label={`Remove ${row.assetId}`} onClick={() => remove(row.id)} />
      ),
    },
  ];

  const unitName = value[0]?.unitName;

  return (
    <>
      {lockedUnitId && (
        <Alert
          type="info"
          showIcon
          title={`Everything on this transfer leaves ${unitName ?? 'the same unit'}`}
          description="One request carries one load from one place. Raise a second request for machines in another unit."
          style={{ marginBottom: 16 }}
        />
      )}
      <Space style={{ marginBottom: 16, width: '100%' }}>
        <Select
          showSearch
          placeholder="Search the register by asset ID, name, serial no..."
          style={{ width: 420 }}
          filterOption={false}
          loading={searching}
          onSearch={search}
          onChange={add}
          value={null}
          notFoundContent={searching ? 'Searching...' : 'Nothing movable found'}
          options={options.map((a) => ({
            value: a.id,
            label: `${a.assetId} — ${a.name}${a.serialNo ? ` (${a.serialNo})` : ''}`,
          }))}
        />
        {lookups?.options?.units?.length > 1 && !lockedUnitId && (
          <span style={{ opacity: 0.6, fontSize: 12 }}>The first asset you add fixes the sending unit.</span>
        )}
      </Space>

      <Table
        columns={columns}
        dataSource={value}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: (
            <EmptyState
              title="No assets yet"
              description="Search above and add the machines that are moving. Only Active, Available and Idle ones can go."
            />
          ),
        }}
        footer={() => `${value.length} asset${value.length === 1 ? '' : 's'} on this transfer`}
      />
    </>
  );
};

export default TransferAssetPicker;
