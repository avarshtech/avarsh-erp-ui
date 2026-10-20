import { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Empty, Table, Typography,
} from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import SearchFilterBar from '../../../../components/SearchFilterBar';
import useDebouncedSearch from '../../../../hooks/useDebouncedSearch';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { hasPermission } from '../../../../utils/permissions';
import { listPullBacks } from '../../../../services/production/jobwork/jobWorkPullBackApi';
import { listFilterOptions } from '../../../../services/production/jobwork/jobWorkTrackerApi';
import { PULLBACK_STATUS_LABEL, toOptions } from '../../../../utils/jobWorkTracker/constants';
import pullBackColumns from './pullBackColumns';

const { Text } = Typography;
const STATUS_OPTIONS = [{ value: 'OPEN', label: 'Open (not settled)' }, { value: 'ALL', label: 'All' }, ...toOptions(PULLBACK_STATUS_LABEL)];

/** Work taken back from slow vendors to finish in-house: request → approval → goods back → settle. */
const PullBacksTab = ({ refresh, actions }) => {
  const { message } = App.useApp();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(300);
  const [status, setStatus] = useState('OPEN');
  const [vendorId, setVendorId] = useState();
  const [rows, setRows] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { listFilterOptions().then((o) => setVendors(o.vendors)).catch(() => {}); }, []);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const r = await listPullBacks({ q: debouncedSearch, status: status === 'ALL' ? undefined : status, vendorId });
        if (alive) setRows(r);
      } catch (e) { toastUnlessHandled(message, e, 'Could not load pull-backs.'); } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [debouncedSearch, status, vendorId, refresh, message]);

  const columns = useMemo(() => pullBackColumns({ onOpenJob: actions.openJob }), [actions]);

  return (
    <Card size="small">
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        When a vendor cannot finish in time, take the unfinished pieces back — in whatever state they are — and finish them in-house.
        A manager approves; goods come back over any number of trips; what never arrives goes back to the vendor or is written off.
      </Text>
      <SearchFilterBar
        searchText={searchText}
        onSearchChange={(e) => setSearchText(e.target ? e.target.value : e)}
        searchPlaceholder="Search pull-back, job, order, style, vendor"
        filters={[
          { type: 'select', key: 's', span: { lg: 5 }, props: { value: status, allowClear: false, options: STATUS_OPTIONS, onChange: setStatus } },
          { type: 'select', key: 'v', props: { placeholder: 'Vendor', value: vendorId, options: vendors, onChange: setVendorId } },
        ]}
        extra={(
          <Button type="primary" icon={<SwapOutlined />} disabled={!hasPermission('production-job-work', 'add')}
            onClick={() => actions.openPullBack({ jobId: null })}>Raise pull-back</Button>
        )}
        style={{ marginBottom: 12 }}
      />
      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1710, y: 'calc(100vh - 400px)' }}
        onRow={(r) => ({ onClick: () => actions.openPullBack({ id: r.id }), style: { cursor: 'pointer' } })}
        pagination={{ pageSize: 25, showSizeChanger: false, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="No pull-backs match." /> }}
      />
    </Card>
  );
};

export default PullBacksTab;
